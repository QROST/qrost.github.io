# Architecture Lineages / 建筑谱系

`architecture-history` is QROST's bilingual, source-first atlas of architects,
practices, built works, places, credits, and documented knowledge-transfer
relationships.

The project is intentionally a **curated pilot**, not a claim to have completed
global architectural history. Public counts distinguish discovered candidates,
reviewed facts, contested claims, and gaps in coverage.

The current catalog contains 1152 works, 1197 people, 63 practices, 57
country-place records, 939 relationship edges, and 13,907 source claims. Exact
direct-P31 mapping currently classifies 888 works, while 230 remain unmapped and
34 remain ambiguous. Wikidata is the primary structured source; a refreshed
24-anchor Getty ULAN P245 crosswalk is regenerated locally per re-hydrate
(gitignored infra), but the reciprocal Getty identity overlay is blocked as of
2026-08-07 because `vocab.getty.edu` returns HTTP 499 (`Service temporarily
degraded`) for JSON-LD and RDF downloads. Public people therefore still carry
zero `ulan` external ids. Agentic verification (`reviewer-agentic-cursor`,
2026-08-23) currently covers all 57 country places, all 63 practices, 257
people, and 104 works (481 verified entities and relations). Known-period works
stay candidate because `field_period` is only indirectly evidenced from
P571/P1619. All 945 relations remain `candidate` by design — Wikidata's
relationship dimension is `candidate`-authority, so verified lineage requires a
stronger source (Getty ULAN relationships, academic literature) than Wikidata
alone provides.

## Data authority

The **local SQLite store** (`data/architecture-history.db`, gitignored) is the
single editable source of truth. Edits flow one direction — SQLite → catalog
shard → public JSON — via `python3 tools/db.py export` (which also runs the
full validate/test gate). The public JSON below is a projection; never hand-edit
it. See `tools/README.md` for the complete edit flow and the Wikidata re-hydrate
path.

Evidence is accepted only from publishers registered as
`independent_external`. QROST's own research briefs are never an information
source or evidence authority. / 证据只接受登记为 `independent_external`
的独立外部发布者；QROST 自写研究简报不作为信息来源或证据权威。

The public data graph lives in `assets/data/`:

- `source-registry.json` — source access, reuse, attribution, and bias decisions;
- `reviewers.json` — explicitly authorized human or agentic editorial reviewers;
- `people.json`, `practices.json`, `places.json`, `works.json` — entities;
- `claims.json` — field- and relation-level evidence;
- `relations.json` — typed relationships, never inferred from visual similarity;
- `manifest.json` — content hashes, counts, and coverage derived by the build.

The browser loads the entity graph first and fetches `claims.json` only when a
reader opens an entity or relation detail. The deferred request is still bound
to the manifest SHA-256 and record count; a failed evidence request leaves the
summary usable, shows a retryable error, and never falls back to unverified
bytes. The catalog filters and sorts the full in-memory entity set, then renders
100 records per page (at most 200 record views across the desktop table and
mobile card container).

Work records preserve each named contributor, role, project phase, and claim.
`credit_set_completeness` separately records whether that list is unknown,
partial, merely complete according to one source, or independently reviewed as
complete. A missing name is never silently treated as a sole-author credit.

Source availability is not adapter readiness. `adapter_status` reports
implementation evidence (`not_implemented`, `fixture_only`, `tested`, or
`production_ready`) independently from API keys, subscriptions, and legal reuse.
Discovery-only sources may locate bibliography but cannot directly publish facts.
`allowed_operations` is this project's fail-closed decision after considering
source rights, access terms, and local policy; it does not describe every action
the provider might technically or legally permit.

The local schema follows Getty CDWA/CONA cataloging guidance and keeps crosswalks
to Getty Vocabularies, Wikidata, and other authority files where available.
Linked Art and CIDOC CRM are integration references; the site schema is a compact
product model, not a replacement standard.

## Wikidata hydration pilot

