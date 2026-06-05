#!/usr/bin/env python3
"""
china-housing gridded climate / elevation field — build-time bake.

Produces a CONTINUOUS field over China (not just the 121 listing points) so the
web map can show a true isotherm / rainfall / elevation basemap underneath the
listings. Two stages, deliberately split:

  fetch (network)   `manage.py field`  → samples a land-masked lat/lng grid via
                    Open-Meteo Historical Archive (ERA5). One batched pass yields
                    BOTH temperature normals AND the model elevation per point.
                    Resumable: results cached in data/ref/field_grid.json.

  emit  (offline)   `manage.py build`   → reads the cache, runs marching squares
                    to extract isolines, and writes assets/data/field.js
                    (window.HOUSING_FIELD). No network — deterministic.

The land mask is a stdlib ray-casting point-in-polygon test against the vendored
china-geo.js province boundaries (GCJ-02; the ~0.5km datum offset is sub-cell at
this grid resolution). Free / no-key / WGS-84-ish, consistent with enrich.py.
"""
from __future__ import annotations

import json
import math
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "data" / "ref"
GEO_JS = ROOT / "assets" / "data" / "china-geo.js"
CACHE = REF / "field_grid.json"
UA = "qrost-china-housing/1.0 (+https://qrost.github.io; contact czd358121692@gmail.com)"

# grid + sampling parameters
STEP = 1.0                 # degrees
LAT_MIN, LAT_MAX = 18.0, 54.0
LNG_MIN, LNG_MAX = 73.0, 135.5
YEARS = (2019, 2023)       # ERA5 normal window (kept short to stay within free quota)
BATCH = 80                 # coords per archive request


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


def land_grid():
    polys = _load_polys()
    cols = int(round((LNG_MAX - LNG_MIN) / STEP)) + 1
    rows = int(round((LAT_MAX - LAT_MIN) / STEP)) + 1
    pts = []
    for r in range(rows):
        lat = round(LAT_MIN + r * STEP, 4)
        for c in range(cols):
            lng = round(LNG_MIN + c * STEP, 4)
            if in_china(lng, lat, polys):
                pts.append((lng, lat))
    return pts, rows, cols


# ---------------------------------------------------------------------------
# Fetch — Open-Meteo archive (batched, resumable)
# ---------------------------------------------------------------------------
def _get(url, timeout=120, retries=4, backoff=3.0):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(backoff * (i + 1))
    raise last


def _key(lng, lat):
    return f"{lng:.2f},{lat:.2f}"


def fill_elevation(pts, cache, log):
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
            elevs = json.loads(_get(url, timeout=45)).get("elevation") or []
        except Exception as e:  # noqa: BLE001
            log(f"  ! elevation batch @{i} failed: {repr(e)[:80]}")
            time.sleep(2)
            continue
        for (lng, lat), e in zip(chunk, elevs):
            ent = cache["points"].setdefault(_key(lng, lat), {"elev": None, "jan": None, "jul": None, "prcp": None})
            if e is not None:
                ent["elev"] = round(float(e), 0)
        done += len(chunk)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        time.sleep(1.0)
    log(f"  elevation fill done: {done} point(s)")


def fetch_field(log, force=False):
    pts, rows, cols = land_grid()
    cache = {"step": STEP, "bbox": [LNG_MIN, LAT_MIN, LNG_MAX, LAT_MAX],
             "rows": rows, "cols": cols, "years": list(YEARS), "points": {}}
    if CACHE.exists() and not force:
        try:
            old = json.loads(CACHE.read_text(encoding="utf-8"))
            if old.get("step") == STEP and old.get("years") == list(YEARS):
                cache = old
                cache["rows"], cache["cols"] = rows, cols
        except Exception:  # noqa: BLE001
            pass
    # elevation first (separate quota, robust even when archive is throttled)
    fill_elevation(pts, cache, log)
    # archive (temperature/precip) todo = points still missing the Jan normal
    todo = [(lng, lat) for (lng, lat) in pts
            if cache["points"].get(_key(lng, lat), {}).get("jan") is None]
    log(f"field: {len(pts)} land grid points @ {STEP}° ({len(todo)} temp to fetch, "
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
            j = json.loads(_get(url))
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
            cache["points"][_key(lng, lat)] = {
                "elev": round(res.get("elevation"), 0) if res.get("elevation") is not None else None,
                "jan": round(sum(jan) / len(jan), 1) if jan else None,
                "jul": round(sum(jul) / len(jul), 1) if jul else None,
                "prcp": round(psum / nyr, 0) if pyears else None,
            }
        done += len(chunk)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        log(f"  …{done}/{len(todo)} fetched (cached → {CACHE.relative_to(ROOT)})")
        time.sleep(1.5)
    log(f"field fetch done: {len(cache['points'])} points cached")
    return cache


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


def emit_field(log=lambda *_: None):
    if not CACHE.exists():
        return None
    cache = json.loads(CACHE.read_text(encoding="utf-8"))
    lng_min, lat_min, lng_max, lat_max = cache["bbox"]
    step = cache["step"]
    rows, cols = cache["rows"], cache["cols"]
    pts = cache["points"]

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
        iso = isolines(g, rows, cols, lng_min, lat_min, step, lv)
        fields[key] = {"label": label, "unit": unit, "ramp": ramp,
                       "min": vmin, "max": vmax, "levels": lv,
                       "points": hp, "isolines": iso}
        log(f"  field {key}: {len(hp)} pts, {len(lv)} levels, "
            f"{sum(len(s) for s in iso.values())} segs")
    return {"bbox": cache["bbox"], "step": step, "fields": fields}
