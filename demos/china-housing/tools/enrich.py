#!/usr/bin/env python3
"""
china-housing enrichment — build-time data baking (free / no-key sources).

Everything here runs at BUILD time on a developer machine, writes results into
data/housing.db, and `manage.py build` then emits the baked results as a static
JS global (window.HOUSING_ENRICHED). The web page therefore makes NO runtime
geocoding / POI / climate request — only on-demand *map tiles* stream when a
user opens a vicinity modal. Consistent with the listings.js / china-geo.js
"bake → static → offline" approach.

Sources (all free, no API key, all WGS-84 so no GCJ-02 conversion needed):
  geocode  Nominatim (OSM)            — coarse-to-fine ladder; small-town 小区
                                         names usually miss, so we fall back to
                                         town/district/city and record the level.
  climate  Open-Meteo Archive (ERA5)  — 2014-2023 daily → monthly normals.
  poi      Overpass (OSM)             — nearest metro / railway / hospital / mall.
  airport  OurAirports CSV (offline)  — nearest CN large/medium airport.
  coast    Natural Earth 50m (offline)— distance to nearest coastline vertex.
  risk     derived                    — coast distance + coarse province seismic
                                         band (GB18306 concept) + typhoon exposure.

Politeness: Nominatim is capped at 1 req/s with a real User-Agent (its usage
policy); Overpass is flaky (504s) so requests retry across mirrors with backoff.
Every stage is RESUMABLE — re-running only fetches rows still missing data.

Standard library only. Functions take an open sqlite3 connection + a log(msg)
callable; manage.py owns the connection and the CLI.
"""
from __future__ import annotations

import json
import math
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "data" / "ref"
UA = "qrost-china-housing/1.0 (+https://qrost.github.io; contact czd358121692@gmail.com)"
_SSL = ssl.create_default_context()

POI_CATEGORIES = ["metro", "train", "airport", "hospital", "mall", "coast"]

# Per-category sanity cap (km). The wide railway-station query (90km, for trains)
# also returns subway-tagged stations that classify as "metro" — a station 90km
# away is a DIFFERENT city's line, not the listing's metro. Cap metro hard; keep
# train/airport uncapped (they are legitimately regional).
_CAT_MAX_KM = {"metro": 12.0, "mall": 30.0, "hospital": 30.0}


# ---------------------------------------------------------------------------
# HTTP helpers (retry + backoff)
# ---------------------------------------------------------------------------
def _get(url, timeout=30, retries=3, backoff=2.0):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(backoff * (i + 1))
    raise last


def _post(url, data, timeout=90, retries=2, backoff=3.0):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(
                url, data=data.encode(),
                headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"})
            with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(backoff * (i + 1))
    raise last


def haversine(lat1, lng1, lat2, lng2):
    """Great-circle distance in km."""
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------
# Schema migration (idempotent)
# ---------------------------------------------------------------------------
def migrate(con):
    cols = {r[1] for r in con.execute("PRAGMA table_info(listings)")}
    for col, decl in (("lat", "REAL"), ("lng", "REAL"),
                      ("geo_level", "TEXT"), ("geo_label", "TEXT"),
                      ("geo_source", "TEXT"),       # 'nominatim' | 'research'
                      ("elevation", "REAL"),        # metres above sea level (Open-Meteo)
                      ("daily_climate", "TEXT"),    # JSON: 365-day curve + comfort/extreme day-ranges
                      ("built_year", "INTEGER"),    # 小区 construction/completion year (web research)
                      ("built_year_src", "TEXT"),   # provenance: source URL / quoted 建成年代 text
                      ("built_year_approx", "INTEGER"),  # 1 = cited decade-level estimate, shown as 约
                      ("terrain_relief", "REAL"),   # local DEM relief (m, max−min over ~3km ring) — 地质灾害 proxy
                      ("hazards_local", "TEXT")):   # per-listing hazard array JSON (prefecture types × physical freq)
        if col not in cols:
            con.execute(f"ALTER TABLE listings ADD COLUMN {col} {decl}")
    con.executescript("""
      CREATE TABLE IF NOT EXISTS climate (
        listing_id INTEGER, month INTEGER,
        tmean REAL, tmax REAL, tmin REAL, precip REAL,
        PRIMARY KEY (listing_id, month)
      );
      CREATE TABLE IF NOT EXISTS poi (
        listing_id INTEGER, category TEXT,
        name TEXT, lat REAL, lng REAL, dist_km REAL,
        PRIMARY KEY (listing_id, category)
      );
      CREATE TABLE IF NOT EXISTS poi_done (listing_id INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS risk (
        listing_id INTEGER PRIMARY KEY,
        coast_km REAL, seismic_band TEXT, typhoon TEXT, summary TEXT
      );
    """)
    poicols = {r[1] for r in con.execute("PRAGMA table_info(poi)")}
    if "source" not in poicols:  # 'osm' | 'research'
        con.execute("ALTER TABLE poi ADD COLUMN source TEXT")
    con.commit()


# ---------------------------------------------------------------------------
# Geocoding — Nominatim coarse-to-fine ladder
# ---------------------------------------------------------------------------
def _geo_ladder(prov, city, dist, loc):
    """Yield (query, level) from most-specific to coarsest."""
    import re
    parts = [p for p in re.split(r"[-\s]+", city or "") if p]
    locality = parts[-1] if parts else (city or "")
    prefecture = parts[0] if parts else (city or "")

    def q(*xs):
        seen = [x for x in xs if x]
        return ", ".join(seen + ["中国"])

    out, used = [], set()
    def add(query, level):
        if query not in used:
            used.add(query)
            out.append((query, level))
    if loc:
        add(q(loc, dist, locality, prov), "loc")
        add(q(loc, locality, prov), "loc")
    if dist:
        add(q(dist, locality, prov), "dist")
    add(q(locality, prov), "city")
    if prefecture != locality:
        add(q(prefecture, prov), "prefecture")
    return out


_GEO_LABELS = {"loc": "小区级", "dist": "街道/镇级", "city": "城市级", "prefecture": "地级市近似"}


def _prov_ok(prov, hit):
    """Reject cross-province false positives (Nominatim free-text latches onto
    nationally-reused names like 恒大/碧桂园 and ignores the trailing province)."""
    if not prov:
        return True
    disp = hit.get("display_name", "")
    addr = hit.get("address", {})
    state = addr.get("state", "") or addr.get("region", "") or addr.get("province", "")
    return prov in disp or prov in state


def geocode_one(prov, city, dist, loc):
    """Return (lat, lng, level, label) or None. Caller rate-limits.

    For each ladder rung we take the top-5 candidates and keep the first one
    whose address actually lies in the expected province; otherwise we fall to
    the next (coarser) rung. This trades precision for not-wildly-wrong."""
    for query, level in _geo_ladder(prov, city, dist, loc):
        url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
            {"q": query, "format": "jsonv2", "limit": 5,
             "countrycodes": "cn", "addressdetails": 1, "accept-language": "zh"})
        try:
            j = json.loads(_get(url, timeout=25, retries=2))
        except Exception:  # noqa: BLE001
            time.sleep(1.1)
            continue
        for hit in j:
            if _prov_ok(prov, hit):
                return float(hit["lat"]), float(hit["lon"]), level, _GEO_LABELS[level]
        time.sleep(1.1)  # polite between ladder rungs
    return None


