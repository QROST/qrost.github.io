# Architecture History data tools

## Commands

```bash
python3 tools/validate.py
python3 tools/build.py
python3 tools/test_data_contract.py
python3 tools/test_wikidata_pilot.py
python3 tools/test_getty_ulan_pilot.py
```

`validate.py` checks:

- JSON Schema with closed record shapes;
- global ID uniqueness and all foreign keys;
- claim-to-entity and evidence-to-source provenance;
- snapshot revision/hash foreign keys and an explicit human reviewer registry;
- credit preservation and attribution modes;
- exact field claims for every non-empty fact on a verified entity;
- date, coordinate, region, period, and enum constraints;
- strict lineage endpoint, conflict, and cycle gates;
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

The bounded Wikidata hydration workflow is:

```bash
python3 tools/fetch_wikidata_pilot.py --accessed YYYY-MM-DD
python3 tools/fetch_wikidata_type_authorities.py --accessed YYYY-MM-DD
python3 tools/import_wikidata_pilot.py \
  assets/data/source-snapshots/<snapshot>.json
python3 tools/build.py
```

The two fetch scripts are the only networked steps. The work fetcher hydrates
the versioned 532-work seed list. The type-authority fetcher reads exactly six
reviewed class QIDs into a separate sidecar bound to the active work snapshot.
Both pin exact revisions and refuse to overwrite an existing snapshot by
default. `import_wikidata_pilot.py` is deterministic and offline; it requires
the configured authority sidecar and still maps work types only by direct P31
equality. No script promotes records to `verified`, maps inception/opening to a
construction date, traverses P279 for classification, or converts P1066/P802
into mentorship.

The bounded Getty ULAN identity workflow has an explicit review boundary:

```bash
python3 tools/fetch_wikidata_ulan_crosswalk.py --accessed YYYY-MM-DD
# Review, validate, and commit the immutable crosswalk before continuing.
python3 tools/fetch_getty_ulan_pilot.py \
  assets/data/source-snapshots/<wikidata-ulan-crosswalk>.json \
  --accessed YYYY-MM-DD
python3 tools/import_getty_ulan_pilot.py \
  assets/data/catalog \
  assets/data/source-snapshots/<wikidata-ulan-crosswalk>.json \
  assets/data/source-snapshots/<getty-ulan-identity>.json
python3 tools/build.py
```

The crosswalk scans P245 for every person and practice already in the catalog,
then selects exactly 24 review anchors by available work region, known work
period, practice representation, and a stable hash. Selected P245 statements
are pinned to exact Wikidata revisions. The crosswalk is authority-only and
cannot support public claims by itself.

The Getty fetcher refuses an uncommitted or modified crosswalk. It retains only
the canonical ULAN URI, exact Wikidata equivalent, entity type, retrieval
receipt, and Getty contributor/source URIs; display names, descriptions,
relationships, and raw response bodies are discarded. The offline importer can
only add candidate ULAN external identifiers to existing entities. It cannot
create people, practices, works, credits, or lineage relations.
