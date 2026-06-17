#!/usr/bin/env python3
"""
china-housing gridded climate / elevation field — build-time bake.

Produces a CONTINUOUS field over China (not just the listing sample points) so the
web map can show a true isotherm / rainfall / elevation basemap underneath the
listings. Two stages, deliberately split:

  fetch (network)   `manage.py field`  → samples a land-masked lat/lng grid via
                    Open-Meteo Historical Archive (ERA5). One batched pass yields
                    BOTH temperature normals AND the model elevation per point.
                    Resumable: results cached in data/ref/field_grid_{step}.json.

  emit  (offline)   `manage.py build`   → reads the cache, runs marching squares
                    to extract isolines (coarse grid only), and writes
                    assets/data/field.js (1°) + field_hi.js (0.25°).
                    No network — deterministic.

The land mask is a stdlib ray-casting point-in-polygon test against the vendored
china-geo.js province boundaries (GCJ-02; the ~0.5km datum offset is sub-cell at
0.25°). Free / no-key / WGS-84-ish, consistent with enrich.py.
"""
from __future__ import annotations

import json
import math
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "data" / "ref"
GEO_JS = ROOT / "assets" / "data" / "china-geo.js"
UA = "qrost-china-housing/1.0 (+https://qrost.github.io; contact czd358121692@gmail.com)"

# grid + sampling parameters — align ERA5 window with enrich.py
STEP_COARSE = 1.0
STEP_FINE = 0.25
RESOLUTIONS = (STEP_COARSE, STEP_FINE)
LAT_MIN, LAT_MAX = 18.0, 54.0
LNG_MIN, LNG_MAX = 73.0, 135.5
YEARS = (2014, 2023)
BATCH = 80                 # coords per archive request

# legacy alias (was single 1° cache)
CACHE = REF / "field_grid_1.json"


def cache_path(step: float) -> Path:
    if step == STEP_COARSE:
        return REF / "field_grid_1.json"
    if step == STEP_FINE:
        return REF / "field_grid_0.25.json"
    return REF / f"field_grid_{step:g}.json"


def _migrate_legacy_cache():
    """field_grid.json (pre-LOD) → field_grid_1.json once."""
    legacy = REF / "field_grid.json"
    dst = cache_path(STEP_COARSE)
    if legacy.exists() and not dst.exists():
        dst.write_text(legacy.read_text(encoding="utf-8"), encoding="utf-8")


# ---------------------------------------------------------------------------
# China land mask (ray casting, holes-aware)
# ---------------------------------------------------------------------------
def _load_polys():
    txt = GEO_JS.read_text(encoding="utf-8")
    m = re.search(r"=\s*(\{.*\})\s*;?\s*$", txt, re.S)
    geo = json.loads(m.group(1))
    polys = []  # each: {"outer":[(x,y)..], "holes":[[(x,y)..]..], "bbox":(mnx,mny,mxx,mxy)}

    def ring(coords):
        return [(c[0], c[1]) for c in coords]

    def add_polygon(rings):
        outer = ring(rings[0])
        holes = [ring(r) for r in rings[1:]]
        xs = [p[0] for p in outer]
        ys = [p[1] for p in outer]
        polys.append({"outer": outer, "holes": holes,
                      "bbox": (min(xs), min(ys), max(xs), max(ys))})

    for f in geo["features"]:
        g = f["geometry"]
        if g["type"] == "Polygon":
            add_polygon(g["coordinates"])
        elif g["type"] == "MultiPolygon":
            for poly in g["coordinates"]:
                add_polygon(poly)
    return polys


def _in_ring(x, y, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi):
            inside = not inside
        j = i
    return inside


def in_china(x, y, polys):
    for p in polys:
        mnx, mny, mxx, mxy = p["bbox"]
        if x < mnx or x > mxx or y < mny or y > mxy:
            continue
        if _in_ring(x, y, p["outer"]) and not any(_in_ring(x, y, h) for h in p["holes"]):
            return True
    return False


LISTING_CORRIDOR_PAD = float(os.environ.get("FIELD_CORRIDOR_PAD", "1.5"))  # ° around listings for 0.25° grid