def geocode_all(con, log, force=False):
    where = "" if force else "WHERE lat IS NULL"
    rows = con.execute(
        f"SELECT id, prov, city, dist, loc FROM listings {where} ORDER BY id").fetchall()
    log(f"geocode: {len(rows)} listing(s) to do (Nominatim, ~1/s)…")
    done = miss = 0
    for r in rows:
        res = geocode_one(r["prov"], r["city"], r["dist"], r["loc"])
        if res:
            lat, lng, level, label = res
            con.execute("UPDATE listings SET lat=?, lng=?, geo_level=?, geo_label=? WHERE id=?",
                        (round(lat, 5), round(lng, 5), level, label, r["id"]))
            done += 1
            if done % 10 == 0:
                con.commit()
                log(f"  …{done} geocoded (last: {r['city']}{r['loc']} → {label})")
        else:
            miss += 1
            log(f"  ! id{r['id']} {r['prov']}{r['city']}{r['loc']}: no match")
        time.sleep(1.1)
    con.commit()
    log(f"geocode done: {done} located, {miss} unresolved")


# ---------------------------------------------------------------------------
# Climate — Open-Meteo archive → monthly normals
# ---------------------------------------------------------------------------
def climate_one(lat, lng, y0=2014, y1=2023):
    url = "https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode({
        "latitude": lat, "longitude": lng,
        "start_date": f"{y0}-01-01", "end_date": f"{y1}-12-31",
        "daily": "temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "auto"})
    j = json.loads(_get(url, timeout=45, retries=3))
    d = j["daily"]
    times = d["time"]
    tmean, tmax, tmin, prcp = (d["temperature_2m_mean"], d["temperature_2m_max"],
                               d["temperature_2m_min"], d["precipitation_sum"])
    # accumulate per (year, month) then average across years
    acc = {}  # month -> {"tmean":[..daily], "tmax":[..], "tmin":[..], "psum": {year: sum}}
    for i, t in enumerate(times):
        ym = t[:7]
        m = int(t[5:7])
        y = int(t[:4])
        a = acc.setdefault(m, {"tmean": [], "tmax": [], "tmin": [], "psum": {}})
        if tmean[i] is not None:
            a["tmean"].append(tmean[i])
        if tmax[i] is not None:
            a["tmax"].append(tmax[i])
        if tmin[i] is not None:
            a["tmin"].append(tmin[i])
        if prcp[i] is not None:
            a["psum"][y] = a["psum"].get(y, 0.0) + prcp[i]
    out = []
    for m in range(1, 13):
        a = acc.get(m)
        if not a or not a["tmean"]:
            out.append((m, None, None, None, None))
            continue
        mean = sum(a["tmean"]) / len(a["tmean"])
        hi = sum(a["tmax"]) / len(a["tmax"]) if a["tmax"] else None
        lo = sum(a["tmin"]) / len(a["tmin"]) if a["tmin"] else None
        psum = (sum(a["psum"].values()) / len(a["psum"])) if a["psum"] else None
        out.append((m, round(mean, 1), round(hi, 1) if hi is not None else None,
                    round(lo, 1) if lo is not None else None,
                    round(psum, 1) if psum is not None else None))
    return out


def climate_all(con, log):
    rows = con.execute("""SELECT l.id, l.lat, l.lng FROM listings l
                          WHERE l.lat IS NOT NULL
                            AND NOT EXISTS (SELECT 1 FROM climate c WHERE c.listing_id=l.id)
                          ORDER BY l.id""").fetchall()
    log(f"climate: {len(rows)} listing(s) to do (Open-Meteo ERA5 2014-2023)…")
    done = 0
    for r in rows:
        try:
            months = climate_one(r["lat"], r["lng"])
        except Exception as e:  # noqa: BLE001
            log(f"  ! id{r['id']} climate failed: {repr(e)[:80]}")
            time.sleep(1.0)
            continue
        con.executemany(
            "INSERT OR REPLACE INTO climate (listing_id, month, tmean, tmax, tmin, precip) "
            "VALUES (?,?,?,?,?,?)",
            [(r["id"], m, tm, tx, tn, pr) for (m, tm, tx, tn, pr) in months])
        done += 1
        if done % 10 == 0:
            con.commit()
            log(f"  …{done} climate done")
        time.sleep(0.7)
    con.commit()
    log(f"climate done: {done} listing(s)")


# ---------------------------------------------------------------------------
# Daily climate — day-of-year (1-365) climatology, 15-day smoothed, with
# day-precise comfort / extreme periods. Reuses the same ERA5 daily fetch.
# ---------------------------------------------------------------------------
_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]  # fixed 365-day calendar


def _doy_365(month, day):
    """1-based day-of-year on a fixed non-leap calendar (shared with the front end)."""
    return sum(_DAYS_IN_MONTH[:month - 1]) + min(day, _DAYS_IN_MONTH[month - 1])


def _smooth_circular(arr, win=15):
    n, half = len(arr), win // 2
    out = [None] * n
    for i in range(n):
        s = c = 0.0
        for k in range(-half, half + 1):
            v = arr[(i + k) % n]
            if v is not None:
                s += v; c += 1
        out[i] = (s / c) if c else None
    return out


def _day_ranges(flags):
    """Cyclic contiguous runs of True → [[start, end], …] (1-based day-of-year;
    a run wrapping the year-end has start > end)."""
    n = len(flags)
    if not any(flags):
        return []
    if all(flags):
        return [[1, n]]
    start = next(i for i in range(n) if flags[i] and not flags[(i - 1) % n])
    runs, run0, last = [], None, None
    for k in range(n):
        i = (start + k) % n
        if flags[i]:
            run0 = i if run0 is None else run0
            last = i
        elif run0 is not None:
            runs.append([run0 + 1, last + 1]); run0 = None
    if run0 is not None:
        runs.append([run0 + 1, last + 1])
    return runs


