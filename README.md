# qrost.github.io

## Demo structure

- `demos/architecture-history/` — 建筑谱系 · Architecture Lineages, a bilingual source-first architectural-history evidence browser with revision-pinned candidate records, searchable map/catalog, field-level provenance, raw relation review, and an explicit 9-region × 8-period coverage ledger.
- `demos/wfoe-china/` contains the China WFOE + hiring costs interactive page.
- `demos/china-housing/` — small-city housing & rent data visualization.
- `demos/china-auto/` — China auto city atlas: 28 cities (17 core + 11 specialist), 168 companies/brands, 56 auto media titles (including national review-video KOLs) grouped by beat, every org has a headquarters city, pinyin/initials search, HQ vs plant vs battery/software roles, clusters and sourced 2025 local output figures.
- `demos/pebble-beach-2027/` — Pebble Beach 2027 · current bilingual planning guide. Seven official signature-event date ranges are recorded, including Concours Sunday on August 15; schedules, prices, routes, maps, brand programs, lodging, and travel details stay visibly partial or pending until year-specific sources are verified.
- `demos/pebble-beach-2026/` — Pebble Beach 2026 · frozen historical archive of the complete public guide. Its itinerary, prices, Tour route, parking diagrams, brand programs, and travel judgments apply to that edition only and are not carried into 2027.
- `demos/china-industrial-software/` — China industrial software survey.
- `demos/pharm-companies/` — global pharmaceutical industry atlas.
- `demos/visual-page/` — 数渊 · Data Abyss (generative-art cosmos fusing housing + industrial + pharma + shelter-cats data into a self-organizing star field, with a waking intro, an emergent generative lo-fi soundtrack, and a tape-flip "radio side" mechanic that periodically turns to a new mix).
- `demos/neon-abyss/` — 霓虹渊 · Neon Abyss, the after-dark twin of Data Abyss: the same chaotic-attractor star field + SOM, set to a generative 138 BPM trance soundtrack with a 15–25 min DJ-set arc (warmup → lift → peak → afterglow) and an optional silent-mode "bring your own DJ" mic-driven beat pulse.
- `demos/cat-and-mouse/` — Cat & Mouse · 猫鼠之间, a top-down interactive cat that watches, stalks and chases through an articulated four-phase gait, then sits, loafs, lies down, rolls or curls up when left alone.
- `demos/makoauto/` — multi-page prototype for a customizable silicone U.S. license-plate frame.
- `demos/shelter-cats/` — world platform for shelter-cat adoption.

## Public identity and hosting

- QROST's current canonical origin is `https://qrost.github.io/`; this project does not own or use `qrost.com`.
- `https://curious-arc.com/` is the CuriousArc studio site. QROST remains its public lab and full experiment index.
- Individual demos may later use ChatGPT Sites or another runtime host, while this repository remains the source, data, build, and validation authority. Do not change a demo's canonical URL until its migration and legacy-link compatibility are complete.

## URL note

- The legacy root URL `/china-business.html` has been removed on purpose.
- Use `/demos/wfoe-china/index.html` instead.

## Checks

- Run `python3 tools/check_public_metadata.py` to verify that the root page and every linked public demo use one matching `qrost.github.io` canonical and Open Graph URL.
