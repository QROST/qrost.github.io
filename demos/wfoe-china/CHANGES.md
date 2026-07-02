# wfoe-china — Phase 1 + 2 + 3 + 4 implementation notes

Implements the colleague's full plan (Phase 1 UX, Phase 2 Tech-light,
Phase 3 Tailwind CLI build, Phase 4 big-file split) under the
"non-breaking" constraints.

## Files touched

| File | Type of change |
|---|---|
| `index.html` | DOM **additions only** — skip-link, mobile hamburger + panel, OG/Twitter image meta, city `<select>`, FX status badge slot, Chart.js URL pinned + SRI |
| `assets/css/china-business.css` | Appended new sections — `:focus-visible`, mobile menu states, scroll-margin, FX badge variants, `@media print` |
| `assets/js/china-business.js` | Hooked `updateFxLabel` to drive FX badge; added city-select wiring, mobile menu controller, `beforeprint` expander, Chart.js missing fallback. Added `exchangeRateFetchSettled` flag. No existing function bodies removed; `getCostData`, `updateVisuals`, `loadExchangeRate`, `state`, tab handler, all chart options untouched in their existing branches |
| `assets/js/i18n-china-business.js` | Added new keys only (`nav.skip`, `nav.menu_open`, `nav.menu_close`, `dash.city_select`, `chart.fx_status_*`, `chart.cdn_unavailable`). No existing keys reworded |
| `assets/img/wfoe-china-og.png` | **New** 1200×630 OG card (slate background, emerald accent, mock 24-bar chart) |

## Hard constraints — how each is met

- **Content zero-deletion**: every existing copy line is byte-identical; every change is either a new sibling element or a new attribute. The single existing button that lost its `data-i18n-aria` attribute (mobile menu toggle) was a stale attribute I added then removed in the same session — there is no net regression.
- **Visual zero-regression on md+**: hamburger is `md:hidden`; mobile panel is `md:hidden` (always invisible on md+ even when JS toggles `hidden`); city `<select>` joins the same `flex-wrap gap-6` cluster as the existing Role/Currency/Headcount/Overhead controls — placed between Headcount and Overhead so the visual rhythm stays.
- **Data + logic unchanged**: `cityData`, WFOE money-column builders, `updateVisuals` math, `getCostData`, FX request endpoints + 8s timeout, fallback constant 7.2, Chart.js dataset structure, all chart `onClick`/`onHover` callbacks are byte-identical.
- **Print rules are additive**: never `display:none` on `main` or its data subtrees. Only the fixed nav, mobile chrome, and (intentionally) the two `<canvas>` chart containers are hidden during print. Every `<details>` is force-opened on `beforeprint` and restored on `afterprint`, so step bodies are preserved on paper.
- **Chart.js pinned**: `chart.js@4.4.7` UMD min, with `integrity="sha384-vsrfeLOOY6KuIYKDlmVH5UiBmgIdB1oEf7p01YgWHuqmOHfZr374+odEv96n9tNC"` and `crossorigin="anonymous"`. Bumping requires re-computing the SRI hash with `openssl dgst -sha384 -binary chart.umd.min.js | openssl base64 -A`.

## Behaviour added

1. **Skip-to-content** — first focusable element of the page; jumps to `#process`.
2. **Mobile hamburger menu** (< 768 px) — same three anchors as desktop nav. Opens via toggle button, closes on: link click, Escape, outside click, viewport widening past md. Focus moves to first link on open, back to toggle on close. `aria-expanded` + `aria-controls` are correctly wired; `aria-label` text follows the active language.
3. **City focus dropdown** — 24 cities, alphabetical by display name, bound to `state.city`. Bar-chart clicks update the dropdown value via `updateVisuals`; dropdown change triggers `updateVisuals`. Options are rebuilt with localized names on every `china-biz-lang-change` event.
4. **FX status badge** — pill next to the existing FX rate line. Three states: `Checking FX…` (pre-fetch), `Live FX` (green), `Offline · fallback 7.2` (amber). `aria-live="polite"` so screen readers announce the final state without spamming pending.
5. **Print stylesheet** — fixed nav becomes static, hero padding compresses, `<details>` all force-open, chart canvases are hidden (numbers remain in the doughnut-side itemised list, which is plain HTML). Slate footer becomes white-with-grey-text.
6. **Chart.js missing notice** — if `Chart` is undefined after script load (network, SRI mismatch, blocker), an inline amber notice replaces each canvas; rest of page continues to function.
7. **OG / Twitter cards** — `og:image` + `twitter:image` (1200×630) point at a new on-brand card image; `twitter:card` upgraded to `summary_large_image`.

