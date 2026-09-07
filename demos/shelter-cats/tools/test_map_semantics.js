#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const elements = new Map();
let option;
const element = id => {
  if (!elements.has(id)) elements.set(id, { innerHTML: '', setAttribute() {} });
  return elements.get(id);
};
const context = {
  console, localStorage: { getItem: () => 'en', setItem() {} },
  document: { documentElement: { setAttribute() {} }, getElementById: element, querySelectorAll: () => [] },
  getComputedStyle: () => ({ getPropertyValue: () => '#336699' }),
  window: { addEventListener() {}, WORLD_GEO: {}, echarts: { registerMap() {}, init: () => ({ on() {}, resize() {}, setOption(value) { option = value; } }) } },
};
vm.createContext(context);
for (const file of ['i18n.js', 'map.js']) vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), context);
const api = context.window.SHELTERCATS_MAP, i18n = context.window.SHELTERCATS_I18N;
const read = file => JSON.parse(fs.readFileSync(path.join(root, 'assets/data', file), 'utf8'));
const shelters = read('shelters.json').shelters;
const cats = read('manifest.json').shards.flatMap(shard => read(shard.file).cats);
const count = (id, all) => cats.filter(cat => cat.shelter_id === id && (all || !['adopted', 'removed'].includes(cat.status))).length;
const max = Math.max(...shelters.map(shelter => count(shelter.id, true)));
const opts = { shelters, sizeMax: max, includeAdopted: true, countFor: id => count(id, true) };
api.render(opts);
const points = () => option.series[0].data;
const full = points(), sizes = Object.fromEntries(full.map(point => [point._sid, point.symbolSize]));
const ranked = full.slice().sort((a, b) => a._n - b._n);
for (let i = 1; i < ranked.length; i++) {
  if (ranked[i]._n > ranked[i - 1]._n) assert.ok(ranked[i].symbolSize > ranked[i - 1].symbolSize, 'more cached records must have a larger circle');
}
assert.ok(sizes.austin_tx > sizes.zaragoza_es && sizes.zaragoza_es > sizes.sonoma_ca, '66, 64 and 61 records must not share the old 36px cap');
const legendValues = html => Array.from(html.matchAll(/data-legend-value="([^"]+)"/g), match => +match[1]);
const samples = legendValues(element('map-legend').innerHTML);
api.render({ ...opts, shelters: shelters.slice(0, 1) });
assert.equal(points()[0].symbolSize, sizes[points()[0]._sid]);
assert.deepEqual(legendValues(element('map-legend').innerHTML), samples, 'filtering does not rescale legend');
api.render({ ...opts, includeAdopted: false, countFor: id => count(id, false) });
assert.deepEqual(legendValues(element('map-legend').innerHTML), samples, 'status switch changes counts without rescaling');
for (const point of points()) {
  assert.ok(point.symbolSize <= sizes[point._sid]);
  assert.equal(point._n, count(point._sid, false));
}
for (let language = 0; language < 2; language++) {
  for (const includeAdopted of [true, false]) {
    api.render({ ...opts, includeAdopted });
    const html = element('map-legend').innerHTML;
    assert.ok(html.includes(i18n.t('mapSizeLegend')));
    assert.ok(html.includes(i18n.t(includeAdopted ? 'mapCountAll' : 'mapCountActive')));
  }
  assert.ok(!/highlight|高亮/.test(i18n.t('mapSub')));
  i18n.toggleLang();
}
api.render({ shelters: [], sizeMax: 0 });
assert.deepEqual(legendValues(element('map-legend').innerHTML), [0]);
console.log('PASS shelter map: current-data ordering, stable status/filter scale, truthful bilingual legends and empty snapshot');
