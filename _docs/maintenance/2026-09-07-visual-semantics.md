# 2026-09-07 visual semantics repair

Visual size and colour should let readers understand the data before opening a
tooltip. This batch applies that principle to six pages, following the reliability
repairs. It does not refresh the underlying research records.

## Rules for future page improvements

- Larger numerical values should produce larger marks. Scale area with a readable
  minimum for quantitative circles; show sample values and units. Disclose caps or
  other artistic transforms instead of implying an exact proportional chart.
- Keep one meaning per visual channel. A colour-layer switch should not silently
  change the meaning of size. Categories need stable colours while filtering;
  categorical dots should not imply numerical differences through unexplained size.
- Use a consistent comparison basis: currency, year, scope, and population.
  Normalize currencies before comparing, retain provenance, and identify reference
  exchange rates. Different statistical scopes must remain visible.
- Keep scales stable across filters where practical. If the comparison population
  changes the size range, explain the range and update the legend together.
- Missing or unverified quantities are not zero. Mark them separately and keep them
  out of numerical colour scales. A cached-record count is not a provider's live total.
- Verify the actual rendered values, legends, filters, language changes, and narrow
  layouts. A visually attractive chart is not evidence that its labels are correct.

## Applied changes

| Page | Meaning after repair |
| --- | --- |
| China Housing | Higher total asking price produces a larger dot. Colour follows the chosen dimension. A three-value size legend uses the current listing population; colour changes preserve that range. Chinese amounts use CNY and English display uses the page's existing USD conversion. |
| China Auto | City size increases with recorded output over a fixed complete-data scale, restoring differences previously lost at the 36px cap. Unknown or unverified output uses a separate hollow marker. Legends state units and retain the warning about differing statistical scopes. |
| Shelter Cats | Dot size increases with cached cat count using a complete-snapshot scale. The legend explains the historical-record switch and that other catalog filters do not alter map counts. The unimplemented region-highlighting claim is removed. |
| Global Pharma | One equal-sized dot represents one site. Category colours come from the complete catalog and remain stable through filtering and language changes. |
| Visual Page / Neon Abyss | Housing unit prices are converted to CNY before artistic size and trail encoding. Both pages reuse Housing's public conversion module and identify bundled, non-live FX dates. Missing prices use a neutral visual weight and an explicit unavailable label. WebGL failures are visible above the entry layer. |

## Verification and remaining work

The automated checks cover monotonic housing prices, matching numeric legends,
stable filtered colours and sizes, missing output, complete housing conversion,
and equal prices across five currencies. Desktop and touch browser regressions
cover the affected atlas interactions. Existing map startup and failure-isolation
checks remain in place. Generated cache tokens follow each module's build tools.

This batch adds 12 desktop/touch browser cases and three numerical regression
gates. Local Chrome checks also exercised both art pages with all 392 housing
records (18 requiring conversion), bilingual details, narrow screens, a failed
conversion module, and visible WebGL failure notices. These art checks used
software WebGL and do not establish physical-device GPU performance.

The following review findings remain separate work items:

- **Industrial Software:** its comparison radar derives both “function” and
  “maturity” from the same label, and infers “ecosystem” from reference counts.
  Replace the capability interpretation with clearly defined independent measures
  or a factual comparison view; do not invent measurement evidence.
- **Pharma groups and deals:** explain categorical size emphasis in the group
  graph. The transaction-count implementation needs a multi-party synthetic
  regression before changing its pair-edge counting; current public data does not
  demonstrate that multi-party overcount.
- **Architecture History:** explain that relationship-node size reflects links in
  the current filtered graph, not architectural importance or evidence confidence.
- **Research comparisons:** continue checking financial years, source coverage,
  freshness, and field-level provenance. Correct visual encoding does not validate
  the underlying market, listing, or provider facts.

This document records local design and verification scope. Public deployment
status is established separately by the release run and live-page checks.
