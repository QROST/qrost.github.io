/* Headless smoke test (DOM/Chart/echarts/Leaflet stubbed): load the baked data
 * globals + app.js, exercise init + every interactive path (map dims, basemaps,
 * sorts, group toggles, modal) to surface runtime errors against real data. */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const DIR = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(DIR, p), 'utf8');

const SELS = {
  '[data-rank]': ['cheap', 'unit', 'comfort', 'extreme', 'yield'].map((rank) => ({ rank })),
  '[data-prov]': ['avgRange', 'avgExtreme', 'avgComfort', 'avgElev', 'avgPrecip', 'avgHazard'].map((prov) => ({ prov })),
  '[data-dim]': ['unitPrice', 'priceWan', 'tempRange', 'janTemp', 'julTemp', 'annualPrecip', 'elevation', 'hazardFreq', 'builtAge'].map((dim) => ({ dim })),
  '[data-base]': ['janTemp', 'julTemp', 'elevation', 'annualPrecip', 'none'].map((base) => ({ base })),
  '[data-group]': ['live', 'infra', 'risk', 'invest'].map((group) => ({ group })),
  '[data-filter]': ['budget10', 'warmWinter', 'coolSummer', 'heated', 'coast50', 'lowAlt', 'lowHazard', 'rail20', 'hsr20'].map((filter) => ({ filter })),
  '[data-qz]': ['heat', 'coast', 'alt', 'rail', 'hsr', 'airport', 'hospital'].map((qz) => ({ qz })),
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
    setAttribute() {}, set placeholder(v) { e._placeholder = v; },
    get placeholder() { return e._placeholder || ''; },
    closest() { return null; }, querySelectorAll() { return []; },
  };
  Object.defineProperty(e, 'innerHTML', { get() { return e._html; }, set(v) { e._html = String(v); } });
  return e;
}
const selCache = {}; const ids = {};
const htmlClass = new Set();
const documentElement = {
  classList: {
    contains(c) { return htmlClass.has(c); },
    add(c) { htmlClass.add(c); },
    remove(c) { htmlClass.delete(c); },
    toggle(c, force) {
      if (force !== undefined) { force ? htmlClass.add(c) : htmlClass.delete(c); return !!force; }
      const on = htmlClass.has(c);
      if (on) htmlClass.delete(c); else htmlClass.add(c);
      return !on;
    },
  },
};
function makeEl() {
  const e = el();
  Object.defineProperty(e, 'id', {
    set(v) { e._id = v; if (v) ids[v] = e; },
    get() { return e._id || ''; },
  });
  return e;
}
const document = {
  documentElement,
  title: '',
  getElementById(id) { return (ids[id] || (ids[id] = el({ id }))); },
  querySelectorAll(s) { return (selCache[s] || (selCache[s] = (SELS[s] || []).map((d) => el(d)))); },
  querySelector() { return el(); }, addEventListener() {}, createElement() { return makeEl(); },
  readyState: 'complete', body: { style: {} },
};
let lastChartCfg = null;
function Chart(c, cfg) { lastChartCfg = cfg; JSON.stringify({ t: cfg && cfg.type }); this.destroy = () => {}; }
Chart.defaults = { font: {}, color: '' };
let lastMapVm = null;
const chartStub = {
  setOption(o) {
    if (o && o.visualMap) lastMapVm = o.visualMap;
    JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? null : v)));
    return chartStub;
  },
  on() {}, resize() {}, clear() {}, getOption() { return { geo: [{ zoom: 1, center: [104, 36] }] }; },
};
const echarts = { registerMap() {}, init() { return chartStub; } };
const L = { map() { return { setView() { return this; }, addTo() { return this; }, invalidateSize() {}, fitBounds() {}, remove() {} }; }, tileLayer() { return { addTo() { return this; } }; }, circleMarker() { return { addTo() { return this; }, bindPopup() { return this; } }; } };
const store = {};
const localStorage = { getItem(k) { return store[k] ?? null; }, setItem(k, v) { store[k] = String(v); } };
const sessionStorage = { getItem() { return null; }, setItem() {} };
const sandbox = { window: {}, document, Chart, echarts, L, console, setTimeout, JSON, Math, Object, Array, String, Number, Map, Set, parseInt, parseFloat, localStorage, sessionStorage, fetch: () => Promise.reject(new Error('offline')), Blob: function () {}, URL: { createObjectURL() { return ''; }, revokeObjectURL() {} } };
sandbox.window.Chart = Chart; sandbox.window.echarts = echarts; sandbox.window.L = L; sandbox.window.addEventListener = () => {};
sandbox.window.matchMedia = (q) => ({ matches: /max-width:\s*639px/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
sandbox.globalThis = sandbox; vm.createContext(sandbox);
const run = (f) => vm.runInContext(read(f), sandbox, { filename: f });
ids['lang-toggle'] = el({ id: 'lang-toggle' });
const provWrap = el({ id: 'province-chart-wrap' });
provWrap.style = { height: '420px' };
const provCanvas = el({ id: 'province-chart' });
provCanvas.style = {};
provCanvas.parentElement = provWrap;
provWrap.appendChild = (c) => { provWrap._child = c; c.parentElement = provWrap; };
ids['province-chart-wrap'] = provWrap;
ids['province-chart'] = provCanvas;
const rankWrap = el({ id: 'rank-wrap' });
rankWrap.appendChild = (c) => { if (c && c.id) ids[c.id] = c; c.parentElement = rankWrap; };
const rankChart = el({ id: 'rank-chart' });
rankChart.parentElement = rankWrap;
rankChart.style = {};
ids['rank-chart'] = rankChart;
['assets/data/listings.js', 'assets/data/china-geo.js', 'assets/data/enriched.js', 'assets/data/hazards.js', 'assets/data/field.js', 'assets/data/loc-pinyin.js', 'assets/data/geo-en.js', 'assets/js/i18n.js', 'assets/js/app.js'].forEach(run);
const zhRe = /[\u4e00-\u9fff]/;

function ensureGroupsOn() {
  ['live', 'infra', 'risk'].forEach((g) => {
    const btn = selCache['[data-group]'].find((b) => b.dataset.group === g);
    // idempotent: chip uses bg-emerald-* when group is active — do not toggle off
    if (btn && !/bg-emerald/.test(btn.className)) btn.fire('click');
  });
}
ids['listing-modal'] = el({ id: 'listing-modal' });
ids['listing-modal'].classList = { _c: new Set(['hidden']), contains(c) { return this._c.has(c); }, add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); }, toggle(c) { this._c.has(c) ? this._c.delete(c) : this._c.add(c); } };

