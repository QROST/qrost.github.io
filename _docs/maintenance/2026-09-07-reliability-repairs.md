# 2026-09-07 reliability repair batch

This batch restores broken core interactions in six demos. It does not complete
the entire site audit or refresh the underlying research facts.

## Changes

- **Maps:** China Auto, China Housing, Global Pharma, Shelter Cats, and Architecture
  History initialize the full chart before enabling touch callbacks. The same
  order is applied to the affected relationship graphs. Coarse-pointer scrolling,
  explicit pan/zoom, scroll relocking, and viewport changes remain supported.
  Housing also resizes its canvas after mounting the touch button, preventing
  the canvas from covering map controls.
- **China Auto:** failures in the map, overview, or cluster graph leave catalogs,
  filters, sources, and details usable, with local bilingual error notices.
- **Global Pharma:** required catalog data is validated and committed together,
  with bounded requests and clean retries. Optional research layers and charts
  report local failures. FX loading is independent and distinguishes retrieved,
  cached, and reference estimates. Revenue display and sorting use the same
  metric. All 1,913 companies are reachable through 100-row pages; roster entries
  expose their existing sites and products.
- **China Housing:** CSV amounts use explicit CNY units, including rent. Original
  amounts, currency, applied FX rate, source, status, and date allow the converted
  amounts to be reproduced. Missing cross-rates retain their own fallback
  provenance; unknown legacy-cache dates remain empty.
- **Shelter Cats:** required headers fail visibly; failed regional shards are
  reported separately and can be retried. Cat totals reflect loaded records.
  Unloaded regions do not appear on the map as shelters with zero cats. All 258
  cached records are reachable through 48-card pages, including historical records
  when selected. Language changes preserve filters, and modal color swatches render
  as visual elements.
- **WFOE China:** missing or broken charts no longer interrupt numbers, controls,
  fee tables, or independent FX updates. A numeric city table provides a fallback.
  Per-person sorting and component rounding agree with displayed totals.
  Mainland contribution breakdowns are explicitly labeled as model assumptions.
- **Builds:** regenerate affected CSS and content hashes. WFOE gains deterministic
  CSS/JS/step-data hashing and mutation tests. Its CSS and both Pebble Beach guide
  checks now join the common gate suite.

## Verification

- `python3 tools/check_all.py` includes map lifecycle, chart failure isolation,
  required/partial data loading, Housing CSV and per-currency FX checks, plus the
  existing data, metadata, syntax, and build checks.
- `npm run test:browser` runs 40 desktop/touch cases covering real chart startup,
  both languages and themes, map controls, complete catalog traversal, required and
  partial data failures, geography failure, and calculator fallbacks.
- Browser tests use a local server and pinned chart fixtures; external requests
  are intercepted. They establish local UI behavior, not provider availability,
  current market/legal facts, or production release status. CI runs the same suite
  in Chromium and retains failure traces and screenshots.
- Source records and research counts are unchanged. The three changed manifests
  only receive new content-hash tokens. Architecture History's private editing
  store and generated research tables are outside this repair batch.

## Still open

- Complete the remaining audit tasks for Makoauto, industrial software, generative
  art, shared preferences/navigation, coverage summaries, and accessibility.
- Repair Housing's data-completeness rules and missing field-level source evidence;
  the new CSV checks do not certify the correctness or freshness of listing facts.
- Review Pharma's transaction-network coverage, financial/country units, source
  links, approvals, and data freshness. Existing validator warnings remain visible;
  this batch does not silently normalize unknown research values.
- Verify WFOE local rates, contribution bases, business facts, and fee evidence.
  Labeling a model assumption does not make it a verified current rule.
- Improve Shelter Cats lifecycle refreshes, source-based behavior descriptions,
  coverage, and map/filter semantics. Snapshot retention is preserved.
- Complete remaining recovery behavior, including retaining filters across optional
  layer reloads, and test Safari/Firefox and physical mobile devices separately.