def climate_daily_one(lat, lng, y0=2014, y1=2023):
    url = "https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode({
        "latitude": lat, "longitude": lng,
        "start_date": f"{y0}-01-01", "end_date": f"{y1}-12-31",
        "daily": "temperature_2m_mean,temperature_2m_max,temperature_2m_min",
        "timezone": "auto"})
    d = json.loads(_get(url, timeout=60, retries=3))["daily"]
    times = d["time"]
    series = {"tmean": d["temperature_2m_mean"], "tmax": d["temperature_2m_max"], "tmin": d["temperature_2m_min"]}
    acc = {k: [[] for _ in range(365)] for k in series}
    for i, t in enumerate(times):
        if t[5:10] == "02-29":       # drop the leap day
            continue
        doy = _doy_365(int(t[5:7]), int(t[8:10])) - 1
        for k, vals in series.items():
            if vals[i] is not None:
                acc[k][doy].append(vals[i])
    norm = {k: [(sum(v) / len(v) if v else None) for v in acc[k]] for k in acc}
    sm = {k: _smooth_circular(norm[k], 15) for k in norm}
    comfort = [(t is not None and 15 <= t <= 26) for t in sm["tmean"]]
    extreme = [((tm is not None and tm < 0) or (tx is not None and tx >= 33))
               for tm, tx in zip(sm["tmean"], sm["tmax"])]
    q = lambda a: [None if v is None else int(round(v)) for v in a]
    return {
        "curve": {"tmean": q(sm["tmean"]), "tmax": q(sm["tmax"]), "tmin": q(sm["tmin"])},
        "comfortDays": _day_ranges(comfort), "extremeDays": _day_ranges(extreme),
        "comfortDayCount": sum(comfort), "extremeDayCount": sum(extreme),
    }


def climate_daily_all(con, log):
    rows = con.execute("""SELECT id, lat, lng FROM listings
                          WHERE lat IS NOT NULL AND (daily_climate IS NULL OR daily_climate = '')
                          ORDER BY id""").fetchall()
    log(f"climate-daily: {len(rows)} listing(s) to do (ERA5 day-of-year, 15-day smoothed)…")
    done = 0
    for r in rows:
        try:
            dc = climate_daily_one(r["lat"], r["lng"])
        except Exception as e:  # noqa: BLE001
            log(f"  ! id{r['id']} daily failed: {repr(e)[:80]}")
            time.sleep(1.0)
            continue
        con.execute("UPDATE listings SET daily_climate=? WHERE id=?",
                    (json.dumps(dc, separators=(",", ":")), r["id"]))
        done += 1
        if done % 10 == 0:
            con.commit(); log(f"  …{done} daily done")
        time.sleep(0.7)
    con.commit()
    log(f"climate-daily done: {done} listing(s)")


# ---------------------------------------------------------------------------
# Elevation — Open-Meteo (Copernicus DEM ~90m), batched, no key
# ---------------------------------------------------------------------------
def elevation_all(con, log, force=False):
    """Bake metres-above-sea-level per geocoded listing. The endpoint accepts up
    to 100 comma-separated coordinates per call, so we batch (one request per
    chunk) — far cheaper than the per-row climate stage. Resumable."""
    where = "" if force else "AND elevation IS NULL"
    rows = con.execute(
        f"SELECT id, lat, lng FROM listings WHERE lat IS NOT NULL {where} ORDER BY id"
    ).fetchall()
    log(f"elevation: {len(rows)} listing(s) to do (Open-Meteo DEM, batched)…")
    done = 0
    for i in range(0, len(rows), 90):
        chunk = rows[i:i + 90]
        lats = ",".join(f'{r["lat"]:.5f}' for r in chunk)
        lngs = ",".join(f'{r["lng"]:.5f}' for r in chunk)
        url = "https://api.open-meteo.com/v1/elevation?" + urllib.parse.urlencode(
            {"latitude": lats, "longitude": lngs})
        try:
            j = json.loads(_get(url, timeout=45, retries=3))
            elevs = j.get("elevation") or []
        except Exception as e:  # noqa: BLE001
            log(f"  ! batch @{i} elevation failed: {repr(e)[:80]}")
            time.sleep(1.5)
            continue
        for r, e in zip(chunk, elevs):
            if e is not None:
                con.execute("UPDATE listings SET elevation=? WHERE id=?",
                            (round(float(e), 1), r["id"]))
                done += 1
        con.commit()
        log(f"  …{done} elevations baked")
        time.sleep(1.0)
    log(f"elevation done: {done} listing(s)")


def _ring_points(lat, lng, r_km=3.0, n=8):
    """n points on a ~r_km ring around (lat,lng), for local relief sampling."""
    dlat = r_km / 111.0
    dlng = r_km / (111.0 * max(0.2, math.cos(math.radians(lat))))
    return [(lat + dlat * math.cos(2 * math.pi * k / n),
             lng + dlng * math.sin(2 * math.pi * k / n)) for k in range(n)]


def relief_all(con, log, force=False):
    """Bake local terrain relief (max−min elevation over a ~3km ring + centre) per
    listing — a ruggedness proxy for 地质灾害 (landslide / debris-flow) susceptibility:
    steep mountains = high relief, flat plain = low. One DEM sample per ring point,
    all batched through Open-Meteo (90 coords/call). Resumable."""
    where = "" if force else "AND terrain_relief IS NULL"
    rows = con.execute(
        f"SELECT id, lat, lng FROM listings WHERE lat IS NOT NULL {where} ORDER BY id"
    ).fetchall()
    log(f"relief: {len(rows)} listing(s) (Open-Meteo DEM, ~3km ring sampling)…")
    plan, allpts = [], []   # plan = (id, offset, count); allpts = flat [(lat,lng), …]
    for r in rows:
        pts = [(r["lat"], r["lng"])] + _ring_points(r["lat"], r["lng"])
        plan.append((r["id"], len(allpts), len(pts)))
        allpts.extend(pts)
    elevs = [None] * len(allpts)
    for i in range(0, len(allpts), 90):
        chunk = allpts[i:i + 90]
        url = "https://api.open-meteo.com/v1/elevation?" + urllib.parse.urlencode({
            "latitude": ",".join(f"{p[0]:.5f}" for p in chunk),
            "longitude": ",".join(f"{p[1]:.5f}" for p in chunk)})
        try:
            ev = json.loads(_get(url, timeout=45, retries=3)).get("elevation") or []
        except Exception as e:  # noqa: BLE001
            log(f"  ! relief batch @{i} failed: {repr(e)[:80]}")
            time.sleep(1.5)
            continue
        for k, v in enumerate(ev):
            if i + k < len(elevs):
                elevs[i + k] = v
        time.sleep(1.0)
    done = 0
    for lid, off, cnt in plan:
        seg = [e for e in elevs[off:off + cnt] if e is not None]
        if len(seg) < 3:
            continue
        con.execute("UPDATE listings SET terrain_relief=? WHERE id=?",
                    (round(max(seg) - min(seg), 1), lid))
        done += 1
    con.commit()
    log(f"relief done: {done} listing(s)")


# ---------------------------------------------------------------------------
# Reference datasets (offline): airports + coastline
# ---------------------------------------------------------------------------
def _load_airports():
    return json.loads((REF / "airports_cn.json").read_text(encoding="utf-8"))


def _load_coast():
    return json.loads((REF / "coast_cn.json").read_text(encoding="utf-8"))


def nearest_airport(lat, lng, airports):
    best, bd = None, 1e18
    for a in airports:
        d = haversine(lat, lng, a["lat"], a["lng"])
        if d < bd:
            bd, best = d, a
    return best, bd


