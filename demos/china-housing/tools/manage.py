#!/usr/bin/env python3
"""
china-housing data manager — SQLite source-of-truth for a static GitHub Pages demo.

The web page (index.html) is a pure static site: it consumes a JS *global*
(`window.HOUSING_LISTINGS` in assets/data/listings.js) rather than fetching JSON,
so the page works identically over http(s) and from disk (file://). That data
file is therefore a *build artifact*. The editable truth lives in SQLite:

    data/housing.db   ← source of truth (a plain SQLite file, edit with SQL or this CLI)
        │  manage.py build
        ▼
    assets/data/listings.js   ← generated (page reads window.HOUSING_LISTINGS)
    data/listings.csv         ← generated mirror (human-readable, git-diffable)
    index.html                ← count/date tokens re-synced in place

Typical workflow (see tools/README.md):
    python3 tools/manage.py add  --prov 云南 --city 曲靖市 --dist 麒麟区 \
                                 --loc 南城建材市场宿舍 --price-wan 8.4 --area 37 \
                                 --rent 200 --updated 2026.1      # one listing
    python3 tools/manage.py import-csv batch.csv                  # many listings
    python3 tools/manage.py build                                 # regenerate artifacts
    git add -A && git commit -m "housing: +N listings"

Zero third-party dependencies — Python 3.9+ standard library only.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime, timezone
import sqlite3
import sys
import unicodedata
from pathlib import Path

import enrich  # sibling module (tools/enrich.py) — build-time data enrichment
import gridfield  # sibling module (tools/gridfield.py) — gridded climate/elevation field

# ---------------------------------------------------------------------------
# Paths — resolved relative to this file so the CLI works from any cwd.
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent          # demos/china-housing/
DB_PATH = ROOT / "data" / "housing.db"
JS_PATH = ROOT / "assets" / "data" / "listings.js"
ENR_PATH = ROOT / "assets" / "data" / "enriched.js"
HAZ_PATH = ROOT / "assets" / "data" / "hazards.js"
POLICY_PATH = ROOT / "assets" / "data" / "policy.js"
OFFERS_PATH = ROOT / "assets" / "data" / "offers.js"
FIELD_PATH = ROOT / "assets" / "data" / "field.js"
FIELD_HI_PATH = ROOT / "assets" / "data" / "field_hi.js"
FIELD_HI_DIR = ROOT / "assets" / "data"
CSV_PATH = ROOT / "data" / "listings.csv"
HTML_PATH = ROOT / "index.html"

# Canonical field order — shared by the DB, the JS global, and the CSV mirror.
FIELDS = ["id", "prov", "city", "dist", "loc", "priceWan", "area", "rent", "updated"]
STR_FIELDS = {"prov", "city", "dist", "loc", "updated"}
INT_FIELDS = {"id", "rent"}
NUM_FIELDS = {"priceWan", "area"}  # may be fractional

SCHEMA = """
CREATE TABLE IF NOT EXISTS listings (
  id        INTEGER PRIMARY KEY,
  prov      TEXT    NOT NULL,
  city      TEXT    NOT NULL,
  dist      TEXT    NOT NULL DEFAULT '',
  loc       TEXT    NOT NULL,
  priceWan  REAL    NOT NULL CHECK (priceWan > 0),
  area      REAL    NOT NULL CHECK (area > 0),
  rent      INTEGER NOT NULL CHECK (rent >= 0),
  updated   TEXT    NOT NULL
);
"""


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    # Wait up to 30s when another manage.py job holds the write lock (e.g. pois-refix).
    con = sqlite3.connect(DB_PATH, timeout=30)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout = 30000;")
    con.execute("PRAGMA foreign_keys = ON;")
    con.executescript(SCHEMA)   # base listings table (idempotent)
    enrich.migrate(con)         # enrichment columns + tables (idempotent)
    return con


def normalize_updated(raw: str) -> str:
    """'2026.1' / '2026-4' / '2026.04' → 'YYYY-MM'. Pass through if already ok."""
    s = str(raw).strip().replace("/", "-").replace(".", "-")
    m = re.match(r"^(\d{4})-(\d{1,2})$", s)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}"
    if re.match(r"^\d{4}-\d{2}$", s):
        return s
    raise ValueError(f"unparseable updated date: {raw!r} (want YYYY-MM or YYYY.M)")


def coerce_row(d: dict) -> dict:
    """Validate + type-coerce a raw dict into a canonical listing row (no id check)."""
    out = {}
    for f in ("prov", "city", "loc"):
        v = str(d.get(f, "")).strip()
        if not v:
            raise ValueError(f"missing required field {f!r} in row {d!r}")
        out[f] = v
    out["dist"] = str(d.get("dist", "") or "").strip()
    out["priceWan"] = float(d["priceWan"])
    out["area"] = float(d["area"])
    out["rent"] = int(round(float(d["rent"])))
    out["updated"] = normalize_updated(d["updated"])
    if d.get("id") not in (None, "", "auto"):
        out["id"] = int(d["id"])
    return out


def upsert(con: sqlite3.Connection, rows: list[dict]) -> tuple[int, int]:
    """Insert/replace rows by id. Rows without id get the next free id. Returns (ins, upd)."""
    cur = con.cursor()
    nxt = (cur.execute("SELECT COALESCE(MAX(id), 0) FROM listings").fetchone()[0]) + 1
    ins = upd = 0
    for r in rows:
        rid = r.get("id")
        if rid is None:
            rid = nxt
            nxt += 1
        exists = cur.execute("SELECT 1 FROM listings WHERE id = ?", (rid,)).fetchone()
        cur.execute(
            """INSERT INTO listings (id, prov, city, dist, loc, priceWan, area, rent, updated)
               VALUES (:id, :prov, :city, :dist, :loc, :priceWan, :area, :rent, :updated)
               ON CONFLICT(id) DO UPDATE SET
                 prov=excluded.prov, city=excluded.city, dist=excluded.dist,
                 loc=excluded.loc, priceWan=excluded.priceWan, area=excluded.area,
                 rent=excluded.rent, updated=excluded.updated""",
            {**r, "id": rid},
        )
        if exists:
            upd += 1
        else:
            ins += 1
    con.commit()
    return ins, upd


def fetch_all(con: sqlite3.Connection) -> list[dict]:
    rows = con.execute(
        f"SELECT {', '.join(FIELDS)} FROM listings ORDER BY id"
    ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# JS generator (CJK-display-width aware column alignment)
# ---------------------------------------------------------------------------
def _dwidth(s: str) -> int:
    return sum(2 if unicodedata.east_asian_width(c) in ("W", "F") else 1 for c in s)


def _pad(token: str, width: int) -> str:
    return token + " " * max(0, width - _dwidth(token))


def _numfmt(v) -> str:
    f = float(v)
    return str(int(f)) if f == int(f) else ("%g" % f)


JS_HEADER = '''/**
 * China small-city housing snapshot — raw listing data.
 *
 * GENERATED FILE — do not edit by hand. Source of truth is data/housing.db;
 * regenerate with:  python3 tools/manage.py build
 *
 * One row = one second-hand listing observed in a small / lower-tier Chinese
 * city, transcribed from a community-sourced "便宜房" (cheap-home) table. This
 * is NOT a market index: every row is a single asking-price observation, often
 * the cheapest unit someone could find in that town, so treat the numbers as
 * illustrative anecdotes rather than appraisals.
 *
 * Fields (all raw — derived metrics are computed in app.js):
 *   id        original 序号 from the source table (54 is absent in the source)
 *   prov      省份      province / municipality (short form)
 *   city      城市      city
 *   dist      区/乡/镇/村 district / town
 *   loc       具体位置  community (小区) or building name
 *   priceWan  二手房总价, unit 万元 (10,000 RMB) per unit — "约X万元/套房"
 *   area      面积, unit 平米 (m²)
 *   rent      租房价格, unit 元/月 (RMB per month)
 *   updated   更新日期, normalised to "YYYY-MM"
 *
 * Embedded as a global (not fetched) so the page works identically over
 * http(s) on GitHub Pages and when opened directly from disk (file://).
 */
'''


def render_js(rows: list[dict]) -> str:
    # Build per-column tokens, then pad each column to its max display width.
    cols = []
    for r in rows:
        cols.append([
            f'id: {r["id"]},',
            f'prov: "{r["prov"]}",',
            f'city: "{r["city"]}",',
            f'dist: "{r["dist"]}",',
            f'loc: "{r["loc"]}",',
            f'priceWan: {_numfmt(r["priceWan"])},',
            f'area: {_numfmt(r["area"])},',
            f'rent: {_numfmt(r["rent"])},',
            f'updated: "{r["updated"]}"',  # last cell: no trailing comma, no pad
        ])
    ncol = len(FIELDS)
    widths = [max(_dwidth(row[i]) for row in cols) for i in range(ncol)]
    lines = []
    for row in cols:
        cells = [_pad(row[i], widths[i]) for i in range(ncol - 1)] + [row[-1]]
        lines.append("  { " + " ".join(cells) + " }")
    return JS_HEADER + "window.HOUSING_LISTINGS = [\n" + ",\n".join(lines) + "\n];\n"


ENR_HEADER = '''/**
 * China small-city housing — baked enrichment (geocode / climate / POIs / risk).
 *
 * GENERATED FILE — do not hand-edit. Source of truth is data/housing.db;
 * (re)generate with:  python3 tools/manage.py enrich  &&  python3 tools/manage.py build
 *
 * Keyed by listing id. All baked at build time from free, no-key, WGS-84
 * sources (Nominatim / Open-Meteo / Overpass / OurAirports / Natural Earth) so
 * the page makes no runtime geocoding/POI/climate request — see tools/enrich.py.
 * climate[m] = [tmean, tmax, tmin, precip] for month m (1-12).
 * daily = 365-day curve + comfort/extreme day-ranges + extended dims
 *   (humidDayCount, snowDayCount, windyDayCount, sunshineHours,
 *    apparentComfortDayCount, meanHumidityPct) — see enrich.py schema.
 */
'''


def render_enriched(d: dict) -> str:
    body = json.dumps(d, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return ENR_HEADER + "window.HOUSING_ENRICHED = " + body + ";\n"


HAZ_HEADER = '''/**
 * China small-city housing — province natural-hazard profile (curated, coarse).
 *
 * GENERATED FILE — do not hand-edit. Source is tools/enrich.py PROVINCE_HAZARDS;
 * regenerate with:  python3 tools/manage.py build
 *
 * Keyed by province short name. A QUALITATIVE, province-level digest of the
 * disaster types each area is historically exposed to (公开地理/气候资料 +
 * 应急管理部 历年灾情 的定性归纳). freq: 3=高频 2=常见 1=偶发 0=罕见.
 * NOT a point hazard model, NOT engineering input — for side-by-side context only.
 */
'''


def render_hazards(d: dict) -> str:
    body = json.dumps(d, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return HAZ_HEADER + "window.HOUSING_HAZARDS = " + body + ";\n"


OFFERS_HEADER = '''/**
 * China small-city housing — multiple price offers per listing (一楼盘多价格挂牌).
 *
 * GENERATED FILE — do not hand-edit. Source is data/housing.db (listing_offers),
 * populated by `manage.py import-offers`; regenerate with `manage.py build`.
 *
 * Additional price points (面积/户型/单价/时间) under one listing — the listings row
 * stays the canonical/representative offer; these show in the detail modal. Every
 * offer carries sourceUrl (cite-or-omit). unitPrice is derived (priceWan*1e4/area).
 *   window.HOUSING_OFFERS = {"<listing_id>": [{area, priceWan, unitPrice, rent,
 *     layout, orientation, floorNote, updated, sourceUrl, note}, …]}  // sorted by 单价 asc
 */
'''


def render_offers(d: dict) -> str:
    body = json.dumps(d, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return OFFERS_HEADER + "window.HOUSING_OFFERS = " + body + ";\n"


POLICY_HEADER = '''/**
 * China small-city housing — city + national home-buying policy (城市/国家购房政策).
 *
 * GENERATED FILE — do not hand-edit. Source is data/housing.db (city_policy +
 * national_policy), populated by `manage.py import-policy`; regenerate with:
 *   python3 tools/manage.py build
 *
 * Contract: tools/POLICY_CONTRACT.md. Policy is keyed by 地级市 (NOT per-listing);
 * every field carries source_url + as_of + confidence (cite-or-null). A TIME-DECAYING
 * snapshot — the page shows an "as-of {date}, 购房前请向当地住建局核实" disclaimer.
 *   window.CITY_POLICY     = {asOf, byPref:{"<prov>|<地级市>":{...}}, locIndex:{...}}
 *   window.NATIONAL_POLICY = {<topic>:{key_facts, value_struct, source_url, as_of, confidence}}
 */
'''


def render_policy(city: dict, national: dict) -> str:
    cb = json.dumps(city, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    nb = json.dumps(national, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return (POLICY_HEADER
            + "window.CITY_POLICY = " + cb + ";\n"
            + "window.NATIONAL_POLICY = " + nb + ";\n")


FIELD_HEADER_COARSE = '''/**
 * China small-city housing — gridded climate / elevation field (basemap, national LOD).
 *
 * GENERATED FILE — do not hand-edit. Source is data/ref/field_grid_1.json
 * (sampled by `manage.py field`); isolines re-extracted by `manage.py build`.
 *
 * A continuous, land-masked field over China (Open-Meteo ERA5 archive + model
 * DEM), so the map can draw a real isotherm / rainfall / elevation basemap
 * under the listings. Per field: heatmap points [lng,lat,value] + marching-
 * squares isoline segments per level. National view @ 1° — zoom in lazy-loads
 * field_hi_<key>.js (0.25°, one layer). window.HOUSING_FIELD = {bbox, step, fields:{key:{...}}}.
 */
'''

FIELD_HEADER_FINE = '''/**
 * China small-city housing — gridded climate / elevation field (province-zoom LOD).
 *
 * GENERATED FILE — do not hand-edit. Source is data/ref/field_grid_0.25.json
 * (sampled by `manage.py field --step 0.25`); emitted by `manage.py build`.
 * Monolithic bundle (all layers). Prefer per-layer field_hi_<key>.js for lazy
 * load (~270 KB each vs ~1.1 MB). Cells only (no isolines).
 * Where ERA5 is not yet fetched, climate is bilinear/nearest downscale from 1°.
 * window.HOUSING_FIELD_HI = {bbox, step, fields:{key:{...}}}.
 */
'''

FIELD_HI_LAYER_HEADER = '''/**
 * China small-city housing — 0.25° basemap single layer (province-zoom LOD).
 *
 * GENERATED FILE — do not hand-edit. Merges into window.HOUSING_FIELD_HI.
 * Lazy-loaded by app.js for the active basemap only (jan/jul ~75% smaller
 * than the monolithic field_hi.js). Cells only (no isolines).
 */
'''


def render_field(d: dict, *, fine: bool = False) -> str:
    header = FIELD_HEADER_FINE if fine else FIELD_HEADER_COARSE
    global_name = "HOUSING_FIELD_HI" if fine else "HOUSING_FIELD"
    body = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    return header + f"window.{global_name} = " + body + ";\n"


def render_field_hi_layer(field_hi: dict, key: str) -> str:
    """One basemap layer — self-contained script that merges into HOUSING_FIELD_HI."""
    meta = {k: field_hi[k] for k in ("bbox", "step", "years") if k in field_hi}
    meta_js = json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
    field_js = json.dumps(
        gridfield.compact_field_layer(field_hi["fields"][key]),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    key_js = json.dumps(key, ensure_ascii=False)
    return (
        FIELD_HI_LAYER_HEADER
        + f"(function(){{var g=window.HOUSING_FIELD_HI=window.HOUSING_FIELD_HI||{meta_js};"
        + f"g.fields=g.fields||{{}};g.fields[{key_js}]={field_js};}})();\n"
    )


def _enrich_coverage(con) -> str:
    g = con.execute("SELECT COUNT(*) FROM listings WHERE lat IS NOT NULL").fetchone()[0]
    c = con.execute("SELECT COUNT(DISTINCT listing_id) FROM climate").fetchone()[0]
    p = con.execute("SELECT COUNT(*) FROM poi_done").fetchone()[0]
    r = con.execute("SELECT COUNT(*) FROM risk").fetchone()[0]
    e = con.execute("SELECT COUNT(*) FROM listings WHERE elevation IS NOT NULL").fetchone()[0]
    pm = con.execute("SELECT COUNT(*) FROM listings WHERE pm25_annual IS NOT NULL").fetchone()[0]
    return f"geo {g}, climate {c}, pois {p}, risk {r}, elev {e}, pm25 {pm}"


# ---------------------------------------------------------------------------
# index.html count/date re-sync (anchored, fail-loud)
# ---------------------------------------------------------------------------
# Default-view filter thresholds — must match app.js isDefaultHidden() (SOP §5).
TIER1_MAX_PRICE_WAN = 20   # 万元
TIER1_MAX_UNIT_YUAN = 5000  # 元/㎡


def is_default_hidden(row: dict) -> bool:
    unit = row["priceWan"] * 10000 / row["area"]
    return row["priceWan"] > TIER1_MAX_PRICE_WAN or unit > TIER1_MAX_UNIT_YUAN


def sync_html(rows: list[dict]) -> list[str]:
    """Re-sync the hard-coded count/date tokens in index.html. Returns log lines."""
    if not HTML_PATH.exists():
        return [f"! index.html not found at {HTML_PATH} — skipped"]
    html = HTML_PATH.read_text(encoding="utf-8")
    visible = [r for r in rows if not is_default_hidden(r)]
    n = len(visible)
    provs = len({r["prov"] for r in visible})
    months = sorted({r["updated"] for r in rows})
    lo, hi = (months[0], months[-1]) if months else ("", "")
    log = []

    def apply(label, pattern, repl, expect=None):
        nonlocal html
        new, k = re.subn(pattern, repl, html)
        html = new
        flag = "" if (expect is None or k == expect) else f"  ⚠ expected {expect}"
        if k == 0:
            log.append(f"! {label}: 0 matches — token not found, update manually{flag}")
        else:
            log.append(f"  {label}: {k} occurrence(s) → synced{flag}")

    # Anchor each match to its specific HTML context so methodology static text
    # (e.g. "112 / 121 套" "50 套" "9 套") is never touched.
    # 1. meta description / og / twitter <meta ... content="N 套...">
    apply("套 meta/og (count)", r'(?<=content=")\d+(?=\s*套)', lambda m: str(n), expect=3)
    # 2. hero paragraph: <strong …>N 套</strong>
    apply("套 hero-count (count)", r'(?<=id="hero-count">)\d+(?=\s*套)', lambda m: str(n), expect=1)
    apply("个省 (provinces)", r"\d+(\s*个省)", lambda m: f"{provs}{m.group(1)}", expect=1)
    apply("覆盖N省 (provinces)", r"(覆盖\s*)\d+(\s*省)",
          lambda m: f"{m.group(1)}{provs}{m.group(2)}", expect=3)
    if lo and hi:
        apply("date range", r"\d{4}-\d{2}(\s*~\s*)\d{4}-\d{2}",
              lambda m: f"{lo}{m.group(1)}{hi}")

    # Cache-bust ALL local <script src="assets/…js"> tags with a content hash, so
    # browsers / the GitHub-Pages CDN re-fetch whenever data OR code changes. The
    # data files (listings/enriched/…) previously had no ?v= and app.js/i18n.js
    # carried a hand-edited stamp — both went stale, so a normal refresh kept the
    # old baked extremeDays / colours. Hash spans every served asset, so any
    # rebuild flips the token and invalidates the lot.
    import hashlib
    asset_dirs = [HTML_PATH.parent / "assets" / "data", HTML_PATH.parent / "assets" / "js"]
    h = hashlib.sha1()
    for d in asset_dirs:
        for f in sorted(d.glob("*.js")) if d.exists() else []:
            h.update(f.read_bytes())
    ver = h.hexdigest()[:10]
    if ver:
        apply("cache-bust (?v)",
              r'(src=")(assets/(?:data|js)/[^"?]+\.js)(?:\?v=[^"]*)?(")',
              lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}")

    HTML_PATH.write_text(html, encoding="utf-8")
    return log


# ---------------------------------------------------------------------------
# legacy listings.js parser (one-time bootstrap of the DB)
# ---------------------------------------------------------------------------
def parse_legacy_js(path: Path) -> list[dict]:
    src = path.read_text(encoding="utf-8")
    m = re.search(r"HOUSING_LISTINGS\s*=\s*\[(.*)\]\s*;", src, re.S)
    if not m:
        raise ValueError(f"could not find HOUSING_LISTINGS array in {path}")
    body = m.group(1)
    field_re = re.compile(r'(\w+)\s*:\s*("(?:[^"\\]|\\.)*"|-?[\d.]+)')
    rows = []
    for obj in re.finditer(r"\{([^}]*)\}", body):
        d = {}
        for fm in field_re.finditer(obj.group(1)):
            key, val = fm.group(1), fm.group(2)
            if val.startswith('"'):
                d[key] = val[1:-1]
            else:
                d[key] = float(val) if "." in val else int(val)
        if d:
            rows.append(coerce_row(d))
    return rows


# ---------------------------------------------------------------------------
# Sub-commands
# ---------------------------------------------------------------------------
def cmd_init(args):
    con = connect()
    con.executescript(SCHEMA)
    con.commit()
    print(f"✓ initialized schema in {DB_PATH.relative_to(ROOT)}")


def cmd_import_js(args):
    con = connect()
    con.executescript(SCHEMA)
    rows = parse_legacy_js(Path(args.path))
    ins, upd = upsert(con, rows)
    print(f"✓ import-js {args.path}: {ins} inserted, {upd} updated ({len(rows)} parsed)")


def cmd_import_csv(args):
    con = connect()
    con.executescript(SCHEMA)
    rows = []
    with open(args.path, newline="", encoding="utf-8-sig") as fh:
        for raw in csv.DictReader(fh):
            rows.append(coerce_row(raw))
    ins, upd = upsert(con, rows)
    print(f"✓ import-csv {args.path}: {ins} inserted, {upd} updated")


def cmd_add(args):
    con = connect()
    con.executescript(SCHEMA)
    row = coerce_row({
        "id": args.id, "prov": args.prov, "city": args.city, "dist": args.dist,
        "loc": args.loc, "priceWan": args.price_wan, "area": args.area,
        "rent": args.rent, "updated": args.updated,
    })
    ins, upd = upsert(con, [row])
    rid = con.execute(
        "SELECT id FROM listings WHERE loc=? AND city=? ORDER BY id DESC LIMIT 1",
        (row["loc"], row["city"]),
    ).fetchone()[0]
    verb = "updated" if upd else "added"
    print(f"✓ {verb} #{rid}: {row['prov']} {row['city']} {row['loc']} "
          f"({_numfmt(row['priceWan'])}万 / {_numfmt(row['area'])}㎡ / {row['rent']}元)")


def cmd_export_csv(args):
    con = connect()
    rows = fetch_all(con)
    path = Path(args.path) if args.path else CSV_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            r = dict(r)
            r["priceWan"] = _numfmt(r["priceWan"])
            r["area"] = _numfmt(r["area"])
            w.writerow(r)
    print(f"✓ export-csv: {len(rows)} rows → {path.relative_to(ROOT)}")


def cmd_build(args):
    con = connect()
    rows = fetch_all(con)
    if not rows:
        sys.exit("✗ no rows in DB — run `init` then `import-js` / `import-csv` / `add` first")
    JS_PATH.parent.mkdir(parents=True, exist_ok=True)
    JS_PATH.write_text(render_js(rows), encoding="utf-8")
    print(f"✓ build: {len(rows)} rows → {JS_PATH.relative_to(ROOT)}")
    # emit baked enrichment (geocode / climate / pois / risk / elevation) as its own global
    enriched = enrich.emit_enriched(con)
    ENR_PATH.write_text(render_enriched(enriched), encoding="utf-8")
    print(f"✓ enriched: {len(enriched)} → {ENR_PATH.relative_to(ROOT)} ({_enrich_coverage(con)})")
    # emit the curated province natural-hazard profile (pure data, no DB rows)
    hazards = enrich.emit_hazards()
    HAZ_PATH.write_text(render_hazards(hazards), encoding="utf-8")
    print(f"✓ hazards: {len(hazards)} province profiles → {HAZ_PATH.relative_to(ROOT)}")
    # emit city + national home-buying policy (keyed by 地级市; cite-or-null provenance)
    city_pol = enrich.emit_city_policy(con)
    nat_pol = enrich.emit_national_policy(con)
    POLICY_PATH.write_text(render_policy(city_pol, nat_pol), encoding="utf-8")
    print(f"✓ policy: {len(city_pol.get('byPref', {}))} 地级市 + "
          f"{len(nat_pol)} national topics → {POLICY_PATH.relative_to(ROOT)}")
    # emit multiple price offers per listing (一楼盘多价格; cite-or-omit provenance)
    offers = enrich.emit_offers(con)
    OFFERS_PATH.write_text(render_offers(offers), encoding="utf-8")
    print(f"✓ offers: {sum(len(v) for v in offers.values())} price point(s) across "
          f"{len(offers)} listing(s) → {OFFERS_PATH.relative_to(ROOT)}")
    # emit gridded climate/elevation fields — coarse (1°) + fine (0.25° zoom LOD)
    log = lambda m: print("   " + m)
    field = gridfield.emit_field(log, step=gridfield.STEP_COARSE)
    if field:
        FIELD_PATH.write_text(render_field(field), encoding="utf-8")
        npts = len(field["fields"].get("elevation", {}).get("points", []))
        print(f"✓ field: {len(field['fields'])} basemap fields, {npts} cells @1° → {FIELD_PATH.relative_to(ROOT)}")
    else:
        print(f"  field: no 1° cache ({gridfield.cache_path(gridfield.STEP_COARSE).relative_to(ROOT)}) — run `field` first")
    gridfield.fill_from_coarse_fallback(log, step=gridfield.STEP_FINE)
    field_hi = gridfield.emit_field(log, step=gridfield.STEP_FINE, isolines_ok=False)
    if field_hi:
        nhi = len(field_hi["fields"].get("elevation", {}).get("points", []))
        filled, total = gridfield.cache_coverage(gridfield.STEP_FINE)
        partial = f" ({filled}/{total} cached)" if filled < total else ""
        for fk in field_hi["fields"]:
            layer_path = FIELD_HI_DIR / f"field_hi_{fk}.js"
            layer_path.write_text(render_field_hi_layer(field_hi, fk), encoding="utf-8")
            kb = layer_path.stat().st_size // 1024
            print(f"   field_hi_{fk}: {kb} KB → {layer_path.relative_to(ROOT)}")
        if FIELD_HI_PATH.exists():
            FIELD_HI_PATH.unlink()
        print(f"✓ field_hi: {len(field_hi['fields'])} per-layer files, {nhi} cells @0.25°{partial} (monolith removed)")
    else:
        print(f"  field_hi: no 0.25° cache — run `manage.py field --step 0.25` for province-zoom LOD")
    # keep the human-readable CSV mirror in sync
    args.path = None
    cmd_export_csv(args)
    # re-sync the static count/date tokens in index.html
    print("  index.html sync:")
    for line in sync_html(rows):
        print("   " + line)


def cmd_tier1_check(args):
    """Report which listings are auto-excluded from the default view (SOP §5 thresholds)."""
    con = connect()
    rows = fetch_all(con)
    if not rows:
        print("(empty)")
        return
    hidden = [r for r in rows if is_default_hidden(r)]
    visible = [r for r in rows if not is_default_hidden(r)]
    print(f"default visible: {len(visible)} / {len(rows)}")
    print(f"filtered (>{TIER1_MAX_PRICE_WAN}万 or >{TIER1_MAX_UNIT_YUAN}元/㎡): {len(hidden)}")
    for r in sorted(hidden, key=lambda x: x["id"]):
        unit = r["priceWan"] * 10000 / r["area"]
        why = []
        if r["priceWan"] > TIER1_MAX_PRICE_WAN:
            why.append(f"总价{_numfmt(r['priceWan'])}万")
        if unit > TIER1_MAX_UNIT_YUAN:
            why.append(f"单价{unit:.0f}元/㎡")
        print(f"  #{r['id']} {r['loc']} ({', '.join(why)})")


def cmd_list(args):
    con = connect()
    rows = fetch_all(con)
    if not rows:
        print("(empty)")
        return
    ids = [r["id"] for r in rows]
    full = set(range(min(ids), max(ids) + 1))
    missing = sorted(full - set(ids))
    by_prov: dict[str, int] = {}
    for r in rows:
        by_prov[r["prov"]] = by_prov.get(r["prov"], 0) + 1
    print(f"{len(rows)} listings · id {min(ids)}–{max(ids)} "
          f"(missing: {missing or 'none'}) · {len(by_prov)} provinces")
    for prov, c in sorted(by_prov.items(), key=lambda kv: -kv[1]):
        print(f"  {prov:<6} {c}")


def cmd_city_check(args):
    """Accuracy gate: reverse-geocode listings and flag any landing in the wrong 地级市/省.

    Catches same-province wrong-city placements the geocode province-validator misses
    (e.g. a 芜湖 listing latching onto a 合肥 district). Cached → cheap to re-run.
    Use after adding listings: `city-check --from <id0> --to <idN>`; bare = whole DB.
    """
    con = connect()
    ids = None
    if args.from_id is not None or args.to_id is not None:
        lo = args.from_id if args.from_id is not None else 0
        hi = args.to_id if args.to_id is not None else 10 ** 9
        ids = [r["id"] for r in con.execute(
            "SELECT id FROM listings WHERE id BETWEEN ? AND ?", (lo, hi))]
    mism = enrich.verify_cities(con, print, ids=ids, refresh=args.refresh)
    if mism:
        print(f"CITY_CHECK_FAIL: {len(mism)} listing(s) in wrong city/province "
              f"→ data/research/_city_mismatch.json (research correct coords, fix, re-bake)")
        sys.exit(1)
    print("CITY_CHECK_OK")


# ---------------------------------------------------------------------------
# enrichment sub-commands (delegate to enrich.py; all resumable + rate-limited)
# ---------------------------------------------------------------------------
def cmd_geocode(args):
    enrich.geocode_all(connect(), print, force=args.force)


def cmd_climate(args):
    enrich.climate_all(connect(), print)


def cmd_climate_daily(args):
    enrich.climate_daily_all(connect(), print, force=args.force)


def cmd_hist_temp(args):
    import fetch_hist_temp_extremes as hte  # noqa: WPS433 — sibling script
    cache = hte.load_cache()
    rep = hte.apply_to_db(
        connect(), cache,
        force=args.force, skip_wiki=args.skip_wiki,
        upgrade_city=args.upgrade_city, upgrade_proxy=args.upgrade_proxy,
    )
    hte.save_cache(cache)
    print("=== hist-temp report ===")
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    print("→ run `build` to regenerate enriched.js")


def cmd_pois(args):
    enrich.pois_all(connect(), print)


def cmd_lulu(args):
    con = connect()
    enrich.lulu_all(con, print)        # CN + HK + TW from national ref sets
    enrich.lulu_ca_local(con, print)   # California via per-listing local search


def cmd_pois_refix(args):
    enrich.pois_refix(connect(), print)
    print("✓ pois-refix complete — now run `research-merge` for gaps, then `build`")


def cmd_pois_refresh(args):
    cats = tuple(c.strip() for c in args.categories.split(",") if c.strip())
    done, fail = enrich.pois_overpass_refresh(connect(), print, categories=cats or ("train",))
    print(f"✓ pois-refresh complete — {done} ok, {fail} overpass fail — now run `build`")


def cmd_risk(args):
    enrich.risk_all(connect(), print)


def cmd_elevation(args):
    enrich.elevation_all(connect(), print, force=args.force)


def cmd_field(args):
    source = getattr(args, "source", "open-meteo")
    steps = gridfield.RESOLUTIONS
    if args.step is not None:
        steps = (float(args.step),)
    for step in steps:
        if getattr(args, "coarse_fallback", False) or getattr(args, "coarse_fallback_only", False):
            gridfield.fill_from_coarse_fallback(print, step=step)
        if getattr(args, "coarse_fallback_only", False):
            continue
        if source in ("cds", "auto"):
            import era5_bulk  # noqa: WPS433
            era5_dir = era5_bulk.ERA5_DIR
            have_nc = any(era5_bulk.era5_year_path(y).exists() for y in era5_bulk.YEARS)
            if source == "cds" or have_nc:
                if not have_nc:
                    print("✗ era5-bulk: no NetCDF in data/ref/era5/ — run `era5-bulk download` first")
                    sys.exit(1)
                era5_bulk.sample_grid(print, step=step, force=args.force)
                continue
        gridfield.fetch_field(print, step=step, force=args.force)
    print("✓ field fetch complete — now run `build` to emit assets/data/field.js (+ field_hi_<key>.js)")


def cmd_era5_bulk(args):
    import era5_bulk  # noqa: WPS433
    if args.era5_cmd == "download":
        years = tuple(args.year) if args.year else era5_bulk.YEARS
        if not args.dry_run and not era5_bulk._cds_credentials_ok():
            print("✗ no ~/.cdsapirc — cannot download.")
            print("  Register: https://cds.climate.copernicus.eu/")
            print("  Preview: python3 tools/manage.py era5-bulk download --dry-run")
            sys.exit(1)
        era5_bulk.download_all(print, years=years, dry_run=args.dry_run, force=args.force)
    elif args.era5_cmd == "sample":
        steps = (float(args.step),) if args.step is not None else (gridfield.STEP_FINE,)
        for step in steps:
            try:
                era5_bulk.sample_grid(print, step=step, force=args.force)
            except FileNotFoundError as e:
                print(f"✗ {e}")
                sys.exit(1)
    elif args.era5_cmd == "status":
        era5_bulk.status_report(print, step=gridfield.STEP_FINE)
        era5_bulk.status_report(print, step=gridfield.STEP_COARSE)
    elif args.era5_cmd == "self-test":
        sys.exit(0 if era5_bulk.run_self_test(print) else 1)


def cmd_pm25(args):
    import pm25  # noqa: WPS433 — sibling script; optional netCDF4 dep
    rep = pm25.pm25_all(connect(), print, year=args.year, force=args.force)
    print("=== pm25 report ===")
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    print("→ run `build` to regenerate enriched.js")


def cmd_enrich(args):
    con = connect()
    enrich.geocode_all(con, print, force=False)
    enrich.climate_all(con, print)
    enrich.climate_daily_all(con, print)  # no-op if climate_all co-baked daily
    enrich.elevation_all(con, print)   # cheap batched DEM lookup
    enrich.risk_all(con, print)        # only needs coords + climate + coastline
    enrich.pois_all(con, print)        # last: Overpass is the slow / flaky stage
    print("✓ enrich complete — now run `build` to emit assets/data/enriched.js")


def cmd_research_merge(args):
    con = connect()
    data = json.load(open(args.path, encoding="utf-8"))
    findings = data.get("findings", data) if isinstance(data, dict) else data
    print(f"merging {len(findings)} research finding(s) from {args.path} …")
    rep = enrich.merge_research(con, findings, print, dry_run=args.dry_run)
    if not args.dry_run:
        enrich.refresh_refined_pois(con, print)   # OSM POIs go stale where a location moved
        # risk summaries embed coords/coast — recompute for any refined locations
        enrich.risk_all(con, print)
    print("=== research merge report ===")
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    if rep["moves"]:
        print(f"⚠ {len(rep['moves'])} location move(s) >25km — review these:")
        for m in rep["moves"]:
            print(f"   #{m['id']} {m['loc']}: moved {m['km']}km → {m['to']}")
    if args.dry_run:
        print("(dry-run — no DB writes; refresh/risk skipped)")


def cmd_built_merge(args):
    con = connect()
    data = json.load(open(args.path, encoding="utf-8"))
    findings = data.get("findings", []) if isinstance(data, dict) else data
    print(f"merging {len(findings)} built-year finding(s) from {args.path} …")
    rep = enrich.merge_built_years(con, findings, print, dry_run=args.dry_run)
    print("=== built-year merge report ===")
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    if args.dry_run:
        print(f"(dry-run — would store {rep['set']}, kept_existing {rep['kept_existing']})")
    else:
        print(f"→ {rep['set']} built-year(s) stored; run `build` to regenerate enriched.js")


def cmd_import_offers(args):
    con = connect()
    enrich.migrate(con)   # ensure listing_offers exists
    data = json.load(open(args.path, encoding="utf-8"))
    findings = data.get("offers", data.get("findings", data)) if isinstance(data, dict) else data
    print(f"merging {len(findings)} price offer(s) from {args.path} …")
    rep = enrich.merge_offers(con, findings, print, dry_run=args.dry_run)
    print("=== offers merge report ===")
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    if args.dry_run:
        print(f"(dry-run — would insert {rep['inserted']} across {rep['listings']} listing(s))")
    else:
        print(f"→ {rep['inserted']} offer(s) across {rep['listings']} listing(s) stored "
              f"(replaced {rep['cleared']}); run `build` to regenerate offers.js")


def cmd_hazard_merge(args):
    con = connect()
    data = json.load(open(args.path, encoding="utf-8"))
    findings = data.get("findings", []) if isinstance(data, dict) else data
    by_pref = {}
    for f in findings:
        k = f.get("prefKey")
        if k:
            by_pref[k] = {"headline": f.get("headline") or "", "hazards": f.get("hazards") or []}
    print(f"synthesizing per-listing hazards from {len(by_pref)} researched prefecture(s) "
          "(types × per-coords physical frequency) …")
    rep = enrich.synth_hazards(con, by_pref, print)
    print("=== hazard synthesis report ===")
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    print(f"→ {rep['listings']} listing hazard profiles ({rep['from_research']} prefecture-research, "
          f"{rep['from_province']} province-fallback); run `build` to regenerate enriched.js")


def _load_findings(path: Path) -> list:
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("findings", data) if isinstance(data, dict) else data
    return items if isinstance(items, list) else []


def cmd_demographics_merge(args):
    con = connect()
    findings = _load_findings(Path(args.path))
    print(f"merging {len(findings)} prefecture demographics finding(s) from {args.path} …")
    rep = enrich.merge_demographics(con, findings, print, dry_run=args.dry_run)
    print("=== demographics merge report ===")
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    if not args.dry_run:
        print("→ run `build` to regenerate enriched.js")


def cmd_hospital_tier3_merge(args):
    con = connect()
    if not args.all_batches and not args.path:
        sys.exit("✗ hospital-tier3-merge: provide <path> or --all-batches")
    if args.all_batches:
        paths = sorted((ROOT / "data" / "research").glob("hospital-dist-batch-*-findings.json"))
        paths += sorted((ROOT / "data" / "research").glob("hospital-dist-round2-findings.json"))
        findings = []
        for p in paths:
            findings.extend(_load_findings(p))
        print(f"merging {len(findings)} tier3 finding(s) from {len(paths)} batch file(s) …")
    else:
        findings = _load_findings(Path(args.path))
        print(f"merging {len(findings)} tier3 finding(s) from {args.path} …")
    rep = enrich.merge_hospital_tier3(con, findings, print, dry_run=args.dry_run)
    print("=== hospital-tier3 merge report ===")
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    if not args.dry_run:
        print("→ run `build` to regenerate enriched.js (pois.hospital_tier3)")


def cmd_property_import(args):
    con = connect()
    rows = []
    with open(args.path, newline="", encoding="utf-8-sig") as fh:
        for raw in csv.DictReader(fh):
            rows.append(raw)
    print(f"importing property fields for {len(rows)} row(s) from {args.path} …")
    rep = enrich.import_property_rows(con, rows, print, dry_run=args.dry_run)
    print("=== property import report ===")
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    if not args.dry_run:
        print("→ run `build` to regenerate enriched.js")


_CONF_RANK = {"unknown": 0, "low": 1, "med": 2, "high": 3}


def _apply_verify(city: dict, adjustments: list, log) -> int:
    """Fold an adversarial-verify pass into a city's policy fields (downgrade confidence,
    attach provenance of the check). Returns the number of fields adjusted."""
    n = 0
    for adj in adjustments or []:
        if adj.get("prefecture") != city.get("prefecture"):
            continue
        fld = adj.get("field")
        obj = city.get(fld)
        if not isinstance(obj, dict):
            continue
        verdict = adj.get("verdict")
        if verdict == "confirmed":
            continue
        cur = obj.get("confidence", "unknown")
        if verdict in ("unsupported", "contradicted"):
            target = adj.get("corrected_confidence") or "unknown"
        elif verdict == "unverifiable":
            target = adj.get("corrected_confidence") or "low"
        else:
            target = cur
        # never raise confidence via a skeptical pass — only cap/lower it
        if _CONF_RANK.get(target, 0) < _CONF_RANK.get(cur, 0):
            obj["confidence"] = target
        obj["_verify"] = {k: adj.get(k) for k in ("verdict", "corrected_value", "note")
                          if adj.get(k) is not None}
        n += 1
    return n


def cmd_import_policy(args):
    """Ingest the policy-research workflow result → city_policy + national_policy.

    Expects {asOf, provinces:[{research:{prov,cities},verify:{adjustments}} | {prov,cities}],
             national:[{topic,...}]}. Applies the adversarial-verify pass before upsert.
    """
    con = connect()
    blob = json.loads(Path(args.path).read_text(encoding="utf-8"))
    as_of = blob.get("asOf") or args.as_of
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    cur = con.cursor()
    n_adj = n_nat = 0
    # Accumulate by (short-prov, prefecture) so 县级市 lumped under one prefecture
    # (e.g. 娄底市-冷水江市 + 娄底市-涟源市 → 娄底市) merge instead of clobbering.
    merged = {}  # (prov, pref) -> {"loc_names": set, "data": dict}
    for item in blob.get("provinces", []):
        research = item.get("research", item) if isinstance(item, dict) else None
        if not research or not research.get("cities"):
            continue
        prov = enrich.norm_prov(research.get("prov"))
        adjustments = (item.get("verify") or {}).get("adjustments") if "verify" in item else None
        for city in research["cities"]:
            if adjustments:
                n_adj += _apply_verify(city, adjustments, print)
            pref = city.get("prefecture")
            if not prov or not pref:
                continue
            loc_names = city.pop("loc_names", []) or []
            data = {k: v for k, v in city.items() if k != "prefecture"}
            slot = merged.get((prov, pref))
            if slot is None:
                merged[(prov, pref)] = {"loc_names": list(loc_names), "data": data}
            else:  # collision: union loc_names, keep first (prefecture-grain) data
                for ln in loc_names:
                    if ln not in slot["loc_names"]:
                        slot["loc_names"].append(ln)
    n_pref = len(merged)
    if not args.dry_run:
        cur.execute("DELETE FROM city_policy")   # full-snapshot replace
        cur.execute("DELETE FROM national_policy")
        for (prov, pref), slot in merged.items():
            cur.execute(
                """INSERT INTO city_policy (prov, prefecture, loc_names, data, as_of, updated)
                   VALUES (?,?,?,?,?,?)""",
                (prov, pref, json.dumps(slot["loc_names"], ensure_ascii=False),
                 json.dumps(slot["data"], ensure_ascii=False), as_of, stamp),
            )
    for nat in blob.get("national", []):
        topic = nat.get("topic")
        if not topic:
            continue
        if args.dry_run:
            n_nat += 1
            continue
        payload = {k: v for k, v in nat.items() if k != "topic"}
        cur.execute(
            """INSERT INTO national_policy (topic, data, updated) VALUES (?,?,?)
               ON CONFLICT(topic) DO UPDATE SET data=excluded.data, updated=excluded.updated""",
            (topic, json.dumps(payload, ensure_ascii=False), stamp),
        )
        n_nat += 1
    if not args.dry_run:
        con.commit()
    verb = "(dry-run) would import" if args.dry_run else "imported"
    print(f"✓ {verb}: {n_pref} 地级市 ({n_adj} verify adjustments) + {n_nat} national topics "
          f"[as_of={as_of}]")
    if not args.dry_run:
        print("→ run `build` to regenerate assets/data/policy.js")


def main(argv=None):
    p = argparse.ArgumentParser(prog="manage.py", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init", help="create the SQLite DB + schema").set_defaults(fn=cmd_init)

    sp = sub.add_parser("import-js", help="bootstrap DB from a legacy listings.js")
    sp.add_argument("path", nargs="?", default=str(JS_PATH))
    sp.set_defaults(fn=cmd_import_js)

    sp = sub.add_parser("import-csv", help="upsert listings from a CSV (cols: %s)" % ",".join(FIELDS))
    sp.add_argument("path")
    sp.set_defaults(fn=cmd_import_csv)

    sp = sub.add_parser(
        "add",
        help="add/replace one listing (see SOP §1: cross-batch loc dedup scan before add)",
    )
    sp.add_argument("--id", type=int, default=None, help="explicit id (default: next free)")
    sp.add_argument("--prov", required=True)
    sp.add_argument("--city", required=True)
    sp.add_argument("--dist", default="")
    sp.add_argument(
        "--loc",
        required=True,
        help="community name; run SOP §1 loc LIKE scan across ALL batches in housing.db first",
    )
    sp.add_argument("--price-wan", required=True, help="total price in 万元")
    sp.add_argument("--area", required=True, help="area in m²")
    sp.add_argument("--rent", required=True, help="monthly rent in 元")
    sp.add_argument("--updated", required=True, help="YYYY-MM or YYYY.M")
    sp.set_defaults(fn=cmd_add)

    sp = sub.add_parser("build", help="regenerate listings.js + enriched.js + listings.csv + sync index.html")
    sp.set_defaults(fn=cmd_build)

    sp = sub.add_parser("geocode", help="bake lat/lng via Nominatim (resumable, ~1/s)")
    sp.add_argument("--force", action="store_true", help="re-geocode rows that already have coords")
    sp.set_defaults(fn=cmd_geocode)

    sub.add_parser("climate", help="bake monthly climate normals via Open-Meteo").set_defaults(fn=cmd_climate)
    sp = sub.add_parser("climate-daily", help="bake 365-day climatology + comfort/extreme day-ranges")
    sp.add_argument("--force", action="store_true",
                    help="re-fetch ERA5 daily archive for all geocoded rows (extended dims)")
    sp.set_defaults(fn=cmd_climate_daily)
    sp = sub.add_parser("hist-temp", help="bake historical max/min temps (Wikipedia CMA → ERA5 fallback)")
    sp.add_argument("--force", action="store_true", help="re-fetch even if columns already populated")
    sp.add_argument("--skip-wiki", action="store_true", help="ERA5 only (faster; no CMA station lookup)")
    sp.add_argument("--upgrade-city", action="store_true",
                    help="re-bake rows still at 市 with district-first logic")
    sp.add_argument("--upgrade-proxy", action="store_true",
                    help="re-bake climate-monthly-2014-2023 proxy rows via wiki/ERA5")
    sp.set_defaults(fn=cmd_hist_temp)
    sp = sub.add_parser("elevation", help="bake metres-above-sea-level via Open-Meteo DEM (batched)")
    sp.add_argument("--force", action="store_true", help="re-fetch rows that already have elevation")
    sp.set_defaults(fn=cmd_elevation)
    sp = sub.add_parser("field", help="sample the gridded China climate/elevation field (resumable cache)")
    sp.add_argument("--step", type=float, default=None, help="grid step in degrees (default: 1.0 and 0.25)")
    sp.add_argument("--force", action="store_true", help="ignore cache and re-sample the whole grid")
    sp.add_argument("--coarse-fallback", action="store_true",
                    help="bilinear-fill unfilled fine cells from 1° cache before archive fetch")
    sp.add_argument("--coarse-fallback-only", action="store_true",
                    help="only run coarse fallback (no archive API calls)")
    sp.add_argument("--source", choices=("open-meteo", "cds", "auto"), default="open-meteo",
                    help="climate source: open-meteo (default), cds (NetCDF), auto (cds when present)")
    sp.set_defaults(fn=cmd_field)
    sp = sub.add_parser("era5-bulk", help="CDS ERA5 regional download + bilinear field sampling")
    era5_sub = sp.add_subparsers(dest="era5_cmd", required=True)
    sp_dl = era5_sub.add_parser("download", help="pull 2014–2023 daily stats → data/ref/era5/")
    sp_dl.add_argument("--year", type=int, action="append", help="limit year(s)")
    sp_dl.add_argument("--dry-run", action="store_true")
    sp_dl.add_argument("--force", action="store_true")
    sp_dl.set_defaults(fn=cmd_era5_bulk)
    sp_sm = era5_sub.add_parser("sample", help="sample NetCDF onto field_grid cache")
    sp_sm.add_argument("--step", type=float, default=None, help="grid step (default 0.25)")
    sp_sm.add_argument("--force", action="store_true")
    sp_sm.set_defaults(fn=cmd_era5_bulk)
    sp_st = era5_sub.add_parser("status", help="NetCDF years + cache src counts")
    sp_st.set_defaults(fn=cmd_era5_bulk)
    sp_ts = era5_sub.add_parser("self-test", help="offline aggregation smoke (no CDS)")
    sp_ts.set_defaults(fn=cmd_era5_bulk)
    sp = sub.add_parser("pm25", help="sample ChinaHighPM2.5 annual + heating-season at listing coords")
    sp.add_argument("--year", type=int, default=2020, help="reference year (default 2020; Y1K + Nov(Y-1)–Mar(Y))")
    sp.add_argument("--force", action="store_true", help="re-sample rows that already have pm25_annual")
    sp.set_defaults(fn=cmd_pm25)
    sub.add_parser("pois", help="bake nearest metro/train/airport/hospital/mall/coast").set_defaults(fn=cmd_pois)
    sub.add_parser("pois-refix", help="re-bake suspicious 0m hospitals / missing metro in metro cities").set_defaults(
        fn=cmd_pois_refix)
    sp = sub.add_parser("pois-refresh", help="re-fetch Overpass for selected POI categories (e.g. train subtype)")
    sp.add_argument("--categories", default="train", help="comma-separated categories (default: train)")
    sp.set_defaults(fn=cmd_pois_refresh)
    sub.add_parser("risk", help="compute coarse coast/seismic/typhoon risk").set_defaults(fn=cmd_risk)
    sub.add_parser('lulu', help='bake nearest-distance to 7 LULU facility classes (offline, from data/ref/lulu_*_cn.json)').set_defaults(fn=cmd_lulu)
    sub.add_parser("enrich", help="run geocode + climate + pois + risk (all stages)").set_defaults(fn=cmd_enrich)

    sp = sub.add_parser("research-merge", help="fold subagent research findings (JSON) into the DB")
    sp.add_argument("path", help="JSON array of per-listing finding objects")
    sp.add_argument("--dry-run", action="store_true", help="report only, no DB writes")
    sp.set_defaults(fn=cmd_research_merge)

    sp = sub.add_parser("built-merge", help="fold validated 建成年代 (construction-year) findings into the DB")
    sp.add_argument("path", help="JSON: [{id, builtYear, source, confidence}, …] or {findings:[…]}")
    sp.add_argument("--dry-run", action="store_true", help="report only, no DB writes")
    sp.set_defaults(fn=cmd_built_merge)

    sp = sub.add_parser("import-offers",
                        help="fold multiple price offers (一楼盘多价格) into listing_offers; re-import replaces per listing")
    sp.add_argument("path", help="JSON: [{id|loc, area, priceWan, layout?, updated?, source_url}, …] or {offers:[…]}")
    sp.add_argument("--dry-run", action="store_true", help="report only, no DB writes")
    sp.set_defaults(fn=cmd_import_offers)

    sub.add_parser("relief", help="bake local terrain relief (DEM ring) for 地质灾害 downscaling").set_defaults(
        fn=lambda a: (enrich.relief_all(connect(), print)))

    sp = sub.add_parser("hazard-merge", help="synthesize per-listing hazards: prefecture research × physical frequency")
    sp.add_argument("path", help="JSON: {findings:[{prefKey, headline, hazards:[{type,freq,note,source}]}, …]}")
    sp.set_defaults(fn=cmd_hazard_merge)

    sp = sub.add_parser("demographics-merge",
                        help="fold prefecture 七普/六普 + 老龄化 research into listings.demographics_local")
    sp.add_argument("path", help="JSON: {findings:[{prefKey, popCensus7, popChangePct, aging65Plus, …}, …]}")
    sp.add_argument("--dry-run", action="store_true", help="report only, no DB writes")
    sp.set_defaults(fn=cmd_demographics_merge)

    sp = sub.add_parser("hospital-tier3-merge",
                        help="fold 三甲医院 research into poi.category=hospital_tier3")
    sp.add_argument("path", nargs="?", help="JSON findings file (hospital-dist-batch format)")
    sp.add_argument("--all-batches", action="store_true",
                    help="glob data/research/hospital-dist-batch-*-findings.json")
    sp.add_argument("--dry-run", action="store_true", help="report only, no DB writes")
    sp.set_defaults(fn=cmd_hospital_tier3_merge)

    sp = sub.add_parser("property-import",
                        help="upsert 产权/顶楼/物业费 from CSV (id,property_rights,is_top_floor,property_fee_yuan,…)")
    sp.add_argument("path", help="CSV with id + optional property columns")
    sp.add_argument("--dry-run", action="store_true", help="validate only, no DB writes")
    sp.set_defaults(fn=cmd_property_import)

    sp = sub.add_parser("import-policy",
                        help="ingest policy-research workflow JSON → city_policy + national_policy")
    sp.add_argument("path", help="workflow result JSON {asOf, provinces:[…], national:[…]}")
    sp.add_argument("--as-of", default="2026-06", help="fallback as_of when JSON omits it")
    sp.add_argument("--dry-run", action="store_true", help="report only, no DB writes")
    sp.set_defaults(fn=cmd_import_policy)

    sp = sub.add_parser("export-csv", help="dump DB → CSV (default data/listings.csv)")
    sp.add_argument("path", nargs="?", default=None)
    sp.set_defaults(fn=cmd_export_csv)

    sub.add_parser("tier1-check", help="list listings auto-excluded from default view (SOP §5)").set_defaults(
        fn=cmd_tier1_check)
    sp = sub.add_parser("city-check",
                        help="reverse-geocode listings; flag any in the wrong 地级市/省 (accuracy gate)")
    sp.add_argument("--from", dest="from_id", type=int, default=None, help="only check ids ≥ this")
    sp.add_argument("--to", dest="to_id", type=int, default=None, help="only check ids ≤ this")
    sp.add_argument("--refresh", action="store_true", help="ignore cache, re-query Nominatim")
    sp.set_defaults(fn=cmd_city_check)
    sub.add_parser("list", help="print a summary of the DB").set_defaults(fn=cmd_list)

    args = p.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
