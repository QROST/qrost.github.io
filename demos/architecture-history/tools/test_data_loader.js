#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { TextDecoder } = require('node:util');

const ROOT = path.resolve(__dirname, '..');
const LOADER_PATH = path.join(ROOT, 'assets/js/data-loader.js');
const LOADER_SOURCE = fs.readFileSync(LOADER_PATH, 'utf8');

function arrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function makeHarness(options = {}) {
  const requests = [];
  let corruptClaims = Boolean(options.corruptClaimsOnce);
  const context = {
    TextDecoder,
    console,
    window: { crypto: webcrypto },
    fetch: async function (url) {
      requests.push(url);
      const relativePath = url.split('?')[0];
      let bytes = fs.readFileSync(path.join(ROOT, relativePath));
      if (corruptClaims && relativePath.endsWith('/claims.json')) {
        corruptClaims = false;
        bytes = Buffer.concat([bytes, Buffer.from(' ')]);
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async function () {
          return arrayBuffer(bytes);
        },
      };
    },
  };
  vm.runInNewContext(LOADER_SOURCE, context, { filename: LOADER_PATH });
  return { loader: context.window.ARCH_DATA, requests };
}

function claimRequests(requests) {
  return requests.filter(function (url) {
    return url.split('?')[0].endsWith('/claims.json');
  });
}

async function main() {
  const normal = makeHarness();
  const initial = await normal.loader.load();
  assert.equal(initial.claims, undefined);
  assert.equal(claimRequests(normal.requests).length, 0);

  const concurrent = await Promise.all([
    normal.loader.loadClaims(),
    normal.loader.loadClaims(),
  ]);
  assert.strictEqual(concurrent[0], concurrent[1]);
  assert.equal(concurrent[0].length, initial.manifest.files['claims.json'].count);
  assert.equal(claimRequests(normal.requests).length, 1);

  const retry = makeHarness({ corruptClaimsOnce: true });
  await retry.loader.load();
  await assert.rejects(
    retry.loader.loadClaims(),
    /SHA-256 mismatch while loading claims\.json/
  );
  const recovered = await retry.loader.loadClaims();
  assert.equal(recovered.length, initial.manifest.files['claims.json'].count);
  assert.equal(claimRequests(retry.requests).length, 2);

  console.log('Data loader lazy-claims contract OK');
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
