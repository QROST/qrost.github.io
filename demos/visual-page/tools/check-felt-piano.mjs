#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';

const sourceURL = new URL('../audio.js', import.meta.url);
const source = await readFile(sourceURL, 'utf8');
const moduleURL = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { FELT_PIANO_ASSETS, FeltPianoBank, Sonifier } = await import(moduleURL);

assert.equal(FELT_PIANO_ASSETS.length, 2, 'lightweight pilot must ship exactly two felt-piano roots');
assert.deepEqual(
  (await readdir(new URL('../samples/', import.meta.url))).sort(),
  ['LICENSE.txt', ...FELT_PIANO_ASSETS.map((asset) => asset.file)].sort(),
  'sample directory must not accumulate unbudgeted audio or manifests',
);

let deployedBytes = 0;
const assetDigests = [];
for (const asset of FELT_PIANO_ASSETS) {
  const assetURL = new URL(`../samples/${asset.file}`, import.meta.url);
  const bytes = await readFile(assetURL);
  const info = await stat(assetURL);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const stamped = asset.file.match(/\.([0-9a-f]{10})\.m4a$/);
  assert.ok(stamped, `${asset.file} must carry a 10-hex content stamp`);
  assert.equal(stamped[1], digest.slice(0, 10), `${asset.file} content stamp drifted`);
  assetDigests.push(digest);
  deployedBytes += info.size;
}
assert.ok(deployedBytes <= 80 * 1024, `felt-piano transfer budget exceeded: ${deployedBytes} bytes`);

const license = await readFile(new URL('../samples/LICENSE.txt', import.meta.url), 'utf8');
assert.match(license, /CC0-1\.0/);
assert.match(license, /Versilian Community Sample Library/);
for (const digest of assetDigests) assert.match(license, new RegExp(digest));

function fakeBuffer(amplitude) {
  const sampleRate = 100;
  const data = new Float32Array(sampleRate * 4);
  for (let i = 0; i < data.length; i++) data[i] = Math.sin(i * 0.17) * amplitude;
  return {
    duration: data.length / sampleRate,
    numberOfChannels: 1,
    sampleRate,
    getChannelData(channel) {
      assert.equal(channel, 0);
      return data;
    },
  };
}

function makeFixture({ failC5 = false } = {}) {
  let fetches = 0;
  let decodes = 0;
  let activeDecodes = 0;
  let maxActiveDecodes = 0;

  const fetchImpl = async (url) => {
    fetches++;
    const isC5 = String(url).includes('c5.');
    if (failC5 && isC5) return { ok: false, status: 404 };
    return {
      ok: true,
      async arrayBuffer() {
        return new Uint8Array([isC5 ? 5 : 4]).buffer;
      },
    };
  };
  const ctx = {
    async decodeAudioData(bytes) {
      decodes++;
      activeDecodes++;
      maxActiveDecodes = Math.max(maxActiveDecodes, activeDecodes);
      await Promise.resolve();
      activeDecodes--;
      return fakeBuffer(new Uint8Array(bytes)[0] === 5 ? 0.18 : 0.2);
    },
  };
  return {
    bank: new FeltPianoBank(fetchImpl),
    ctx,
    counts: () => ({ fetches, decodes, maxActiveDecodes }),
  };
}

{
  const { bank, ctx, counts } = makeFixture();
  const baseURL = new URL('https://example.test/samples/');
  const p1 = bank.prepare(ctx, baseURL);
  const p2 = bank.prepare(ctx, baseURL);
  assert.strictEqual(p1, p2, 'concurrent prepare calls must share one in-flight promise');
  assert.equal(await p1, true);
  assert.equal(bank.state, 'armed');
  assert.deepEqual(counts(), { fetches: 2, decodes: 2, maxActiveDecodes: 1 });
  assert.equal(bank.resolveAttackAnchor(261.63), null, 'armed samples must not hot-switch before a phrase boundary');
  assert.equal(bank.commitAtPhrase(3), false);
  assert.equal(bank.state, 'armed');
  assert.equal(bank.commitAtPhrase(4), true);
  assert.equal(bank.state, 'active');

  const anchor = bank.resolveAttackAnchor(261.63);
  assert.ok(Number.isFinite(anchor.rate) && Number.isFinite(anchor.gain));
  assert.equal(bank.resolveAttackAnchor(1479.98), null, 'out-of-range attack anchors must fail closed');

  // 生产初始调性域：3 个 climate 根 × 8 个 session transpose × 6 套进行。
  // 每套进行的 4 个最低 upper-comp voice 至少 2 个落在 C4/C5 ±6st 窗内，
  // 因而任何 felt-comp universe 下载后都能实际贡献触键，而无需增加 C3/C6。
  const CHORDS = {
    maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], maj9: [0, 4, 7, 11, 14],
    min9: [0, 3, 7, 10, 14], dom9: [0, 4, 7, 10, 14], min11: [0, 3, 7, 10, 17],
  };
  const PROGRESSIONS = [
    [[0, 'maj9'], [9, 'min7'], [2, 'min9'], [7, 'dom9']],
    [[2, 'min9'], [7, 'dom9'], [0, 'maj9'], [9, 'min7']],
    [[9, 'min9'], [5, 'maj7'], [0, 'maj9'], [7, 'dom9']],
    [[0, 'maj9'], [5, 'maj7'], [9, 'min7'], [7, 'dom9']],
    [[0, 'maj7'], [4, 'min7'], [5, 'maj9'], [7, 'dom9']],
    [[9, 'min9'], [2, 'min11'], [7, 'dom9'], [0, 'maj9']],
  ];
  const SESSION_TRANSPOSE = [0, 2, -2, 3, 5, -4, -5, 7];
  assert.match(source, /this\.keyRoot = warm < 0\.4 \? 45 : warm > 0\.7 \? 50 : 48;/);
  assert.match(source, /const SESS_TRANSPOSE = \[0, 2, -2, 3, 5, -4, -5, 7\];/);
  let minAnchorHits = Infinity;
  for (const keyRoot of [45, 48, 50]) {
    for (const transpose of SESSION_TRANSPOSE) {
      const sessKey = keyRoot + transpose;
      for (const progression of PROGRESSIONS) {
        let hits = 0;
        for (const [root, type] of progression) {
          const lowestUpperMidi = sessKey + 12 + root + CHORDS[type][1];
          const freq = 440 * Math.pow(2, (lowestUpperMidi - 69) / 12);
          if (bank.resolveAttackAnchor(freq)) hits++;
        }
        minAnchorHits = Math.min(minAnchorHits, hits);
        assert.ok(hits >= 2, `sessKey=${sessKey} progression lost its felt attack anchors (${hits}/4)`);
      }
    }
  }
  assert.equal(minAnchorHits, 2);

  bank.resetForContext({});
  assert.equal(bank.state, 'idle');
  assert.equal(bank.resolveAttackAnchor(261.63), null);
}