def coast_km(lat, lng, coast):
    bd = 1e18
    for clat, clng in coast:
        d = haversine(lat, lng, clat, clng)
        if d < bd:
            bd = d
    return bd


# ---------------------------------------------------------------------------
# POI — Overpass (metro / railway / hospital / mall) + offline airport/coast
# ---------------------------------------------------------------------------
_OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def _overpass(lat, lng):
    ql = (f"[out:json][timeout:60];("
          f'node["station"="subway"](around:9000,{lat},{lng});'
          f'node["railway"="station"]["subway"="yes"](around:9000,{lat},{lng});'
          f'node["railway"="station"](around:90000,{lat},{lng});'
          f'way["railway"="station"](around:90000,{lat},{lng});'
          f'node["amenity"="hospital"](around:12000,{lat},{lng});'
          f'way["amenity"="hospital"](around:12000,{lat},{lng});'
          f'node["shop"="mall"](around:12000,{lat},{lng});'
          f'way["shop"="mall"](around:12000,{lat},{lng});'
          f');out center tags;')
    for mirror in _OVERPASS:
        try:
            return json.loads(_post(mirror, "data=" + urllib.parse.quote(ql), retries=2))
        except Exception:  # noqa: BLE001
            time.sleep(2)
    return None


def _classify(el):
    t = el.get("tags", {})
    if t.get("station") == "subway" or t.get("subway") == "yes":
        return "metro"
    if t.get("railway") == "station":
        return "train"
    if t.get("amenity") == "hospital":
        return "hospital"
    if t.get("shop") == "mall":
        return "mall"
    return None


def pois_all(con, log):
    airports, coast = _load_airports(), _load_coast()
    rows = con.execute("""SELECT id, lat, lng FROM listings
                          WHERE lat IS NOT NULL
                            AND id NOT IN (SELECT listing_id FROM poi_done)
                          ORDER BY id""").fetchall()
    log(f"pois: {len(rows)} listing(s) to do (Overpass + offline airport/coast)…")
    done = 0
    for r in rows:
        lat, lng = r["lat"], r["lng"]
        found = {}
        # offline categories — always available
        ap, apd = nearest_airport(lat, lng, airports)
        if ap:
            found["airport"] = (f'{ap["name"]}' + (f' ({ap["iata"]})' if ap["iata"] else ""),
                                ap["lat"], ap["lng"], apd)
        ckm = coast_km(lat, lng, coast)
        found["coast"] = ("最近海岸线", None, None, ckm)
        # online categories — Overpass (best-effort)
        data = _overpass(lat, lng)
        if data is not None:
            nearest = {}
            for el in data.get("elements", []):
                cat = _classify(el)
                if not cat:
                    continue
                c = el.get("center") or {"lat": el.get("lat"), "lon": el.get("lon")}
                if c.get("lat") is None:
                    continue
                d = haversine(lat, lng, c["lat"], c["lon"])
                if d > _CAT_MAX_KM.get(cat, 1e9):
                    continue   # too far to be the listing's own metro/mall/hospital
                if cat not in nearest or d < nearest[cat][3]:
                    nm = el["tags"].get("name") or el["tags"].get("name:zh") or "(未命名)"
                    nearest[cat] = (nm, round(c["lat"], 5), round(c["lon"], 5), d)
            found.update(nearest)
        else:
            log(f"  ! id{r['id']} overpass unavailable (metro/train/hospital/mall skipped)")
        for cat, (nm, plat, plng, d) in found.items():
            con.execute(
                "INSERT OR REPLACE INTO poi (listing_id, category, name, lat, lng, dist_km) "
                "VALUES (?,?,?,?,?,?)",
                (r["id"], cat, nm, plat, plng, round(d, 1)))
        con.execute("INSERT OR REPLACE INTO poi_done (listing_id) VALUES (?)", (r["id"],))
        done += 1
        if done % 5 == 0:
            con.commit()
            log(f"  …{done} POI sets done")
        time.sleep(1.5)
    con.commit()
    log(f"pois done: {done} listing(s)")


# ---------------------------------------------------------------------------
# Risk — coarse, region-level (honest approximation)
# ---------------------------------------------------------------------------
# Province seismic band per the *concept* of GB18306 ground-motion zoning.
# COARSE province-level approximation only — NOT a point value, NOT engineering.
SEISMIC = {
    "云南": "高", "四川": "高", "甘肃": "高", "河北": "高",
    "辽宁": "较高", "山东": "较高", "福建": "较高", "海南": "较高",
    "吉林": "中", "黑龙江": "中", "河南": "中", "江苏": "中",
    "安徽": "中", "广东": "中", "广西": "中", "重庆": "中", "贵州": "中",
    "上海": "低",
}


def risk_all(con, log):
    coast = _load_coast()
    rows = con.execute("SELECT id, prov, lat, lng FROM listings WHERE lat IS NOT NULL ORDER BY id").fetchall()
    log(f"risk: computing for {len(rows)} located listing(s)…")
    for r in rows:
        ckm = round(coast_km(r["lat"], r["lng"], coast), 1)
        band = SEISMIC.get(r["prov"], "中")
        # typhoon exposure: southern + coastal heuristic
        if ckm < 60 and r["lat"] < 25:
            typh = "高"
        elif ckm < 120 and r["lat"] < 32:
            typh = "中"
        elif ckm < 200:
            typh = "弱"
        else:
            typh = "极低"
        jan = con.execute("SELECT tmean FROM climate WHERE listing_id=? AND month=1", (r["id"],)).fetchone()
        jul = con.execute("SELECT tmean FROM climate WHERE listing_id=? AND month=7", (r["id"],)).fetchone()
        bits = [f"距海岸约 {ckm:.0f}km" if ckm < 300 else "深处内陆",
                f"台风暴露 {typh}", f"地震动(省级近似) {band}"]
        if jan and jan[0] is not None:
            bits.append(f"1月均温 {jan[0]:.0f}℃")
        if jul and jul[0] is not None:
            bits.append(f"7月均温 {jul[0]:.0f}℃")
        con.execute(
            "INSERT OR REPLACE INTO risk (listing_id, coast_km, seismic_band, typhoon, summary) "
            "VALUES (?,?,?,?,?)",
            (r["id"], ckm, band, typh, " · ".join(bits)))
    con.commit()
    log("risk done")


