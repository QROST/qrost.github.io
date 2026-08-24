/* Fetch + index the static data layer (manifest-driven), cache-busted by window.PHARM_DATA_VERSION.
   Product catalog shards are deliberately lazy: initCore() never requests them.
   window.PHARM_DATA */
(function () {
  'use strict';
  var BASE = 'assets/data/';
  function ver() { return (window.PHARM_DATA_VERSION || 'dev'); }

  var store = {
    manifest: null, companies: [], sites: [], products: [], modalities: [],
    therapeuticAreas: [], countries: [], milestones: [], pairs: [], groups: [], policies: [], deals: []
  };
  var companyMap = {}, modalityMap = {}, taMap = {}, productMap = {}, sitesByCompany = {};
  var groupMap = {}, childrenByParent = {}, companiesByGroup = {};
  var policyMap = {}, policiesByCompany = {};
  var dealMap = {}, dealsByCompany = {};
  var corePromise = null, productsPromise = null, productsLoaded = false;

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

  async function initCoreImpl() {
    store.manifest = await fetchJson(BASE + 'manifest.json');

    var results = await Promise.all([
      fetchJson(BASE + 'companies.json', true),
      fetchJson(BASE + 'sites.json', true),
      fetchJson(BASE + 'modalities.json', true),
      fetchJson(BASE + 'therapeutic-areas.json', true),
      fetchJson(BASE + 'country-stats.json', true),
      fetchJson(BASE + 'breakthroughs.json', true),
      fetchJson(BASE + 'comparisons/benchmark-pairs.json', true),
      fetchJson(BASE + 'groups.json', true),
      fetchJson(BASE + 'policies.json', true),
      fetchJson(BASE + 'deals.json', true)
    ]);

    store.companies = arr(results[0], 'companies');
    store.sites = arr(results[1], 'sites');
    store.modalities = arr(results[2], 'modalities');
    store.therapeuticAreas = arr(results[3], 'therapeutic_areas');
    store.countries = arr(results[4], 'countries');
    store.milestones = arr(results[5], 'milestones');
    store.pairs = arr(results[6], 'pairs');
    store.groups = arr(results[7], 'groups');
    store.policies = arr(results[8], 'policies');
    store.deals = arr(results[9], 'deals');

    store.groups.forEach(function (g) { groupMap[g.id] = g; });
    store.companies.forEach(function (c) {
      companyMap[c.id] = c;
      if (c.parent_id) (childrenByParent[c.parent_id] = childrenByParent[c.parent_id] || []).push(c);
      if (c.group_id) (companiesByGroup[c.group_id] = companiesByGroup[c.group_id] || []).push(c);
    });
    store.modalities.forEach(function (m) { modalityMap[m.id] = m; });
    store.therapeuticAreas.forEach(function (t) { taMap[t.id] = t; });
    store.sites.forEach(function (s) {
      (sitesByCompany[s.company_id] = sitesByCompany[s.company_id] || []).push(s);
    });
    // policy index + reverse (company -> policies that affect it)
    store.policies.forEach(function (p) {
      policyMap[p.id] = p;
      (p.affected_companies || []).forEach(function (a) {
        if (!a || !a.company_id) return;
        (policiesByCompany[a.company_id] = policiesByCompany[a.company_id] || []).push({ policy: p, effect: a.effect, note_zh: a.note_zh, note_en: a.note_en });
      });
    });
    // deal index + reverse (company -> deals it is a party to)
    store.deals.forEach(function (d) {
      dealMap[d.id] = d;
      var seen = {};
      (d.parties || []).forEach(function (p) {
        if (!p || !p.company_id || seen[p.company_id]) return;
        seen[p.company_id] = 1;
        (dealsByCompany[p.company_id] = dealsByCompany[p.company_id] || []).push(d);
      });
    });
    return store;
  }

  function initCore() {
    if (!corePromise) corePromise = initCoreImpl();
    return corePromise;
  }

  async function loadProductsImpl() {
    await initCore();
    var shards = (store.manifest && store.manifest.shards) || [];
    var settled = await Promise.allSettled(shards.map(function (s) { return fetchJson(BASE + s.file); }));
    var failed = [];
    settled.forEach(function (result, index) {
      if (result.status === 'rejected') failed.push(shards[index] && shards[index].file || ('shard ' + (index + 1)));
    });
    // Product state is atomic: never expose an incomplete catalog as a
    // successful load. The rejected promise is cleared by loadProducts(), so
    // a later user retry fetches every shard again from a clean state.
    if (failed.length) throw new Error('product catalog failed to load: ' + failed.join(', '));
    var nextProducts = [];
    settled.forEach(function (result) { nextProducts = nextProducts.concat(arr(result.value, 'products')); });
    var expected = store.manifest && store.manifest.total_products;
    if (typeof expected === 'number' && nextProducts.length !== expected) {
      throw new Error('product catalog count mismatch: expected ' + expected + ', got ' + nextProducts.length);
    }
    var nextProductMap = {};
    nextProducts.forEach(function (p) { nextProductMap[p.id] = p; });
    store.products = nextProducts;
    productMap = nextProductMap;
    productsLoaded = true;
    return store.products;
  }

  function loadProducts() {
    if (!productsPromise) productsPromise = loadProductsImpl().catch(function (error) {
      productsPromise = null;
      throw error;
    });
    return productsPromise;
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

  // ---- corporate-group / ownership helpers ----
  function getGroup(id) { return groupMap[id] || null; }
  function companiesInGroup(gid) { return companiesByGroup[gid] || []; }
  function subsidiariesOf(id) { return childrenByParent[id] || []; }      // direct children (parent_id === id)
  function parentOf(id) { var c = companyMap[id]; return (c && c.parent_id && companyMap[c.parent_id]) || null; }
  function groupSiblings(id) {                                            // same group, excluding self + own children
    var c = companyMap[id]; if (!c || !c.group_id) return [];
    return (companiesByGroup[c.group_id] || []).filter(function (x) { return x.id !== id && x.parent_id !== id; });
  }

  // ---- China-policy helpers ----
  function getPolicy(id) { return policyMap[id] || null; }
  function policiesForCompany(id) { return policiesByCompany[id] || []; }   // [{policy, effect, note_zh, note_en}]

  // ---- deal helpers ----
  function getDeal(id) { return dealMap[id] || null; }
  function dealsForCompany(id) { return dealsByCompany[id] || []; }

  window.PHARM_DATA = {
    initCore: initCore,
    loadProducts: loadProducts,
    productsForCompany: productsForCompany,
    sitesForCompany: sitesForCompany,
    milestonesForCompany: milestonesForCompany,
    reverseMilestones: reverseMilestones,
    getGroup: getGroup,
    companiesInGroup: companiesInGroup,
    subsidiariesOf: subsidiariesOf,
    parentOf: parentOf,
    groupSiblings: groupSiblings,
    getPolicy: getPolicy,
    policiesForCompany: policiesForCompany,
    getDeal: getDeal,
    dealsForCompany: dealsForCompany,
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
    get pairs() { return store.pairs; },
    get groups() { return store.groups; },
    get policies() { return store.policies; },
    get deals() { return store.deals; },
    get productsLoaded() { return productsLoaded; }
  };
})();
