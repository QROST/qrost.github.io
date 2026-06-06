/* Headless smoke test (DOM/Chart/echarts/Leaflet stubbed): load the baked data
 * globals + app.js, exercise init + every interactive path (map dims, basemaps,
 * sorts, group toggles, modal) to surface runtime errors against real data. */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const DIR = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(DIR, p), 'utf8');

const SELS = {
  '[data-rank]': ['cheap', 'unit', 'comfort', 'mild', 'yield'].map((rank) => ({ rank })),
  '[data-prov]': ['avgRange', 'avgExtreme', 'avgUnit', 'avgPrice'].map((prov) => ({ prov })),
  '[data-dim]': ['tempRange', 'unitPrice', 'priceWan', 'janTemp', 'julTemp', 'annualPrecip', 'elevation', 'extremeMonths'].map((dim) => ({ dim })),
  '[data-base]': ['none', 'janTemp', 'julTemp', 'elevation', 'annualPrecip'].map((base) => ({ base })),
  '[data-group]': ['live', 'infra', 'risk', 'invest'].map((group) => ({ group })),
  '[data-lm-tab]': ['sat', 'near', 'climate'].map((lmTab) => ({ lmTab })),
  '[data-lm-pane]': ['sat', 'near', 'climate'].map((lmPane) => ({ lmPane })),
  '[data-col]': [], '[data-open]': [],
};
function el(dataset) {
  const e = {
    dataset: dataset || {}, style: {}, _html: '', textContent: '', className: '', value: '', _l: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener(t, fn) { (e._l[t] || (e._l[t] = [])).push(fn); },
    fire(t, ev) { (e._l[t] || []).forEach((fn) => fn(ev || {})); },
    appendChild() {}, getContext() { return {}; }, getAttribute() { return null; },
    closest() { return null; }, querySelectorAll() { return []; },
  };
  Object.defineProperty(e, 'innerHTML', { get() { return e._html; }, set(v) { e._html = String(v); } });
  return e;
}
const selCache = {}; const ids = {};
const document = {
  getElementById(id) { return (ids[id] || (ids[id] = el({ id }))); },
  querySelectorAll(s) { return (selCache[s] || (selCache[s] = (SELS[s] || []).map((d) => el(d)))); },
  querySelector() { return el(); }, addEventListener() {}, createElement() { return el(); },
  readyState: 'complete', body: { style: {} },
};
function Chart(c, cfg) { JSON.stringify({ t: cfg && cfg.type }); this.destroy = () => {}; }
Chart.defaults = { font: {}, color: '' };
const chartStub = { setOption(o) { JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? null : v))); return chartStub; }, on() {}, resize() {}, clear() {}, getOption() { return { geo: [{ zoom: 1, center: [104, 36] }] }; } };
const echarts = { registerMap() {}, init() { return chartStub; } };
const L = { map() { return { setView() { return this; }, addTo() { return this; }, invalidateSize() {}, fitBounds() {}, remove() {} }; }, tileLayer() { return { addTo() { return this; } }; }, circleMarker() { return { addTo() { return this; }, bindPopup() { return this; } }; } };
const sandbox = { window: {}, document, Chart, echarts, L, console, setTimeout, JSON, Math, Object, Array, String, Number, Map, Set, parseInt, parseFloat, Blob: function () {}, URL: { createObjectURL() { return ''; }, revokeObjectURL() {} } };
sandbox.window.Chart = Chart; sandbox.window.echarts = echarts; sandbox.window.L = L; sandbox.window.addEventListener = () => {};
sandbox.globalThis = sandbox; vm.createContext(sandbox);
const run = (f) => vm.runInContext(read(f), sandbox, { filename: f });
['assets/data/listings.js', 'assets/data/china-geo.js', 'assets/data/enriched.js', 'assets/data/hazards.js', 'assets/data/field.js', 'assets/js/app.js'].forEach(run);

