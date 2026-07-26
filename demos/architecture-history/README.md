# Architecture Lineages / 建筑谱系

`architecture-history` is QROST's bilingual, source-first atlas of architects,
practices, built works, places, credits, and documented knowledge-transfer
relationships.

The project is intentionally a **curated pilot**, not a claim to have completed
global architectural history. Public counts distinguish discovered candidates,
reviewed facts, contested claims, and gaps in coverage.

The first committed hydration pilot contains 19 cross-regional work fixtures,
33 people, 2 practices, 16 country-place records, 11 raw relationship review
edges, and 233 source claims. Every one remains `candidate`; the reviewer
registry is empty and the published verified count is therefore zero.

## Data authority

The public data graph lives in `assets/data/`:

- `source-registry.json` — source access, reuse, attribution, and bias decisions;
- `reviewers.json` — explicitly authorized human editorial reviewers;
- `people.json`, `practices.json`, `places.json`, `works.json` — entities;
- `claims.json` — field- and relation-level evidence;
- `relations.json` — typed relationships, never inferred from visual similarity;
- `manifest.json` — content hashes, counts, and coverage derived by the build.

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

The pilot reuses 19 deliberately varied, source-derived QIDs across nine
macroregions. They are mapping fixtures, not a popularity ranking or a
representative global sample. For each seed and direct dependency, the adapter:

1. fetches the latest `Special:EntityData` JSON and reads `lastrevid`;
2. refetches the exact revision through the `revision` query parameter;
3. rejects redirects, merges, missing entities, or revision mismatches;
4. saves the pinned URL, canonical minimized-record hash, qualifiers, and
   references;
5. derives a source-scoped catalog whose records all remain candidates.

The planned discovery frame is fixed at 9 macroregions × 8 periods (72 cells),
but every cell is currently `not_run`. No global coverage percentage is claimed.
The discovery ontology uses an exact P31 allowlist and explicitly avoids an
unbounded online P279 traversal.

## Verification states

- `candidate` — discovered from a source, not yet reviewed as a public fact;
- `verified` — schema, provenance, foreign keys, and editorial review passed;
- `contested` — reliable evidence conflicts;
- `declined` — the proposed claim is not supported.

Only explicitly documented `direct_mentor`, `master_of_apprentice`, and
`formal_teacher` relationships may later be considered by the separate game
build.
Employment, co-location, shared schools, collaboration, chronology, and stylistic
similarity do not imply mentorship.

All directional knowledge-transfer edges run from predecessor to successor:
mentor → mentee, master → apprentice, and teacher → student. The relation type is
`master_of_apprentice`, avoiding the ambiguous direction of “apprenticed under.”
Raw Wikidata P1066 discovery is stored separately as `student_of_recorded` and is
not treated as mentorship without human reclassification and stronger evidence.
Game readiness is deliberately not stored as an editable historical-data field:
the future game project must derive it from the then-current verified,
conflict-free graph and its own versioned rules.

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
