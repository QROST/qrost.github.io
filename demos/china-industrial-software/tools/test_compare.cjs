#!/usr/bin/env node
/** Exercise source-backed comparison fields and slot limits without a chart or browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const products = fs.readdirSync(path.join(root, 'assets/data/categories')).filter(f => f.endsWith('.json'))
  .flatMap(f => JSON.parse(fs.readFileSync(path.join(root, 'assets/data/categories', f), 'utf8')).products);
const context = vm.createContext({
  window: {},
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { addEventListener() {}, documentElement: {}, querySelectorAll: () => [], getElementById: () => null },
});
context.window.INDUSTRIAL_CATALOG = { getProductById: id => products.find(p => p.id === id) };
for (const file of ['i18n.js', 'compare.js']) vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), context);
const cmp = context.window.INDUSTRIAL_COMPARE;
const i18n = context.window.INDUSTRIAL_I18N;
const quote = products.find(p => p.pricing === 'quote');
const free = products.find(p => p.pricing === 'free');
assert.ok(quote && free, 'real quote and free entries must be covered');
assert.equal(cmp.addProduct('missing-product'), false);
assert.equal(cmp.addProduct(quote.id), true);
assert.equal(cmp.addProduct(quote.id), false);
assert.equal(cmp.addProduct(free.id), true);
for (const p of products.filter(p => ![quote.id, free.id].includes(p.id)).slice(0, 2)) assert.equal(cmp.addProduct(p.id), true);
assert.equal(cmp.getSlots().length, 4);
assert.equal(cmp.addProduct(products.find(p => !cmp.getSlots().includes(p.id)).id), false);
const copiedSlots = cmp.getSlots(); copiedSlots.pop();
assert.equal(cmp.getSlots().length, 4, 'callers cannot mutate selection through its snapshot');
cmp.removeProduct(quote.id);
assert.equal(cmp.getSlots().length, 3);
assert.equal(cmp.addProduct(quote.id), true);

const unknown = { ...quote, id: 'fixture-unknown', name_zh: '未知样本', name_en: 'Unknown sample', pricing: null };
const container = { innerHTML: '' };
function pricingCells() {
  const row = container.innerHTML.match(/<tr data-field="pricing">([\s\S]*?)<\/tr>/)?.[1];
  assert.ok(row, 'pricing must be visible in the factual comparison table');
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
}
cmp.renderTable(container, [quote, free, unknown]);
assert.deepEqual(pricingCells(), ['询价', '免费', '未知']);
assert.match(container.innerHTML, /scope="row"/);
assert.match(container.innerHTML, /scope="col"/);
i18n.setLang('en');
cmp.renderTable(container, [quote, free, unknown]);
assert.deepEqual(pricingCells(), ['Contact for quote', 'Free', 'Unknown']);
assert.equal(i18n.pricingLabel('unrecognized-tier'), 'Unknown');
assert.equal(i18n.pricingLabel('toString'), 'Unknown');
assert.equal(i18n.pricingLabel(undefined), 'Unknown');
assert.equal(i18n.pricingLabel(0), 'Unknown');
assert.equal(i18n.pricingLabel('high'), 'High');
// Changing maturity and adding sources must not produce or modify any pricing score.
cmp.renderTable(container, [{ ...quote, maturity: 'mission_critical', sources: Array(20).fill({}), international_benchmarks: Array(20).fill('example') }]);
assert.deepEqual(pricingCells(), ['Contact for quote']);
assert.doesNotMatch(container.innerHTML, /<canvas|radar|<th[^>]*>(?:Ecosystem|Value score)<\/th>/i);
cmp.renderTable(container, [{ ...unknown, name_en: '<img src=x onerror=alert(1)>' }]);
assert.ok(container.innerHTML.includes('&lt;img'));
assert.ok(!container.innerHTML.includes('<img'));
cmp.clear();
cmp.renderTable(container, cmp.getSelectedProducts());
assert.equal(cmp.getSlots().length, 0);
assert.ok(!container.innerHTML.includes('<table'));
assert.match(container.innerHTML, /Pick from catalog/);
console.log(`test_compare: OK (${products.length} real entries; quote/free/unknown facts, bilingual labels, 4-slot cap, empty state; no chart dependency)`);
