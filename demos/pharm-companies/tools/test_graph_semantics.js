#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, 'assets/data', file), 'utf8'));
const options = new Map(), instances = new Map();
const context = {
  console,
  localStorage: { getItem: () => 'en', setItem() {} },
  document: { documentElement: { setAttribute() {} }, querySelectorAll: () => [], getElementById: () => null },
  getComputedStyle: () => ({ getPropertyValue: () => '#64748b' }),
  window: { addEventListener() {}, echarts: {
    getInstanceByDom: element => instances.get(element),
    init: element => {
      const instance = { on() {}, off() {}, resize() {}, setOption: value => options.set(element, value) };
      instances.set(element, instance); return instance;
    },
  } },
};
vm.createContext(context);
for (const file of ['i18n.js', 'groups-graph.js', 'deals-graph.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), context);
}
const I = context.window.PHARM_I18N;
const groupsApi = context.window.GROUPS_GRAPH, dealsApi = context.window.DEALS_GRAPH;
const companies = read('companies.json').companies, groups = read('groups.json').groups, deals = read('deals.json').deals;
const companyById = Object.fromEntries(companies.map(company => [company.id, company]));
const groupById = Object.fromEntries(groups.map(group => [group.id, group]));
const getCompany = id => companyById[id] || null;
const groupElement = {}, roleLegend = { innerHTML: '' };
const groupOpts = { companies, groups, isEn: true, getCompany, getGroup: id => groupById[id], i18n: I, roleLegend };
const groupColors = () => Object.fromEntries(options.get(groupElement).series[0].data.map(node => [
  node._cid, options.get(groupElement).series[0].categories[node.category].itemStyle.color,
]));
groupsApi.render(groupElement, groupOpts);
const baseline = groupColors();
const fullLegend = Array.from(options.get(groupElement).legend[0].data);
assert.equal(new Set(Object.values(baseline)).size, fullLegend.length, 'current groups have distinct color values beyond the base palette');
for (const group of groups) {
  groupsApi.render(groupElement, { ...groupOpts, filterGroupId: group.id });
  assert.deepEqual(Array.from(options.get(groupElement).legend[0].data), fullLegend, 'filtering retains the full group legend');
  for (const [id, color] of Object.entries(groupColors())) assert.equal(color, baseline[id], 'group colors survive filtering');
}
groupsApi.render(groupElement, { ...groupOpts, groups: groups.slice().reverse(), companies: companies.slice().reverse() });
assert.deepEqual(groupColors(), baseline, 'catalog order does not alter ID colors');
for (const lang of ['zh', 'en']) {
  I.setLang(lang);
  groupsApi.render(groupElement, { ...groupOpts, isEn: lang === 'en' });
  assert.deepEqual(groupColors(), baseline, 'language does not alter group colors');
  assert.ok(roleLegend.innerHTML.includes(I.t('grpSizeNote')));
  for (const node of options.get(groupElement).series[0].data) {
    const role = companyById[node._cid].group_role;
    const legendRole = ['group-holdco', 'flagship-listco'].includes(role) ? role : 'other';
    const sample = roleLegend.innerHTML.match(new RegExp('data-group-role="' + legendRole + '"[^]*?width:([0-9]+)px'));
    assert.ok(sample, 'every role has a size legend');
    assert.equal(node.symbolSize, Number(sample[1]), 'role legend matches actual marker size');
  }
}

// Independently count retained event IDs and their distinct catalog participants.
function expectedNetwork(type) {
  const selected = deals.filter(deal => !type || deal.deal_type === type);
  const shown = selected.filter(deal => new Set(deal.parties.filter(party => getCompany(party.company_id)).map(party => party.company_id)).size >= 2);
  const counts = {};
  for (const company of companies) {
    const n = shown.filter(deal => deal.parties.some(party => party.company_id === company.id)).length;
    if (n) counts[company.id] = n;
  }
  return { selected, shown, counts };
}
for (const type of ['', ...new Set(deals.map(deal => deal.deal_type))]) {
  const actual = dealsApi.buildNetwork(deals, getCompany, type), expected = expectedNetwork(type);
  assert.equal(actual.totalDeals, deals.length);
  assert.equal(actual.matchedDeals, expected.selected.length);
  assert.equal(actual.drawableDeals, expected.shown.length);
  assert.deepEqual({ ...actual.dealCounts }, expected.counts, 'current per-company counts retain independent deal IDs');
}
const fixtureCompanies = { a: { id: 'a', region: 'europe' }, b: { id: 'b', region: 'japan' }, c: { id: 'c', region: 'greater_china' } };
const fixtureLookup = id => fixtureCompanies[id] || null;
const triple = { id: 'triple', deal_type: 'collaboration', total_usd_m: 12, headline_en: 'Three-party fixture', headline_zh: '三方合成记录', parties: ['a', 'b', 'c', 'a'].map(company_id => ({ company_id })) };
const double = { id: 'double', deal_type: 'license_out', parties: ['a', 'b'].map(company_id => ({ company_id })) };
const unresolved = { id: 'unresolved', deal_type: 'equity_stake', parties: [{ company_id: 'a' }, { company_id: 'outside' }] };
const fixture = [triple, double, unresolved, triple];
const network = dealsApi.buildNetwork(fixture, fixtureLookup, '');
assert.equal(network.totalDeals, 3, 'duplicate event IDs count once');
assert.equal(network.matchedDeals, 3);
assert.equal(network.drawableDeals, 2);
assert.equal(network.edges.length, 4, 'one three-way event makes three links; the second event makes one');
assert.deepEqual({ ...network.dealCounts }, { a: 2, b: 2, c: 1 }, 'repeated parties do not inflate participation counts');
const tripleOnly = dealsApi.buildNetwork(fixture, fixtureLookup, 'collaboration');
assert.deepEqual({ ...tripleOnly.dealCounts }, { a: 1, b: 1, c: 1 });
const noDrawing = dealsApi.buildNetwork(fixture, fixtureLookup, 'equity_stake');
assert.equal(noDrawing.matchedDeals, 1); assert.equal(noDrawing.drawableDeals, 0); assert.equal(noDrawing.nodeIds.length, 0);
const noMatch = dealsApi.buildNetwork(fixture, fixtureLookup, 'jv');
assert.equal(noMatch.matchedDeals, 0); assert.equal(noMatch.drawableDeals, 0);
const dealElement = {};
for (const lang of ['zh', 'en']) {
  I.setLang(lang);
  dealsApi.render(dealElement, { network, getCompany: fixtureLookup, isEn: lang === 'en', i18n: I });
  const option = options.get(dealElement);
  for (const node of option.series[0].data) {
    assert.equal(node.value, network.dealCounts[node._cid]);
    assert.ok(option.tooltip.formatter({ dataType: 'node', data: node, name: node.name }).includes(String(node.value)));
  }
  const link = option.series[0].links.find(link => link._deal.id === 'triple');
  assert.ok(option.tooltip.formatter({ dataType: 'edge', data: link }).includes(I.t('dealTotal')), 'total carries the potential/milestone label');
}
const before = options.get(dealElement).series[0];
const changedAmount = fixture.map(deal => ({ ...deal, total_usd_m: 9999 }));
dealsApi.render(dealElement, { deals: changedAmount, getCompany: fixtureLookup, isEn: true, i18n: I });
const after = options.get(dealElement).series[0];
assert.deepEqual(Array.from(after.data, node => node.symbolSize), Array.from(before.data, node => node.symbolSize), 'amount does not determine node size');
assert.deepEqual(Array.from(after.links, link => ({ ...link.lineStyle })), Array.from(before.links, link => ({ ...link.lineStyle })), 'amount does not determine line style');
for (const link of after.links) {
  const style = dealsApi.styleForType(link._deal.deal_type);
  assert.equal(link.lineStyle.color, style.color); assert.equal(link.lineStyle.type, style.type); assert.equal(link.lineStyle.width, style.width);
}
const all = expectedNetwork(''), ma = expectedNetwork('m_and_a');
console.log(`PASS pharma graphs: ${fullLegend.length} stable group colors; role legends; catalog ${deals.length}, drawable ${all.shown.length}, M&A ${ma.selected.length}/${ma.shown.length}; independent multi-party counts and typed amount/line semantics`);
