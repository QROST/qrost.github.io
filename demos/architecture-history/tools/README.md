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
- credit preservation and attribution modes;
- date, coordinate, region, period, and enum constraints;
- strict lineage/game eligibility gates;
- content hashes and counts when a manifest exists.

`build.py`:

1. hashes every committed source/data file except `manifest.json`;
2. derives counts and coverage summaries;
3. writes canonical `manifest.json`;
4. refreshes the data version and local CSS/JS cache tokens when the page exists;
5. runs `validate.py` and fails if validation fails.

The build is offline. Network adapters must first produce a versioned,
redistributable snapshot or an evidence pack; the public build never depends on
a live API.