{
  const { bank, ctx } = makeFixture({ failC5: true });
  assert.equal(await bank.prepare(ctx, new URL('https://example.test/samples/')), false);
  assert.equal(bank.state, 'failed');
  assert.equal(bank.resolveAttackAnchor(261.63), null, 'partial family failure must remain fully procedural');
}

{
  let decodeCalls = 0;
  let releaseDecode;
  let markDecodeStarted;
  const decodeStarted = new Promise((resolve) => { markDecodeStarted = resolve; });
  const decodeGate = new Promise((resolve) => { releaseDecode = resolve; });
  const fetchImpl = async () => ({
    ok: true,
    async arrayBuffer() { return new Uint8Array([4]).buffer; },
  });
  const oldCtx = {
    async decodeAudioData() {
      decodeCalls++;
      markDecodeStarted();
      await decodeGate;
      return fakeBuffer(0.2);
    },
  };
  const bank = new FeltPianoBank(fetchImpl);
  const oldPrepare = bank.prepare(oldCtx, new URL('https://example.test/samples/'));
  await decodeStarted;
  bank.resetForContext({});
  releaseDecode();
  assert.equal(await oldPrepare, false);
  assert.equal(decodeCalls, 1, 'stale context must not decode the second asset after reset');
  assert.equal(bank.state, 'idle');
}

{
  const sonifier = new Sonifier();
  let prepareCalls = 0;
  sonifier.started = true;
  sonifier.ens = { comp: 1 };
  sonifier._feltBank = { state: 'idle', prepare() { prepareCalls++; } };
  sonifier.enableFeltPianoSamples(new URL('https://example.test/samples/'));
  assert.equal(prepareCalls, 0, 'sample fetch/decode must not run in the first-note gesture task');
  clearTimeout(sonifier._feltPrepareTimer);
}

{
  const sonifier = new Sonifier();
  let prepareCalls = 0;
  sonifier.started = true;
  sonifier.ctx = {};
  sonifier.muted = true;
  sonifier.ens = { comp: 1 };
  sonifier._feltBank = { state: 'idle', prepare() { prepareCalls++; } };
  sonifier.enableFeltPianoSamples(new URL('https://example.test/samples/'));
  assert.equal(sonifier._feltPrepareTimer, null, 'muted/club mode must not start the sample timer');
  sonifier.setMuted(false);
  assert.ok(sonifier._feltPrepareTimer, 'unmute should make the deferred sample prepare eligible again');
  assert.equal(prepareCalls, 0);
  clearTimeout(sonifier._feltPrepareTimer);
}

{
  const sonifier = new Sonifier();
  let prepareCalls = 0;
  sonifier.started = true;
  sonifier.ctx = {};
  sonifier.ens = { comp: 1 };
  sonifier._feltBank = { state: 'idle', prepare() { prepareCalls++; } };
  sonifier.setPageHidden(true);
  sonifier.enableFeltPianoSamples(new URL('https://example.test/samples/'));
  assert.equal(sonifier._feltPrepareTimer, null, 'hidden page must not start the optional sample timer');
  sonifier.setPageHidden(false);
  assert.ok(sonifier._feltPrepareTimer, 'visibility restore should explicitly re-arm deferred sample prepare');
  assert.equal(prepareCalls, 0);
  clearTimeout(sonifier._feltPrepareTimer);
}

console.log(`PASS: two-root felt-piano bank is atomic, deferred, content-addressed, covers every baseline progression, and ${deployedBytes} bytes`);