setTimeout(() => {
  const w = sandbox.window; const checks = [];
  const T = (n, p) => checks.push([n, !!p]);
  T('listings 127', (w.HOUSING_LISTINGS || []).length === 127);
  T('enriched 127', Object.keys(w.HOUSING_ENRICHED || {}).length === 127);
  T('hazards 19', Object.keys(w.HOUSING_HAZARDS || {}).length === 19);
  T('field 4 fields', w.HOUSING_FIELD && Object.keys(w.HOUSING_FIELD.fields).length === 4);
  T('field elevation 973pts', w.HOUSING_FIELD && w.HOUSING_FIELD.fields.elevation.points.length === 973);
  T('kpi', /房源样本/.test(ids['kpi-grid']._html));
  T('table head', /气候类型/.test(ids['table-head']._html) && /年温差/.test(ids['table-head']._html));
  T('no 宜居指数 anywhere', !/宜居指数/.test(ids['table-head']._html) && !/宜居指数/.test(ids['table-body']._html));
  T('climate types rendered', /(四季如春|常年温暖|四季分明|长夏无冬|夏热冬暖|冬暖夏凉|常年凉冷|温和过渡)/.test(ids['table-body']._html));
  T('table body', (ids['table-body']._html || '').length > 1000);
  T('table count 121 default', /显示 121 \/ 121/.test(ids['table-count'].textContent));
  ids['tier1-toggle'] = { checked: false, addEventListener() {} };
  T('tier1 toggle wired', typeof w.__setTier1On === 'function');
  try {
    w.__setTier1On(true);
    T('table count 127 tier1', /显示 127 \/ 127/.test(ids['table-count'].textContent));
    w.__setTier1On(false);
  } catch (e) { T('tier1 toggle — ' + e.message, false); }
  T('table head heating+freq', /供暖/.test(ids['table-head']._html) && /主要灾害·频率/.test(ids['table-head']._html));
  const HZ = w.HOUSING_HAZARDS || {};
  T('heating 4 tiers', new Set(Object.values(HZ).map((p) => p.heating)).size === 4);
  T('no cold-as-hazard', !Object.values(HZ).some((p) => p.hazards.some((h) => /低温|冻害/.test(h.type))));
  T('hazard freq explicit', Object.values(HZ).every((p) => p.hazards.every((h) => /^(年年|数年|十年|数十年|百年)$/.test(h.freqShort))));
  T('table body heating cell', /集中供暖|无·湿冷|无·冬暖|部分供暖/.test(ids['table-body']._html));
  try { selCache['[data-dim]'].forEach((b) => b.fire('click')); T('map dims', true); } catch (e) { T('map dims — ' + e.message, false); }
  try { selCache['[data-base]'].forEach((b) => b.fire('click')); T('basemaps (incl isolines+heatmap)', true); } catch (e) { T('basemaps — ' + e.message, false); }
  try { selCache['[data-prov]'].forEach((b) => b.fire('click')); selCache['[data-rank]'].forEach((b) => b.fire('click')); T('prov+rank', true); } catch (e) { T('prov+rank — ' + e.message, false); }
  try { selCache['[data-group]'].forEach((b) => b.fire('click')); ['janTemp', 'hospitalKm', 'seismic', 'hazard', 'tempRange', 'climateType', 'prov'].forEach((col) => ids['table-head'].fire('click', { target: { closest: () => ({ dataset: { col } }) } })); T('group+sorts', true); } catch (e) { T('group+sorts — ' + e.message, false); }
  try { ids['table-body'].fire('click', { target: { closest: () => ({ dataset: { open: '65' } }) } }); selCache['[data-lm-tab]'].find((b) => b.dataset.lmTab === 'climate').fire('click'); T('modal climate+hazard+供暖', /历史灾害概况/.test(ids['lm-risk']._html) && /冬季供暖/.test(ids['lm-risk']._html) && /年温差/.test(ids['lm-risk']._html)); } catch (e) { T('modal — ' + e.message, false); }
  let ok = true; for (const [n, p] of checks) { if (!p) ok = false; console.log((p ? 'PASS' : 'FAIL') + ' · ' + n); }
  console.log(ok ? '\nSMOKE_OK' : '\nSMOKE_FAIL'); process.exit(ok ? 0 : 1);
}, 150);
