#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'assets', 'data');
const PLANT_TYPES = new Set(['vehicle_plant', 'engine_plant', 'battery_plant', 'parts_plant']);
const MANUFACTURING_ROLES = new Set(['factory', 'supplier_plant']);

function table(file, key) {
  return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'))[key];
}

const cities = table('cities.json', 'cities');
const organizations = table('organizations.json', 'organizations');
const facilities = table('facilities.json', 'facilities');
const roles = table('city-roles.json', 'city_roles');
const relations = table('relations.json', 'relations');
const clusters = table('clusters.json', 'clusters');
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'schema.json'), 'utf8'));
assert.deepEqual(
  [...PLANT_TYPES].sort(),
  schema.enums.facility_type.filter((x) => x.endsWith('_plant')).sort(),
  'graph plant types must stay bound to every schema facility type ending in _plant',
);
const cityById = Object.fromEntries(cities.map((x) => [x.id, x]));
const orgById = Object.fromEntries(organizations.map((x) => [x.id, x]));
const facilityById = Object.fromEntries(facilities.map((x) => [x.id, x]));
const clusterById = Object.fromEntries(clusters.map((x) => [x.id, x]));
const rolesByCity = {};
const facilitiesByCity = {};
const orgsByCity = {};
const childrenByParent = {};

roles.forEach((r) => (rolesByCity[r.city_id] ||= []).push(r));
facilities.forEach((f) => (facilitiesByCity[f.city_id] ||= []).push(f));
organizations.forEach((o) => {
  if (o.headquarters_city_id) (orgsByCity[o.headquarters_city_id] ||= []).push(o);
  if (o.parent_id) (childrenByParent[o.parent_id] ||= []).push(o);
});
roles.forEach((r) => {
  const org = orgById[r.entity_id];
  if (!org) return;
  const list = (orgsByCity[r.city_id] ||= []);
  if (!list.some((x) => x.id === org.id)) list.push(org);
});

function plantFacilitiesForCity(cityId) {
  return (facilitiesByCity[cityId] || []).filter((f) => PLANT_TYPES.has(f.facility_type));
}

function manufacturingRolesForCity(cityId) {
  return (rolesByCity[cityId] || []).filter((r) => MANUFACTURING_ROLES.has(r.role_type));
}

function manufacturingCountForCity(cityId) {
  const plants = plantFacilitiesForCity(cityId);
  const explicitOperators = new Set(plants.map((f) => f.operator_id).filter(Boolean));
  return plants.length + manufacturingRolesForCity(cityId).filter((r) => !explicitOperators.has(r.entity_id)).length;
}

function render(layers, width = 1280, resizeWidth = null) {
  let option = null;
  let resizeHandler = null;
  const elements = {
    'cluster-graph': {},
    'cluster-graph-head': { textContent: '' },
    'cluster-legend': { innerHTML: '' },
  };
  const chart = {
    setOption(next) { option = next; },
    getOption() { return option || {}; },
    dispose() {}, off() {}, on() {}, resize() {},
  };
  const i18n = {
    t(key) { return key === 'candidate' ? '候选' : key; },
    name(row) { return row.display_name_zh || row.name_zh || row.legal_name_zh || row.id; },
    pick(zh, en) { return zh || en || ''; },
    enumLabel(_kind, value) { return value; },
    isEn() { return false; },
  };
  const context = {
    console,
    document: {
      documentElement: { classList: { contains() { return false; } } },
      getElementById(id) { return elements[id] || null; },
    },
    getComputedStyle() {
      return { getPropertyValue() { return '#64748b'; } };
    },
    requestAnimationFrame(fn) { fn(); },
    setTimeout, clearTimeout,
    window: {
      innerWidth: width,
      CHINA_AUTO_I18N: i18n,
      echarts: { init() { return chart; } },
      addEventListener(type, fn) { if (type === 'resize') resizeHandler = fn; },
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, 'assets', 'js', 'charts.js'), 'utf8'),
    vm.createContext(context),
    { filename: 'charts.js' },
  );
  context.window.CHINA_AUTO_CHARTS.renderClusterGraph({
    cities, organizations, facilities, relations, clusters, layers,
    getCluster(id) { return clusterById[id] || null; },
    getStat() { return null; },
    getOrg(id) { return orgById[id] || null; },
    getFacility(id) { return facilityById[id] || null; },
    getCity(id) { return cityById[id] || null; },
    childrenOf(id) { return childrenByParent[id] || []; },
    orgsForCity(id) { return orgsByCity[id] || []; },
    facilitiesForCity: plantFacilitiesForCity,
    manufacturingRolesForCity,
    manufacturingCountForCity,
    mediaForCity() { return []; },
    institutionsForCity() { return []; },
  });
  if (resizeWidth != null) {
    assert(resizeHandler, 'graph did not register a responsive resize handler');
    context.window.innerWidth = resizeWidth;
    resizeHandler();
  }
  assert(option && option.series && option.series[0], 'graph did not render a series');
  return option.series[0];
}

function graphLinks(series) {
  return series.links || series.edges || [];
}