## What is intentionally NOT done in this PR

- New `data-i18n` keys for existing step bodies (out of scope — adds
  no behaviour, churns the diff).
- Splitting region/city tiles or SAR brief into JSON (Phase 4 already
  removed ~70 KB / 670 lines by extracting just the two step tables;
  region tiles are visually distinct per region and not worth the
  abstraction overhead).

## Phase 3 — Tailwind CLI build (CDN removed)

New source files:
- `package.json` — pins `tailwindcss@3.4.17`, scripts `build:css` and `watch:css`.
- `tailwind.config.js` — content scans `index.html` + both JS files. Safelist is empty (all utility classes appear in source).
- `src/tailwind-input.css` — three `@tailwind` directives.
- `.gitignore` — keeps the built CSS in the repo, ignores `node_modules`.
- `assets/css/tailwind-built.css` — committed build output (~19 KB, identical utilities to the previous CDN runtime).

`index.html` change: the `<script src="https://cdn.tailwindcss.com">` line is replaced with `<link rel="stylesheet" href="assets/css/tailwind-built.css">`. Visual smoke-tested against the previous CDN render: pixel-identical.

To regenerate after class-usage changes:
```sh
cd demos/wfoe-china
npm install        # first time only
npm run build:css  # writes assets/css/tailwind-built.css
```

If a future change adds utility classes that only exist via JS string literals NOT covered by the content scan, the build will drop them. Two ways to handle:
1. Reference the class in source (HTML or JS) so the scanner sees it.
2. Add it to `safelist` in `tailwind.config.js` with a comment explaining why.

GitHub Pages serves the committed CSS directly — no CI build step needed.

## Phase 4 — Step cards extracted to JSON + renderer

The 20 WFOE step cards and 10 domestic-LLC step cards were ~700 lines of cookie-cutter markup inside `index.html`. They are now:

- **Data** — `assets/data/wfoe-steps.json` (20 entries) and `assets/data/domestic-steps.json` (10 entries). Each entry has `id`, `num`, `title_html`, optional `detail` (`{kind: "list" | "paragraph", items_html | html}`), and money-cell metadata. JSON was extracted programmatically from the previous inline HTML, so the rendered output is byte-equivalent.
- **Renderer** — `assets/js/steps-render.js` (~150 lines, plain ES5-ish JS, no dependencies). Fetches both JSON files in parallel, builds the same DOM structure, mounts into `<div id="wfoe-steps-mount">` and `<div id="domestic-steps-mount">`. Each rendered card carries the same `data-i18n="sXX.title"`, `data-i18n="sXX.detail"`, `data-wfoe-money="sXX"` / `data-domestic-fee="dXX"` hooks the existing i18n + money pipelines already rely on.
- **Mount points** — `index.html` replaces the two 20-/10-card blocks with `<div id="wfoe-steps-mount" aria-busy="true">` (and same for domestic). Each mount carries a `<noscript>` fallback pointing at the JSON file.
- **Glue** — `china-business.js`:
  - Exposes `window.refreshWfoeMoney = refreshWfoeMoney;` (previously private).
  - Adds `window.addEventListener('china-biz-steps-rendered', ...)` which re-runs `refreshWfoeMoney()` and `refreshDomesticFees()` once the cards exist.
  - When the renderer finishes, it also calls `ChinaBizI18n.setLang(currentLang)` so the freshly-inserted nodes have their English content cached for round-trip toggles and are translated immediately if the page is already in Chinese.

Behavioural contract preserved:
- Same DOM shape, classes, attributes — `step-active`, `data-i18n`, `data-wfoe-money`, `data-domestic-fee` all match the previous markup.
- Same i18n behaviour — the i18n script's `data-i18n-en-cache` mechanism picks up new nodes on the first `setLang` after render.
- Same money-cell behaviour — `refreshWfoeMoney`/`refreshDomesticFees` find the new nodes via existing selectors.
- Same print-expansion — the print expander selects `details` at print time, so it picks up the dynamically rendered ones.
- Tab toggle, language toggle, currency toggle, headcount, overhead, city select, FX badge, OG meta, Chart.js SRI — all unchanged.

