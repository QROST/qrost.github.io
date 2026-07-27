/* Deterministic public-data loader for Architecture Lineages. */
(function () {
  'use strict';

  const DATA_VERSION = 'e43295a3706deaa4bf05270303a5f52a201daec5e306649f23792c69ae777f23';
  const MANIFEST_SHA256 = '6ee9b85b613a5a4d36d34f377ec9a6a970943193c41f9f2da7a3183fdd6c1620';
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