def _load_listing_coords():
    db = ROOT / "data" / "housing.db"
    if not db.exists():
        return []
    import sqlite3
    con = sqlite3.connect(db)
    try:
        return [(float(lng), float(lat)) for lat, lng in con.execute(
            "SELECT lat, lng FROM listings WHERE lat IS NOT NULL AND lng IS NOT NULL")]
    finally:
        con.close()


def land_grid(step: float = STEP_COARSE, *, corridor_pad: float | None = None):
    polys = _load_polys()
    cols = int(round((LNG_MAX - LNG_MIN) / step)) + 1
    rows = int(round((LAT_MAX - LAT_MIN) / step)) + 1
    listings = _load_listing_coords() if corridor_pad is not None else []
    pts = []
    for r in range(rows):
        lat = round(LAT_MIN + r * step, 4)
        for c in range(cols):
            lng = round(LNG_MIN + c * step, 4)
            if not in_china(lng, lat, polys):
                continue
            if corridor_pad is not None and listings:
                if not any(abs(lng - ll) <= corridor_pad and abs(lat - la) <= corridor_pad
                           for ll, la in listings):
                    continue
            pts.append((lng, lat))
    return pts, rows, cols


# ---------------------------------------------------------------------------
# Fetch — Open-Meteo archive (batched, resumable)
# ---------------------------------------------------------------------------
def _era5_wait_seconds(pad=75):
    now = datetime.now(timezone.utc)
    wait = (3600 - now.minute * 60 - now.second) % 3600
    if wait < pad:
        wait += 3600
    return wait + pad


def _sleep_until_era5_reset(log, pad=75):
    wait = _era5_wait_seconds(pad)
    if log:
        log(f"  …archive 429 — sleeping {wait}s for UTC quota reset")
    time.sleep(wait)


def _get(url, timeout=120, retries=6, backoff=3.0, log=None):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 429:
                _sleep_until_era5_reset(log)
                continue
            time.sleep(backoff * (i + 1))
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(backoff * (i + 1))
    raise last


def _key(lng, lat):
    return f"{lng:.2f},{lat:.2f}"


def _nearest_coarse(coarse_pts: dict, lng: float, lat: float, field: str, max_deg: float = 2.5):
    """Nearest 1° cell with data within max_deg (for coastal corridor gaps)."""
    best, best_d = None, max_deg * max_deg
    for k, ent in coarse_pts.items():
        v = ent.get(field)
        if v is None:
            continue
        clng, clat = (float(x) for x in k.split(","))
        d = (clng - lng) ** 2 + (clat - lat) ** 2
        if d < best_d:
            best_d, best = d, float(v)
    return best


def _coarse_lookup(coarse_pts: dict, lng: float, lat: float, field: str):
    """Nearest 1° cell value, or None."""
    clng = round(math.floor((lng - LNG_MIN) / STEP_COARSE) * STEP_COARSE + LNG_MIN, 2)
    clat = round(math.floor((lat - LAT_MIN) / STEP_COARSE) * STEP_COARSE + LAT_MIN, 2)
    ent = coarse_pts.get(_key(clng, clat)) or {}
    v = ent.get(field)
    if v is not None:
        return v
    return _nearest_coarse(coarse_pts, lng, lat, field)


def _bilinear_coarse(coarse_pts: dict, lng: float, lat: float, field: str):
    """Bilinear sample from 1° cache; falls back to nearest cell."""
    c0 = int(math.floor((lng - LNG_MIN) / STEP_COARSE))
    r0 = int(math.floor((lat - LAT_MIN) / STEP_COARSE))
    tx = (lng - (LNG_MIN + c0 * STEP_COARSE)) / STEP_COARSE
    ty = (lat - (LAT_MIN + r0 * STEP_COARSE)) / STEP_COARSE
    corners = []
    for dc, dr in ((0, 0), (1, 0), (1, 1), (0, 1)):
        clng = round(LNG_MIN + (c0 + dc) * STEP_COARSE, 2)
        clat = round(LAT_MIN + (r0 + dr) * STEP_COARSE, 2)
        v = (coarse_pts.get(_key(clng, clat)) or {}).get(field)
        if v is None:
            return _nearest_coarse(coarse_pts, lng, lat, field)
        corners.append(float(v))
    v00, v10, v11, v01 = corners
    return (1 - tx) * (1 - ty) * v00 + tx * (1 - ty) * v10 + tx * ty * v11 + (1 - tx) * ty * v01