# ---------------------------------------------------------------------------
# Province natural-hazard profile — curated, coarse, province-level.
#
# A qualitative digest of the disaster types each province is historically
# exposed to, compiled from public geography / climatology and 应急管理部 yearly
# 灾情 patterns. This is NOT a point hazard model and NOT engineering input.
#
# IMPORTANT: plain cold / 严寒 / 低温冻害 is NOT counted as a hazard here. Winter
# cold is climate, not disaster, and is already represented honestly by the
# livability metrics (1月均温 / 极端月 / 宜居指数) — listing it again as a
# "灾害" would double-penalize cold-but-otherwise-safe provinces (e.g. 黑龙江,
# which in fact has few earthquakes and no typhoons). Discrete cold-driven
# DISASTERS that damage infrastructure (暴雪雪灾 snow load, 凝冻 ice storm) are
# kept — those are events, not just "it's cold".
#
# `freq` is an explicit RECURRENCE-INTERVAL bucket (how often a disaster-scale
# event of this type tends to recur in the province), NOT a severity score:
#   5=几乎年年  4=数年一遇  3=约十年一遇  2=数十年一遇  1=百年级罕见
# A 几乎年年 typhoon and a 数十年一遇 great earthquake are very different beasts;
# severity lives in the `note`. Each hazard: (type, freq, note).
# ---------------------------------------------------------------------------
HAZARD_FREQ_LABEL = {5: "几乎年年", 4: "数年一遇", 3: "约十年一遇", 2: "数十年一遇", 1: "百年级罕见"}
HAZARD_FREQ_SHORT = {5: "年年", 4: "数年", 3: "十年", 2: "数十年", 1: "百年"}

PROVINCE_HAZARDS = {
    "黑龙江": {"headline": "夏汛+冬季暴雪为主；无台风、地震少",
              "hazards": [("暴雪雪灾", 4, "冬季强降雪致灾，数年一遇"), ("洪涝", 4, "松花江/嫩江流域夏季汛情(1998等)"),
                          ("干旱", 4, "西部春旱"), ("森林火灾", 3, "大兴安岭林区(1987特大火)")]},
    "吉林": {"headline": "夏汛、暴雪与西部干旱；地震少",
            "hazards": [("洪涝", 4, "第二松花江流域"), ("暴雪雪灾", 4, "冬季致灾性降雪"), ("干旱", 4, "西部")]},
    "辽宁": {"headline": "夏汛+北上台风外围，海城式中强震(数十年一遇)",
            "hazards": [("洪涝", 4, "辽河流域"), ("暴雪", 4, "冬季"), ("干旱", 4, "辽西"),
                        ("台风外围", 3, "沿海受北上台风影响"), ("地震", 2, "海城1975 M7.3")]},
    "北京": {"headline": "华北平原旱涝+冬季暴雪；地震风险低于唐山带",
            "hazards": [("洪涝内涝", 4, "海河流域+城区暴雨内涝"), ("干旱", 4, "春旱"),
                        ("暴雪", 4, "冬季强降雪"), ("地震", 2, "华北强震带外围，1976唐山距城较远")]},
    "河北": {"headline": "华北强震带(数十年一遇)+旱涝交替",
            "hazards": [("洪涝", 4, "海河流域(2023大水)"), ("干旱", 4, "春旱常见"),
                        ("暴雨", 3, "太行山前极端暴雨"), ("地震", 2, "唐山1976/邢台1966，华北强震带")]},
    "河南": {"headline": "暴雨洪涝突出，旱涝并存",
            "hazards": [("暴雨", 4, "夏季强对流"), ("干旱", 4, "黄淮春夏旱"),
                        ("洪涝", 3, "流域性洪涝；2021郑州为千年一遇极端"), ("地震", 1, "局部弱震")]},
    "山东": {"headline": "旱涝+北上台风影响沿海",
            "hazards": [("洪涝", 4, "黄淮/沂沭河"), ("干旱", 4, "春旱"),
                        ("台风", 3, "利奇马2019等北上台风"), ("风暴潮", 3, "沿海"),
                        ("地震", 1, "郯庐带，郯城1668历史大震")]},
    "安徽": {"headline": "江淮梅雨洪涝为最大风险",
            "hazards": [("暴雨", 5, "梅雨季强降水"), ("洪涝", 4, "江淮梅雨/2020巢湖"),
                        ("干旱", 4, "伏旱"), ("台风外围", 3, "东部")]},
    "上海": {"headline": "沿海台风+城市内涝；缓发地面沉降",
            "hazards": [("洪涝内涝", 4, "暴雨城市内涝"), ("台风", 4, "夏秋登陆/影响"),
                        ("风暴潮", 3, "河口沿海"), ("地面沉降", 2, "缓发·长期监测累积")]},
    "江苏": {"headline": "台风、洪涝，偶发强龙卷",
            "hazards": [("洪涝", 4, "淮河下游/太湖"), ("台风", 3, "沿海"),
                        ("风暴潮", 3, "沿海"), ("龙卷风", 2, "2016盐城EF4，强龙卷罕见")]},
    "广东": {"headline": "台风+流域性洪涝的双高暴露",
            "hazards": [("台风", 5, "登陆最频繁省份之一"), ("暴雨", 5, "前汛期强降水"),
                        ("洪涝", 4, "珠江/西江流域"), ("风暴潮", 4, "沿海")]},
    "广西": {"headline": "洪涝+台风+喀斯特地质灾害",
            "hazards": [("洪涝", 4, "西江/郁江流域"), ("台风", 4, "北部湾沿海"),
                        ("地质灾害", 4, "喀斯特山区滑坡/塌陷"), ("干旱", 4, "桂西季节性")]},
    "福建": {"headline": "台风高暴露+山区地质灾害",
            "hazards": [("台风", 5, "正面登陆频繁"), ("暴雨", 5, "台风暴雨"),
                        ("洪涝", 4, "闽江流域"), ("地质灾害", 4, "山区滑坡/崩塌")]},
    "重庆": {"headline": "高温伏旱+山地滑坡+江河洪涝",
            "hazards": [("高温干旱", 5, "夏季伏旱(2022极端)"), ("地质灾害", 4, "三峡库区滑坡/崩塌"),
                        ("洪涝", 4, "长江/嘉陵江"), ("地震", 2, "局部中小震")]},
    "贵州": {"headline": "喀斯特地质灾害突出，冬季凝冻为特色风险",
            "hazards": [("地质灾害", 4, "喀斯特滑坡/泥石流/塌陷"), ("洪涝", 4, "夏季暴雨"),
                        ("干旱", 4, "夏旱"), ("凝冻", 4, "冬季雨雪冰冻致灾(2008特大为数十年一遇)")]},
    "四川": {"headline": "高烈度地震(约十年一遇)+山地次生灾害",
            "hazards": [("地质灾害", 4, "泥石流/滑坡(震后高发)"), ("洪涝", 4, "盆地暴雨"),
                        ("干旱", 4, "盆地伏旱"), ("地震", 3, "汶川2008/芦山/泸定，龙门山带")]},
    "云南": {"headline": "多震带+干湿季地质灾害与季节性干旱",
            "hazards": [("地质灾害", 4, "雨季泥石流/滑坡"), ("干旱", 4, "冬春季节性"),
                        ("洪涝", 4, "雨季"), ("地震", 3, "多条活动断裂带，鲁甸2014等")]},
    "甘肃": {"headline": "强震+半干旱区旱灾与黄土滑坡",
            "hazards": [("干旱", 5, "半干旱气候，常年缺水"), ("地质灾害", 4, "黄土滑坡/泥石流"),
                        ("沙尘暴", 4, "河西走廊春季"), ("地震", 3, "陇南/积石山2023等")]},
    "海南": {"headline": "全国台风登陆最前沿",
            "hazards": [("台风", 5, "登陆最频繁"), ("高温", 5, "夏季湿热"),
                        ("洪涝", 4, "台风暴雨"), ("风暴潮", 4, "沿海")]},
}

