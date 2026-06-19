# LULU feature contract (规避型环境数据)

Shared spec so the backend / frontend / i18n changes cohere. **All three workers
must use these EXACT names.** Feature = nearest-distance from each listing to 7
classes of "不利于居住" facilities (LULU = locally-unwanted land uses), surfaced as
sortable table columns + "越远越好" preference filters. **Do NOT touch the letter
grades (GRADE_DIMS) or worthBadge** — scope is filters + sortable columns only.

## The 7 categories — canonical keys (poi-table category == JS e.pois key)

| key | 中文 | OSM source | ref file |
|------|------|-----------|----------|
| `wastewater` | 污水处理厂 | man_made=wastewater_plant | data/ref/lulu_wastewater_cn.json |
| `landfill` | 垃圾填埋场 | landuse=landfill | data/ref/lulu_landfill_cn.json |
| `incinerator` | 垃圾焚烧厂 | man_made=incinerator / plant:source=waste | data/ref/lulu_incinerator_cn.json |
| `nuclear` | 核电站 | plant:source=nuclear | data/ref/lulu_nuclear_cn.json |
| `substation` | 大型变电站(≥220kV) | power=substation + voltage | data/ref/lulu_substation_cn.json |
| `chemical` | 化工园区/危化 | industrial=chemical etc. | data/ref/lulu_chemical_cn.json |
| `sensitive` | 敏感地点 | landuse=military / military=* | data/ref/lulu_sensitive_cn.json |

Each ref file = JSON array of `{"name": str, "lat": float, "lng": float}` (substation
also has `"kv"`). Built by `tools/fetch_lulu.py` (already committed).

## JS field names (camelCase, set on each `d` row in DATA derivation)
`wastewaterKm`, `landfillKm`, `incineratorKm`, `nuclearKm`, `substationKm`, `chemicalKm`, `sensitiveKm`
— each = `poiKm(e, '<key>')` (returns the baked nearest distance in km, or null).

## i18n keys (add to BOTH zh and en, mirrored)
- Column labels: `col_wastewaterKm`, `col_landfillKm`, `col_incineratorKm`, `col_nuclearKm`, `col_substationKm`, `col_chemicalKm`, `col_sensitiveKm`
  - zh: 污水厂km / 垃圾填埋km / 垃圾焚烧km / 核电站km / 大变电站km / 化工危化km / 敏感地点km
  - en: Sewage km / Landfill km / Incinerator km / Nuclear km / Substation km / Chemical km / Sensitive km
- POI labels (modal 周边 list): `poiWastewater`,`poiLandfill`,`poiIncinerator`,`poiNuclear`,`poiSubstation`,`poiChemical`,`poiSensitive`
  - zh: 污水处理厂 / 垃圾填埋场 / 垃圾焚烧厂 / 核电站 / 大型变电站 / 化工·危化 / 敏感地点
  - en: Sewage plant / Landfill / Incinerator / Nuclear plant / Substation / Chemical / Sensitive site
- Column-group label: `gAvoid` → zh `环境规避` / en `Avoid`  (new column group, see below)
- Filter chips (越远越好 = farther-is-better; pass means "at least this far"):
  - `fcFarSensitive` → zh `远离敏感地点≥5km` / en `Sensitive ≥5km`
  - `fcFarNuclear`   → zh `远离核电站≥30km` / en `Nuclear ≥30km`
  - `fcFarNuisance`  → zh `远离污染源≥3km` / en `Pollution ≥3km`  (污水/填埋/焚烧/化工 的最近者)
- Methodology: `methodLuluTitle` (zh `不利环境·敏感地点` / en `Adverse environment · sensitive sites`)
  and `methodLuluBody` (HTML `<li>`s in the same style as the hazard methodology).
  Body must state: source = OpenStreetMap/Overpass (free, WGS-84); nearest computed by
  haversine against national reference point sets; 大型变电站 = ≥220kV; 「敏感地点」
  = OSM-public military land only, **coverage sparse — absence ≠ none**; this is a
  rough livability-avoidance signal, NOT an official or targeting dataset; 越远越好.

## app.js wiring (frontend worker)
1. DATA derivation (near where hospitalKm/airportKm are set, ~line 355): add the 7 `*Km` fields via `poiKm(e,'<key>')`.
2. New column GROUP `avoid` (label `gAvoid`). Add it wherever the group set/toggle is defined (alongside `infra`). Default-visible state: match how `infra` is handled.
3. COLS: add 7 columns `{ key:'<field>', label:t('col_<field>'), group:'avoid', num:true, get:(d)=>nz(d.<field>, 1e9), cell:(d)=>luluKmCell(d.<field>, '<field>') }`.
4. New cell renderer `luluKmCell(val, scaleKey)` — DIVERGING semantic colour: NEAR = bad = red, FAR = good = green (opposite of amenity distance). Use the existing semantic palette: build `frac = clamp(val / scaleMax, 0, 1)` and colour `mix(RED, ... , frac)` so 0km→red, mid→slate, far→green (e.g. interpolate RED→SLATE for frac<0.5, SLATE→EMER for frac≥0.5). Reuse `pill()` + `fmtKm()` + `pillFgForBg()`. Do NOT reuse the gray distKmBg (that has no good/bad meaning).
5. viewTableScales(): add scale spans for the 7 keys. Suggested fallback max (km): wastewater 15, landfill 15, incinerator 20, nuclear 120, substation 8, chemical 20, sensitive 30. (Far end = "comfortably far".)
6. FILTERS (~line 1955): add the 3 chips:
   - `fcFarSensitive: { labelKey:'fcFarSensitive', pass:(d)=> d.sensitiveKm != null && d.sensitiveKm >= 5 }`
   - `fcFarNuclear:   { labelKey:'fcFarNuclear',   pass:(d)=> d.nuclearKm != null && d.nuclearKm >= 30 }`
   - `fcFarNuisance:  { labelKey:'fcFarNuisance',  pass:(d)=> { const xs=[d.wastewaterKm,d.landfillKm,d.incineratorKm,d.chemicalKm].filter(v=>v!=null); return xs.length>0 && Math.min(...xs) >= 3 } }`
   Filter chips auto-persist via saveUiPrefs (tstate.chips) — no extra wiring beyond registering in FILTERS + the click handler already iterates [data-filter].
7. Modal 周边: add the 7 categories to POI_META_KEYS so they render in the near-list (each with labelKey above + a distinct colour hex not already used). Map markers optional (many LULU points have no curated name; null-coord safe).

## Gotchas (from the integration map)
- Null distances: sort accessor must use `nz(d.field, 1e9)` so unknowns sink.
- Semantic colour is STRICT: green=desirable, red=worse. For LULU FAR=green, NEAR=red — invert vs amenity distance. Never use severityColor for "far".
- emit_enriched is generic — backend just stores the 7 categories in the `poi` table; no emit change needed.
- Cache-bust is automatic in `build` (content hash) — do not hand-edit ?v=.
