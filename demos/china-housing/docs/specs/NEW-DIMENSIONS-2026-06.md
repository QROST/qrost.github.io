# Manual / Research Dimensions Spec (2026-06)

Workstream **6/6** — dimensions without a ready automated pipeline. Scope this session:
**spec + nullable schema + CLI stubs**; no full population backfill.

---

## Overview

| Dimension | Granularity | Source | Merge channel | UI group |
|-----------|-------------|--------|---------------|----------|
| 七普 vs 六普人口流出 + 老龄化 | 地级市 (~80) | stats.gov.cn bulletins, manual curation | `demographics-merge` | `demographics` (new toggle) |
| 三甲医院距离 | per-listing | 卫健委名单 + research-merge | `hospital-tier3-merge` | `infra` |
| 产权性质 / 顶楼 / 物业费 | per-listing | manual on ingest | `property-import` | `property` (new toggle) |

Patterns mirror existing pipelines:

- **hazard-merge**: prefecture JSON → per-listing `hazards_local` via `prefKey`
- **built-merge**: per-listing findings + validation gate → `built_year` columns
- **research-merge**: agent names/addresses → Nominatim + `poi` rows (`source='research'`)

---

## 1. Demographics — 七普 vs 六普 + 老龄化

### 1.1 Research artifact

`data/research/demographics_research.json`:

```json
{
  "compiled": "2026-06-09",
  "method": "stats.gov.cn 七普/六普公报；地级市常住人口对比；65岁及以上占比",
  "findings": [
    {
      "prefKey": "黑龙江|双鸭山市",
      "popCensus7": 1208803,
      "popCensus6": 1462000,
      "popChangePct": -17.3,
      "outflow": true,
      "aging65Plus": 0.162,
      "aging60Plus": 0.241,
      "headline": "七普较六普常住人口减少约17%，老龄化加速",
      "sources": ["https://www.stats.gov.cn/..."],
      "notes": "公报口径为全市常住人口"
    }
  ]
}
```

`prefKey` = `{prov}|{city.split('-')[0]}` — same rule as `hazard-merge` / `synth_hazards`.

### 1.2 DB storage

**Column** `listings.demographics_local` `TEXT` (nullable JSON), baked to `enriched.js` as `demographics`:

```json
{
  "prefKey": "黑龙江|双鸭山市",
  "popCensus7": 1208803,
  "popCensus6": 1462000,
  "popChangePct": -17.3,
  "outflow": true,
  "aging65Plus": 0.162,
  "aging60Plus": 0.241,
  "headline": "…",
  "sources": ["…"]
}
```

No separate staging table — research JSON is source-of-truth (like `hazard_research.json`).

### 1.3 Ingest workflow

```bash
# 1) Curate ~80 prefecture rows (manual / subagent) → demographics_research.json
# 2) Merge to all geocoded listings in matching prefecture
python3 tools/manage.py demographics-merge data/research/demographics_research.json
python3 tools/manage.py build
```

`demographics-merge` copies the prefecture finding onto every listing where
`f"{prov}|{city.split('-')[0]}"` matches. Listings without coords still get
the JSON (city-level attribute, not coord-dependent).

### 1.4 UI surfacing (planned — not in this session)

| Surface | Field | Display |
|---------|-------|---------|
| Table group `demographics` | `popChangePct` | 人口Δ% with red/green pill |
| Table group `demographics` | `aging65Plus` | 65+占比 % |
| Table group `demographics` | `outflow` | 流出/流入/— |
| Modal「周边」tab footer | `demographics.headline` | one-line city context |
| Quiz soft dim (future) | `outflow` + `aging65Plus` | optional penalty |

**Deferred**: national prefecture backfill (~80 cities), quiz integration.

---

## 2. Tier-3 hospital distance — 三甲医院

### 2.1 Why not OSM alone

OSM `amenity=hospital` lacks reliable 三甲 tagging; verified in pois-refix rounds.
Use **卫健委三级甲等医院名录** + per-listing research (existing `hospital-dist-batch-*` workflow).

### 2.2 Reference master list (started)

`data/ref/hospitals_tier3_cn.json` — curated subset of 卫健委 entries with WGS-84 coords:

```json
{
  "compiled": "2026-06-09",
  "method": "国家卫健委三级甲等医院名录 + 官网地址 + Nominatim/OSM 坐标核实",
  "hospitals": [
    {
      "id": "hlj-qth-rmyy",
      "name": "七台河市人民医院",
      "address": "黑龙江省七台河市桃山区山湖路49号",
      "prov": "黑龙江",
      "city": "七台河市",
      "lat": 45.77266,
      "lng": 130.99886,
      "tier": "三甲",
      "source": "https://www.qthyy.org.cn/..."
    }
  ]
}
```

### 2.3 DB storage

**POI row** with `category='hospital_tier3'` (separate from generic `hospital` OSM POI):

| poi column | value |
|------------|-------|
| listing_id | listing id |
| category | `hospital_tier3` |
| name | verified hospital name |
| lat, lng | WGS-84 |
| dist_km | haversine from listing anchor |
| source | `research` |
| subtype | `tier3` (optional) |

Baked to `enriched.js` → `pois.hospital_tier3.distKm` → frontend `tier3HospitalKm`.

Generic `hospital` POI remains for nearest-any-hospital; **infra column switches to tier3 when present**.

### 2.4 Research findings template

`data/research/templates/hospital-tier3-finding.json` — per-listing batch output
(same shape as `hospital-dist-batch-*-findings.json`):