# ---------------------------------------------------------------------------
# Central heating (集中供暖) — province-level, curated. Determined by the
# 秦岭–淮河 line: north of it gets municipal central heating; south of it does
# not. The honest livability signal is the southern split between 冬暖 (warm,
# no heating needed) and 湿冷 (cold-damp winters with NO central heating — the
# "夹心层" pain). 江苏/安徽 straddle the line (淮河以北部分有), tagged 过渡.
# Province-level approximation: a few cities within a province differ.
# ---------------------------------------------------------------------------
HEAT_HEATED, HEAT_PARTIAL, HEAT_WARM, HEAT_DAMP = "集中供暖", "部分供暖", "无·冬暖", "无·湿冷"
PROVINCE_HEATING = {
    "黑龙江": HEAT_HEATED, "吉林": HEAT_HEATED, "辽宁": HEAT_HEATED, "北京": HEAT_HEATED, "河北": HEAT_HEATED,
    "山东": HEAT_HEATED, "河南": HEAT_HEATED, "甘肃": HEAT_HEATED,
    "江苏": HEAT_PARTIAL, "安徽": HEAT_PARTIAL,
    "广东": HEAT_WARM, "广西": HEAT_WARM, "福建": HEAT_WARM, "海南": HEAT_WARM, "云南": HEAT_WARM,
    "上海": HEAT_DAMP, "重庆": HEAT_DAMP, "四川": HEAT_DAMP, "贵州": HEAT_DAMP,
}
HEATING_NOTE = {
    HEAT_HEATED: "秦岭-淮河线以北，市政集中供暖",
    HEAT_PARTIAL: "跨供暖线，淮河以北部分城市有集中供暖",
    HEAT_WARM: "供暖线以南，冬季温暖、基本无需供暖",
    HEAT_DAMP: "供暖线以南却冬季湿冷，且无集中供暖（取暖靠自备）",
}


def emit_hazards():
    """Province → {headline, heating, heatingNote, hazards:[{type,freq,freqLabel,
    freqShort,note}], top}. Pure curated data (no DB / no network). `top` is the
    most-frequent hazard type(s); `heating` is the 集中供暖 tier."""
    out = {}
    for prov, p in PROVINCE_HAZARDS.items():
        hs = [{"type": t, "freq": f, "freqLabel": HAZARD_FREQ_LABEL[f],
               "freqShort": HAZARD_FREQ_SHORT[f], "note": n}
              for (t, f, n) in p["hazards"]]
        hs.sort(key=lambda h: -h["freq"])
        topf = hs[0]["freq"] if hs else 0
        heating = PROVINCE_HEATING.get(prov, "—")
        out[prov] = {"headline": p["headline"], "hazards": hs,
                     "top": [h["type"] for h in hs if h["freq"] == topf],
                     "heating": heating, "heatingNote": HEATING_NOTE.get(heating, "")}
    return out


# ---------------------------------------------------------------------------
# Per-listing hazard synthesis — prefecture types (research) × physical frequency.
# Province profiles are too coarse (every 小区 in a province shares them). Combine
# the per-地级市 researched hazard TYPES with per-coords PHYSICAL exposure so the
# FREQUENCY of location-driven hazards varies within a province: 台风/风暴潮 by
# coastal distance (inland drops it), 地质灾害 by terrain relief (flat plain drops
# it) — EXCEPT 采煤沉陷-type subsidence, which is mining- not terrain-driven and
# happens on flat coal cities, so it is kept as researched. Climate/seismic hazards
# (干旱/暴雨/暴雪/地震/…) stay at their regional (researched/province) frequency.
# ---------------------------------------------------------------------------
_COASTAL_HAZ = {"台风", "台风外围", "风暴潮"}
_TERRAIN_HAZ = {"地质灾害", "滑坡", "泥石流", "崩塌", "山洪"}
_MINING_KW = ("沉陷", "塌陷", "采煤")   # mining subsidence — NOT terrain-driven (bare 矿 too broad: a mining CITY like 攀枝花 still has terrain landslides)


def _coastal_freq(typh, coast_km, htype):
    """Coastal-driven recurrence for 台风/风暴潮 from typhoon exposure + coast distance.
    int freq, or None to DROP (genuinely inland / not on the immediate coast)."""
    if htype == "风暴潮" and (coast_km is None or coast_km > 30):
        return None
    return {"高": 5, "中": 4, "弱": 3, "极低": None}.get(typh)


def _geohazard_freq(relief):
    """Terrain-driven recurrence for landslide/debris 地质灾害 from local relief.
    -1 = no relief data (keep researched freq); 0 = flat → drop."""
    if relief is None:
        return -1
    if relief >= 400:
        return 5
    if relief >= 250:
        return 4
    if relief >= 120:
        return 3
    if relief >= 60:
        return 2
    return 0


def synth_hazards(con, research_by_pref, log):
    """Fold per-prefecture hazard research + per-coords physics into a per-listing
    hazard array (listings.hazards_local JSON = {headline, hazards:[{type,freq,
    freqLabel,freqShort,note,source?}], top}). Falls back to the province profile
    where a prefecture has no research."""
    rows = con.execute("SELECT id, prov, city, terrain_relief FROM listings "
                       "WHERE lat IS NOT NULL ORDER BY id").fetchall()
    rep = {"listings": 0, "from_research": 0, "from_province": 0,
           "dropped_coastal": 0, "dropped_terrain": 0, "downscaled": 0}
    for r in rows:
        key = f"{r['prov']}|{r['city'].split('-')[0]}"
        rf = research_by_pref.get(key)
        if rf and rf.get("hazards"):
            base = [{"type": h.get("type"), "freq": h.get("freq"), "note": h.get("note") or "",
                     "source": h.get("source") or ""} for h in rf["hazards"] if h.get("type")]
            headline = rf.get("headline") or ""
            rep["from_research"] += 1
        else:
            p = PROVINCE_HAZARDS.get(r["prov"], {})
            base = [{"type": t, "freq": f, "note": n, "source": ""} for (t, f, n) in p.get("hazards", [])]
            headline = p.get("headline", "")
            rep["from_province"] += 1
        rk = con.execute("SELECT typhoon, coast_km FROM risk WHERE listing_id=?", (r["id"],)).fetchone()
        typh = rk["typhoon"] if rk else None
        ckm = rk["coast_km"] if rk else None
        out = []
        for h in base:
            t, f, note = h["type"], h.get("freq"), h.get("note") or ""
            if t in _COASTAL_HAZ:
                nf = _coastal_freq(typh, ckm, t)
                if nf is None:
                    rep["dropped_coastal"] += 1
                    continue
                if f is None or nf != f:
                    rep["downscaled"] += 1
                f = nf
            elif t in _TERRAIN_HAZ and not any(k in note for k in _MINING_KW):
                nf = _geohazard_freq(r["terrain_relief"])
                if nf == 0:
                    rep["dropped_terrain"] += 1
                    continue
                if nf != -1:
                    if f is None or nf != f:
                        rep["downscaled"] += 1
                    f = nf
            if f is None:
                f = 3   # researched freq missing → default 约十年
            f = max(1, min(5, int(f)))
            item = {"type": t, "freq": f, "freqLabel": HAZARD_FREQ_LABEL[f],
                    "freqShort": HAZARD_FREQ_SHORT[f], "note": note}
            if h.get("source"):
                item["source"] = h["source"]
            out.append(item)
        bytype = {}   # dedupe by type, keep the highest freq
        for it in out:
            if it["type"] not in bytype or it["freq"] > bytype[it["type"]]["freq"]:
                bytype[it["type"]] = it
        out = sorted(bytype.values(), key=lambda x: -x["freq"])
        topf = out[0]["freq"] if out else 0
        obj = {"headline": headline, "hazards": out,
               "top": [h["type"] for h in out if h["freq"] == topf]}
        con.execute("UPDATE listings SET hazards_local=? WHERE id=?",
                    (json.dumps(obj, ensure_ascii=False), r["id"]))
        rep["listings"] += 1
    con.commit()
    return rep


