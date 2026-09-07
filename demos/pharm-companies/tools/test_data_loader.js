#!/usr/bin/env node
/* Runtime contract for the lazy product catalog.
   Covers: no eager shards, full success, concurrent coalescing, atomic partial
   failure, and a clean retry that re-fetches every shard. */
'use strict';

const fs = require('fs');
const assert = require('assert/strict');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/data-loader.js'), 'utf8');
const basePayloads = {
  'assets/data/manifest.json': {
    data_version: 'test',
    total_products: 2,
    shards: [{ file: 'catalog/a.json' }, { file: 'catalog/b.json' }],
  },
  'assets/data/companies.json': { companies: [{ id: 'co-1' }] },
  'assets/data/sites.json': { sites: [] },
  'assets/data/modalities.json': { modalities: [] },
  'assets/data/therapeutic-areas.json': { therapeutic_areas: [] },
  'assets/data/country-stats.json': { countries: [] },
  'assets/data/breakthroughs.json': { milestones: [] },
  'assets/data/comparisons/benchmark-pairs.json': { pairs: [] },
  'assets/data/groups.json': { groups: [] },
  'assets/data/policies.json': { policies: [] },
  'assets/data/deals.json': { deals: [] },
  'assets/data/catalog/a.json': { products: [{ id: 'p-1', company_id: 'co-1' }] },
  'assets/data/catalog/b.json': { products: [{ id: 'p-2', company_id: 'co-1' }] },
};

