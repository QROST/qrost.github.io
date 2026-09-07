#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/i18n.js'), 'utf8');

function load({ response, cache = {} } = {}) {
  const context = {
    window: {}, document: { documentElement: {}, getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null },
    sessionStorage: { getItem: key => cache[key] || null, setItem: (key, value) => { cache[key] = value; } },
    fetch: async () => { if (!response) throw new Error('offline'); return { ok: true, json: async () => response }; },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.HOUSING_I18N;
}

(async () => {
  const fallback = load();
  await fallback.fetchExchangeRate();
  assert.equal(fallback.getFxInfo('California').rate, 7);
  assert.equal(fallback.getFxInfo('香港').date, '2026-06-17');
  assert.equal(fallback.getFxInfo('台湾').status, 'fallback');
  assert.equal(fallback.getFxInfo('北京').rate, 1);
  assert.equal(fallback.getFxInfo('北京').status, 'not_required');

  const cache = {};
  // Mixed response: TWD is unavailable; it must keep fallback provenance while USD/HKD/AUD become live.
  const live = load({ cache, response: { date: '2026-09-04', rates: { CNY: 7.1, HKD: 7.8, AUD: 1.4 } } });
  await live.fetchExchangeRate();
  assert.equal(live.getFxInfo('香港').rate, 7.1 / 7.8);
  assert.equal(live.getFxInfo('香港').status, 'live');
  assert.equal(live.getFxInfo('香港').source, 'Frankfurter');
  assert.equal(live.getFxInfo('香港').date, '2026-09-04');
  assert.equal(live.getFxInfo('台湾').rate, 7 / 31);
  assert.equal(live.getFxInfo('台湾').status, 'fallback');
  assert.equal(live.getFxInfo('台湾').date, '2026-06-17');
  const cached = load({ cache });
  await cached.fetchExchangeRate();
  assert.equal(cached.getFxInfo('香港').rate, 7.1 / 7.8);
  assert.equal(cached.getFxInfo('香港').status, 'cached');
  assert.equal(cached.getFxInfo('香港').date, '2026-09-04');
  assert.equal(cached.getFxInfo('台湾').status, 'fallback');
  assert.equal(cached.getFxInfo('台湾').date, '2026-06-17');

  const legacy = load({ cache: { 'housing-fx': JSON.stringify({ rate: 6.9, cnyPerHkd: 0.9, at: Date.now() }) } });
  await legacy.fetchExchangeRate();
  assert.equal(legacy.getFxInfo('香港').status, 'cached');
  assert.equal(legacy.getFxInfo('香港').date, '');
  assert.equal(legacy.getFxInfo('香港').source, 'unknown (legacy cache)');
  assert.equal(legacy.getFxInfo('台湾').status, 'fallback');

  const expired = load({ cache: { 'housing-fx': JSON.stringify({ rate: 6.9, at: 1 }) } });
  await expired.fetchExchangeRate();
  assert.equal(expired.getFxInfo('California').status, 'fallback');
  assert.equal(expired.getFxInfo('California').rate, 7);
  const noDate = load({ response: { rates: { CNY: 7.2, TWD: 32 } } });
  await noDate.fetchExchangeRate();
  assert.equal(noDate.getFxInfo('台湾').date, '');
  assert.equal(noDate.getFxInfo('台湾').rate, 7.2 / 32);
  console.log('PASS · housing FX metadata · fallback, live mixed coverage, cached, legacy, expired, missing date');
})().catch(error => { console.error(error); process.exitCode = 1; });
