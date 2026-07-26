# Architecture Lineages / 建筑谱系

`architecture-history` is QROST's bilingual, source-first atlas of architects,
practices, built works, places, credits, and documented knowledge-transfer
relationships.

The project is intentionally a **curated pilot**, not a claim to have completed
global architectural history. Public counts distinguish discovered candidates,
reviewed facts, contested claims, and gaps in coverage.

## Data authority

The public data graph lives in `assets/data/`:

- `source-registry.json` — source access, reuse, attribution, and bias decisions;
- `people.json`, `practices.json`, `places.json`, `works.json` — entities;
- `claims.json` — field- and relation-level evidence;
- `relations.json` — typed relationships, never inferred from visual similarity;
- `manifest.json` — content hashes, counts, and coverage derived by the build.

Work records preserve each named contributor, role, project phase, and claim.
`credit_set_completeness` separately records whether that list is unknown,
partial, merely complete according to one source, or independently reviewed as
complete. A missing name is never silently treated as a sole-author credit.

The local schema follows Getty CDWA/CONA cataloging guidance and keeps crosswalks
to Getty Vocabularies, Wikidata, and other authority files where available.
Linked Art and CIDOC CRM are integration references; the site schema is a compact
product model, not a replacement standard.

## Verification states

- `candidate` — discovered from a source, not yet reviewed as a public fact;
- `verified` — schema, provenance, foreign keys, and editorial review passed;
- `contested` — reliable evidence conflicts;
- `declined` — the proposed claim is not supported.

Only explicitly documented `direct_mentor`, `apprenticed_under`, and
`formal_teacher` relationships can ever become game-upgrade candidates.
Employment, co-location, shared schools, collaboration, chronology, and stylistic
similarity do not imply mentorship.

## Build

```bash
python3 tools/build.py
```

The build regenerates `assets/data/manifest.json`, validates the full foreign-key
graph, refreshes content-derived asset tokens when the page exists, and fails
closed on provenance or eligibility errors.

Research notes and raw working material live under `tmp/research/` and are
gitignored. Redistributable, minimized source snapshots used for reproducible
public builds may be committed under `assets/data/source-snapshots/`.
