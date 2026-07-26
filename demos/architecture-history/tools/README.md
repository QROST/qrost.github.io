# Architecture History data tools

## Commands

```bash
python3 tools/validate.py
python3 tools/build.py
python3 tools/test_data_contract.py
```

`validate.py` checks:

- JSON Schema with closed record shapes;
- global ID uniqueness and all foreign keys;
- claim-to-entity and evidence-to-source provenance;
- snapshot revision/hash foreign keys and an explicit human reviewer registry;
- credit preservation and attribution modes;
- exact field claims for every non-empty fact on a verified entity;
- date, coordinate, region, period, and enum constraints;
- strict lineage/game eligibility gates;
- a required manifest whose complete counts, coverage, version, and hashes are
  independently re-derived.

`build.py`:

1. hashes every committed source/data file except `manifest.json`;
2. derives counts and coverage summaries;
3. writes canonical `manifest.json`;
4. refreshes the data version and local CSS/JS cache tokens when the page exists;
5. runs `validate.py` and fails if validation fails.

Catalog shards and source snapshots use source-specific closed schemas. The
current snapshot schema is intentionally Wikidata-specific; a new provider must
add its own schema and validator instead of imitating QIDs or `lastrevid`.

The build is offline. Network adapters must first produce a versioned,
redistributable snapshot or an evidence pack; the public build never depends on
a live API.