def _bilinear_coarse_ok(coarse_pts: dict, lng: float, lat: float) -> bool:
    """True when all four surrounding 1° land cells exist in the coarse cache."""
    c0 = int(math.floor((lng - LNG_MIN) / STEP_COARSE))
    r0 = int(math.floor((lat - LAT_MIN) / STEP_COARSE))
    for dc, dr in ((0, 0), (1, 0), (1, 1), (0, 1)):
        clng = round(LNG_MIN + (c0 + dc) * STEP_COARSE, 2)
        clat = round(LAT_MIN + (r0 + dr) * STEP_COARSE, 2)
        ent = coarse_pts.get(_key(clng, clat)) or {}
        if ent.get("jan") is None:
            return False
    return True


_COARSE_PLACEHOLDER_SRC = frozenset({"coarse_interp", "1deg_nearest"})


def fill_from_coarse_fallback(log, step: float = STEP_FINE):
    """Downscale 1° ERA5 cache onto unfilled fine cells (bilinear when possible,
    else copy nearest 1° land cell). Climate only — elevation stays as-is.
    Marks `src: coarse_interp` / `1deg_nearest` so archive fetch upgrades later."""
    if step >= STEP_COARSE:
        log(f"coarse fallback: only for step < {STEP_COARSE}° (got {step})")
        return 0
    coarse_file = cache_path(STEP_COARSE)
    fine_file = cache_path(step)
    if not coarse_file.exists():
        log(f"coarse fallback: missing {coarse_file.relative_to(ROOT)}")
        return 0
    coarse = json.loads(coarse_file.read_text(encoding="utf-8"))
    coarse_pts = coarse.get("points") or {}
    corridor = LISTING_CORRIDOR_PAD if step == STEP_FINE else None
    pts, rows, cols = land_grid(step, corridor_pad=corridor)
    cache = {"step": step, "bbox": [LNG_MIN, LAT_MIN, LNG_MAX, LAT_MAX],
             "rows": rows, "cols": cols, "years": list(YEARS), "points": {},
             "corridor_pad": corridor}
    if fine_file.exists():
        try:
            old = json.loads(fine_file.read_text(encoding="utf-8"))
            if old.get("step") == step and old.get("years") == list(YEARS):
                cache = old
                cache["rows"], cache["cols"] = rows, cols
        except Exception:  # noqa: BLE001
            pass
    todo = [(lng, lat) for (lng, lat) in pts
            if cache["points"].get(_key(lng, lat), {}).get("jan") is None]

    def _write_meta():
        meta = cache.setdefault("meta", {})
        meta["coarse_interp_count"] = sum(
            1 for p in cache["points"].values() if p.get("src") == "coarse_interp")
        meta["coarse_nearest_count"] = sum(
            1 for p in cache["points"].values() if p.get("src") == "1deg_nearest")
        meta["coarse_fill_note"] = (
            "climate downscaled from field_grid_1.json (bilinear or nearest 1° land cell); "
            "archive fetch replaces src=coarse_interp|1deg_nearest with era5")
        fine_file.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")

    if not todo:
        _write_meta()
        log(f"coarse fallback @{step}°: nothing to fill "
            f"({cache['meta'].get('coarse_interp_count', 0)} bilinear, "
            f"{cache['meta'].get('coarse_nearest_count', 0)} nearest)")
        return 0
    log(f"coarse fallback @{step}°: filling {len(todo)} cell(s) from 1° cache…")
    n_interp = n_nearest = 0
    for lng, lat in todo:
        ent = cache["points"].setdefault(_key(lng, lat),
                                         {"elev": None, "jan": None, "jul": None, "prcp": None})
        if ent.get("jan") is not None:
            continue
        use_bilinear = _bilinear_coarse_ok(coarse_pts, lng, lat)
        sample = _bilinear_coarse if use_bilinear else _nearest_coarse
        jan = sample(coarse_pts, lng, lat, "jan")
        jul = sample(coarse_pts, lng, lat, "jul")
        prcp = sample(coarse_pts, lng, lat, "prcp")
        if jan is None and jul is None:
            continue
        ent["jan"] = round(jan, 1) if jan is not None else None
        ent["jul"] = round(jul, 1) if jul is not None else None
        ent["prcp"] = round(prcp, 0) if prcp is not None else None
        ent["src"] = "coarse_interp" if use_bilinear else "1deg_nearest"
        if use_bilinear:
            n_interp += 1
        else:
            n_nearest += 1
    _write_meta()
    meta = cache["meta"]
    log(f"coarse fallback @{step}° done: {n_interp + n_nearest} new "
        f"({meta['coarse_interp_count']} bilinear, {meta['coarse_nearest_count']} nearest)")
    return n_interp + n_nearest