const full = render({ hq: true, brands: true, plants: true });
const nodes = full.data;
const links = graphLinks(full);
const facilityNodes = nodes.filter((n) => String(n.id).startsWith('fac:'));
const cityFacilityLinks = links.filter((l) => !String(l.source).includes(':') && String(l.target).startsWith('fac:'));
const roleLinks = links.filter((l) => !String(l.source).includes(':') && String(l.target).startsWith('org:') && MANUFACTURING_ROLES.has(l._rel));
const expectedPlantCount = facilities.filter((f) => PLANT_TYPES.has(f.facility_type)).length;
const expectedRoleEdges = roles.filter((r) => MANUFACTURING_ROLES.has(r.role_type)).filter((r) => {
  return !plantFacilitiesForCity(r.city_id).some((f) => f.operator_id === r.entity_id);
}).map((r) => `${r.city_id}|${r.entity_id}|${r.role_type}`).sort();

assert.equal(facilityNodes.length, expectedPlantCount, 'every explicit manufacturing facility belongs in the plant layer');
assert.equal(cityFacilityLinks.length, expectedPlantCount, 'every explicit manufacturing facility needs one city edge');
assert.equal(roleLinks.length, expectedRoleEdges.length, 'all facility-unmatched manufacturing roles must be projected');
assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length, 'graph node ids must be unique');

const nonPlantIds = facilities.filter((f) => !PLANT_TYPES.has(f.facility_type)).map((f) => `fac:${f.id}`);
nonPlantIds.forEach((id) => assert(!nodes.some((n) => n.id === id), `${id} must not be presented as a plant`));
roleLinks.forEach((l) => assert(String(l._tip).includes('候选'), `${l.source} -> ${l.target} lacks candidate disclosure`));
const actualRoleEdges = Array.from(
  roleLinks,
  (l) => `${l.source}|${String(l.target).slice(4)}|${l._rel}`,
).sort();
assert.equal(new Set(actualRoleEdges).size, actualRoleEdges.length, 'manufacturing-role edges must be unique');
assert.deepEqual(actualRoleEdges, expectedRoleEdges, 'rendered manufacturing-role edge set differs from source data');
facilityNodes.filter((n) => facilityById[n._rawId].confidence <= 0.5)
  .forEach((n) => assert(String(n._tip).includes('候选'), `${n.id} lacks candidate disclosure`));
cityFacilityLinks.filter((l) => facilityById[String(l.target).slice(4)].confidence <= 0.5)
  .forEach((l) => assert(String(l._tip).includes('候选'), `${l.source} -> ${l.target} lacks candidate disclosure`));
assert(cityFacilityLinks.every((l) => l._rel === 'located_in' && l.lineStyle.type === 'solid'), 'cataloged plant location edges must be solid');
assert(roleLinks.every((l) => l.lineStyle.type === 'dotted'), 'candidate manufacturing-role edges must be dotted');

function representedManufacturing(cityId) {
  const out = new Set();
  links.filter((l) => l.source === cityId).forEach((l) => {
    const target = String(l.target);
    if (target.startsWith('org:') && MANUFACTURING_ROLES.has(l._rel)) out.add(target.slice(4));
    if (target.startsWith('fac:')) {
      const facility = facilityById[target.slice(4)];
      out.add(facility.operator_id || target);
    }
  });
  return out;
}

for (const cityId of ['chengdu', 'changsha', 'tianjin', 'hefei', 'ningbo']) {
  const expectedOperators = new Set(plantFacilitiesForCity(cityId).map((f) => f.operator_id).filter(Boolean));
  manufacturingRolesForCity(cityId).forEach((r) => expectedOperators.add(r.entity_id));
  const expectedSites = plantFacilitiesForCity(cityId).length
    + manufacturingRolesForCity(cityId).filter((r) => !plantFacilitiesForCity(cityId).some((f) => f.operator_id === r.entity_id)).length;
  assert.equal(representedManufacturing(cityId).size, expectedOperators.size, `${cityId} manufacturer coverage is incomplete`);
  assert.equal(manufacturingCountForCity(cityId), expectedSites, `${cityId} public site count disagrees with graph coverage`);
}

const byd = nodes.find((n) => n.id === 'org:byd');
assert(byd && byd._clusterIds.includes('northwest'), 'BYD must join the Xi\'an production cluster focus');
assert(byd._clusterIds.includes('yangtze-river-delta'), 'BYD must join its Hefei/Changzhou production cluster focus');

const mobile = render({ hq: true, brands: true, plants: true }, 390);
assert(mobile.data.filter((n) => n._kind !== 'city').every((n) => n.label.show === false), 'narrow graph must suppress non-city labels');
assert(mobile.data.filter((n) => n._kind === 'city').every((n) => n.label.show === true), 'city labels must remain visible');
const resizedMobile = render({ hq: true, brands: true, plants: true }, 1280, 390);
assert(resizedMobile.data.filter((n) => n._kind !== 'city').every((n) => n.label.show === false), 'desktop-to-mobile resize must rebuild narrow labels');

const withoutPlants = render({ hq: true, brands: true, plants: false });
assert(!withoutPlants.data.some((n) => String(n.id).startsWith('fac:')), 'plant-off must remove facility nodes');
assert(!graphLinks(withoutPlants).some((l) => MANUFACTURING_ROLES.has(l._rel)), 'plant-off must remove manufacturing-role edges');

console.log(`test_cluster_graph: OK (${expectedPlantCount} plants + ${expectedRoleEdges.length} candidate manufacturing links; ${nodes.length} nodes / ${links.length} links)`);
