/* Fetch + index the static data layer (manifest-driven), cache-busted by
   window.SHELTERCATS_DATA_VERSION. window.SHELTERCATS_DATA */
(function () {
  'use strict';
  var BASE = 'assets/data/';
  function ver() { return (window.SHELTERCATS_DATA_VERSION || 'dev'); }

  var store = {
    manifest: null, enums: {}, shelters: [], cats: [], failedShards: []
  };
  var shelterById = {}, catById = {}, catsByShelter = {};
  var pending = null;

  async function fetchJson(path) {
    var sep = path.indexOf('?') === -1 ? '?' : '&';
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 10000);
    try {
      var r = await fetch(path + sep + 'v=' + ver(), { signal: controller.signal });
      if (!r.ok) throw new Error('fetch ' + path + ': ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }
  function arr(d, k) {
    var rows = Array.isArray(d) ? d : d && d[k];
    if (!Array.isArray(rows)) throw new Error('Invalid ' + k + ' table');
    return rows;
  }
  function indexRows(rows, expected, label) {
    if (!Number.isInteger(expected) || rows.length !== expected) throw new Error(label + ' count mismatch');
    var index = Object.create(null);
    rows.forEach(function (row) {
      if (!row || typeof row.id !== 'string' || !row.id || index[row.id]) throw new Error(label + ' invalid or duplicate ID');
      index[row.id] = row;
    });
    return index;
  }

  async function load() {
    var manifest = await fetchJson(BASE + 'manifest.json');
    var shards = manifest && manifest.shards;
    if (!Array.isArray(shards) || !Number.isInteger(manifest.total_cats) ||
        (ver() !== 'dev' && manifest.data_version !== ver())) throw new Error('Invalid or stale manifest');
    var files = new Set();
    shards.forEach(function (s) {
      if (!s || !/^cats\/[a-z_]+\.json$/.test(s.file) || files.has(s.file) || !Number.isInteger(s.count) || s.count < 0) throw new Error('Invalid shard manifest');
      files.add(s.file);
    });
    if (shards.reduce(function (n, s) { return n + s.count; }, 0) !== manifest.total_cats) throw new Error('Shard total mismatch');
    var head = await Promise.all([
      fetchJson(BASE + 'enums.json'),
      fetchJson(BASE + 'shelters.json')
    ]);
    var enums = head[0], shelters = arr(head[1], 'shelters');
    if (!enums || !Array.isArray(enums.regions_live) || !enums.status || !enums.colors) throw new Error('Invalid enums');
    var nextShelters = indexRows(shelters, manifest.total_shelters, 'shelters');
    var shardData = await Promise.allSettled(shards.map(async function (s) {
      var rows = arr(await fetchJson(BASE + s.file), 'cats');
      indexRows(rows, s.count, s.file);
      rows.forEach(function (cat) {
        if (!nextShelters[cat.shelter_id] || !enums.status[cat.status]) throw new Error('Invalid cat reference or status');
      });
      return rows;
    }));
    var cats = [], failed = [];
    shardData.forEach(function (result, i) {
      if (result.status === 'fulfilled') cats = cats.concat(result.value);
      else failed.push(shards[i]);
    });
    var nextCats = indexRows(cats, cats.length, 'cats'), nextByShelter = Object.create(null);
    cats.forEach(function (c) {
      (nextByShelter[c.shelter_id] = nextByShelter[c.shelter_id] || []).push(c);
    });
    // Commit validated headers and healthy shards together. Failed shards remain
    // explicit; they are never represented as a successful empty catalog.
    store = { manifest: manifest, enums: enums, shelters: shelters, cats: cats, failedShards: failed };
    shelterById = nextShelters; catById = nextCats; catsByShelter = nextByShelter;
    return store;
  }
  function init() {
    if (!pending) pending = load().finally(function () { pending = null; });
    return pending;
  }

  window.SHELTERCATS_DATA = {
    init: init,
    get manifest() { return store.manifest; },
    get enums() { return store.enums; },
    get cats() { return store.cats; },
    get failedShards() { return store.failedShards; },
    get shelters() { return store.shelters; },
    getShelter: function (id) { return shelterById[id] || null; },
    getCat: function (id) { return catById[id] || null; },
    catsForShelter: function (id) { return catsByShelter[id] || []; }
  };
})();
