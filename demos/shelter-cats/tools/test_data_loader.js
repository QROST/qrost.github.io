#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'assets/js/data-loader.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/manifest.json')));

function fixture() {
  const faults = new Map();
  let requests = 0;
  const context = {
    window: { SHELTERCATS_DATA_VERSION: manifest.data_version },
    AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests++;
      const file = url.split('?')[0].replace('assets/data/', '');
      const fault = faults.get(file);
      if (fault === 'timeout') {
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('timeout')));
        });
      }
      if (fault === 'http') return { ok: false, status: 503 };
      return { ok: true, json: async () => {
        if (fault === 'json') throw new SyntaxError('bad JSON');
        const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data', file)));
        return typeof fault === 'function' ? fault(data) : data;
      } };
    },
  };
  // Exercise the real abort path without waiting ten seconds per fixture.
  context.setTimeout = fn => setTimeout(fn, 30);
  vm.runInNewContext(code, context);
  return { data: context.window.SHELTERCATS_DATA, faults, requests: () => requests };
}

(async () => {
  const normal = fixture();
  const first = normal.data.init(), coalesced = normal.data.init();
  assert.equal(first, coalesced);
  await first;
  assert.equal(normal.data.cats.length, manifest.total_cats);
  assert.equal(normal.data.failedShards.length, 0);
  assert.equal(normal.requests(), 3 + manifest.shards.length);
  const cat = normal.data.cats[0];
  assert.equal(normal.data.getCat(cat.id), cat);
  assert.ok(normal.data.catsForShelter(cat.shelter_id).includes(cat));

  for (const file of ['manifest.json', 'enums.json', 'shelters.json']) {
    for (const fault of ['http', 'json', 'timeout']) {
      const test = fixture(); test.faults.set(file, fault);
      await assert.rejects(test.data.init());
      assert.equal(test.data.manifest, null);
      assert.equal(test.data.cats.length, 0);
      test.faults.clear(); await test.data.init();
      assert.equal(test.data.cats.length, manifest.total_cats);
    }
  }
  const shard = manifest.shards[0];
  const rows = data => Array.isArray(data) ? data : data.cats;
  for (const fault of ['http', 'json', 'timeout',
    data => { rows(data).pop(); return data; },
    data => { rows(data)[0].id = rows(data)[1].id; return data; },
    data => { rows(data)[0].shelter_id = 'missing'; return data; },
    data => { rows(data)[0].status = 'not-a-status'; return data; },
  ]) {
    const test = fixture(); test.faults.set(shard.file, fault);
    await test.data.init();
    assert.equal(test.data.cats.length, manifest.total_cats - shard.count);
    assert.equal(test.data.failedShards.length, 1);
    assert.equal(test.data.failedShards[0].file, shard.file);
    test.faults.clear(); await test.data.init();
    assert.equal(test.data.failedShards.length, 0);
    assert.equal(test.data.cats.length, manifest.total_cats);
    assert.equal(new Set(test.data.cats.map(c => c.id)).size, manifest.total_cats);
  }
  const allMissing = fixture();
  manifest.shards.forEach(s => allMissing.faults.set(s.file, 'http'));
  await allMissing.data.init();
  assert.equal(allMissing.data.cats.length, 0);
  assert.equal(allMissing.data.failedShards.length, manifest.shards.length);

  normal.faults.set('manifest.json', data => ({ ...data, data_version: 'old' }));
  await assert.rejects(normal.data.init(), /stale/);
  assert.equal(normal.data.getCat(cat.id), cat, 'failed refresh preserves the accepted snapshot');
  normal.faults.set('manifest.json', data => ({ ...data, total_cats: data.total_cats + 1 }));
  await assert.rejects(normal.data.init(), /total/);
  console.log('shelter loader: atomic headers, partial shards, validation, timeout and retry passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