The pilot reuses 559 deliberately curated, source-derived QIDs across nine
macroregions. They are mapping seed works, not a popularity ranking or a
representative global sample. For each seed and direct dependency, the adapter:

1. fetches the latest `Special:EntityData` JSON and reads `lastrevid`;
2. refetches the exact revision through the `revision` query parameter;
3. rejects redirects, merges, missing entities, or revision mismatches;
4. saves the pinned URL, canonical minimized-record hash, qualifiers, and
   references;
5. derives a source-scoped catalog whose records all remain candidates.

A separate six-record work-type authority sidecar pins the exact Wikidata class
revisions used by the newest P31 mappings. It is bound to the active work
snapshot, and its P279 statements are retained only for audit context. The
importer never traverses P279 to classify a work.

The planned discovery frame is fixed at 9 macroregions × 8 periods (72 cells),
and the first coverage discovery snapshot has now run all 72 cells (67 sampled, 5 empty_observed). No global coverage percentage is claimed from seed works alone.
The discovery ontology uses an exact P31 allowlist and explicitly avoids an
unbounded online P279 traversal.

## Getty ULAN identity pilot

The active catalog crosswalk scans P245 for every person and practice already
imported, then selects exactly 24 review anchors by region/period coverage and a
stable hash. Selected P245 statements are pinned to exact Wikidata revisions
before any Getty request. The crosswalk is authority-only and cannot publish
identity claims by itself.

A live Getty fetch on 2026-08-07 against `https://vocab.getty.edu/ulan/{id}`
(JSON-LD) and the RDF download redirect both returned HTTP 499. The HTML ULAN
display pages still respond, but they are not an accepted identity adapter. No
new `getty-ulan-identity` snapshot was written for the expanded catalog; public
people keep `ulan` absent until Getty LOD recovers and the reciprocal importer
re-runs.

Earlier pilot fixtures and offline tests still exercise the accept/screen
boundary: only an exact Getty → Wikidata reciprocal link may patch an existing
person. Missing or conflicting backlinks become screening rejections and never
create entities or lineage edges.

## Verification states

- `candidate` — discovered from a source, not yet reviewed as a public fact;
- `verified` — schema, provenance, foreign keys, and editorial review passed;
- `contested` — reliable evidence conflicts;
- `declined` — the proposed claim is not supported.

Only explicitly documented `direct_mentor`, `master_of_apprentice`, and
`formal_teacher` relationships may become verified lineage records.
Employment, co-location, shared schools, collaboration, chronology, and stylistic
similarity do not imply mentorship.

All directional knowledge-transfer edges run from predecessor to successor:
mentor → mentee, master → apprentice, and teacher → student. The relation type is
`master_of_apprentice`, avoiding the ambiguous direction of “apprenticed under.”
Raw Wikidata P1066 discovery is stored separately as `student_of_recorded` and is
not treated as mentorship without human reclassification and stronger evidence.
Editorial verification is deliberately stored separately from source records.
The library preserves candidate, contested, and declined states so readers can
inspect uncertainty without silently rewriting the historical evidence.

Curated person seeds are display-admission records, not lineage-expansion
anchors. Only architecture-occupation people, credited contributors, and
architecture practices can anchor the bounded relation traversal. An unmapped
P106 occupation is published as `unknown`, never silently relabeled
`historian`; curated theorists, historians, critics, and engineer-builders do
not pull their unrelated neighbors into the graph merely because they were
selected for display.

## Build

```bash
python3 tools/build.py
```

The build regenerates `assets/data/manifest.json`, validates the full foreign-key
graph, refreshes content-derived asset tokens when the page exists, and fails
closed on provenance or verification errors. Generated public arrays are merged
from source-scoped `assets/data/catalog/*.json` shards; failed builds restore all
generated outputs instead of leaving a half-written tree.

Research notes and raw working material live under `tmp/research/` and are
gitignored. Redistributable, minimized source snapshots used for reproducible
public builds may be committed under `assets/data/source-snapshots/`.
