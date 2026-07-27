/* Deterministic public-data loader for Architecture Lineages. */
(function () {
  'use strict';

  const DATA_VERSION = 'c82c4c17a18ffca22ff62021e40f5160e73863db861f48182020f552aa4ff30c';
  const MANIFEST_SHA256 = '1bfc2034a4d3b70a8ae2334487a391a764bfc6d23d8e28e3b95f0c6aa85b1332';
  const SCHEMA_ID = 'architecture-lineages';
  const SCHEMA_VERSION = '1.4.0';
  const FILES = {
    manifest: 'manifest.json',
    works: 'works.json',
    people: 'people.json',
    practices: 'practices.json',
    places: 'places.json',
    relations: 'relations.json',
    claims: 'claims.json',
    sources: 'source-registry.json',
    coverageConfig: 'methodology/wikidata-coverage-config.json',
  };

  let cache = null;

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
    const manifest = await fetchJson(FILES.manifest, { sha256: MANIFEST_SHA256 });
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
      Object.entries(FILES).filter(function (entry) {
        return entry[0] !== 'manifest';
      }).map(async function (entry) {
        const expected = manifest.files && manifest.files[entry[1]];
        if (!expected) throw new Error('Manifest does not declare ' + entry[1]);
        return [entry[0], await fetchJson(entry[1], expected)];
      })
    );
    const raw = Object.assign({ manifest: manifest }, Object.fromEntries(entries));
    const data = {
      manifest: raw.manifest,
      coverageConfig: raw.coverageConfig,
      works: assertCount(assertArray(raw.works, 'works', FILES.works), manifest, FILES.works),
      people: assertCount(assertArray(raw.people, 'people', FILES.people), manifest, FILES.people),
      practices: assertCount(
        assertArray(raw.practices, 'practices', FILES.practices),
        manifest,
        FILES.practices
      ),
      places: assertCount(assertArray(raw.places, 'places', FILES.places), manifest, FILES.places),
      relations: assertCount(
        assertArray(raw.relations, 'relations', FILES.relations),
        manifest,
        FILES.relations
      ),
      claims: assertCount(assertArray(raw.claims, 'claims', FILES.claims), manifest, FILES.claims),
      sources: assertCount(assertArray(raw.sources, 'sources', FILES.sources), manifest, FILES.sources),
      dataVersion: DATA_VERSION,
    };
    cache = data;
    return data;
  }

  window.ARCH_DATA = {
    DATA_VERSION: DATA_VERSION,
    MANIFEST_SHA256: MANIFEST_SHA256,
    load: load,
  };
})();
