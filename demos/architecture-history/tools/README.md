# Architecture History data tools

## Data source of truth (read this first)

The **local SQLite store** (`data/architecture-history.db`, gitignored) is the
single editable authority for the entity graph. All data fixes and additions
happen there first; the public JSON is a projection that must never be hand-edited.

Data flows in **one direction**:

```
SQLite store  ──db.py export──▶  catalog shard  ──build.py──▶  8 public JSON
(data/architecture-history.db)  (assets/data/catalog/       (assets/data/*.json
  edit here                      wikidata-hydration.json)     + manifest, git-tracked)
```

- The catalog shard is retained as an SQLite **export projection** (not the
  Wikidata importer's product anymore) because `validate.py` and
  `test_wikidata_pilot.py` hard-depend on it: validate asserts the public arrays
  equal the catalog merge, and test_wikidata_pilot pins shard sha256s.
- The export is **lossless**: entity/claim/relation payloads are stored complete,
  shard top-level provenance (`generated_from`, `source_id`, `transformer_*`) is
  captured in `schema_meta`, and a roundtrip reproduces the shard byte-for-byte
  (covered by `test_db.py`).

### Everyday edit flow

```bash
# 1. Rebuild the SQLite store from the current shard / public JSON (first time,
#    or after a Wikidata re-hydrate overwrote the shard):
python3 tools/db.py import

# 2. Edit the store directly (SQL) or via a script.
sqlite3 data/architecture-history.db

# 3. Export the store to the shard AND run build.py's full validate/test gate:
python3 tools/db.py export
#    Use --no-build for fast iteration (writes only the shard).

# 4. Review the diff, then commit. Only the 8 public JSON tables + manifest
#    + loader constants + index.html tokens change in git:
git diff --stat assets/data/ index.html assets/js/data-loader.js
git commit
```

### Proven re-hydrate sequence (2026-08-14)

The `preserve_verification_state()` path mixes old-snapshot evidence into a
fresh snapshot and breaks provenance gates; use a **fresh import** instead:

1. Edit seeds (`tools/wikidata-hydration-seeds.json`) and the country authority
   in the coverage config; commit the intake change.
2. `python3 tools/fetch_wikidata_pilot.py --accessed YYYY-MM-DD`
3. Rebind `tools/wikidata-work-type-authority-seeds.json`
   (`base_work_snapshot_id` -> the new snapshot id), run
   `fetch_wikidata_type_authorities.py --accessed YYYY-MM-DD`, and point the
   coverage config `work_type_derivation.authority_bindings[0].snapshot_id`
   at the new sidecar.
4. Move the old catalog shard away, then
   `import_wikidata_pilot.py <new snapshot>` (fresh, no preserve).
5. Run the editorial scripts on the shard (they edit the shard, not SQLite):
   `promote_place_verification.py` → `agentic_review_person.py` →
   `agentic_review_practice.py` → `agentic_review_work.py`.
   `promote_place_verification.py` needs a ULAN crosswalk on disk — regenerate
   with `fetch_wikidata_ulan_crosswalk.py` if it was cleaned up.
6. `python3 tools/db.py import` (absorbs the editorial state into SQLite).
7. Re-apply the region backfill from `data/region-snapshot.json` via
   `apply_region_backfill.py`, then **align verified entities to their
   verified `field_region`/`field_country_codes` claims** — a backfill that
   overwrites a region already covered by a verified claim breaks the
   "verified field lacks an exact verified claim" gate. Claims win over
   backfill; backfill only fills fields without claims. Also restore
   `last_verified` to a date string on any entity demoted by the backfill.
8. `python3 tools/db.py export` (full validate + test gates), update pinned
   counts/sha256s in `test_wikidata_pilot.py`, refresh
   `data/region-snapshot.json` from the store for the next cycle, delete stale
   crosswalk snapshots, and commit.

### Wikidata re-hydrate (non-daily, only when pulling fresh Wikidata data)

The fetch→import pipeline below produces a new shard from Wikidata; afterwards
run `db.py import` to absorb it into the SQLite store (verification state is
preserved by `import_wikidata_pilot.py`'s `preserve_verification_state()`).
This path is **not** for routine data corrections — those go through SQLite.

## Commands

```bash
python3 tools/validate.py
python3 tools/build.py
python3 tools/test_data_contract.py
python3 tools/test_wikidata_pilot.py
python3 tools/test_wikidata_coverage.py
python3 tools/test_expand_coverage_selection.py
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
python3 tools/agentic_review_practice.py --limit 50 --reviewed-at YYYY-MM-DD
python3 tools/agentic_review_work.py --limit 50 --reviewed-at YYYY-MM-DD
python3 tools/build.py
```

`promote_place_verification.py` verifies place name/identity/region/country fields.
`agentic_review_person.py` / `agentic_review_practice.py` / `agentic_review_work.py` verify people, practices, and no-credit works (or in bounded batches) when
every meaningful field has revision-pinned `structured_mapping` evidence and
P106 supports `architect` roles. Neither script maps inception/opening to a
construction date, traverse P279 for classification, or convert P1066/P802
into mentorship.

The Wikidata coverage discovery workflow is separate from curated seed-work import:

```bash
# Full 72-cell matrix (~78 minutes at 1 SPARQL req/min)
python3 tools/fetch_wikidata_coverage.py --accessed YYYY-MM-DD

# Smoke test: first N cells only
python3 tools/fetch_wikidata_coverage.py --accessed YYYY-MM-DD --max-cells 2
```

`fetch_wikidata_coverage.py` is the only networked coverage step. It runs the
configured 9×8 region/period grid against `query.wikidata.org`, sleeps at least
65 seconds between SPARQL requests, selects up to eight works per cell by stable
hash without popularity signals, and pins selected work entities to exact
revisions via Special:EntityData. Creator entities are classified for
`eligible_credits` only and are not stored in the snapshot. The script refuses
to overwrite an existing output path unless `--force` is passed. Coverage cells
remain `not_run` in the public manifest until a coverage snapshot is committed.

To deepen coverage from an existing snapshot without re-running SPARQL, use
newest-first period waves:

```bash
python3 tools/expand_coverage_selection.py \
  --snapshot assets/data/source-snapshots/wikidata-coverage-2026-08-07-b976a0d3ce82.json \
  --per-cell 8 \
  --period-order newest_first \
  --output assets/data/source-snapshots/wikidata-coverage-expanded.json

python3 tools/promote_coverage_to_seeds.py \
  --coverage assets/data/source-snapshots/wikidata-coverage-expanded.json \
  --seeds tools/wikidata-hydration-seeds.json \
  --periods 2000_present,1980_1999,1946_1979 \
  --output tools/wikidata-hydration-seeds-promoted.json

python3 tools/fetch_wikidata_pilot.py --accessed YYYY-MM-DD \
  --seeds tools/wikidata-hydration-seeds-promoted.json
```

`expand_coverage_selection.py` reselects from stored `candidate_work_qids`.
`promote_coverage_to_seeds.py` appends unseen selected works into the hydration
seed catalog for pilot fetch/import. Run additional period waves (for example
`1919_1945,1800_1918`) after earlier waves are hydrated.

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
