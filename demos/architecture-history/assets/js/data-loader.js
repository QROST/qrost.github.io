/* Deterministic public-data loader for Architecture Lineages. */
(function () {
  'use strict';

  const DATA_VERSION = '06ca1289f72fd2c0d3e5e9a72b0c9ae319d3997c0a9fb2a9c4a5701ec3aa1985';
  const MANIFEST_SHA256 = '34da167308e4ede4ae3432339f532d904b3ed8d51d129d13b52aca05debd5ce9';
  const SCHEMA_ID = 'architecture-lineages';
  const SCHEMA_VERSION = '1.5.0';
  const MANIFEST_FILE = 'manifest.json';
  const CLAIMS_FILE = 'claims.json';
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
  let claimsCache = null;
  let claimsPromise = null;

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

  async function loadClaims() {
    if (claimsCache) return claimsCache;
    if (claimsPromise) return claimsPromise;
    claimsPromise = (async function () {
      if (!manifestCache) await load();
      const expected = manifestCache.files && manifestCache.files[CLAIMS_FILE];
      if (!expected) throw new Error('Manifest does not declare ' + CLAIMS_FILE);
      const payload = await fetchJson(CLAIMS_FILE, expected);
      const records = assertCount(
        assertArray(payload, 'claims', CLAIMS_FILE),
        manifestCache,
        CLAIMS_FILE
      );
      claimsCache = records;
      return records;
    })();
    try {
      return await claimsPromise;
    } catch (error) {
      // A transient local-server or cache failure can be retried from the
      // visible detail fallback without weakening hash/count validation.
      claimsPromise = null;
      throw error;
    }
  }

  window.ARCH_DATA = {
    DATA_VERSION: DATA_VERSION,
    MANIFEST_SHA256: MANIFEST_SHA256,
    load: load,
    loadClaims: loadClaims,
  };
})();