# ---------------------------------------------------------------------------
# Research merge — fold subagent findings (names/addresses) into the DB.
# Agents return *names* (verifiable, with sources); the precise geocoding +
# distance is done HERE deterministically via Nominatim, with province + radius
# validation, so we never bake an agent-asserted coordinate. Provenance is
# tracked (geo_source / poi.source = 'research'); large location moves are
# flagged for human review rather than trusted blindly.
# ---------------------------------------------------------------------------
def geocode_query(query, prov, limit=5):
    """Province-validated geocode of an arbitrary name/address. Caller rate-limits."""
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "jsonv2", "limit": limit,
         "countrycodes": "cn", "addressdetails": 1, "accept-language": "zh"})
    try:
        j = json.loads(_get(url, timeout=25, retries=2))
    except Exception:  # noqa: BLE001
        return None
    for hit in j:
        if _prov_ok(prov, hit):
            return float(hit["lat"]), float(hit["lon"]), hit.get("display_name", "")
    return None


def merge_research(con, findings, log, move_flag_km=25.0, poi_max_km=60.0):
    """Fold a list of per-listing finding dicts into the DB. Returns a report.

    finding = {id, refined_address?, hospital_name?, mall_name?, metro_name?,
               sources?, notes?}  (any field may be null/absent)."""
    report = {"refined": 0, "moves": [], "poi_filled": {"hospital": 0, "mall": 0, "metro": 0},
              "poi_name_only": 0, "rejected": [], "skipped": 0}
    for f in findings:
        lid = f.get("id")
        row = con.execute(
            "SELECT prov, loc, lat, lng, geo_level FROM listings WHERE id=?", (lid,)).fetchone()
        if not row:
            report["skipped"] += 1
            continue
        prov, anchor = row["prov"], [row["lat"], row["lng"]]
        # 1) refine an imprecise (city/dist-level) location from a verified address
        addr = f.get("refined_address")
        if addr and row["geo_level"] in ("city", "dist"):
            import re as _re
            cands = [addr]
            # Nominatim has no house numbers for most CN streets — retry without 门牌号
            simpler = _re.sub(r"\d+\s*号?", "", addr).strip(" ,，")
            if simpler and simpler != addr:
                cands.append(simpler)
            g = None
            for cand in cands:
                g = geocode_query(f"{cand}, {prov}", prov)
                time.sleep(1.1)
                if g:
                    break
            if g:
                mv = (haversine(anchor[0], anchor[1], g[0], g[1])
                      if anchor[0] is not None else None)
                con.execute("UPDATE listings SET lat=?, lng=?, geo_level='loc', "
                            "geo_label='调研细化', geo_source='research' WHERE id=?",
                            (round(g[0], 5), round(g[1], 5), lid))
                anchor = [g[0], g[1]]
                report["refined"] += 1
                if mv is not None and mv > move_flag_km:
                    report["moves"].append(
                        {"id": lid, "loc": row["loc"], "km": round(mv, 1), "to": g[2][:46]})
        # 2) fill genuinely-missing POIs by verified name (don't overwrite OSM hits)
        for cat, key in (("hospital", "hospital_name"), ("mall", "mall_name"), ("metro", "metro_name")):
            name = f.get(key)
            if not name:
                continue
            if con.execute("SELECT 1 FROM poi WHERE listing_id=? AND category=?", (lid, cat)).fetchone():
                continue
            g = geocode_query(f"{name}, {prov}", prov)
            time.sleep(1.1)
            if g:
                d = (haversine(anchor[0], anchor[1], g[0], g[1])
                     if anchor[0] is not None else None)
                if d is not None and d > poi_max_km:
                    report["rejected"].append({"id": lid, "cat": cat, "name": name, "km": round(d, 1)})
                    continue
                con.execute("INSERT OR REPLACE INTO poi (listing_id,category,name,lat,lng,dist_km,source) "
                            "VALUES (?,?,?,?,?,?,'research')",
                            (lid, cat, name, round(g[0], 5), round(g[1], 5), round(d, 1) if d else None))
                report["poi_filled"][cat] += 1
            else:
                # agent-verified name that Nominatim can't place → keep name-only (no pin)
                con.execute("INSERT OR REPLACE INTO poi (listing_id,category,name,lat,lng,dist_km,source) "
                            "VALUES (?,?,?,NULL,NULL,NULL,'research')", (lid, cat, name))
                report["poi_name_only"] += 1
    con.commit()
    return report