```json
{
  "id": 5,
  "hospital_name": "七台河市人民医院",
  "hospital_address": "黑龙江省七台河市桃山区山湖路49号",
  "hospital_lat": 45.77266,
  "hospital_lng": 130.99886,
  "dist_km": 1.4,
  "confidence": "high",
  "hospital_source": "https://www.qthyy.org.cn/...",
  "sources": ["…"],
  "notes": "国家三级甲等综合医院"
}
```

`confidence` ∈ `{high, med}` required; coords required (agent supplies verified coords,
code validates distance < 80 km).

### 2.5 Ingest workflow

```bash
# Per-listing research batches (existing subagent fan-out)
python3 tools/manage.py hospital-tier3-merge data/research/hospital-dist-batch-1-findings.json
# Or merge all batch files:
python3 tools/manage.py hospital-tier3-merge --all-batches
python3 tools/manage.py build
```

`research-merge` **unchanged** for generic hospital gaps; tier3 uses dedicated category
so OSM false-positives don't overwrite 三甲 distance.

**Deferred**: bulk nearest-tier3 from `hospitals_tier3_cn.json` without per-listing research;
full 卫健委 list import script.

---

## 3. Property — 产权 / 顶楼 / 物业费 / 小产权 veto

### 3.1 No external source

Fields captured **at ingest** from listing notes / agent / colleague CSV.

### 3.2 DB columns (nullable)

| Column | Type | Values / notes |
|--------|------|----------------|
| `property_rights` | TEXT | `商品房` `共有产权` `集资房` `公房` `房改房` `小产权` `unknown` |
| `is_top_floor` | INTEGER | `1` 顶楼 / `0` 非顶楼 / `NULL` 未知 |
| `property_fee_yuan` | REAL | 物业费 元/㎡·月 |
| `xiaochanquan` | INTEGER | `1` = **veto** (小产权); auto-set when `property_rights='小产权'` |

Baked to `enriched.js`:

```json
{
  "propertyRights": "商品房",
  "isTopFloor": false,
  "propertyFeeYuan": 1.2,
  "xiaochanquan": false
}
```

### 3.3 CSV ingest

`property-import` accepts CSV with header:

```
id,property_rights,is_top_floor,property_fee_yuan,xiaochanquan,notes
```

Optional columns; `id` required. `xiaochanquan` auto-derived if `property_rights=小产权`.

```bash
python3 tools/manage.py property-import data/research/property-batch.csv
python3 tools/manage.py build
```

Extend `import-csv` later with optional property columns on main listing CSV — **deferred**.

### 3.4 UI surfacing (planned)

| Surface | Behavior |
|---------|----------|
| Table group `property` | 产权 / 顶楼 / 物业费 columns |
| Filter chip `noXiaochanquan` | hides `xiaochanquan=1` (fail-closed: unknown passes) |
| Modal header badge | red「小产权」when veto |
| Default hidden | **not** auto-hidden (unlike tier1 price gate) — user opts in via filter |

**Deferred**: i18n keys, modal detail section, grade-dim integration.

---

## 4. Schema migration summary

Added in `enrich.migrate()` (idempotent, all nullable):

```sql
ALTER TABLE listings ADD COLUMN demographics_local TEXT;
ALTER TABLE listings ADD COLUMN property_rights TEXT;
ALTER TABLE listings ADD COLUMN is_top_floor INTEGER;
ALTER TABLE listings ADD COLUMN property_fee_yuan REAL;
ALTER TABLE listings ADD COLUMN xiaochanquan INTEGER;
```

POI category `hospital_tier3` uses existing `poi` table — no DDL change.

Run migration: `python3 tools/manage.py init` (or any command that calls `connect()`).

---

## 5. CLI commands

| Command | Status | Description |
|---------|--------|-------------|
| `demographics-merge <json>` | **stub** | fold prefecture demographics → `demographics_local` |
| `hospital-tier3-merge <json>` | **stub** | fold tier3 findings → `poi.hospital_tier3` |
| `hospital-tier3-merge --all-batches` | **stub** | glob `hospital-dist-batch-*-findings.json` |
| `property-import <csv>` | **stub** | upsert property columns from CSV |

---

## 6. Research JSON templates

| Path | Purpose |
|------|---------|
| `data/research/templates/demographics-prefecture.json` | single prefecture finding |
| `data/research/templates/hospital-tier3-finding.json` | single listing tier3 finding |
| `data/research/templates/property-listing.csv` | property CSV example row |

---

## 7. Verification checklist

```bash
cd demos/china-housing
python3 tools/manage.py init                    # applies migration
python3 -c "import sqlite3; c=sqlite3.connect('data/housing.db'); print([r[1] for r in c.execute('PRAGMA table_info(listings)') if r[1] in ('demographics_local','property_rights','xiaochanquan')])"
python3 tools/manage.py hospital-tier3-merge data/research/hospital-dist-batch-1-findings.json --dry-run
python3 tools/manage.py demographics-merge data/research/templates/demographics-prefecture.json --dry-run
```

---

## 8. Deferred (explicitly out of scope)

- Full ~80 prefecture demographics curation
- Full 卫健委三甲 list import + bulk nearest-hospital computation
- Frontend COLS / FILTERS / i18n / modal UI
- `emit_enriched` consumer fields in `app.js` (`tier3HospitalKm`, demographics columns)
- Quiz / grade-dim scoring for new dimensions
- Extending main `import-csv` with property columns
