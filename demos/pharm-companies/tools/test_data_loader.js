#!/usr/bin/env node
/* Runtime contract for the lazy product catalog.
   Covers: no eager shards, full success, concurrent coalescing, atomic partial
   failure, and a clean retry that re-fetches every shard. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/data-loader.js'), 'utf8');
const basePayloads = {
  'assets/data/manifest.json': {
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

function harness() {
  const calls = [];
  const failures = new Set();
  const sandbox = {
    window: { PHARM_DATA_VERSION: 'test' },
    fetch: async (url) => {
      const clean = String(url).split('?')[0];
      calls.push(clean);
      if (failures.has(clean)) return { ok: false, status: 503, json: async () => ({}) };
      const body = basePayloads[clean];
      return body
        ? { ok: true, json: async () => body }
        : { ok: false, status: 404, json: async () => ({}) };
    },
    console,
    Promise,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { data: sandbox.window.PHARM_DATA, calls, failures };
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

(async () => {
  await testSuccessAndCoalescing();
  await testAtomicFailureAndRetry();
  console.log('OK: no eager shards; full success, concurrent coalescing, atomic partial failure, and retry all pass');
})().catch((error) => { console.error(error); process.exitCode = 1; });
