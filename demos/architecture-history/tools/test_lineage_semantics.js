#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const elements = new Map(), handlers = {};
let option;
const element = id => {
  if (!elements.has(id)) elements.set(id, { innerHTML: '', setAttribute() {} });
  return elements.get(id);
};
const context = {
  console, localStorage: { getItem: () => 'zh', setItem() {} },
  CustomEvent: function (type) { this.type = type; },
  document: {
    documentElement: { classList: { contains: () => false } },
    getElementById: element, querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
  },
  getComputedStyle: () => ({ getPropertyValue: key => key === '--cobalt' ? '#315d78' : '#ffffff' }),
  window: { addEventListener() {}, dispatchEvent() {}, echarts: { init: () => ({
    on(event, callback) { handlers[event] = callback; },
    setOption(value) { option = value; }, resize() {}, dispose() {},
  }) } },
};
vm.createContext(context);
for (const file of ['i18n.js', 'maps.js']) vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), context);
const api = context.window.ARCH_MAPS, i18n = context.window.ARCH_I18N;
const read = file => JSON.parse(fs.readFileSync(path.join(root, 'assets/data', file + '.json'), 'utf8'))[file];
const people = read('people');
const entitiesById = Object.fromEntries(people.map(person => [person.id, person]));
const relations = read('relations').filter(row =>
  ['student_of_recorded', 'documented_influence'].includes(row.relation_type) && entitiesById[row.from_id] && entitiesById[row.to_id]);
const relationIdsByPerson = new Map();
for (const row of relations) for (const id of new Set([row.from_id, row.to_id])) {
  if (!relationIdsByPerson.has(id)) relationIdsByPerson.set(id, new Set());
  relationIdsByPerson.get(id).add(row.id);
}
const opts = { entitiesById, allRelations: relations };
const series = () => option.series[0];
api.renderLineage(relations, opts);
const full = new Map(series().data.map(node => [node.id, node]));
assert.equal(full.size, relationIdsByPerson.size);
assert.equal(series().links.length, new Set(relations.map(row => row.id)).size);
for (const node of full.values()) {
  assert.equal(node.totalRelationCount, relationIdsByPerson.get(node.id).size);
  assert.equal(node.visibleRelationCount, node.totalRelationCount);
}
const ranked = [...full.values()].sort((a, b) => a.totalRelationCount - b.totalRelationCount);
assert.ok(ranked.at(-1).totalRelationCount > 5, 'current public data must exercise the old five-record cap');
for (let i = 1; i < ranked.length; i++) if (ranked[i].totalRelationCount > ranked[i - 1].totalRelationCount) {
  assert.ok(ranked[i].symbolSize > ranked[i - 1].symbolSize, 'different counts must remain distinguishable beyond five');
}
assert.equal(new Set([...full.values()].map(node => node.itemStyle.color)).size, 1);
const legend = element('lineage-size-legend').innerHTML;
for (const type of ['student_of_recorded', 'documented_influence']) {
  const selected = relations.filter(row => row.relation_type === type);
  api.renderLineage(selected, opts);
  for (const node of series().data) {
    assert.equal(node.symbolSize, full.get(node.id).symbolSize, 'type filtering must preserve size');
    assert.equal(node.totalRelationCount, full.get(node.id).totalRelationCount);
    assert.ok(node.visibleRelationCount <= node.totalRelationCount);
  }
  assert.equal(element('lineage-size-legend').innerHTML, legend);
  for (const edge of series().links) {
    assert.equal(edge.relationType, type);
    assert.equal(edge.lineStyle.type, 'dashed');
    assert.ok(option.tooltip.formatter({ dataType: 'edge', data: edge }).includes(type), 'tooltip must preserve the actual raw type');
  }
}

const entities = { a: { id: 'a', entity_type: 'person', name_en: '<A>' }, b: { id: 'b', entity_type: 'person', name_en: 'B' }, practice: { entity_type: 'practice' } };
const fixture = [];
for (const [hub, count] of [['a', 8], ['b', 6]]) for (let i = 0; i < count; i++) {
  const id = hub + i;
  entities[id] = { id, entity_type: 'person', name_en: id };
  fixture.push({ id, from_id: hub, to_id: id, relation_type: 'student_of_recorded' });
}
fixture.push(fixture[0]); // same relation ID cannot inflate counts or duplicate edges
fixture.push({ ...fixture[0], id: 'distinct-source-record', relation_type: 'documented_influence' });
fixture.push({ id: 'self', from_id: 'a', to_id: 'a', relation_type: 'documented_influence' });
fixture.push({ id: 'non-person', from_id: 'a', to_id: 'practice' });
fixture.push({ id: 'unresolved', from_id: 'a', to_id: 'missing' });
let openedPerson, openedRelation;
const fixtureOpts = { entitiesById: entities, allRelations: fixture,
  onClick: id => { openedPerson = id; }, onRelationClick: id => { openedRelation = id; } };
api.renderLineage(fixture, fixtureOpts);
const fixtureFull = new Map(series().data.map(node => [node.id, node]));
assert.equal(fixtureFull.get('a').totalRelationCount, 10);
assert.equal(fixtureFull.get('b').totalRelationCount, 6);
assert.ok(fixtureFull.get('a').symbolSize > fixtureFull.get('b').symbolSize);
assert.equal(series().links.length, 16);
api.renderLineage([fixture[0]], fixtureOpts);
const node = series().data.find(row => row.id === 'a');
assert.equal(node.visibleRelationCount, 1);
assert.equal(node.totalRelationCount, 10);
assert.equal(node.symbolSize, fixtureFull.get('a').symbolSize);
handlers.click({ dataType: 'node', data: node });
handlers.click({ dataType: 'edge', data: series().links[0] });
assert.equal(openedPerson, 'a'); assert.equal(openedRelation, fixture[0].id);
for (const language of ['zh', 'en']) {
  i18n.setLanguage(language); api.renderLineage([fixture[0]], fixtureOpts);
  const tooltip = option.tooltip.formatter({ dataType: 'node', data: node });
  assert.ok(tooltip.includes(i18n.t('lineageTotalCount', { count: 10 })));
  assert.ok(tooltip.includes(i18n.t('lineageVisibleCount', { count: 1 })));
  assert.ok(tooltip.includes(i18n.t('lineageCountMeaning')));
  assert.ok(!tooltip.includes('<A>'));
  assert.ok(element('lineage-size-legend').innerHTML.includes(i18n.t('lineageSizeNote')));
}
api.renderLineage([], fixtureOpts);
assert.equal(series().data.length, 0);
assert.ok(element('lineage-size-legend').innerHTML.includes('data-relation-count="10"'), 'empty search must retain the complete scale');
api.renderLineage([], { entitiesById: {}, allRelations: [] });
assert.ok(!element('lineage-size-legend').innerHTML.includes('data-relation-count='));
console.log(`PASS lineage semantics: ${relations.length} candidate records, ${full.size} people, maximum ${ranked.at(-1).totalRelationCount}; fixed scales, ID deduplication, raw types, evidence navigation and bilingual counts`);
