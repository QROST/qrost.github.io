# qrost.github.io

## Demo structure

- `demos/architecture-history/` — 建筑谱系 · Architecture Lineages, a bilingual source-first architectural-history evidence browser with revision-pinned candidate records, searchable map/catalog, field-level provenance, raw relation review, and an explicit 9-region × 8-period coverage ledger.
- `demos/wfoe-china/` contains the China WFOE + hiring costs interactive page.
- `demos/china-housing/` — small-city housing & rent data visualization.
- `demos/china-auto/` — China auto city atlas: 28 cities (17 core + 11 specialist), 168 companies/brands, 80 facility records, and 56 auto media titles (including national review-video KOLs) grouped by beat; every org has a headquarters city, explicit founded/ownership/listing/headcount/sales/plant states, pinyin/initials search, HQ vs plant vs battery/software roles, clusters and sourced 2025 local output figures.
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

## Public-page inventory

- `site-inventory.json` is the tracked publication decision for every repository HTML file: current demo, frozen archive, supporting prototype page, test harness, app-support page, or internal-only reference.
- The inventory records whether a page is published, indexable, canonical, eligible for the XML sitemap, and required to carry a full social-sharing card.
- There are 12 current demo entry pages. `demos/pebble-beach-2026/` is the single frozen demo archive; the incomplete 2027 planning page remains `noindex,follow` until its year-specific facts are sufficiently complete.
- `sitemap.xml` contains only published, indexable inventory entries. `robots.txt` deliberately permits crawling so per-page `noindex` directives can be observed.
- QROST-authored briefs, summaries, and build notes are never external evidence for research claims. Public research records must cite an independently published source with an explicit support scope.

## URL note

- The legacy root URL `/china-business.html` has been removed on purpose.
- Use `/demos/wfoe-china/index.html` instead.

## Checks

- `npm ci --ignore-scripts` installs the single locked root build dependency (Tailwind CSS 3.4.17).
- `npm run build:css && python3 tools/build.py` rebuilds the committed homepage CSS and refreshes content-addressed CSS/JavaScript cache tokens.
- `npm run check:css` recompiles the root, China Auto, Housing, Pharma, and Shelter Cats Tailwind outputs in a temporary directory and compares them byte-for-byte with the committed CSS.
- `python3 tools/build.py --check` verifies root cache tokens without writing.
- `python3 tools/check_public_metadata.py` verifies the complete inventory, canonical/robots decisions, OG/Twitter fields, local sharing-image dimensions, sitemap, robots policy, and homepage demo cards.
- `python3 tools/test_public_metadata.py` runs mutation fixtures proving that missing fields, stray HTML, bad images, and sitemap/indexing contradictions fail closed.
- `python3 tools/check_all.py` runs the stable root, research-data, public-demo cache/runtime, accessibility-contract, and repository-syntax gates used by GitHub Actions. Run it after `npm ci`; every gate must leave tracked content unchanged.
