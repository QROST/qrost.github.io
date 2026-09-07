#!/usr/bin/env node
// Exercise each production builder without WebGL, including the real sibling data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = vm.createContext({
  window: {}, document: { documentElement: {} },
  localStorage: { getItem: () => null },
  fetch: () => { throw new Error('Bundled Housing conversion must not request live FX'); },
});
for (const path of ['assets/data/listings.js', 'assets/data/enriched.js', 'assets/js/i18n.js']) {
  vm.runInContext(await read(`china-housing/${path}`), source);
}
const real = source.window;
const rates = { CNY: 1, USD: 7, TWD: 7 / 31, HKD: 7 / 7.82, AUD: 7 / 1.45 };
const provinces = { CNY: '北京', USD: 'California', TWD: '台湾', HKD: '香港', AUD: '澳洲' };

for (const [demo, app] of [['visual-page', 'app.js'], ['neon-abyss', 'app-club.js']]) {
  const appSource = await read(`${demo}/${app}`);
  const builder = appSource.match(/function buildHousing\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(builder, `${demo}: production Housing builder found`);
  const build = (listings, enriched, fx = real.HOUSING_I18N) => {
    const stars = [];
    const D = { feat: [], shape: [], op: [] };
    const context = vm.createContext({
      window: { HOUSING_LISTINGS: listings, HOUSING_ENRICHED: enriched, HOUSING_I18N: fx },
      D, CENTER: [0, 42, 0], TRAIL: 72, climWarm: 0,
      clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
      makeFeat: () => new Array(28).fill(0),
      addStar: (...args) => (stars.push({ size: args[10], raw: args[13].raw, id: args[13].id, args }), stars.length - 1),
    });
    vm.runInContext(`${builder}\nbuildHousing();`, context);
    assert.ok(stars.every(s => s.args.slice(2, 6).every(Number.isFinite) && Number.isFinite(s.size)));
    assert.ok(D.feat.flat().every(Number.isFinite), `${demo}: no NaN from missing prices`);
    return { stars, D };
  };
  const actual = build(real.HOUSING_LISTINGS, real.HOUSING_ENRICHED);
  const geocoded = real.HOUSING_LISTINGS.filter(ls => {
    const e = real.HOUSING_ENRICHED[ls.id];
    return e?.lat != null && e.lng != null;
  });
  assert.equal(actual.stars.length, geocoded.length);
  let foreign = 0;
  for (const star of actual.stars) {
    const ls = geocoded.find(row => row.id === star.id);
    const currency = real.HOUSING_I18N.listingCurrency(ls.prov);
    const expected = ls.priceWan * 10000 * rates[currency] / ls.area;
    assert.ok(Math.abs(star.raw.unit - expected) < 1e-7, `${demo}: listing ${ls.id} CNY unit price`);
    if (currency !== 'CNY') {
      foreign++;
      assert.equal(star.raw.fx.status, 'fallback');
      assert.match(star.raw.fx.date, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
  const sorted = actual.stars.slice().sort((a, b) => a.raw.unit - b.raw.unit);
  assert.ok(sorted.every((s, i) => !i || s.size >= sorted[i - 1].size), `${demo}: higher CNY prices cannot shrink stars`);

  const samples = Object.entries(provinces).map(([currency, prov], i) => ({ id: i, prov, priceWan: 7 / rates[currency], area: 70, rent: 100 }));
  const coords = Object.fromEntries(samples.map(ls => [ls.id, { lat: 30, lng: 110 }]));
  const equal = build(samples, coords);
  assert.ok(equal.stars.every(s => Math.abs(s.raw.unit - 1000) < 1e-7));
  assert.ok(equal.stars.every(s => Math.abs(s.size - equal.stars[0].size) < 1e-12), `${demo}: equal CNY values have equal base size across currencies`);
  const missing = samples.map((ls, i) => ({ ...ls, ...(i % 2 ? { area: null } : { priceWan: null }), rent: null }));
  const unknown = build(missing, coords);
  assert.ok(unknown.stars.every(s => s.raw.unit === null));
  assert.ok(unknown.D.feat.every(f => f[6] === 0.5 && f[7] === 0.5));
  const noFx = build(real.HOUSING_LISTINGS, real.HOUSING_ENRICHED, null);
  assert.equal(noFx.stars.length, geocoded.length, `${demo}: FX module failure keeps climate entities available`);
  assert.ok(noFx.stars.every(s => s.raw.unit === null));

  const document = { documentElement: {}, getElementById: () => null };
  const i18n = vm.createContext({ document });
  vm.runInContext((await read(`${demo}/i18n.js`)).replace(/^export /gm, ''), i18n);
  i18n.applyUi();
  assert.equal(document.documentElement.lang, 'en', `${demo}: shared Housing preferences cannot override art-page language`);
  const crossCurrency = actual.stars.find(s => s.raw.fx.currency === 'USD');
  assert.match(i18n.housingPriceNote(crossCurrency.raw), /CNY\/m².*bundled FX.*not live/);
  assert.match(i18n.housingPriceNote({ unit: null }), /unavailable.*neutral size/);
  i18n.setLang('zh');
  assert.match(i18n.housingPriceNote(crossCurrency.raw), /人民币\/㎡.*内置汇率.*非实时/);
  assert.match(i18n.housingPriceNote({ unit: null }), /未知.*中性/);
  assert.doesNotMatch(i18n.pricePerSqm(300), /0\.0/);
  console.log(`PASS: ${demo}: ${actual.stars.length} geocoded listings, ${foreign} converted; equal-value sizing, missing prices/FX, EN/中文 labels`);
}