def merge_built_years(con, findings, log, lo=1900, hi=2026):
    """Fold 建成年代 (construction-year) research findings into listings.built_year.

    finding = {id, builtYear:int|null, source?, yearText?, confidence:'high'|'med'|
               'approx'|'low'|'none', note?}. Anti-hallucination gate — a year is
    stored ONLY if: confidence in {high, med, approx}, a non-empty source/quote is
    given, the year is in [lo, hi], and it is not after the listing's own update
    year (+1 slack for pre-sale). `approx` (a cited decade-level estimate, e.g. from
    an 老旧小区改造 list or 地方志) is stored with built_year_approx=1 and shown as
    约 on the front end. Precedence: an approx finding never overwrites a year that
    is already precise. Everything else stays NULL (shown as 年代未知)."""
    rep = {"set": 0, "approx": 0, "rejected": [], "skipped_no_year": 0,
           "missing_listing": 0, "kept_precise": 0}
    for f in findings:
        lid = f.get("id")
        row = con.execute("SELECT loc, updated, built_year, built_year_approx "
                          "FROM listings WHERE id=?", (lid,)).fetchone()
        if not row:
            rep["missing_listing"] += 1
            continue
        yr = f.get("builtYear", f.get("built_year"))
        conf = (f.get("confidence") or "").strip().lower()
        src = (f.get("source") or f.get("yearText") or f.get("note") or "").strip()
        if yr is None or conf not in ("high", "med", "approx"):
            rep["skipped_no_year"] += 1
            continue
        try:
            yr = int(yr)
        except (TypeError, ValueError):
            rep["rejected"].append({"id": lid, "why": "not-int", "val": yr})
            continue
        up = (row["updated"] or "")[:4]
        up_year = int(up) if up.isdigit() else hi
        if yr < lo or yr > hi:
            rep["rejected"].append({"id": lid, "loc": row["loc"], "why": "out-of-range", "yr": yr})
            continue
        if yr > up_year + 1:
            rep["rejected"].append({"id": lid, "loc": row["loc"], "why": "after-listing", "yr": yr, "listed": up_year})
            continue
        if not src:
            rep["rejected"].append({"id": lid, "loc": row["loc"], "why": "no-source", "yr": yr})
            continue
        approx = 1 if conf == "approx" else 0
        # never downgrade an already-precise year to an approx estimate
        if approx and row["built_year"] is not None and not row["built_year_approx"]:
            rep["kept_precise"] += 1
            continue
        con.execute("UPDATE listings SET built_year=?, built_year_src=?, built_year_approx=? WHERE id=?",
                    (yr, src[:300], approx, lid))
        rep["set"] += 1
        if approx:
            rep["approx"] += 1
    con.commit()
    return rep


def refresh_refined_pois(con, log):
    """A research location refine moves the anchor, so its previously-baked OSM
    POIs (computed vs the old coords) go stale. Recompute them against the new
    location: offline airport/coast always; Overpass metro/train/hospital/mall
    only where the existing row is NOT research-sourced (verified names stay)."""
    airports, coast = _load_airports(), _load_coast()
    rows = con.execute("SELECT id, lat, lng FROM listings "
                       "WHERE geo_source='research' AND lat IS NOT NULL ORDER BY id").fetchall()
    log(f"refresh: recomputing POIs for {len(rows)} research-refined listing(s)…")
    for r in rows:
        lat, lng = r["lat"], r["lng"]
        ap, apd = nearest_airport(lat, lng, airports)
        if ap:
            con.execute("INSERT OR REPLACE INTO poi (listing_id,category,name,lat,lng,dist_km,source) "
                        "VALUES (?,?,?,?,?,?,'osm')",
                        (r["id"], "airport", ap["name"] + (f' ({ap["iata"]})' if ap["iata"] else ""),
                         ap["lat"], ap["lng"], round(apd, 1)))
        con.execute("INSERT OR REPLACE INTO poi (listing_id,category,name,lat,lng,dist_km,source) "
                    "VALUES (?,?,?,NULL,NULL,?,'osm')",
                    (r["id"], "coast", "最近海岸线", round(coast_km(lat, lng, coast), 1)))
        data = _overpass(lat, lng)
        if data is not None:
            nearest = {}
            for el in data.get("elements", []):
                cat = _classify(el)
                if not cat:
                    continue
                ce = el.get("center") or {"lat": el.get("lat"), "lon": el.get("lon")}
                if ce.get("lat") is None:
                    continue
                d = haversine(lat, lng, ce["lat"], ce["lon"])
                if d > _CAT_MAX_KM.get(cat, 1e9):
                    continue   # too far to be the listing's own metro/mall/hospital
                if cat not in nearest or d < nearest[cat][3]:
                    nm = el["tags"].get("name") or el["tags"].get("name:zh") or "(未命名)"
                    nearest[cat] = (nm, round(ce["lat"], 5), round(ce["lon"], 5), d)
            for cat, (nm, plat, plng, d) in nearest.items():
                cur = con.execute("SELECT source FROM poi WHERE listing_id=? AND category=?",
                                  (r["id"], cat)).fetchone()
                if cur and cur[0] == "research":   # preserve verified research POI
                    continue
                con.execute("INSERT OR REPLACE INTO poi (listing_id,category,name,lat,lng,dist_km,source) "
                            "VALUES (?,?,?,?,?,?,'osm')", (r["id"], cat, nm, plat, plng, round(d, 1)))
        time.sleep(1.5)
    con.commit()
    log("refresh done")


# ---------------------------------------------------------------------------
# Emit — assemble the enriched JS global from the DB
# ---------------------------------------------------------------------------
def emit_enriched(con):
    """Return {id: {...}} dict of all baked enrichment for build to serialize."""
    out = {}
    for r in con.execute("SELECT id, lat, lng, geo_level, geo_label, geo_source, elevation, daily_climate, built_year, built_year_src, built_year_approx, hazards_local FROM listings WHERE lat IS NOT NULL"):
        e = {"lat": r["lat"], "lng": r["lng"],
             "geoLevel": r["geo_level"], "geoLabel": r["geo_label"],
             "geoSource": r["geo_source"] or "nominatim"}
        if r["elevation"] is not None:
            e["elevation"] = r["elevation"]
        if r["hazards_local"]:
            try:
                e["hazard"] = json.loads(r["hazards_local"])
            except Exception:  # noqa: BLE001
                pass
        if r["built_year"] is not None:
            e["builtYear"] = r["built_year"]
            if r["built_year_src"]:
                e["builtYearSrc"] = r["built_year_src"]
            if r["built_year_approx"]:
                e["builtYearApprox"] = True
        if r["daily_climate"]:
            try:
                e["daily"] = json.loads(r["daily_climate"])
            except Exception:  # noqa: BLE001
                pass
        out[r["id"]] = e
    for r in con.execute("SELECT listing_id, month, tmean, tmax, tmin, precip FROM climate ORDER BY listing_id, month"):
        e = out.get(r["listing_id"])
        if e is None:
            continue
        e.setdefault("climate", {})[r["month"]] = [r["tmean"], r["tmax"], r["tmin"], r["precip"]]
    for r in con.execute("SELECT listing_id, category, name, lat, lng, dist_km, source FROM poi"):
        e = out.get(r["listing_id"])
        if e is None:
            continue
        e.setdefault("pois", {})[r["category"]] = {
            "name": r["name"], "lat": r["lat"], "lng": r["lng"],
            "distKm": r["dist_km"], "source": r["source"] or "osm"}
    for r in con.execute("SELECT listing_id, coast_km, seismic_band, typhoon, summary FROM risk"):
        e = out.get(r["listing_id"])
        if e is None:
            continue
        e["risk"] = {"coastKm": r["coast_km"], "seismic": r["seismic_band"],
                     "typhoon": r["typhoon"], "summary": r["summary"]}
    return out
