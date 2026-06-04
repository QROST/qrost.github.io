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
                      ("geo_source", "TEXT"),   # 'nominatim' | 'research'
                      ("elevation", "REAL")):   # metres above sea level (Open-Meteo)
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
# 灾情 patterns. This is NOT a point hazard model and NOT engineering input:
# frequency is a coarse ordinal tag, scoped to the *province*, meant only to
# let users compare "what tends to go wrong here" side by side in the table.
#
# freq ordinal:  3=高频  2=常见  1=偶发  0=罕见
# Each hazard:  (type, freq, note).  `headline` is a one-line province summary.
# ---------------------------------------------------------------------------
HAZARD_FREQ_LABEL = {3: "高频", 2: "常见", 1: "偶发", 0: "罕见"}

PROVINCE_HAZARDS = {
    "黑龙江": {"headline": "夏汛+冬季暴雪/低温为主，地震少",
              "hazards": [("洪涝", 2, "松花江/嫩江流域夏季汛情"), ("暴雪雪灾", 2, "冬季严寒多雪"),
                          ("低温冻害", 2, "极端低温、冻土"), ("森林火灾", 1, "春秋大兴安岭林区"), ("干旱", 1, "西部春旱")]},
    "吉林": {"headline": "夏汛、暴雪与低温冻害",
            "hazards": [("洪涝", 2, "第二松花江流域"), ("暴雪雪灾", 2, "冬季"), ("低温冻害", 2, "东部山区"), ("干旱", 1, "西部")]},
    "辽宁": {"headline": "夏汛+北上台风外围，海城式中强震",
            "hazards": [("洪涝", 2, "辽河流域"), ("台风外围", 1, "沿海受北上台风影响"),
                        ("地震", 2, "海城1975 M7.3 等"), ("暴雪", 2, "冬季"), ("干旱", 1, "辽西")]},
    "河北": {"headline": "华北强震带+旱涝交替",
            "hazards": [("地震", 3, "唐山1976/邢台1966，华北强震带"), ("洪涝", 2, "海河流域"),
                        ("干旱", 2, "春旱常见"), ("暴雨", 1, "太行山前")]},
    "河南": {"headline": "暴雨洪涝突出，旱涝并存",
            "hazards": [("洪涝", 3, "2021郑州特大暴雨"), ("暴雨", 2, "夏季强对流"), ("干旱", 2, "黄淮春夏旱"), ("地震", 1, "局部")]},
    "山东": {"headline": "旱涝+北上台风影响沿海",
            "hazards": [("洪涝", 2, "黄淮/沂沭河"), ("台风", 1, "利奇马2019等北上台风"),
                        ("干旱", 2, "春旱"), ("风暴潮", 1, "沿海"), ("地震", 1, "郯庐带局部")]},
    "安徽": {"headline": "江淮梅雨洪涝为最大风险",
            "hazards": [("洪涝", 3, "江淮梅雨/2020巢湖"), ("干旱", 1, "伏旱"), ("台风外围", 1, "东部"), ("暴雨", 2, "梅雨季")]},
    "上海": {"headline": "沿海台风+内涝、缓发地面沉降",
            "hazards": [("台风", 2, "夏秋登陆/影响"), ("洪涝内涝", 2, "暴雨城市内涝"),
                        ("风暴潮", 1, "河口沿海"), ("地面沉降", 1, "缓发，长期监测")]},
    "江苏": {"headline": "台风、洪涝，偶发强龙卷",
            "hazards": [("洪涝", 2, "淮河下游/太湖"), ("台风", 1, "沿海"),
                        ("龙卷风", 1, "2016盐城EF4"), ("风暴潮", 1, "沿海")]},
    "广东": {"headline": "台风+流域性洪涝的双高暴露",
            "hazards": [("台风", 3, "登陆最频繁省份之一"), ("洪涝", 3, "珠江/西江流域"),
                        ("暴雨", 2, "前汛期强降水"), ("风暴潮", 2, "沿海")]},
    "广西": {"headline": "洪涝+台风+喀斯特地质灾害",
            "hazards": [("洪涝", 3, "西江/郁江流域"), ("台风", 2, "北部湾沿海"),
                        ("地质灾害", 2, "喀斯特山区滑坡/塌陷"), ("干旱", 1, "桂西季节性")]},
    "福建": {"headline": "台风高暴露+山区地质灾害",
            "hazards": [("台风", 3, "正面登陆频繁"), ("洪涝", 2, "闽江流域"),
                        ("地质灾害", 2, "山区滑坡/崩塌"), ("暴雨", 2, "台风暴雨")]},
    "重庆": {"headline": "山地滑坡+高温伏旱+江河洪涝",
            "hazards": [("地质灾害", 3, "三峡库区滑坡/崩塌"), ("洪涝", 2, "长江/嘉陵江"),
                        ("高温干旱", 2, "夏季伏旱"), ("地震", 1, "局部中小震")]},
    "贵州": {"headline": "喀斯特地质灾害+凝冻为特色风险",
            "hazards": [("地质灾害", 3, "喀斯特滑坡/泥石流/塌陷"), ("洪涝", 2, "夏季暴雨"),
                        ("凝冻", 2, "冬季低温雨雪冰冻"), ("干旱", 1, "夏旱")]},
    "四川": {"headline": "高烈度地震+山地次生灾害",
            "hazards": [("地震", 3, "汶川2008/芦山/泸定，龙门山带"), ("地质灾害", 3, "泥石流/滑坡(震后高发)"),
                        ("洪涝", 2, "盆地暴雨"), ("干旱", 1, "盆地伏旱")]},
    "云南": {"headline": "多震带+干湿季地质灾害与季节性干旱",
            "hazards": [("地震", 3, "多条活动断裂带"), ("地质灾害", 3, "雨季泥石流/滑坡"),
                        ("干旱", 2, "冬春季节性"), ("洪涝", 2, "雨季")]},
    "甘肃": {"headline": "强震+半干旱区旱灾与黄土滑坡",
            "hazards": [("地震", 3, "陇南/积石山2023等"), ("干旱", 3, "半干旱气候"),
                        ("地质灾害", 2, "黄土滑坡/泥石流"), ("沙尘暴", 1, "河西走廊")]},
    "海南": {"headline": "全国台风登陆最前沿",
            "hazards": [("台风", 3, "登陆最频繁"), ("洪涝", 2, "台风暴雨"),
                        ("风暴潮", 2, "沿海"), ("高温", 2, "夏季湿热")]},
}


def emit_hazards():
    """Province → {headline, hazards:[{type,freq,freqLabel,note}], top}.
    Pure curated data (no DB / no network). `top` is the highest-frequency hazard
    type(s), handy as a compact table tag."""
    out = {}
    for prov, p in PROVINCE_HAZARDS.items():
        hs = [{"type": t, "freq": f, "freqLabel": HAZARD_FREQ_LABEL[f], "note": n}
              for (t, f, n) in p["hazards"]]
        hs.sort(key=lambda h: -h["freq"])
        topf = hs[0]["freq"] if hs else 0
        out[prov] = {"headline": p["headline"], "hazards": hs,
                     "top": [h["type"] for h in hs if h["freq"] == topf]}
    return out


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
    for r in con.execute("SELECT id, lat, lng, geo_level, geo_label, geo_source, elevation FROM listings WHERE lat IS NOT NULL"):
        e = {"lat": r["lat"], "lng": r["lng"],
             "geoLevel": r["geo_level"], "geoLabel": r["geo_label"],
             "geoSource": r["geo_source"] or "nominatim"}
        if r["elevation"] is not None:
            e["elevation"] = r["elevation"]
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
