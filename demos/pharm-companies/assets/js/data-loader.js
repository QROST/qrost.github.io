/* Fetch + index all data files (manifest-driven), cache-busted by window.PHARM_DATA_VERSION.
   window.PHARM_DATA */
(function () {
  'use strict';
  var BASE = 'assets/data/';
  function ver() { return (window.PHARM_DATA_VERSION || 'dev'); }

  var store = {
    manifest: null, companies: [], sites: [], products: [], modalities: [],
    therapeuticAreas: [], countries: [], milestones: [], pairs: []
  };
  var companyMap = {}, modalityMap = {}, taMap = {}, productMap = {}, sitesByCompany = {};

  async function fetchJson(path, optional) {
    var sep = path.indexOf('?') === -1 ? '?' : '&';
    try {
      var r = await fetch(path + sep + 'v=' + ver());
      if (!r.ok) { if (optional) return null; throw new Error('fetch ' + path + ': ' + r.status); }
      return await r.json();
    } catch (e) { if (optional) return null; throw e; }
  }
  function arr(data, key) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return Array.isArray(data[key]) ? data[key] : [];
  }

  async function initCore() {
    store.manifest = await fetchJson(BASE + 'manifest.json');
    var shards = (store.manifest && store.manifest.shards) || [];

    var results = await Promise.all([
      fetchJson(BASE + 'companies.json', true),
      fetchJson(BASE + 'sites.json', true),
      fetchJson(BASE + 'modalities.json', true),
      fetchJson(BASE + 'therapeutic-areas.json', true),
      fetchJson(BASE + 'country-stats.json', true),
      fetchJson(BASE + 'breakthroughs.json', true),
      fetchJson(BASE + 'comparisons/benchmark-pairs.json', true)
    ].concat(shards.map(function (s) { return fetchJson(BASE + s.file, true); })));

    store.companies = arr(results[0], 'companies');
    store.sites = arr(results[1], 'sites');
    store.modalities = arr(results[2], 'modalities');
    store.therapeuticAreas = arr(results[3], 'therapeutic_areas');
    store.countries = arr(results[4], 'countries');
    store.milestones = arr(results[5], 'milestones');
    store.pairs = arr(results[6], 'pairs');
    store.products = [];
    for (var i = 7; i < results.length; i++) { store.products = store.products.concat(arr(results[i], 'products')); }

    store.companies.forEach(function (c) { companyMap[c.id] = c; });
    store.modalities.forEach(function (m) { modalityMap[m.id] = m; });
    store.therapeuticAreas.forEach(function (t) { taMap[t.id] = t; });
    store.products.forEach(function (p) { productMap[p.id] = p; });
    store.sites.forEach(function (s) {
      (sitesByCompany[s.company_id] = sitesByCompany[s.company_id] || []).push(s);
    });
    return store;
  }

  function productsForCompany(id) { return store.products.filter(function (p) { return p.company_id === id; }); }
  function sitesForCompany(id) { return sitesByCompany[id] || []; }
  function milestonesForCompany(id) { return store.milestones.filter(function (m) { return m.company_id === id; }); }
  function reverseMilestones(companyId) {
    // milestones where THIS company's products are the incumbent being displaced
    var pids = productsForCompany(companyId).map(function (p) { return p.id; });
    return store.milestones.filter(function (m) {
      return (m.incumbent_product_ids || []).some(function (x) { return pids.indexOf(x) !== -1; });
    });
  }

  window.PHARM_DATA = {
    initCore: initCore,
    productsForCompany: productsForCompany,
    sitesForCompany: sitesForCompany,
    milestonesForCompany: milestonesForCompany,
    reverseMilestones: reverseMilestones,
    getCompany: function (id) { return companyMap[id] || null; },
    getModality: function (id) { return modalityMap[id] || null; },
    getTA: function (id) { return taMap[id] || null; },
    getProduct: function (id) { return productMap[id] || null; },
    get manifest() { return store.manifest; },
    get companies() { return store.companies; },
    get sites() { return store.sites; },
    get products() { return store.products; },
    get modalities() { return store.modalities; },
    get therapeuticAreas() { return store.therapeuticAreas; },
    get countries() { return store.countries; },
    get milestones() { return store.milestones; },
    get pairs() { return store.pairs; }
  };
})();
