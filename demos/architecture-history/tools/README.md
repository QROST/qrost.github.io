# Architecture History data tools

## Commands

```bash
python3 tools/validate.py
python3 tools/build.py
python3 tools/test_data_contract.py
python3 tools/test_wikidata_pilot.py
python3 tools/test_wikidata_coverage.py
python3 tools/test_getty_ulan_pilot.py
```

`validate.py` checks:

- JSON Schema with closed record shapes;
- global ID uniqueness and all foreign keys;
- claim-to-entity and evidence-to-source provenance;
- snapshot revision/hash foreign keys and an explicit human/agentic reviewer registry;
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
the versioned 559-work seed list. The type-authority fetcher reads exactly six
reviewed class QIDs into a separate sidecar bound to the active work snapshot.
Both pin exact revisions and refuse to overwrite an existing snapshot by
default. `import_wikidata_pilot.py` is deterministic and offline; it requires
the configured authority sidecar and still maps work types only by direct P31
equality. Country-place editorial promotion is the exception:

```bash
python3 tools/promote_place_verification.py --reviewed-at YYYY-MM-DD
python3 tools/agentic_review_person.py --limit 20 --reviewed-at YYYY-MM-DD
python3 tools/build.py
```

`promote_place_verification.py` verifies place name/identity/region/country fields.
`agentic_review_person.py` verifies people one-by-one (or in bounded batches) when
every meaningful field has revision-pinned `structured_mapping` evidence and
P106 supports `architect` roles. Neither script maps inception/opening to a
construction date, traverse P279 for classification, or convert P1066/P802
into mentorship.

The Wikidata coverage discovery workflow is separate from hydration fixtures:

```bash
# Full 72-cell matrix (~78 minutes at 1 SPARQL req/min)
python3 tools/fetch_wikidata_coverage.py --accessed YYYY-MM-DD

# Smoke test: first N cells only
python3 tools/fetch_wikidata_coverage.py --accessed YYYY-MM-DD --max-cells 2
```

`fetch_wikidata_coverage.py` is the only networked coverage step. It runs the
configured 9×8 region/period grid against `query.wikidata.org`, sleeps at least
65 seconds between SPARQL requests, selects up to four works per cell by stable
hash without popularity signals, and pins selected work entities to exact
revisions via Special:EntityData. Creator entities are classified for
`eligible_credits` only and are not stored in the snapshot. The script refuses
to overwrite an existing output path unless `--force` is passed. Coverage cells
remain `not_run` in the public manifest until a coverage snapshot is committed.

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
relationships, and raw response bodies are discarded. Only an exact reciprocal
Getty → Wikidata link is accepted; missing or conflicting backlinks remain
screening rejection receipts and never produce public claims. The offline
importer can only add candidate ULAN external identifiers to existing entities.
It cannot create people, practices, works, credits, or lineage relations. The
validator reconstructs the complete expected overlay from the accepted snapshot
records and rejects any changed identity, claim, attribution URI, or ordering.
If `vocab.getty.edu` returns HTTP 499 / service-degraded, stop: do not invent
identity patches from HTML display pages.

Chinese-name seeds for people missing Wikidata `zh`/`zh-hans` labels:

```bash
python3 tools/fetch_name_zh_seeds.py --accessed YYYY-MM-DD
# Review tools/name-zh-seeds.json; seeds must stay empty unless reciprocal
# enwiki/zhwiki → Wikidata ownership matches the person QID.
python3 tools/apply_name_zh_seeds.py   # optional catalog patch path
# or re-import; import_wikidata_pilot.py loads tools/name-zh-seeds.json
python3 tools/build.py
```

`fetch_name_zh_seeds.py` rejects sitelinks or langlinks whose Wikipedia page
`wikibase_item` does not equal the person QID (guards against building/work
pages wrongly attached to people). Do not mass-fill `name_zh` by transliteration.