def fill_elevation(pts, cache, cache_file: Path, log):
    """Fill `elev` for every land point via the elevation API — a SEPARATE quota
    from the archive endpoint, so this works even when archive is rate-limited.
    Batched 100/call."""
    todo = [(lng, lat) for (lng, lat) in pts
            if cache["points"].get(_key(lng, lat), {}).get("elev") is None]
    if not todo:
        return
    log(f"  elevation: filling {len(todo)} point(s) via elevation API…")
    done = 0
    for i in range(0, len(todo), 100):
        chunk = todo[i:i + 100]
        url = "https://api.open-meteo.com/v1/elevation?" + urllib.parse.urlencode({
            "latitude": ",".join(f"{lat:.2f}" for (lng, lat) in chunk),
            "longitude": ",".join(f"{lng:.2f}" for (lng, lat) in chunk)})
        try:
            elevs = json.loads(_get(url, timeout=45, log=log)).get("elevation") or []
        except Exception as e:  # noqa: BLE001
            log(f"  ! elevation batch @{i} failed: {repr(e)[:80]}")
            time.sleep(2)
            continue
        for (lng, lat), e in zip(chunk, elevs):
            ent = cache["points"].setdefault(_key(lng, lat), {"elev": None, "jan": None, "jul": None, "prcp": None})
            if e is not None:
                ent["elev"] = round(float(e), 0)
        done += len(chunk)
        cache_file.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        time.sleep(1.0)
    log(f"  elevation fill done: {done} point(s)")


def fetch_field(log, step: float = STEP_COARSE, force=False):
    _migrate_legacy_cache()
    cache_file = cache_path(step)
    corridor = LISTING_CORRIDOR_PAD if step == STEP_FINE else None
    pts, rows, cols = land_grid(step, corridor_pad=corridor)
    cache = {"step": step, "bbox": [LNG_MIN, LAT_MIN, LNG_MAX, LAT_MAX],
             "rows": rows, "cols": cols, "years": list(YEARS), "points": {},
             "corridor_pad": corridor}
    if cache_file.exists() and not force:
        try:
            old = json.loads(cache_file.read_text(encoding="utf-8"))
            if old.get("step") == step and old.get("years") == list(YEARS):
                cache = old
                cache["rows"], cache["cols"] = rows, cols
        except Exception:  # noqa: BLE001
            pass
    # elevation prefill: separate API quota — skip on fine grid (archive returns elevation
    # per point; avoids 15k elevation calls that contend with coarse fetch).
    if step >= STEP_COARSE:
        fill_elevation(pts, cache, cache_file, log)
    # archive todo = missing Jan normal OR coarse placeholder (upgrade to real ERA5)
    def _needs_archive(lng, lat):
        ent = cache["points"].get(_key(lng, lat), {})
        return ent.get("jan") is None or ent.get("src") in _COARSE_PLACEHOLDER_SRC

    todo = [(lng, lat) for (lng, lat) in pts if _needs_archive(lng, lat)]
    log(f"field @{step}°: {len(pts)} land grid points ({len(todo)} temp to fetch, "
        f"{len(pts) - len(todo)} cached)…")
    y0, y1 = YEARS
    done = 0
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        lats = ",".join(f"{lat:.2f}" for (lng, lat) in chunk)
        lngs = ",".join(f"{lng:.2f}" for (lng, lat) in chunk)
        url = "https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode({
            "latitude": lats, "longitude": lngs,
            "start_date": f"{y0}-01-01", "end_date": f"{y1}-12-31",
            "daily": "temperature_2m_mean,precipitation_sum", "timezone": "GMT"})
        try:
            j = json.loads(_get(url, log=log))
        except Exception as e:  # noqa: BLE001
            log(f"  ! batch @{i} failed: {repr(e)[:90]}")
            time.sleep(4)
            continue
        results = j if isinstance(j, list) else [j]
        for (lng, lat), res in zip(chunk, results):
            d = res.get("daily") or {}
            times = d.get("time") or []
            tm = d.get("temperature_2m_mean") or []
            pr = d.get("precipitation_sum") or []
            jan, jul, psum, pyears = [], [], 0.0, set()
            for k, t in enumerate(times):
                mo = int(t[5:7])
                if k < len(tm) and tm[k] is not None:
                    if mo == 1:
                        jan.append(tm[k])
                    elif mo == 7:
                        jul.append(tm[k])
                if k < len(pr) and pr[k] is not None:
                    psum += pr[k]
                    pyears.add(t[:4])
            nyr = max(1, len(pyears))
            ent = cache["points"].setdefault(_key(lng, lat), {"elev": None, "jan": None, "jul": None, "prcp": None})
            if res.get("elevation") is not None and ent.get("elev") is None:
                ent["elev"] = round(res.get("elevation"), 0)
            ent["jan"] = round(sum(jan) / len(jan), 1) if jan else None
            ent["jul"] = round(sum(jul) / len(jul), 1) if jul else None
            ent["prcp"] = round(psum / nyr, 0) if pyears else None
            if ent.get("src") in _COARSE_PLACEHOLDER_SRC:
                ent.pop("src", None)
        done += len(chunk)
        cache_file.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        log(f"  …{done}/{len(todo)} fetched (cached → {cache_file.relative_to(ROOT)})")
        time.sleep(max(1.5, float(os.environ.get("FIELD_FETCH_PACE", "1.5"))))
    filled = sum(1 for p in cache["points"].values() if p.get("jan") is not None)
    log(f"field @{step}° fetch done: {filled}/{len(pts)} points with climate")
    return cache


