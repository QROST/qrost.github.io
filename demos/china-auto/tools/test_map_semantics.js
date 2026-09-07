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
const chart = { on() {}, resize() {}, setOption(value) { option = value; } };
const context = {
  console, localStorage: { getItem: () => 'zh', setItem() {} },
  document: { documentElement: { setAttribute() {} }, getElementById: element, querySelectorAll: () => [] },
  getComputedStyle: () => ({ getPropertyValue: () => '#336699' }),
  window: { addEventListener() {}, CHINA_GEO: {}, echarts: { registerMap() {}, init: () => chart } },
};
vm.createContext(context);
for (const file of ['i18n.js', 'map.js']) vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), context);
const api = context.window.CHINA_AUTO_MAP, i18n = context.window.CHINA_AUTO_I18N;
const read = file => JSON.parse(fs.readFileSync(path.join(root, 'assets/data', file), 'utf8'));
const cities = read('cities.json').cities;
const stats = Object.fromEntries(read('statistics.json').statistics.map(stat => [stat.city_id, stat]));
const opts = { allCities: cities, cities, getStat: id => stats[id] };
const points = () => option.series.flatMap(series => series.data);
api.render(opts);
const full = points(), sizes = Object.fromEntries(full.map(point => [point._id, point.symbolSize]));
const domain = option.visualMap.max;
const known = full.filter(point => point.value[2] != null).sort((a, b) => a.value[2] - b.value[2]);
for (let i = 1; i < known.length; i++) {
  if (known[i].value[2] > known[i - 1].value[2]) assert.ok(known[i].symbolSize > known[i - 1].symbolSize, 'larger output must have a larger circle');
}
assert.ok(sizes.chongqing > sizes.guangzhou && sizes.guangzhou > sizes.liuzhou, 'largest current cities must not hit the same cap');
assert.equal(full.filter(point => point.value[2] == null).length, cities.length - known.length);
for (const point of full.filter(point => point.value[2] == null)) assert.equal(point.symbol, 'emptyCircle');
const beforeLegend = element('map-legend').innerHTML;
for (const dim of ['output', 'cluster', 'role']) {
  api.render({ ...opts, dim, cities: cities.filter(city => city.id === 'guangzhou') });
  assert.equal(points()[0].symbolSize, sizes.guangzhou, 'filtering or category color must not change circle size');
  if (dim === 'output') {
    assert.equal(option.visualMap.max, domain, 'filtering must not change output color scale');
    assert.equal(element('map-legend').innerHTML, beforeLegend);
  }
}
for (const language of ['zh', 'en']) {
  i18n.setLang(language); api.render(opts);
  assert.ok(element('map-legend').innerHTML.includes(i18n.t('mapSizeLegend')));
  assert.ok(element('map-legend').innerHTML.includes(i18n.t('mapOutputUnknown')));
  assert.ok(!element('map-legend').innerHTML.includes('visualMap'));
}
const fixture = [0, 10000, null, -1, NaN, 1e9].map((value, i) => ({ id: String(i), name_en: String(i), lat: i, lng: i, value }));
api.render({ allCities: fixture, cities: fixture, getStat: id => ({ total_vehicle_output: fixture[+id].value, confidence: id === '5' ? 0.5 : 0.9 }) });
assert.equal(option.series[0].data.length, 2, 'zero is known; null, negative, NaN and candidate values are excluded from the numerical scale');
assert.equal(option.visualMap.max, 10000, 'candidate values must not expand the scale');
assert.ok(option.series[0].data[0].symbolSize < option.series[0].data[1].symbolSize);
api.render({ ...opts, layer: 'facilities', facilities: [{ id: 'f', lat: 0, lng: 0, name_en: 'Facility' }] });
assert.equal(points()[0].symbolSize, 7);
assert.equal(option.visualMap, undefined);
assert.ok(element('map-legend').innerHTML.includes(i18n.t('mapFacilityNote')));
console.log('PASS auto map: current-data ordering, fixed scales, missing/candidate isolation, bilingual legends and facility semantics');
