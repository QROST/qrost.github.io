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
  let corruptRemaining = options.corruptShardRequests || 0;
  const context = {
    TextDecoder,
    TextEncoder: require('node:util').TextEncoder,
    console,
    window: { crypto: webcrypto },
    fetch: async function (url) {
      requests.push(url);
      const relativePath = url.split('?')[0];
      let bytes = fs.readFileSync(path.join(ROOT, relativePath));
      if (
        corruptRemaining > 0 &&
        relativePath.startsWith('assets/data/' + 'claims/')
      ) {
        corruptRemaining -= 1;
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

function shardRequests(requests) {
  return requests.filter(function (url) {
    return url.split('?')[0].includes('/claims/shard-');
  });
}

async function main() {
  const normal = makeHarness();
  const initial = await normal.loader.load();
  assert.equal(initial.manifest.files['claims.json'], undefined);
  assert.equal(shardRequests(normal.requests).length, 0);

  // A person whose claim_ids promise at least one claim.
  const subject = initial.people.find(function (person) {
    return person.claim_ids && person.claim_ids.length > 0;
  });
  assert.ok(subject, 'fixture catalog has a person with claims');
  const bucket = normal.loader.claimsBucket(subject.id);
  assert.ok(bucket >= 0 && bucket < normal.loader.CLAIMS_SHARD_COUNT);

  // Concurrent loads of the same subject share one shard request.
  const concurrent = await Promise.all([
    normal.loader.loadClaimsForSubject(subject.id),
    normal.loader.loadClaimsForSubject(subject.id),
  ]);
  assert.deepStrictEqual(concurrent[0], concurrent[1]);
  assert.equal(concurrent[0].length, subject.claim_ids.length);
  assert.ok(concurrent[0].every(function (claim) {
    return claim.subject_id === subject.id;
  }));
  assert.equal(shardRequests(normal.requests).length, 1);

  // A different subject in the same bucket is served from the cached shard.
  const sameBucket = initial.people.find(function (person) {
    return (
      person.id !== subject.id &&
      person.claim_ids && person.claim_ids.length > 0 &&
      normal.loader.claimsBucket(person.id) === bucket
    );
  });
  if (sameBucket) {
    const cached = await normal.loader.loadClaimsForSubject(sameBucket.id);
    assert.equal(shardRequests(normal.requests).length, 1);
    assert.equal(cached.length, sameBucket.claim_ids.length);
  }

  // A corrupted shard fails closed, then recovers on retry.
  const retry = makeHarness({ corruptShardRequests: 1 });
  await retry.loader.load();
  await assert.rejects(
    retry.loader.loadClaimsForSubject(subject.id),
    /SHA-256 mismatch while loading claims\/shard-/
  );
  const recovered = await retry.loader.loadClaimsForSubject(subject.id);
  assert.equal(recovered.length, subject.claim_ids.length);
  assert.equal(shardRequests(retry.requests).length, 2);

  console.log('Data loader sharded-claims contract OK');
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