setTimeout(() => {
  const w = sandbox.window; const checks = [];
  const T = (n, p) => checks.push([n, !!p]);
  T('listings 387', (w.HOUSING_LISTINGS || []).length === 387);
  T('loc no area suffix', (w.HOUSING_LISTINGS || []).every((r) => !/（\d+\.?\d*\s*㎡?）|\(\d+\.?\d*\s*㎡?\)|\d+\s*(m2|m²|㎡)/i.test(r.loc)));
  T('loc no slash combos', (w.HOUSING_LISTINGS || []).every((r) => !/\//.test(r.loc)));
  T('loc no pricing notes', (w.HOUSING_LISTINGS || []).every((r) => !/按套计价|非按㎡/.test(r.loc)));
  T('loc no vague fragments', (w.HOUSING_LISTINGS || []).every((r) => !/左侧地产|开发东面|附近老住宅/.test(r.loc)));
  T('loc pinyin covers all', (() => {
    const py = w.HOUSING_LOC_PINYIN || {};
    return (w.HOUSING_LISTINGS || []).every((r) => py[r.loc] || !/[\u4e00-\u9fff]/.test(r.loc));
  })());
  T('甲壳虫 loc cleaned', (() => {
    const a = w.HOUSING_LISTINGS.find((r) => r.id === 32);
    const b = w.HOUSING_LISTINGS.find((r) => r.id === 263);
    return a && a.loc === '新田城甲壳虫公寓' && b && b.loc === '新田城甲壳虫公寓（小户）';
  })());
  T('enriched 387', Object.keys(w.HOUSING_ENRICHED || {}).length === 387);
  T('hazards 32', Object.keys(w.HOUSING_HAZARDS || {}).length === 32);
  T('field 4 fields', w.HOUSING_FIELD && Object.keys(w.HOUSING_FIELD.fields).length === 4);
  T('field step 1° coarse', w.HOUSING_FIELD && w.HOUSING_FIELD.step === 1);
  T('field elevation 973pts', w.HOUSING_FIELD && w.HOUSING_FIELD.fields.elevation.points.length === 973);
  T('field_hi per-layer on disk', (() => {
    const keys = ['janTemp', 'julTemp', 'elevation', 'annualPrecip'];
    for (const k of keys) {
      const p = path.join(DIR, `assets/data/field_hi_${k}.js`);
      if (!fs.existsSync(p)) return false;
      const box = { window: {} };
      vm.runInContext(fs.readFileSync(p, 'utf8'), vm.createContext(box));
      const hi = box.window.HOUSING_FIELD_HI;
      const fld = hi && hi.fields && hi.fields[k];
      const n = fld && (fld.points ? fld.points.length : (fld.q && fld.pts ? fld.pts.split('|').length : 0));
      if (!hi || hi.step !== 0.25 || !n || n < 80) return false;
    }
    return true;
  })());
  T('field_hi_janTemp layer', (() => {
    const p = path.join(DIR, 'assets/data/field_hi_janTemp.js');
    if (!fs.existsSync(p)) return false;
    const box = { window: {} };
    vm.runInContext(fs.readFileSync(p, 'utf8'), vm.createContext(box));
    const hi = box.window.HOUSING_FIELD_HI;
    const fld = hi && hi.fields && hi.fields.janTemp;
    const n = fld && (fld.points ? fld.points.length : (fld.q && fld.pts ? fld.pts.split('|').length : 0));
    return hi && hi.step === 0.25 && n >= 80;
  })());
  T('geo-en districts CJK-free', Object.values((w.HOUSING_GEO_EN || {}).district || {}).every((v) => !zhRe.test(v)));
  T('kpi', /房源样本/.test(ids['kpi-grid']._html));
  // comfort-max day count drifts with ERA5 re-bakes (boundary-sensitive at mild
  // climates), so assert a sane floor not an exact number that needs re-syncing.
  T('kpi comfort max listing', (() => {
    const h = ids['kpi-grid']._html || '';
    const m = h.match(/(\d+)天/g) || [];
    const max = Math.max(0, ...m.map((x) => parseInt(x, 10)));
    return /舒适日最多/.test(h) && max >= 250;
  })());
  T('table head', /气候类型/.test(ids['table-head']._html) && /年温差/.test(ids['table-head']._html));
  T('table col order prov first id last', (() => {
    const ths = [...(ids['table-head']._html || '').matchAll(/data-col="([^"]+)"/g)].map((m) => m[1]);
    return ths.length > 2 && ths[0] === 'prov' && ths[ths.length - 1] === 'id';
  })());
  T('table sticky prov+city attrs', /data-col="prov"/.test(ids['table-body']._html) && /data-col="city"/.test(ids['table-body']._html) && /table-sticky-col/.test(ids['table-body']._html));
  T('table sticky css in index', /table-sticky-col/.test(read('index.html')) && /--table-sticky-city-left/.test(read('index.html')));
  T('no 宜居指数 anywhere', !/宜居指数/.test(ids['table-head']._html) && !/宜居指数/.test(ids['table-body']._html));
  T('climate types rendered', /(四季如春|常年温暖|四季分明|长夏无冬|夏热冬暖|冬暖夏凉|常年凉冷|温和过渡)/.test(ids['table-body']._html));
  T('table body', (ids['table-body']._html || '').length > 1000);
  T('table precip ramp pills', /style="background:(?:#[0-9a-f]{3,8}|rgb\(\d+,\d+,\d+\));color:#(?:0f172a|f8fafc)">\d+mm/.test(ids['table-body']._html));
  T('table temp ramp pills', /style="background:(?:#[0-9a-f]{3,8}|rgb\(\d+,\d+,\d+\));color:#(?:0f172a|f8fafc)">-?\d+°C/.test(ids['table-body']._html));
  T('tempComfortColor piecewise anchors', (() => {
    const f = w.__tempComfortColor;
    if (!f) return false;
    const cold = f(-10);
    const comfort = f(15);
    const hot = f(35);
    const mid = f(1.5);
    return /rgb\(37,99,235\)/.test(cold)
      && /rgb\(5,150,105\)/.test(comfort)
      && /rgb\(220,38,38\)/.test(hot)
      && !/rgb\(5,150,105\)/.test(mid);
  })());
  T('table temp comfort band green', /style="background:rgb\(5,150,105\);color:/.test(ids['table-body']._html));
  T('table elev terrain pills', /style="background:(?:#[0-9a-f]{3,8}|rgb\(\d+,\d+,\d+\));color:#(?:0f172a|f8fafc)">\d+m\b/.test(ids['table-body']._html));
  T('table dist gray pills', /style="background:rgb\(\d+,\d+,\d+\);color:#(?:0f172a|f8fafc)">[^<]{1,48}(?: km|\d+m\b)/.test(ids['table-body']._html));
  T('table count 248 default', /显示 248 \/ 248/.test(ids['table-count'].textContent));
  ids['tier1-toggle'] = { checked: false, addEventListener() {} };
  T('tier1 toggle wired', typeof w.__setTier1On === 'function');
  try {
    w.__setTier1On(true);
    T('table count 387 tier1', /显示 387 \/ 387/.test(ids['table-count'].textContent));
    T('prov California zh 加州', w.HOUSING_I18N.displayProvince('California') === '加州');
    const cal = (w.HOUSING_LISTINGS || []).find((r) => r.id === 284);
    T('cityLabel California zh 加州', cal && w.__cityLabel && w.__cityLabel(cal).startsWith('加州'));
    w.__setLang('en');
    T('prov California en', w.HOUSING_I18N.displayProvince('California') === 'California');
    T('cityLabel California en', cal && w.__cityLabel && w.__cityLabel(cal).startsWith('California'));
    T('id284 loc 90293 zh', cal && cal.loc === '90293');
    T('id284 communityName en 90293', cal && w.HOUSING_I18N.communityName(cal.loc, cal.name_en) === '90293');
    T('table no Mariposa name', !/Mariposa/.test(ids['table-body']._html));
    w.__setLang('zh');
    w.__setTier1On(false);
  } catch (e) { T('tier1 toggle — ' + e.message, false); }
  T('table head heating+freq', /供暖/.test(ids['table-head']._html) && /当地灾种·常见度/.test(ids['table-head']._html));
  T('table head col_hazardHint', /复发频率，非严重度/.test(ids['table-head']._html));
  const HZ = w.HOUSING_HAZARDS || {};
  T('heating 4 tiers', new Set(Object.values(HZ).map((p) => p.heating)).size === 4);
  T('no cold-as-hazard', !Object.values(HZ).some((p) => p.hazards.some((h) => /低温|冻害/.test(h.type))));
  T('hazard freq explicit', Object.values(HZ).every((p) => p.hazards.every((h) => /^(年年|数年|十年|数十年|百年)$/.test(h.freqShort))));
  T('hazard cells commonness labels', /很常见|较常见|偶尔|少见|极少/.test(ids['table-body']._html));
  T('hazard type 地质灾害 display zh', /滑坡\/泥石流/.test(ids['table-body']._html));
  T('hazard rain+flood merged', !Object.values(w.HOUSING_ENRICHED || {}).some((e) => {
    const hz = e.hazard && e.hazard.hazards; if (!hz) return false;
    const t = hz.map((h) => h.type);
    return (t.includes('暴雨') && t.includes('洪涝')) || t.includes('洪涝内涝');
  }));
  T('hazard 暴雨洪涝 present', /暴雨洪涝/.test(ids['table-body']._html));
  T('hazard no typhoon+surge split', !Object.values(w.HOUSING_ENRICHED || {}).some((e) => {
    const hz = e.hazard && e.hazard.hazards; if (!hz) return false;
    const t = hz.map((h) => h.type);
    return t.includes('风暴潮') && t.some((x) => x === '台风' || x === '台风外围');
  }));
  T('hazard no raw 风暴潮 in data', !Object.values(w.HOUSING_ENRICHED || {}).some((e) => {
    const hz = e.hazard && e.hazard.hazards; if (!hz) return false;
    return hz.some((h) => h.type === '风暴潮');
  }));
  T('table body heating cell', /集中供暖|无·湿冷|无·冬暖|部分供暖/.test(ids['table-body']._html));
  try {
    selCache['[data-dim]'].forEach((b) => b.fire('click'));
    T('map dims', true);
    selCache['[data-dim]'].find((b) => b.dataset.dim === 'tempRange').fire('click');
    const vmText = (lastMapVm && lastMapVm[0] && lastMapVm[0].text) || [];
    T('map tempRange legend zh', vmText[0] === '四季分明' && vmText[1] === '平稳');
    w.__setLang('en');
    selCache['[data-dim]'].find((b) => b.dataset.dim === 'tempRange').fire('click');
    const vmEn = (lastMapVm && lastMapVm[0] && lastMapVm[0].text) || [];
    T('map tempRange legend en', vmEn[0] === 'large swing' && vmEn[1] === 'steady');
    selCache['[data-dim]'].find((b) => b.dataset.dim === 'unitPrice').fire('click');
    const vmPriceEn = (lastMapVm && lastMapVm[0] && lastMapVm[0].text) || [];
    T('map unitPrice legend en', vmPriceEn[0] === 'dear' && vmPriceEn[1] === 'cheap');
    w.__setLang('zh');
    selCache['[data-dim]'].find((b) => b.dataset.dim === 'unitPrice').fire('click');
    const vmPrice = (lastMapVm && lastMapVm[0] && lastMapVm[0].text) || [];
    T('map unitPrice legend zh not swing', vmPrice[0] === '贵' && vmPrice[1] === '便宜');
    selCache['[data-dim]'].find((b) => b.dataset.dim === 'janTemp').fire('click');
    const vmJan = (lastMapVm && lastMapVm[0] && lastMapVm[0].text) || [];
    T('map janTemp legend zh', vmJan[0] === '热' && vmJan[1] === '冷');
    selCache['[data-dim]'].find((b) => b.dataset.dim === 'hazardFreq').fire('click');
    const vmHz = (lastMapVm && lastMapVm[0] && lastMapVm[0].text) || [];
    T('map hazardFreq legend zh', vmHz[0] === '更常见' && vmHz[1] === '更少见');
    selCache['[data-dim]'].find((b) => b.dataset.dim === 'builtAge').fire('click');
    const vmAge = (lastMapVm && lastMapVm[0] && lastMapVm[0].text) || [];
    T('map builtAge legend zh', vmAge[0] === '老' && vmAge[1] === '新');
    w.__setLang('en');
    selCache['[data-dim]'].find((b) => b.dataset.dim === 'builtAge').fire('click');
    const vmAgeEn = (lastMapVm && lastMapVm[0] && lastMapVm[0].text) || [];
    T('map builtAge legend en', vmAgeEn[0] === 'old' && vmAgeEn[1] === 'new');
    const e335 = w.HOUSING_ENRICHED && w.HOUSING_ENRICHED['335'];
    T('future builtYear 335 in enrich', e335 && e335.builtYear === 2027);
    w.__setTier1On(true);
    w.__setLang('zh');
    T('future built cell zh', /未交付/.test(ids['table-body']._html) && /cbd5e1/i.test(ids['table-body']._html));
    w.__setLang('en');
    T('future built cell en', /−\d+ yr/.test(ids['table-body']._html));
    w.__setLang('zh');
    try {
      const I = w.HOUSING_I18N;
      const hk = (w.HOUSING_LISTINGS || []).find((r) => r.id === 357);
      const tw = (w.HOUSING_LISTINGS || []).find((r) => r.id === 347);
      const ca356 = (w.HOUSING_LISTINGS || []).find((r) => r.id === 356);
      const ml1 = (w.HOUSING_LISTINGS || []).find((r) => r.id === 1);
      T('HK currency HKD', I.listingCurrency('香港') === 'HKD');
      T('TW currency TWD', I.listingCurrency('台湾') === 'TWD');
      T('CA currency USD', I.listingCurrency('California') === 'USD');
      const hkCnyWan = I.localWanToCnyYuan(hk.priceWan, hk.prov) / 10000;
      const twCnyWan = I.localWanToCnyYuan(tw.priceWan, tw.prov) / 10000;
      const ca356CnyWan = I.localWanToCnyYuan(ca356.priceWan, ca356.prov) / 10000;
      T('HK id357 CNY wan < raw HKD wan', hkCnyWan < hk.priceWan && hkCnyWan > 10000);
      T('TW id347 CNY wan < raw TWD wan', twCnyWan < tw.priceWan && twCnyWan > 1000);
      T('CA id356 CNY wan > raw USD wan (×FX)', ca356CnyWan > ca356.priceWan && ca356CnyWan > 1000);
      T('mainland id1 CNY wan unchanged', I.localWanToCnyYuan(ml1.priceWan, ml1.prov) / 10000 === ml1.priceWan);
      w.__setTier1On(true);
      w.__setLang('zh');
      T('HK zh table not raw 14900万', !/14900万/.test(ids['table-body']._html));
      T('TW zh table not raw 54420万', !/54420万/.test(ids['table-body']._html));
      T('CA zh table not raw 1188万', !/1188万/.test(ids['table-body']._html));
      T('CA zh formatter ~1155万', I.formatPriceWan(ca356.priceWan, ca356.prov).includes('1155'));
      T('HK zh formatter CNY not HKD wan', (() => {
        const fmt = I.formatPriceWan(hk.priceWan, hk.prov);
        return (fmt.endsWith('万') || fmt.endsWith('亿')) && !fmt.includes('14900')
          && I.localWanToCnyYuan(hk.priceWan, hk.prov) < hk.priceWan * 10000;
      })());
      const sh = (w.HOUSING_LISTINGS || []).find((r) => r.id === 125);
      const shCheap = (w.HOUSING_LISTINGS || []).find((r) => r.id === 60);
      const hk358 = (w.HOUSING_LISTINGS || []).find((r) => r.id === 358);
      T('mainland id125 priceYuan unchanged', sh && Math.abs(I.localWanToCnyYuan(sh.priceWan, sh.prov) - sh.priceWan * 10000) < 0.01);
      T('mainland id60 zh fmt raw wan', shCheap && I.formatPriceWan(shCheap.priceWan, shCheap.prov) === '10万');
      T('mainland id125 zh fmt raw wan', sh && I.formatPriceWan(sh.priceWan, sh.prov) === '395万');
      T('mainland needsFx false', !I.listingNeedsFx('上海') && !I.listingNeedsFx('黑龙江'));
      T('HK id358 zh CNY wan ~5655', hk358 && (() => {
        const cnyWan = I.localWanToCnyYuan(hk358.priceWan, hk358.prov) / 10000;
        return cnyWan > 5000 && cnyWan < 7000 && /5655/.test(I.formatPriceWan(hk358.priceWan, hk358.prov));
      })());
      w.__setLang('en');
      T('overseas en formatter not raw-wan USD', [284, 356, 347, 357, 359].every((id) => {
        const d = w.HOUSING_LISTINGS.find((r) => r.id === id);
        const fmt = I.formatPriceWan(d.priceWan, d.prov);
        const wrong = '$' + Math.round(d.priceWan * 10000 / I.getRate()).toLocaleString('en-US');
        return fmt !== wrong;
      }));
      T('overseas en table no raw-wan USD', [284, 356, 347, 357, 359].every((id) => {
        const d = w.HOUSING_LISTINGS.find((r) => r.id === id);
        const wrong = '$' + Math.round(d.priceWan * 10000 / I.getRate()).toLocaleString('en-US');
        return !ids['table-body']._html.includes(wrong);
      }));
      T('CA en formatter $1.65M #356', I.formatPriceWan(ca356.priceWan, ca356.prov) === '$1,650,000');
      T('CA en table $1,650,000', ids['table-body']._html.includes('$1,650,000'));
      T('HK en table USD millions', /\$1[0-9],/.test(ids['table-body']._html));
      w.__setLang('zh');
      w.__setTier1On(false);
    } catch (e) { T('HK/TW currency — ' + e.message, false); }
    w.__setTier1On(false);
    w.__setLang('zh');
    selCache['[data-dim]'].find((b) => b.dataset.dim === 'tempRange').fire('click');
  } catch (e) { T('map dims — ' + e.message, false); }
  try { selCache['[data-base]'].forEach((b) => b.fire('click')); T('basemaps (incl isolines+heatmap)', true); } catch (e) { T('basemaps — ' + e.message, false); }
  try {
    const sample = (w.HOUSING_LISTINGS || []).find((r) => r.id === 1);
    T('cityLabel zh province', sample && w.__cityLabel && w.__cityLabel(sample) === '黑龙江 · 鹤岗 · 峻德小区');
    w.__setLang('en');
    T('cityLabel en province', sample && w.__cityLabel && w.__cityLabel(sample) === 'Heilongjiang, Hegang, Jun De Xiao Qu');
    w.__setLang('zh');
    T('kpi cheapest province zh', /河南 · 鹤壁 · 鹤山老破小/.test(ids['kpi-grid']._html));
    selCache['[data-prov]'].forEach((b) => b.fire('click'));
    selCache['[data-rank]'].forEach((b) => b.fire('click'));
    T('prov+rank', true);
    selCache['[data-rank]'].find((b) => b.dataset.rank === 'comfort').fire('click');
    const rankStrip = document.getElementById('rank-strip');
    const rankNote = document.getElementById('rank-climate-note');
    T('rank comfort note zh', rankNote && /日最低温 ≥8℃/.test(rankNote._html || rankNote.innerHTML) && /互斥/.test(rankNote._html || rankNote.innerHTML));
    T('rank strip province zh', rankStrip && /云南 · 红河州-个旧 · 白云新村/.test(rankStrip._html));
    selCache['[data-rank]'].find((b) => b.dataset.rank === 'extreme').fire('click');
    T('rank extreme note zh', rankNote && /极端日/.test(rankNote._html || rankNote.innerHTML) && /33℃/.test(rankNote._html || rankNote.innerHTML));
    selCache['[data-rank]'].find((b) => b.dataset.rank === 'comfort').fire('click');
    (function () {
      const daySet = (ranges) => {
        const s = new Set();
        (ranges || []).forEach(([a, b]) => {
          if (a <= b) { for (let i = a; i <= b; i++) s.add(i); }
          else { for (let i = a; i <= 365; i++) s.add(i); for (let i = 1; i <= b; i++) s.add(i); }
        });
        return s;
      };
      let overlapAll = 0;
      for (const id of Object.keys(w.HOUSING_ENRICHED || {})) {
        const dy = w.HOUSING_ENRICHED[id].daily;
        if (!dy) continue;
        const c = daySet(dy.comfortDays), e = daySet(dy.extremeDays);
        c.forEach((d) => { if (e.has(d)) overlapAll++; });
      }
      const n116 = w.HOUSING_ENRICHED && w.HOUSING_ENRICHED['116'];
      const dy116 = n116 && n116.daily;
      const ov116 = dy116 ? [...daySet(dy116.comfortDays)].filter((d) => daySet(dy116.extremeDays).has(d)).length : 99;
      T('comfort/extreme no overlap portfolio', overlapAll === 0);
      T('comfort/extreme no overlap id116 南腊', ov116 === 0);
      T('CA coastal no record-heat supplement', [284, 285, 286, 356].every((id) => {
        const dy = w.HOUSING_ENRICHED && (w.HOUSING_ENRICHED[id] || w.HOUSING_ENRICHED[String(id)]);
        return dy && dy.daily && dy.daily.recordHeatSupplement == null && dy.daily.extremeDayCount === 0;
      }));
      const hkTwIds = [347, 348, 349, 350, 351, 352, 353, 354, 355, 357, 358, 359];
      T('HK/TW no record-heat supplement', hkTwIds.every((id) => {
        const dy = w.HOUSING_ENRICHED && (w.HOUSING_ENRICHED[id] || w.HOUSING_ENRICHED[String(id)]);
        return dy && dy.daily && dy.daily.recordHeatSupplement == null;
      }));
      T('HK/TW extreme strips summer-only', hkTwIds.every((id) => {
        const dy = w.HOUSING_ENRICHED && (w.HOUSING_ENRICHED[id] || w.HOUSING_ENRICHED[String(id)]);
        if (!dy || !dy.daily) return false;
        const ext = daySet(dy.daily.extremeDays);
        if (!ext.size) return true;
        const tmax = dy.daily.curve && dy.daily.curve.tmax;
        if (!tmax) return false;
        for (const d of ext) {
          if (d < 135 || d > 275) return false;
          if (tmax[d - 1] != null && tmax[d - 1] < 28) return false;
        }
        return dy.daily.extremeDayCount <= 10;
      }));
    })();
    w.__setLang('en');
    selCache['[data-rank]'].find((b) => b.dataset.rank === 'comfort').fire('click');
    T('rank strip province en', rankStrip && /Yunnan, Honghe-Gejiu, Bai Yun Xin Cun/.test(rankStrip._html));
    w.__setLang('zh');
    selCache['[data-prov]'].find((b) => b.dataset.prov === 'avgRange').fire('click');
    const provN = lastChartCfg && lastChartCfg.data.labels.length;
    T('prov chart dynamic height', parseInt(provWrap.style.height, 10) >= 560);
    T('prov chart y autoSkip false', lastChartCfg && lastChartCfg.options.scales.y.ticks.autoSkip === false);
    T('prov chart all provinces', provN >= 24 && provN <= 28);
    w.__setLang('en');
    selCache['[data-prov]'].find((b) => b.dataset.prov === 'avgRange').fire('click');
    T('prov chart en height', parseInt(provWrap.style.height, 10) >= 560);
    T('prov chart en labels', lastChartCfg && lastChartCfg.data.labels.includes('Heilongjiang'));
    selCache['[data-prov]'].find((b) => b.dataset.prov === 'avgExtreme').fire('click');
    const strip = ids['province-strip'];
    T('prov strip no truncate', strip && strip._html && !/truncate/.test(strip._html) && /Heilongjiang/.test(strip._html));
    T('prov extreme strip summary col en', strip && /avg extreme/.test(strip._html) && /\d+\s*d\b/.test(strip._html));
    w.__setLang('zh');
    selCache['[data-prov]'].find((b) => b.dataset.prov === 'avgComfort').fire('click');
    const comfortStrip = ids['province-strip'];
    T('prov comfort strip visible', comfortStrip && comfortStrip.style.display !== 'none' && comfortStrip._html.length > 200);
    T('prov comfort strip zh note', comfortStrip && /绿段/.test(comfortStrip._html));
    T('prov comfort strip green spans', comfortStrip && /套舒适/.test(comfortStrip._html));
    T('prov comfort strip summary col zh', comfortStrip && /均舒适/.test(comfortStrip._html) && /\d+天/.test(comfortStrip._html));
    T('prov comfort canvas hidden', provCanvas.style.display === 'none');
    selCache['[data-prov]'].find((b) => b.dataset.prov === 'avgHazard').fire('click');
    T('prov hazard chart', lastChartCfg && lastChartCfg.data.datasets[0].data.every((v) => typeof v === 'number'));
    T('prov no price tabs', !['avgUnit', 'avgPrice'].some((k) => selCache['[data-prov]'].some((b) => b.dataset.prov === k)));
    w.__setLang('zh');
  } catch (e) { T('prov+rank — ' + e.message, false); }
  try {
    selCache['[data-group]'].forEach((b) => b.fire('click'));
    ['janTemp', 'histTempMax', 'histTempMin', 'hospitalKm', 'transitKm', 'seismic', 'hazard', 'tempRange', 'climateType', 'prov'].forEach((col) => ids['table-head'].fire('click', { target: { closest: () => ({ dataset: { col } }) } }));
    T('group+sorts', true);
  } catch (e) { T('group+sorts — ' + e.message, false); }
  try { ids['table-body'].fire('click', { target: { closest: () => ({ dataset: { open: '65' } }) } }); selCache['[data-lm-tab]'].find((b) => b.dataset.lmTab === 'climate').fire('click'); T('modal climate+hazard+供暖', /历史灾害概况/.test(ids['lm-risk']._html) && /冬季供暖/.test(ids['lm-risk']._html) && /年温差/.test(ids['lm-risk']._html)); } catch (e) { T('modal — ' + e.message, false); }
  try {
    ids['theme-toggle'].fire('click');
    ensureGroupsOn();
    T('dark theme table cells', /text-slate-300/.test(ids['table-body']._html));
    T('dark theme precip pills', /style="background:(?:#[0-9a-f]{3,8}|rgb\(\d+,\d+,\d+\));color:#(?:0f172a|f8fafc)">\d+mm/.test(ids['table-body']._html));
    T('dark theme elev pills', /style="background:(?:#[0-9a-f]{3,8}|rgb\(\d+,\d+,\d+\));color:#(?:0f172a|f8fafc)">\d+m\b/.test(ids['table-body']._html));
    T('dark theme dist pills', /style="background:rgb\(\d+,\d+,\d+\);color:#(?:0f172a|f8fafc)">[^<]{1,48}(?: km|\d+m\b)/.test(ids['table-body']._html));
    T('dark theme table head', /bg-slate-800/.test(ids['table-head']._html));
    T('dark theme kpi card', ids['kpi-grid']._html.length > 100 && !/dark:bg-slate-800/.test(ids['kpi-grid']._html));
    const liveGrpBtn = selCache['[data-group]'].find((b) => b.dataset.group === 'live');
    if (/bg-emerald/.test(liveGrpBtn.className)) liveGrpBtn.fire('click');
    const darkChip = liveGrpBtn.className;
    T('dark theme chip explicit bg', /bg-slate-800/.test(darkChip) && !/dark:/.test(darkChip));
    ids['theme-toggle'].fire('click');
    T('light theme table cells', /text-slate-700/.test(ids['table-body']._html));
    T('light theme table head', /bg-slate-50/.test(ids['table-head']._html));
    T('light html no dark class', !htmlClass.has('dark'));
    const lightChip = selCache['[data-group]'].find((b) => b.dataset.group === 'live').className;
    T('light theme chip bg-white', /bg-white/.test(lightChip) && !/bg-slate-800/.test(lightChip));
    const rankTab = selCache['[data-rank]'].find((b) => b.dataset.rank === 'comfort');
    T('light theme rank tab no dark variant', rankTab && !/dark:/.test(rankTab.className));
    ids['theme-toggle'].fire('click');
    T('dark round-trip table', /text-slate-300/.test(ids['table-body']._html));
    ids['theme-toggle'].fire('click');
    T('theme+lang coexist', true);
  } catch (e) { T('theme toggle — ' + e.message, false); }
  try {
    ensureGroupsOn();
    w.__setLang('zh');
    T('default lang zh', w.__getLang() === 'zh');
    T('zh hero count', /套/.test(ids['hero-count'].textContent));
    T('zh table has ¥ or 万', /万|¥/.test(ids['table-body']._html));
    T('zh table has ㎡ or km', /㎡|km|°C/.test(ids['table-body']._html));
    T('zh table has mm precip', /\d+mm/.test(ids['table-body']._html));
    T('zh filter hsr20 chip', selCache['[data-filter]'].some((b) => b.dataset.filter === 'hsr20' && /高铁≤20km/.test(b.textContent)));
    T('zh quiz hsr chip', selCache['[data-qz]'].some((b) => b.dataset.qz === 'hsr' && /要高铁站/.test(b.textContent)));
    T('zh quiz airport chip', selCache['[data-qz]'].some((b) => b.dataset.qz === 'airport' && /要近机场/.test(b.textContent)));
    T('zh quiz hospital chip', selCache['[data-qz]'].some((b) => b.dataset.qz === 'hospital' && /要近医院/.test(b.textContent)));
    T('hsr poi baked', Object.values(w.HOUSING_ENRICHED || {}).some((e) => {
      if (e.pois?.hsr?.distKm != null) return true;
      const t = e.pois?.train;
      return !!(t && t.trainKind === 'highspeed' && t.distKm != null);
    }));
    T('zh table has m elev', /\d+m\b/.test(ids['table-body']._html));
    T('zh hist temp columns', /历史最高温/.test(ids['table-head']._html) && /历史最低温/.test(ids['table-head']._html));
    T('mobile card temp pills', /style="background:(?:#[0-9a-f]{3,8}|rgb\(\d+,\d+,\d+\));color:#(?:0f172a|f8fafc)">-?\d+°C/.test((ids['table-cards'] && ids['table-cards']._html) || ''));
    w.__setLang('en');
    T('lang en', w.__getLang() === 'en');
    T('housing-lang persisted', localStorage.getItem('housing-lang') === 'en');
    T('en table count', /Showing \d+ \/ \d+/.test(ids['table-count'].textContent));
    T('en kpi listings', /Listings/.test(ids['kpi-grid']._html));
    T('en hero no CJK', !zhRe.test(ids['hero-title'].textContent + ids['hero-body'].innerHTML));
    T('en pinyin community', /Jun De Xiao Qu|Dong Rong Xiao Qu/.test(ids['table-body']._html));
    T('en unit sqft', /\$.*\/sqft/.test(ids['table-body']._html));
    T('en table head climate', /Climate/.test(ids['table-head']._html) && /Heating/.test(ids['table-head']._html));
    T('en hist temp columns', /Record high/.test(ids['table-head']._html) && /Record low/.test(ids['table-head']._html));
    T('hist temp data baked', (() => { const rows = (sandbox.window.HOUSING_LISTINGS || []).slice(0, 5); return rows.some((r) => { const e = sandbox.window.HOUSING_ENRICHED[r.id] || sandbox.window.HOUSING_ENRICHED[String(r.id)]; return e && e.histTempMax != null && e.histTempMin != null; }); })());
    T('en table head no zh', !zhRe.test(ids['table-head']._html));
    T('en filter hsr20 chip', selCache['[data-filter]'].some((b) => b.dataset.filter === 'hsr20' && /HSR ≤20km/.test(b.textContent)));
    T('en quiz airport chip', selCache['[data-qz]'].some((b) => b.dataset.qz === 'airport' && /Near airport/.test(b.textContent)));
    T('en quiz hospital chip', selCache['[data-qz]'].some((b) => b.dataset.qz === 'hospital' && /Near hospital/.test(b.textContent)));
    T('en table body no zh', !zhRe.test(ids['table-body']._html));
    T('en climate types', /(Spring-like year-round|Four distinct seasons|Long summer|Mild winter|Cool year-round)/.test(ids['table-body']._html));
    T('en heating cell', /Central heating|No heating/.test(ids['table-body']._html));
    T('en kpi no zh', !zhRe.test(ids['kpi-grid']._html));
    T('en has °F', /°F/.test(ids['table-body']._html));
    T('en table temp pills °F', /style="background:(?:#[0-9a-f]{3,8}|rgb\(\d+,\d+,\d+\));color:#(?:0f172a|f8fafc)">-?\d+°F/.test(ids['table-body']._html));
    T('en has mi', /\d+(\.\d+)? mi|\d+ ft/.test(ids['table-body']._html));
    T('en table elev ft', /\d[\d,]* ft/.test(ids['table-body']._html));
    T('en table precip in', /\d+(\.\d+)? in/.test(ids['table-body']._html));
    T('en table head elev/precip imperial', /Elev \(ft\)/.test(ids['table-head']._html) && /Rain \(in\)/.test(ids['table-head']._html));
    T('en no °C in table', !/°C/.test(ids['table-body']._html));
    T('en no km in table cells', !/\bkm\b/.test(ids['table-body']._html));
    T('en no mm in table cells', !/\bmm\b/.test(ids['table-body']._html));
    T('en no elev m suffix in table', !/\d[\d,]*m\b/.test(ids['table-body']._html));
    ids['table-body'].fire('click', { target: { closest: () => ({ dataset: { open: '1' } }) } });
    selCache['[data-lm-tab]'].find((b) => b.dataset.lmTab === 'climate').fire('click');
    T('en modal no zh', !zhRe.test(ids['lm-risk']._html));
    T('en modal heating', /Winter heating|Central heating|No heating/.test(ids['lm-risk']._html));
    T('en modal has °F', /°F/.test(ids['lm-risk']._html));
    w.__setLang('en');
    ids['table-body'].fire('click', { target: { closest: () => ({ dataset: { open: '65' } }) } });
    T('lang change while modal open', !document.getElementById('listing-modal').classList.contains('hidden'));
    ids['lang-toggle'].fire('click');
    T('toggle back zh', w.__getLang() === 'zh');
    T('zh table count', /显示 \d+ \/ \d+ 套/.test(ids['table-count'].textContent));
    w.__setTier1On(true);
    w.__setLang('en');
    T('lang+tier1 en no crash', w.__getLang() === 'en' && /Showing/.test(ids['table-count'].textContent));
    T('tier1 en table body no zh', !zhRe.test(ids['table-body']._html || ''));
    T('tier1 en cards no zh', !zhRe.test((ids['table-cards'] && ids['table-cards']._html) || ''));
    T('tier1 en rank strip no zh', (() => {
      selCache['[data-rank]'].find((b) => b.dataset.rank === 'comfort').fire('click');
      const strip = document.getElementById('rank-strip');
      return strip && !zhRe.test(strip._html || '');
    })());
    T('tier1 HK en labels', (() => {
      const hk = w.HOUSING_LISTINGS.find((r) => r.id === 357);
      const tw = w.HOUSING_LISTINGS.find((r) => r.id === 347);
      const sh = w.HOUSING_LISTINGS.find((r) => r.id === 333);
      return w.__cityLabel(hk) === 'Hong Kong, Hong Kong, The Cullinan'
        && w.__cityLabel(tw).startsWith('Taiwan, Taipei,')
        && w.__cityLabel(sh).includes('Tomson Riviera')
        && w.HOUSING_I18N.displayProvince('香港') === 'Hong Kong'
        && w.HOUSING_I18N.displayProvince('台湾') === 'Taiwan';
    })());
    ids['table-body'].fire('click', { target: { closest: () => ({ dataset: { open: '357' } }) } });
    selCache['[data-lm-tab]'].find((b) => b.dataset.lmTab === 'climate').fire('click');
    T('tier1 HK modal en no zh', !zhRe.test(ids['lm-risk']._html || '') && /The Cullinan/.test(ids['lm-title'].textContent || ''));
    w.__setTier1On(false);
    const I = w.HOUSING_I18N;
    T('FX fallback ÷7', I.getRateSource() === 'fallback' && Math.abs(I.getRate() - 7) < 0.01);
    T('formatters null-safe', I.formatTemp(null) === '—' && I.formatDist(null) === '—' && I.formatArea(null) === '—' && I.formatElevation(null) === '—' && I.formatPrecip(null) === '—');
    T('formatElevation en ft', I.formatElevation(100) === '328 ft');
    T('formatPrecip en in', I.formatPrecip(254) === '10 in');
    w.__setLang('zh');
    T('formatElevation zh m', I.formatElevation(100) === '100m');
    T('formatPrecip zh mm', I.formatPrecip(500) === '500mm');
    w.__setLang('en');
    selCache['[data-dim]'].find((b) => b.dataset.dim === 'elevation').fire('click');
    const vmElevFmt = lastMapVm && lastMapVm[0] && lastMapVm[0].formatter;
    T('map elevation legend en ft', vmElevFmt && /ft$/.test(vmElevFmt(1000)));
    selCache['[data-dim]'].find((b) => b.dataset.dim === 'annualPrecip').fire('click');
    const vmPrecFmt = lastMapVm && lastMapVm[0] && lastMapVm[0].formatter;
    T('map precip legend en in', vmPrecFmt && / in$/.test(vmPrecFmt(500)));
    w.__setLang('zh');
    T('provExtremeUnion zh day-based', I.t('provExtremeUnion') === '极端日段（省内并集）' && I.t('provExtremePerListing') === '天/小区');
    T('document.title zh', /宜居又便宜/.test(document.title));
    w.__setLang('en');
    T('provExtremeUnion en day-based', /extreme-day spans/i.test(I.t('provExtremeUnion')) && I.t('provExtremePerListing') === ' d/listing');
    T('document.title en', /livable and affordable/i.test(document.title));
    I.setLastCommitIso('2026-06-07T20:56:01-07:00');
    w.__setLang('zh');
    T('builtAt zh', /^网页更新于 \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(document.getElementById('page-built-at').textContent));
    w.__setLang('en');
    T('builtAt en prefix', /^Page updated /.test(document.getElementById('page-built-at').textContent));
    T('formatCommitDate en', /Jun/.test(I.formatCommitDate('2026-06-07T20:56:01-07:00')));
    w.__setLang('zh');
  } catch (e) { T('lang toggle — ' + e.message, false); }
  let ok = true; for (const [n, p] of checks) { if (!p) ok = false; console.log((p ? 'PASS' : 'FAIL') + ' · ' + n); }
  console.log(ok ? '\nSMOKE_OK' : '\nSMOKE_FAIL'); process.exit(ok ? 0 : 1);
}, 150);
