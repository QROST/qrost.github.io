/* Fetch + index JSON under assets/data/. window.CHINA_AUTO_DATA */
(function () {
  'use strict';
  var BASE = 'assets/data/';
  function ver() { return window.CHINA_AUTO_DATA_VERSION || 'dev'; }

  var store = {
    manifest: null,
    cities: [], organizations: [], facilities: [], cityRoles: [], relations: [],
    clusters: [], statistics: [], media: [], institutions: [], sources: [],
    orgEnrichment: {}
  };
  var cityMap = {}, orgMap = {}, facilityMap = {}, clusterMap = {}, sourceMap = {};
  var rolesByCity = {}, orgsByCity = {}, facilitiesByCity = {}, statsByCity = {};
  var mediaByCity = {}, institutionsByCity = {};
  var instByOrg = {}, mediaByOrg = {}, childrenByParent = {}, plantCountByOrg = {};

  async function fetchJson(path) {
    var sep = path.indexOf('?') === -1 ? '?' : '&';
    var r = await fetch(path + sep + 'v=' + ver());
    if (!r.ok) throw new Error('fetch ' + path + ': ' + r.status);
    return r.json();
  }
  function arr(data, key) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return Array.isArray(data[key]) ? data[key] : [];
  }

  function indexAll() {
    cityMap = {}; orgMap = {}; facilityMap = {}; clusterMap = {}; sourceMap = {};
    rolesByCity = {}; orgsByCity = {}; facilitiesByCity = {}; statsByCity = {};
    mediaByCity = {}; institutionsByCity = {};
    instByOrg = {}; mediaByOrg = {}; childrenByParent = {}; plantCountByOrg = {};

    store.cities.forEach(function (c) { cityMap[c.id] = c; });
    store.organizations.forEach(function (o) { orgMap[o.id] = o; });
    store.facilities.forEach(function (f) { facilityMap[f.id] = f; });
    store.clusters.forEach(function (c) { clusterMap[c.id] = c; });
    store.sources.forEach(function (s) { sourceMap[s.id] = s; });

    store.cityRoles.forEach(function (r) {
      (rolesByCity[r.city_id] = rolesByCity[r.city_id] || []).push(r);
    });
    store.organizations.forEach(function (o) {
      if (o.headquarters_city_id) {
        (orgsByCity[o.headquarters_city_id] = orgsByCity[o.headquarters_city_id] || []).push(o);
      }
    });
    store.cityRoles.forEach(function (r) {
      var o = orgMap[r.entity_id];
      if (!o || !r.city_id) return;
      var list = orgsByCity[r.city_id] = orgsByCity[r.city_id] || [];
      if (list.indexOf(o) === -1) list.push(o);
    });
    store.facilities.forEach(function (f) {
      (facilitiesByCity[f.city_id] = facilitiesByCity[f.city_id] || []).push(f);
      if (f.operator_id) plantCountByOrg[f.operator_id] = (plantCountByOrg[f.operator_id] || 0) + 1;
    });
    store.statistics.forEach(function (s) {
      (statsByCity[s.city_id] = statsByCity[s.city_id] || []).push(s);
    });
    store.media.forEach(function (m) {
      var cid = m.editorial_city_id || m.registered_city_id;
      if (cid) (mediaByCity[cid] = mediaByCity[cid] || []).push(m);
      if (m.organization_id) mediaByOrg[m.organization_id] = m;
    });
    store.institutions.forEach(function (i) {
      if (i.city_id) (institutionsByCity[i.city_id] = institutionsByCity[i.city_id] || []).push(i);
      if (i.organization_id) instByOrg[i.organization_id] = i;
    });
    store.organizations.forEach(function (o) {
      var en = store.orgEnrichment[o.id] || {};
      o.enrich = en;
      if (!o.founded_year && en.founded_year) o.founded_year = en.founded_year;
      if (!o.website && en.website) o.website = en.website;
      if (!o.parent_id) return;
      (childrenByParent[o.parent_id] = childrenByParent[o.parent_id] || []).push(o);
    });
  }

  async function initCore() {
    var files = [
      ['manifest.json', 'manifest'],
      ['cities.json', 'cities'],
      ['organizations.json', 'organizations'],
      ['facilities.json', 'facilities'],
      ['city-roles.json', 'cityRoles', 'city_roles'],
      ['relations.json', 'relations'],
      ['clusters.json', 'clusters'],
      ['statistics.json', 'statistics'],
      ['media.json', 'media'],
      ['institutions.json', 'institutions'],
      ['sources.json', 'sources'],
      ['org-enrichment.json', 'orgEnrichment']
    ];
    var results = await Promise.all(files.map(function (f) { return fetchJson(BASE + f[0]); }));
    files.forEach(function (f, i) {
      var data = results[i];
      if (f[1] === 'manifest') store.manifest = data;
      else if (f[1] === 'orgEnrichment') {
        store.orgEnrichment = (data && data.enrichment) || {};
      }
      else store[f[1]] = arr(data, f[2] || f[1].replace(/([A-Z])/g, function (m) { return '_' + m.toLowerCase(); }));
    });
    indexAll();
    return store;
  }

  function statsForCity(id, year) {
    var list = statsByCity[id] || [];
    if (year == null) return list;
    return list.filter(function (s) { return s.year === year; });
  }
  function stat2025(cityId) {
    var s = statsForCity(cityId, 2025);
    return s.length ? s[0] : null;
  }
  function relationsFor(id) {
    return store.relations.filter(function (r) {
      return r.from_id === id || r.to_id === id;
    });
  }

  window.CHINA_AUTO_DATA = {
    initCore: initCore,
    getCity: function (id) { return cityMap[id] || null; },
    getOrg: function (id) { return orgMap[id] || null; },
    getFacility: function (id) { return facilityMap[id] || null; },
    getSource: function (id) { return sourceMap[id] || null; },
    getCluster: function (id) { return clusterMap[id] || null; },
    rolesForCity: function (id) { return rolesByCity[id] || []; },
    orgsForCity: function (id) { return orgsByCity[id] || []; },
    facilitiesForCity: function (id) { return facilitiesByCity[id] || []; },
    statsForCity: statsForCity,
    stat2025: stat2025,
    mediaForCity: function (id) { return mediaByCity[id] || []; },
    institutionsForCity: function (id) { return institutionsByCity[id] || []; },
    institutionForOrg: function (id) { return instByOrg[id] || null; },
    mediaForOrg: function (id) { return mediaByOrg[id] || null; },
    childrenOf: function (id) { return childrenByParent[id] || []; },
    plantCount: function (id) { return plantCountByOrg[id] || 0; },
    relationsFor: relationsFor,
    get manifest() { return store.manifest; },
    get cities() { return store.cities; },
    get organizations() { return store.organizations; },
    get facilities() { return store.facilities; },
    get cityRoles() { return store.cityRoles; },
    get relations() { return store.relations; },
    get clusters() { return store.clusters; },
    get statistics() { return store.statistics; },
    get media() { return store.media; },
    get institutions() { return store.institutions; },
    get sources() { return store.sources; }
  };
})();
