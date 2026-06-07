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
from datetime import datetime
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
FIELD_PATH = ROOT / "assets" / "data" / "field.js"
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
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
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


FIELD_HEADER = '''/**
 * China small-city housing — gridded climate / elevation field (basemap).
 *
 * GENERATED FILE — do not hand-edit. Source is data/ref/field_grid.json
 * (sampled by `manage.py field`); isolines re-extracted by `manage.py build`.
 *
 * A continuous, land-masked field over China (Open-Meteo ERA5 archive + model
 * DEM), so the map can draw a real isotherm / rainfall / elevation basemap
 * under the listings. Per field: heatmap points [lng,lat,value] + marching-
 * squares isoline segments per level. Coarse (1° grid) — for orientation, not
 * precision. window.HOUSING_FIELD = {bbox, step, fields:{key:{...}}}.
 */
'''


def render_field(d: dict) -> str:
    body = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    return FIELD_HEADER + "window.HOUSING_FIELD = " + body + ";\n"


def _enrich_coverage(con) -> str:
    g = con.execute("SELECT COUNT(*) FROM listings WHERE lat IS NOT NULL").fetchone()[0]
    c = con.execute("SELECT COUNT(DISTINCT listing_id) FROM climate").fetchone()[0]
    p = con.execute("SELECT COUNT(*) FROM poi_done").fetchone()[0]
    r = con.execute("SELECT COUNT(*) FROM risk").fetchone()[0]
    e = con.execute("SELECT COUNT(*) FROM listings WHERE elevation IS NOT NULL").fetchone()[0]
    return f"geo {g}, climate {c}, pois {p}, risk {r}, elev {e}"


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
        built_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        apply("footer 网页更新于", r'(id="page-built-at" class="tabular-nums">网页更新于\s*)\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}',
              lambda m: f"{m.group(1)}{built_at}", expect=1)

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
    # emit the gridded climate/elevation field (offline isoline gen from cache)
    field = gridfield.emit_field(lambda m: print("   " + m))
    if field:
        FIELD_PATH.write_text(render_field(field), encoding="utf-8")
        print(f"✓ field: {len(field['fields'])} basemap fields → {FIELD_PATH.relative_to(ROOT)}")
    else:
        print(f"  field: no grid cache ({gridfield.CACHE.relative_to(ROOT)}) — run `field` first; basemaps will be absent")
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


# ---------------------------------------------------------------------------
# enrichment sub-commands (delegate to enrich.py; all resumable + rate-limited)
# ---------------------------------------------------------------------------
def cmd_geocode(args):
    enrich.geocode_all(connect(), print, force=args.force)


def cmd_climate(args):
    enrich.climate_all(connect(), print)


def cmd_climate_daily(args):
    enrich.climate_daily_all(connect(), print)


def cmd_pois(args):
    enrich.pois_all(connect(), print)


def cmd_pois_refix(args):
    enrich.pois_refix(connect(), print)
    print("✓ pois-refix complete — now run `research-merge` for gaps, then `build`")


def cmd_risk(args):
    enrich.risk_all(connect(), print)


def cmd_elevation(args):
    enrich.elevation_all(connect(), print, force=args.force)


def cmd_field(args):
    gridfield.fetch_field(print, force=args.force)
    print("✓ field fetch complete — now run `build` to emit assets/data/field.js")


def cmd_enrich(args):
    con = connect()
    enrich.geocode_all(con, print, force=False)
    enrich.climate_all(con, print)
    enrich.elevation_all(con, print)   # cheap batched DEM lookup
    enrich.risk_all(con, print)        # only needs coords + climate + coastline
    enrich.pois_all(con, print)        # last: Overpass is the slow / flaky stage
    print("✓ enrich complete — now run `build` to emit assets/data/enriched.js")


