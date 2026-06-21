/* Fetch + index the static data layer (manifest-driven), cache-busted by
   window.SHELTERCATS_DATA_VERSION. window.SHELTERCATS_DATA */
(function () {
  'use strict';
  var BASE = 'assets/data/';
  function ver() { return (window.SHELTERCATS_DATA_VERSION || 'dev'); }

  var store = {
    manifest: null, enums: {}, shelters: [], cats: []
  };
  var shelterById = {}, catById = {}, catsByShelter = {};

  async function fetchJson(path, optional) {
    var sep = path.indexOf('?') === -1 ? '?' : '&';
    try {
      var r = await fetch(path + sep + 'v=' + ver());
      if (!r.ok) { if (optional) return null; throw new Error('fetch ' + path + ': ' + r.status); }
      return await r.json();
    } catch (e) { if (optional) return null; throw e; }
  }
  function arr(d, k) { if (!d) return []; if (Array.isArray(d)) return d; return Array.isArray(d[k]) ? d[k] : []; }

  async function init() {
    store.manifest = await fetchJson(BASE + 'manifest.json');
    var shards = (store.manifest && store.manifest.shards) || [];
    var head = await Promise.all([
      fetchJson(BASE + 'enums.json', true),
      fetchJson(BASE + 'shelters.json', true)
    ]);
    store.enums = head[0] || {};
    store.shelters = arr(head[1], 'shelters');

    var shardData = await Promise.all(shards.map(function (s) { return fetchJson(BASE + s.file, true); }));
    store.cats = [];
    shardData.forEach(function (d) { store.cats = store.cats.concat(arr(d, 'cats')); });

    store.shelters.forEach(function (s) { shelterById[s.id] = s; });
    store.cats.forEach(function (c) {
      catById[c.id] = c;
      (catsByShelter[c.shelter_id] = catsByShelter[c.shelter_id] || []).push(c);
    });
    return store;
  }

  window.SHELTERCATS_DATA = {
    init: init,
    get manifest() { return store.manifest; },
    get enums() { return store.enums; },
    get cats() { return store.cats; },
    get shelters() { return store.shelters; },
    getShelter: function (id) { return shelterById[id] || null; },
    getCat: function (id) { return catById[id] || null; },
    catsForShelter: function (id) { return catsByShelter[id] || []; }
  };
})();