def fetch_all_fields(log, force=False, steps=None):
    steps = steps or RESOLUTIONS
    out = {}
    for step in steps:
        out[step] = fetch_field(log, step=step, force=force)
    return out


# ---------------------------------------------------------------------------
# Marching squares — extract isoline segments from a scalar grid
# ---------------------------------------------------------------------------
# Per case, which edge-pairs to connect. Edges: 0=bottom(p0-p1) 1=right(p1-p2)
# 2=top(p2-p3) 3=left(p3-p0). Corners p0=BL p1=BR p2=TR p3=TL.
_MS = {
    1: [(3, 0)], 2: [(0, 1)], 3: [(3, 1)], 4: [(1, 2)],
    5: [(3, 0), (1, 2)], 6: [(0, 2)], 7: [(3, 2)], 8: [(2, 3)],
    9: [(2, 0)], 10: [(0, 1), (2, 3)], 11: [(2, 1)], 12: [(1, 3)],
    13: [(1, 0)], 14: [(0, 3)],
}
_E2C = {0: (0, 1), 1: (1, 2), 2: (2, 3), 3: (3, 0)}  # edge → (cornerA, cornerB)


def _nice_levels(vmin, vmax, step):
    lo = math.ceil(vmin / step) * step
    out, v = [], lo
    while v < vmax:
        out.append(round(v, 3))
        v += step
    return out


def isolines(grid, rows, cols, lng_min, lat_min, step, levels):
    """grid[r][c] scalar or None (r north-positive). Returns {level: [seg,..]}."""
    def corner(r, c):
        return (round(lng_min + c * step, 4), round(lat_min + r * step, 4), grid[r][c])

    out = {}
    for t in levels:
        segs = []
        for r in range(rows - 1):
            for c in range(cols - 1):
                p = [corner(r, c), corner(r, c + 1), corner(r + 1, c + 1), corner(r + 1, c)]
                if any(v[2] is None for v in p):
                    continue
                idx = sum((1 << i) for i in range(4) if p[i][2] >= t)
                if idx in (0, 15):
                    continue
                def cross(ei):
                    a, b = _E2C[ei]
                    va, vb = p[a][2], p[b][2]
                    f = 0.5 if vb == va else (t - va) / (vb - va)
                    return [round(p[a][0] + (p[b][0] - p[a][0]) * f, 3),
                            round(p[a][1] + (p[b][1] - p[a][1]) * f, 3)]
                for (e1, e2) in _MS.get(idx, []):
                    segs.append([cross(e1), cross(e2)])
        if segs:
            out[str(t)] = segs
    return out


