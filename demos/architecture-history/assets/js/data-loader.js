/* Deterministic public-data loader for Architecture Lineages. */
(function () {
  'use strict';

  const DATA_VERSION = 'f13952f7f05a0062b51a69bfea48719a96a1059d92ec6ab07f6dd1b43c6e00ff';
  const MANIFEST_SHA256 = '19ad1b536c523bebb6aa720afa4b06e28a22fe6966195bd0eb66f3c3422356d7';
  const SCHEMA_ID = 'architecture-lineages';
  const SCHEMA_VERSION = '1.5.0';
  const MANIFEST_FILE = 'manifest.json';
  const CLAIMS_SHARD_COUNT = 32;
  const CLAIMS_DIR = 'claims';
  const INITIAL_FILES = {
    works: 'works.json',
    people: 'people.json',
    practices: 'practices.json',
    places: 'places.json',
    relations: 'relations.json',
    sources: 'source-registry.json',
    coverageConfig: 'methodology/wikidata-coverage-config.json',
  };

  let cache = null;
  let manifestCache = null;
  const claimsShardCache = new Map();
  const claimsShardPromises = new Map();

  function assertArray(payload, key, filename) {
    if (!payload || !Array.isArray(payload[key])) {
      throw new Error('Invalid architecture-history payload: ' + filename + ' → ' + key);
    }
    return payload[key];
  }

  function bytesToHex(bytes) {
    return Array.from(new Uint8Array(bytes), function (value) {
      return value.toString(16).padStart(2, '0');
    }).join('');
  }

  async function fetchJson(filename, expectedFile) {
    const token = expectedFile ? expectedFile.sha256.slice(0, 16) : DATA_VERSION.slice(0, 16);
    const response = await fetch(
      'assets/data/' + filename + '?v=' + token,
      { credentials: 'same-origin' }
    );
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ' while loading ' + filename);
    }
    const bytes = await response.arrayBuffer();
    if (expectedFile) {
      if (!window.crypto || !window.crypto.subtle) {
        throw new Error('Web Crypto is required to verify ' + filename);
      }
      const digest = await window.crypto.subtle.digest('SHA-256', bytes);
      const actual = bytesToHex(digest);
      if (actual !== expectedFile.sha256) {
        throw new Error('SHA-256 mismatch while loading ' + filename);
      }
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }

  function assertCount(records, manifest, filename) {
    const expected = manifest.files && manifest.files[filename];
    if (!expected) throw new Error('Manifest does not declare ' + filename);
    if (records.length !== expected.count) {
      throw new Error(
        'Manifest count mismatch for ' + filename + ': expected ' +
        expected.count + ', received ' + records.length
      );
    }
    return records;
  }

  // Must stay identical to tools/claims_shards.py: FNV-1a over the UTF-8
  // bytes of the subject id, mod the shard count.
  function claimsBucket(subjectId) {
    const bytes = new TextEncoder().encode(subjectId);
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      // Math.imul keeps the multiplication in 32-bit integers; a plain float64
      // multiply loses precision above 2^53 and drifts from the Python bucket.
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash % CLAIMS_SHARD_COUNT;
  }

  function claimsShardFile(index) {
    return CLAIMS_DIR + '/shard-' + String(index).padStart(2, '0') + '.json';
  }

  async function loadClaimsShard(index) {
    if (claimsShardCache.has(index)) return claimsShardCache.get(index);
    if (claimsShardPromises.has(index)) return claimsShardPromises.get(index);
    const filename = claimsShardFile(index);
    const request = (async function () {
      if (!manifestCache) await load();
      const expected = manifestCache.files && manifestCache.files[filename];
      if (!expected) throw new Error('Manifest does not declare ' + filename);
      const payload = await fetchJson(filename, expected);
      return assertCount(
        assertArray(payload, 'claims', filename),
        manifestCache,
        filename
      );
    })();
    claimsShardPromises.set(index, request);
    try {
      const records = await request;
      claimsShardCache.set(index, records);
      return records;
    } catch (error) {
      // A transient local-server or cache failure can be retried from the
      // visible detail fallback without weakening hash/count validation.
      claimsShardPromises.delete(index);
      throw error;
    }
  }

  async function loadClaimsForSubject(subjectId) {
    if (typeof subjectId !== 'string' || !subjectId) {
      throw new Error('A subject id is required to load claims');
    }
    const shard = await loadClaimsShard(claimsBucket(subjectId));
    return shard.filter(function (claim) {
      return claim.subject_id === subjectId;
    });
  }

  async function load() {
    if (cache) return cache;
    const manifest = await fetchJson(MANIFEST_FILE, { sha256: MANIFEST_SHA256 });
    if (
      !manifest ||
      manifest.schema_id !== SCHEMA_ID ||
      manifest.schema_version !== SCHEMA_VERSION ||
      manifest.hash_algorithm !== 'sha256' ||
      manifest.data_version !== DATA_VERSION
    ) {
      throw new Error('Data manifest and loader version do not match');
    }
    const entries = await Promise.all(
      Object.entries(INITIAL_FILES).map(async function (entry) {
        const expected = manifest.files && manifest.files[entry[1]];
        if (!expected) throw new Error('Manifest does not declare ' + entry[1]);
        return [entry[0], await fetchJson(entry[1], expected)];
      })
    );
    const raw = Object.assign({ manifest: manifest }, Object.fromEntries(entries));
    const data = {
      manifest: raw.manifest,
      coverageConfig: raw.coverageConfig,
      works: assertCount(
        assertArray(raw.works, 'works', INITIAL_FILES.works),
        manifest,
        INITIAL_FILES.works
      ),
      people: assertCount(
        assertArray(raw.people, 'people', INITIAL_FILES.people),
        manifest,
        INITIAL_FILES.people
      ),
      practices: assertCount(
        assertArray(raw.practices, 'practices', INITIAL_FILES.practices),
        manifest,
        INITIAL_FILES.practices
      ),
      places: assertCount(
        assertArray(raw.places, 'places', INITIAL_FILES.places),
        manifest,
        INITIAL_FILES.places
      ),
      relations: assertCount(
        assertArray(raw.relations, 'relations', INITIAL_FILES.relations),
        manifest,
        INITIAL_FILES.relations
      ),
      sources: assertCount(
        assertArray(raw.sources, 'sources', INITIAL_FILES.sources),
        manifest,
        INITIAL_FILES.sources
      ),
      dataVersion: DATA_VERSION,
    };
    manifestCache = manifest;
    cache = data;
    return data;
  }

  window.ARCH_DATA = {
    DATA_VERSION: DATA_VERSION,
    MANIFEST_SHA256: MANIFEST_SHA256,
    CLAIMS_SHARD_COUNT: CLAIMS_SHARD_COUNT,
    claimsBucket: claimsBucket,
    load: load,
    loadClaimsForSubject: loadClaimsForSubject,
  };
})();