function harness(options = {}) {
  const payloads = JSON.parse(JSON.stringify(basePayloads));
  const calls = [];
  const failures = new Set(), stalledResponses = new Set(), stalledBodies = new Set(), signals = [];
  const sandbox = {
    window: { PHARM_DATA_VERSION: 'test' },
    fetch: async (url, init) => {
      const clean = String(url).split('?')[0];
      calls.push(clean);
      signals.push({ path: clean, signal: init && init.signal });
      if (stalledResponses.has(clean)) return new Promise(() => {});
      if (stalledBodies.has(clean)) return { ok: true, json: async () => new Promise(() => {}) };
      if (failures.has(clean)) return { ok: false, status: 503, json: async () => ({}) };
      const body = payloads[clean];
      return body
        ? { ok: true, json: async () => body }
        : { ok: false, status: 404, json: async () => ({}) };
    },
    console,
    Promise,
    AbortController,
    setTimeout: (fn, ms) => setTimeout(fn, options.timeoutMs || ms),
    clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { data: sandbox.window.PHARM_DATA, calls, failures, payloads, stalledResponses, stalledBodies, signals };
}

function shardCalls(calls) {
  return calls.filter((url) => url.includes('/catalog/'));
}

async function testSuccessAndCoalescing() {
  const h = harness();
  await h.data.initCore();
  if (shardCalls(h.calls).length) throw new Error('initCore requested a product shard');
  if (h.data.products.length || h.data.productsLoaded) throw new Error('core boot exposed product data');

  const first = h.data.loadProducts();
  const second = h.data.loadProducts();
  if (first !== second) throw new Error('concurrent lazy loads were not coalesced');
  await Promise.all([first, second]);
  if (!h.data.productsLoaded || h.data.products.length !== 2) throw new Error('full success did not commit both shards');
  if (!h.data.getProduct('p-1') || !h.data.getProduct('p-2')) throw new Error('successful products were not indexed');
  if (shardCalls(h.calls).length !== 2) throw new Error('full success did not request each shard exactly once');
}

async function testAtomicFailureAndRetry() {
  const h = harness();
  const failedPath = 'assets/data/catalog/b.json';
  h.failures.add(failedPath);
  await h.data.initCore();

  const first = h.data.loadProducts();
  const second = h.data.loadProducts();
  if (first !== second) throw new Error('failing concurrent loads were not coalesced');
  const results = await Promise.allSettled([first, second]);
  if (results.some((result) => result.status !== 'rejected')) throw new Error('partial shard failure did not reject every caller');
  if (h.data.productsLoaded) throw new Error('partial shard failure marked productsLoaded=true');
  if (h.data.products.length || h.data.getProduct('p-1')) throw new Error('partial shard failure leaked partial products');
  if (!String(results[0].reason).includes('catalog/b.json')) throw new Error('failure did not identify the failed shard');

  h.failures.delete(failedPath);
  const beforeRetry = shardCalls(h.calls).length;
  await h.data.loadProducts();
  const retried = shardCalls(h.calls).slice(beforeRetry);
  if (retried.length !== 2 || !retried.includes('assets/data/catalog/a.json') || !retried.includes(failedPath)) {
    throw new Error('retry did not re-fetch every shard');
  }
  if (!h.data.productsLoaded || h.data.products.length !== 2 || !h.data.getProduct('p-2')) {
    throw new Error('retry did not atomically commit the complete catalog');
  }
}

async function testCoreAtomicFailureAndRetry() {
  for (const failedPath of ['companies.json', 'sites.json', 'modalities.json', 'therapeutic-areas.json']) {
    const h = harness();
    h.failures.add('assets/data/' + failedPath);
    const first = h.data.initCore();
    assert.equal(first, h.data.initCore(), 'core requests must coalesce');
    await assert.rejects(first, /fetch/);
    assert.equal(h.data.manifest, null, 'failed core leaked its manifest');
    assert.equal(h.data.companies.length, 0, 'failed core leaked companies');
    assert.equal(h.data.getCompany('co-1'), null, 'failed core leaked company indexes');
    h.failures.clear();
    await h.data.initCore();
    assert.equal(h.data.companies.length, 1, 'core retry failed');
    assert.equal(h.data.getCompany('co-1').id, 'co-1');
    assert.equal(shardCalls(h.calls).length, 0, 'core retry eagerly loaded products');
  }
}

async function testCoreIntegrityAndOptionalLayers() {
  for (const mutate of [
    h => { h.payloads['assets/data/companies.json'] = {}; },
    h => { h.payloads['assets/data/companies.json'].companies.push({ id: 'co-1' }); },
    h => { h.payloads['assets/data/manifest.json'].total_companies = 3; },
    h => { h.payloads['assets/data/sites.json'].sites = [{ id: 'bad-site', company_id: 'unknown' }]; },
  ]) {
    const h = harness(); mutate(h);
    await assert.rejects(h.data.initCore());
    assert.equal(h.data.manifest, null, 'invalid core became visible');
    assert.equal(h.data.companies.length, 0);
  }
  const h = harness();
  h.failures.add('assets/data/deals.json');
  h.payloads['assets/data/country-stats.json'] = { bad: [] };
  h.payloads['assets/data/manifest.json'].total_groups = 2;
  await h.data.initCore();
  assert.equal(h.data.companies.length, 1, 'optional failure blocked catalog');
  assert.equal(h.data.deals.length, 0);
  assert.match(h.data.layerErrors.deals, /503/);
  assert.match(h.data.layerErrors.countries, /invalid/);
  assert.match(h.data.layerErrors.groups, /count mismatch/);
  await h.data.loadProducts();
  assert.equal(h.data.products.length, 2, 'optional failure blocked healthy product catalog');
}

async function testMalformedProductShardIsAtomic() {
  const h = harness();
  h.payloads['assets/data/catalog/b.json'] = {};
  await assert.rejects(h.data.loadProducts(), /invalid products/);
  assert.equal(h.data.productsLoaded, false);
  assert.equal(h.data.products.length, 0);
  h.payloads['assets/data/catalog/b.json'] = basePayloads['assets/data/catalog/b.json'];
  await h.data.loadProducts();
  assert.equal(h.data.products.length, 2);
}

async function testTimeoutAndSnapshotRetry() {
  for (const stall of ['stalledResponses', 'stalledBodies']) {
    const h = harness({ timeoutMs: 5 });
    const failed = 'assets/data/companies.json';
    h[stall].add(failed);
    await assert.rejects(h.data.initCore(), /timed out/);
    assert.equal(h.data.manifest, null);
    assert.equal(h.data.companies.length, 0);
    assert.equal(h.signals.find(x => x.path === failed).signal.aborted, true, 'timed-out request was not cancelled');
    h[stall].clear();
    await h.data.initCore();
    assert.equal(h.data.companies.length, 1, 'timeout retry failed');
  }
  const optional = harness({ timeoutMs: 5 });
  optional.stalledBodies.add('assets/data/country-stats.json');
  await optional.data.initCore();
  assert.equal(optional.data.companies.length, 1, 'stalled optional layer blocked healthy catalog');
  assert.match(optional.data.layerErrors.countries, /timed out/);

  const stale = harness();
  stale.payloads['assets/data/manifest.json'].data_version = 'older-page';
  await assert.rejects(stale.data.initCore(), /version mismatch/);
  assert.equal(stale.calls.length, 1, 'mixed snapshot requested core tables');
  assert.equal(stale.data.manifest, null);
  stale.payloads['assets/data/manifest.json'].data_version = 'test';
  await stale.data.initCore();
  assert.equal(stale.data.companies.length, 1, 'snapshot mismatch retry failed');
}

(async () => {
  await testTimeoutAndSnapshotRetry();
  await testCoreAtomicFailureAndRetry();
  await testCoreIntegrityAndOptionalLayers();
  await testMalformedProductShardIsAtomic();
  await testSuccessAndCoalescing();
  await testAtomicFailureAndRetry();
  console.log('OK: bounded response/body timeout retry, snapshot consistency, core integrity, optional layers, and lazy atomic retry pass');
})().catch((error) => { console.error(error); process.exitCode = 1; });