# ---------------------------------------------------------------------------
# Emit — assemble window.HOUSING_FIELD from the cache
# ---------------------------------------------------------------------------
FIELD_SPECS = {
    # key:        (cache field, label, unit, ramp, level-step)
    "janTemp": ("jan", "1月均温", "℃", "temp", 5),
    "julTemp": ("jul", "7月均温", "℃", "temp", 5),
    "elevation": ("elev", "海拔", "m", "terrain", 500),
    "annualPrecip": ("prcp", "年降水", "mm", "precip", 200),
}


def emit_field(log=lambda *_: None, step: float = STEP_COARSE, *, isolines_ok: bool | None = None):
    _migrate_legacy_cache()
    cache_file = cache_path(step)
    if not cache_file.exists():
        return None
    cache = json.loads(cache_file.read_text(encoding="utf-8"))
    lng_min, lat_min, lng_max, lat_max = cache["bbox"]
    step = cache["step"]
    rows, cols = cache["rows"], cache["cols"]
    pts = cache["points"]
    if isolines_ok is None:
        isolines_ok = step >= STEP_COARSE

    def gridof(field):
        g = [[None] * cols for _ in range(rows)]
        for r in range(rows):
            lat = lat_min + r * step
            for c in range(cols):
                lng = lng_min + c * step
                v = pts.get(f"{lng:.2f},{lat:.2f}")
                if v and v.get(field) is not None:
                    g[r][c] = v[field]
        return g

    fields = {}
    for key, (cf, label, unit, ramp, lstep) in FIELD_SPECS.items():
        g = gridof(cf)
        vals = [g[r][c] for r in range(rows) for c in range(cols) if g[r][c] is not None]
        if not vals:
            continue
        vmin, vmax = min(vals), max(vals)
        # heatmap points: [lng, lat, value] (land only)
        hp = []
        for r in range(rows):
            lat = round(lat_min + r * step, 3)
            for c in range(cols):
                if g[r][c] is not None:
                    hp.append([round(lng_min + c * step, 3), lat, g[r][c]])
        lv = _nice_levels(vmin, vmax, lstep)
        iso = isolines(g, rows, cols, lng_min, lat_min, step, lv) if isolines_ok else {}
        fields[key] = {"label": label, "unit": unit, "ramp": ramp,
                       "min": vmin, "max": vmax, "levels": lv,
                       "points": hp, "isolines": iso}
        nseg = sum(len(s) for s in iso.values())
        log(f"  field @{step}° {key}: {len(hp)} pts, {len(lv)} levels, {nseg} segs")
    out = {"bbox": cache["bbox"], "step": step, "years": cache.get("years", list(YEARS)),
           "corridor_pad": cache.get("corridor_pad"), "fields": fields}
    meta = cache.get("meta") or {}
    fill = {}
    if meta.get("coarse_interp_count"):
        fill["coarse_interp"] = meta["coarse_interp_count"]
    if meta.get("coarse_nearest_count"):
        fill["1deg_nearest"] = meta["coarse_nearest_count"]
    if fill:
        out["coarse_fill"] = fill
        if meta.get("coarse_fill_note"):
            out["coarse_fill_note"] = meta["coarse_fill_note"]
    return out


def cache_coverage(step: float) -> tuple[int, int]:
    """Return (filled, total) climate cells for a resolution."""
    _migrate_legacy_cache()
    cache_file = cache_path(step)
    corridor = LISTING_CORRIDOR_PAD if step == STEP_FINE else None
    pts, _, _ = land_grid(step, corridor_pad=corridor)
    if not cache_file.exists():
        return 0, len(pts)
    cache = json.loads(cache_file.read_text(encoding="utf-8"))
    filled = sum(1 for (lng, lat) in pts
                 if cache["points"].get(_key(lng, lat), {}).get("jan") is not None)
    return filled, len(pts)