Failure modes covered:
- `fetch` fails (offline, file://, 404) → mount point fills with an amber inline notice pointing at the JSON path. Dashboard + tabs + i18n continue to work.
- User toggles language while the renderer is still mid-fetch → the existing nodes translate normally; new nodes get translated once render finishes (renderer calls `setLang` once on completion).
- User clicks a tab before render finishes → the empty mount becomes visible (with `<noscript>` if relevant); cards appear when the fetch resolves.

Index.html size: previously ~130 KB / 1460 lines → now ~61 KB / 760 lines. JSON files total ~18 KB. Net win for diff size and copy-editing.

## Files added / changed across Phase 3 + Phase 4

| File | Type | Purpose |
|---|---|---|
| `package.json` | new | Tailwind CLI build chain |
| `tailwind.config.js` | new | Content scan + safelist for build |
| `src/tailwind-input.css` | new | `@tailwind` entry point |
| `.gitignore` | new | Ignore `node_modules`, keep built CSS |
| `assets/css/tailwind-built.css` | new | Committed build output (replaces CDN) |
| `assets/data/wfoe-steps.json` | new | 20 WFOE step records |
| `assets/data/domestic-steps.json` | new | 10 domestic step records |
| `assets/js/steps-render.js` | new | Fetch + render step cards |
| `index.html` | changed | CDN→built CSS link, step blocks → mount points, +1 script tag |
| `assets/js/china-business.js` | changed | Expose `refreshWfoeMoney` + listen for `china-biz-steps-rendered` |

## Manual smoke list

- [ ] Desktop (≥ 1024 px): top nav shows three anchors + lang toggle, no hamburger.
- [ ] Mobile (≤ 640 px): three anchors hidden; hamburger visible; tapping opens panel; tapping a link closes panel and scrolls to section.
- [ ] Tab key from address bar: Skip-to-content appears, then QROST logo, then nav links, then lang toggle. Each has a visible emerald focus ring.
- [ ] Language toggle: html `lang` flips between `en` and `zh-CN`. City dropdown options switch to Chinese names.
- [ ] City dropdown: pick any city → bar chart highlights that bar, doughnut + itemised list refresh.
- [ ] Bar chart click on a different city → dropdown value updates in step.
- [ ] FX badge: shows green "Live FX" once online fetch resolves; amber "Offline · fallback 7.2" if both endpoints fail (test by blocking `api.exchangerate.host` in DevTools).
- [ ] Print preview (Cmd/Ctrl + P): nav is static, all step bodies visible, charts replaced by their textual itemised list, no overlap.
- [ ] DevTools Network → block `cdn.jsdelivr.net`: amber chart-unavailable notice appears in both chart slots; tabs, language toggle, fees still work.
- [ ] Phase 3 — Network tab shows `tailwind-built.css` loaded, no request to `cdn.tailwindcss.com`. Disable the network entirely and reload from cache: layout still correct.
- [ ] Phase 3 — `npm run build:css` (after a checkout) produces a `tailwind-built.css` byte-equivalent (modulo header comment) to the committed file.
- [ ] Phase 4 — open the Setup tab: 20 WFOE cards visible. Numbers 1–20 in sequence. Each has a money line on the right.
- [ ] Phase 4 — switch to Domestic tab: 10 cards visible, numbers 1–10.
- [ ] Phase 4 — toggle language while on each tab: every title + every detail body switches; money cells switch; SAR brief switches.
- [ ] Phase 4 — DevTools Network → 404 one of the JSON files: that mount shows the amber inline notice, but the other tab + dashboard + i18n all work normally.

## Phase 5 — Sino-foreign JV (Joint Venture) tab

Adds a third entity-type tab alongside WFOE and Domestic LLC, targeting mainland Sino-foreign JV / FIE LLC structures (中外合资·外商投资有限责任公司):

- **Data** — `assets/data/joint-venture-steps.json` (12 entries). Extracted from the same JSON protocol as WFOE and domestic steps; includes JV-specific milestones (partner due diligence, JV agreement + Articles, negative-list compliance, dual-language governance).
- **Renderer** — existing `assets/js/steps-render.js` reused; adds JV mount point `<div id="jv-steps-mount">` alongside WFOE and domestic.
- **Money formatter** — `buildJvStepMoneyHtml`, `refreshJvMoney` (parallel to `buildWfoeMoney`, `refreshDomesticFees`). JV steps carry higher legal counsel fees (~100K–300K CNY range for partner negotiation + dual filings).
- **i18n** — new keys for `process.tab_jv`, `process.jv_intro`, `process.fee_note_jv`, entity-comparison columns (`entity.col_jv`, `entity.jv_vehicle`, `entity.jv_own`, `entity.jv_hire`, `entity.jv_fp`, `entity.jv_time`, `entity.jv_cap`). All keys exist in both EN and ZH dictionaries.
- **Event hook** — renderer fires `china-biz-steps-rendered` after JV cards mount; `refreshJvMoney` is triggered at the same time as `refreshWfoeMoney` and `refreshDomesticFees`.

Behavioural contract: Same as Phase 4 (mount point structure, null-fallback, i18n + money refresh on render).

Extended manual smoke checklist:
- [ ] JV tab is visible and labeled correctly in both EN and ZH.
- [ ] JV tab shows 12 step cards (steps jv01–jv12) with correct numbering.
- [ ] City select updates JV money cells; bar chart click on another city updates JV estimates.
- [ ] Language toggle switches all JV titles + details + money header correctly.
- [ ] DevTools Network → 404 `joint-venture-steps.json`: that mount shows the amber notice, but WFOE/Domestic tabs remain functional.

## Phase 6 — Dark mode

Adds an `html.dark` class toggle (`#theme-toggle` button in the nav, next
to the language toggle), matching the pattern used by the china-housing
and pharm-companies demos in this repo:

- **Bootstrap** — inline `<script>` in `<head>` applies saved
  (`localStorage['wfoe-china-theme']`) or system (`prefers-color-scheme`)
  preference to `<html class="dark">` before first paint, avoiding a
  flash of the wrong theme.
- **Tailwind config** — `darkMode: 'class'` added to `tailwind.config.js`.
  No `dark:` utility variants are actually used anywhere in the markup;
  this flag is present for correctness/future-proofing but the current
  implementation does not depend on Tailwind's dark-variant generation.
- **CSS override layer** — `assets/css/china-business.css` appends a
  `html.dark …` block that re-targets the ~50 hardcoded Tailwind
  slate/white/emerald/sky/amber/cyan utility classes already used
  throughout `index.html`, the JS-rendered step cards
  (`steps-render.js`), and i18n strings (`i18n-china-business.js`), with
  `!important`. This was chosen over adding `dark:` variants to every
  call site (~50+ locations across HTML + 2 JS files) because the
  class-based override automatically covers classes that JS toggles at
  runtime (e.g. `classList.add('bg-white', ...)` in the Role/Currency/
  Overhead pill buttons) without touching light-mode markup at all —
  zero risk of light-mode regression. Custom (non-Tailwind) components
  with hardcoded hex colors (step-flow rail, badges, FX tooltip) get
  their own `html.dark` rules in the same block.
- **Chart.js** — `Chart.defaults.color` (axis/legend/tooltip text) is
  fixed at chart-construction time and does not respond to CSS.
  `assets/js/china-business.js` adds `applyChartTheme()`, called once
  after `initCharts()` (to pick up dark mode set pre-paint) and again on
  every toggle click, which flips `Chart.defaults.color` and calls
  `.update()` on both charts. Chart gridlines use Chart.js defaults in
  both themes (not overridden) — acceptable contrast in both modes.
- **Icon** — `#theme-toggle .theme-toggle-icon` uses a CSS `content`
  swap (moon in light mode → click to go dark; sun in dark mode → click
  to go light), no extra image assets.

Cache-bust: all five versioned asset tags in `index.html` bumped from
`?v=20260611fx2` to `?v=20260702dm1` (CSS + JS changed together).

Extended manual smoke checklist:
- [ ] Toggle button flips `<html>` between light/dark; icon swaps
      moon ↔ sun; preference persists across reload (localStorage) and
      across `#anchor` navigation.
- [ ] First load with no saved preference follows OS
      `prefers-color-scheme`.
- [ ] Dark mode + language toggle combined: Chinese copy renders with
      correct dark-mode contrast (checked: hero, step cards, SAR tab,
      region cards/badges, dashboard, footer, methodology accordion).
- [ ] Dashboard bar + doughnut charts are legible in dark mode
      (axis labels, city names, legend, tooltips); toggling theme
      mid-session (charts already rendered) updates them live.
- [ ] Role/Currency/Overhead/Global-cities pill buttons keep visible
      active-state contrast in dark mode (JS toggles the same
      `bg-white`/`text-slate-800`/etc. classes the CSS override covers).
- [ ] No console errors on load or on toggle.