def cmd_research_merge(args):
    con = connect()
    findings = json.load(open(args.path, encoding="utf-8"))
    print(f"merging {len(findings)} research finding(s) from {args.path} …")
    rep = enrich.merge_research(con, findings, print)
    enrich.refresh_refined_pois(con, print)   # OSM POIs go stale where a location moved
    # risk summaries embed coords/coast — recompute for any refined locations
    enrich.risk_all(con, print)
    print("=== research merge report ===")
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    if rep["moves"]:
        print(f"⚠ {len(rep['moves'])} location move(s) >25km — review these:")
        for m in rep["moves"]:
            print(f"   #{m['id']} {m['loc']}: moved {m['km']}km → {m['to']}")


def cmd_built_merge(args):
    con = connect()
    data = json.load(open(args.path, encoding="utf-8"))
    findings = data.get("findings", []) if isinstance(data, dict) else data
    print(f"merging {len(findings)} built-year finding(s) from {args.path} …")
    rep = enrich.merge_built_years(con, findings, print)
    print("=== built-year merge report ===")
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    print(f"→ {rep['set']} built-year(s) stored; run `build` to regenerate enriched.js")


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

    sp = sub.add_parser("add", help="add/replace one listing")
    sp.add_argument("--id", type=int, default=None, help="explicit id (default: next free)")
    sp.add_argument("--prov", required=True)
    sp.add_argument("--city", required=True)
    sp.add_argument("--dist", default="")
    sp.add_argument("--loc", required=True)
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
    sub.add_parser("climate-daily", help="bake 365-day climatology + comfort/extreme day-ranges").set_defaults(fn=cmd_climate_daily)
    sp = sub.add_parser("elevation", help="bake metres-above-sea-level via Open-Meteo DEM (batched)")
    sp.add_argument("--force", action="store_true", help="re-fetch rows that already have elevation")
    sp.set_defaults(fn=cmd_elevation)
    sp = sub.add_parser("field", help="sample the gridded China climate/elevation field (resumable cache)")
    sp.add_argument("--force", action="store_true", help="ignore cache and re-sample the whole grid")
    sp.set_defaults(fn=cmd_field)
    sub.add_parser("pois", help="bake nearest metro/train/airport/hospital/mall/coast").set_defaults(fn=cmd_pois)
    sub.add_parser("pois-refix", help="re-bake suspicious 0m hospitals / missing metro in metro cities").set_defaults(
        fn=cmd_pois_refix)
    sub.add_parser("risk", help="compute coarse coast/seismic/typhoon risk").set_defaults(fn=cmd_risk)
    sub.add_parser("enrich", help="run geocode + climate + pois + risk (all stages)").set_defaults(fn=cmd_enrich)

    sp = sub.add_parser("research-merge", help="fold subagent research findings (JSON) into the DB")
    sp.add_argument("path", help="JSON array of per-listing finding objects")
    sp.set_defaults(fn=cmd_research_merge)

    sp = sub.add_parser("built-merge", help="fold validated 建成年代 (construction-year) findings into the DB")
    sp.add_argument("path", help="JSON: [{id, builtYear, source, confidence}, …] or {findings:[…]}")
    sp.set_defaults(fn=cmd_built_merge)

    sub.add_parser("relief", help="bake local terrain relief (DEM ring) for 地质灾害 downscaling").set_defaults(
        fn=lambda a: (enrich.relief_all(connect(), print)))

    sp = sub.add_parser("hazard-merge", help="synthesize per-listing hazards: prefecture research × physical frequency")
    sp.add_argument("path", help="JSON: {findings:[{prefKey, headline, hazards:[{type,freq,note,source}]}, …]}")
    sp.set_defaults(fn=cmd_hazard_merge)

    sp = sub.add_parser("export-csv", help="dump DB → CSV (default data/listings.csv)")
    sp.add_argument("path", nargs="?", default=None)
    sp.set_defaults(fn=cmd_export_csv)

    sub.add_parser("tier1-check", help="list listings auto-excluded from default view (SOP §5)").set_defaults(
        fn=cmd_tier1_check)
    sub.add_parser("list", help="print a summary of the DB").set_defaults(fn=cmd_list)

    args = p.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
