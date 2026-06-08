#!/usr/bin/env python3
"""Bake per-listing historical temperature extrema (all-time high / low).

Resolution priority per (prov, city, dist) cluster — 区镇/街道级:
  1. zh.wikipedia Weather box for district/town name (区/镇/街道气候数据)
  2. Open-Meteo ERA5 reanalysis daily extrema 1940–2023 at cluster centroid
  3. zh.wikipedia parent-city template (市级回退，仅 ERA5 不可用时)

Station records are preferred when a Wikipedia climate template exists; ERA5
grid-cell extrema are a reproducible fallback (≈25 km cell at listing coords).

Writes listings.hist_temp_* + hist_temp_level columns + data/ref/hist_temp_cache.json.
"""
from __future__ import annotations

import json
import re
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from enrich import _get  # noqa: E402

DB = ROOT / "data" / "housing.db"
CACHE = ROOT / "data" / "ref" / "hist_temp_cache.json"
UA = "qrost-china-housing/1.0 (+https://qrost.github.io; contact czd358121692@gmail.com)"
ERA5_Y0, ERA5_Y1 = 1940, 2023

LEVEL_DIST = "区镇/街道"
LEVEL_COUNTY = "区县"
LEVEL_CITY = "市"


def _title_ladder(name: str) -> list[str]:
    """Candidate zh.wikipedia Template:…气候数据 page titles for a place name."""
    c = (name or "").strip()
    if not c:
        return []
    titles: list[str] = []
    seen: set[str] = set()

    def add(t: str) -> None:
        if t and t not in seen:
            seen.add(t)
            titles.append(t)

    if "-" in c:
        pref, sub = c.split("-", 1)
        add(f"Template:{sub}气候数据")
        add(f"Template:{sub}市气候数据")
        add(f"Template:{pref}气候数据")
        add(f"Template:{pref}市气候数据")
        sub_core = re.sub(r"(市|州|县|区)$", "", sub)
        pref_core = re.sub(r"(市|州|县|区)$", "", pref)
        add(f"Template:{sub_core}市气候数据")
        add(f"Template:{pref_core}市气候数据")
    add(f"Template:{c}气候数据")
    add(f"Template:{c}市气候数据")
    core = re.sub(r"(市|州|县|区|街道|镇|乡)$", "", c)
    add(f"Template:{core}市气候数据")
    add(f"Template:{core}气候数据")
    if c.endswith("街道"):
        add(f"Template:{core}区气候数据")
    if c.endswith("镇"):
        add(f"Template:{core}镇气候数据")
    return titles


def wiki_title_ladder(dist: str, city: str) -> list[tuple[str, str]]:
    """(title, expected_level) pairs — district names first, then city."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for title in _title_ladder(dist):
        if title not in seen:
            seen.add(title)
            lvl = LEVEL_COUNTY if re.search(r"(县|区)$", dist or "") else LEVEL_DIST
            out.append((title, lvl))
    for title in _title_ladder(city):
        if title not in seen:
            seen.add(title)
            out.append((title, LEVEL_CITY))
    return out


def _parse_weatherbox(wt: str) -> dict | None:
    hi = re.search(r"\|year record high C\s*=\s*([-\d.]+)", wt)
    lo = re.search(r"\|year record low C\s*=\s*([-\d.]+)", wt)
    if not hi or not lo:
        his = [float(x) for x in re.findall(
            r"\|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) record high C\s*=\s*([-\d.]+)", wt)]
        los = [float(x) for x in re.findall(
            r"\|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) record low C\s*=\s*([-\d.]+)", wt)]
        if not his or not los:
            return None
        tmax, tmin = max(his), min(los)
        src = "wikipedia-weatherbox-monthly"
    else:
        tmax, tmin = float(hi.group(1)), float(lo.group(1))
        src = "wikipedia-cma-weatherbox"
    loc = re.search(r"\|location\s*=\s*([^\n|]+)", wt)
    station = loc.group(1).strip() if loc else ""
    return {
        "histTempMax": round(tmax, 1),
        "histTempMin": round(tmin, 1),
        "histTempSrc": src,
        "histTempStation": station[:120] if station else None,
        "histTempNote": "维基百科气候数据模板（极端值多源自中国气象局国家站）",
    }


def fetch_wiki_extremes(dist: str, city: str, cache: dict, sleep: float = 0.35,
                        max_titles: int = 8, *, city_only: bool = False) -> dict | None:
    key = f"wiki-city:{city}" if city_only else f"wiki-dist:{dist}"
    if key in cache:
        return cache[key]
    if city_only:
        ladder = [(t, LEVEL_CITY) for t in _title_ladder(city)[:max_titles]]
    else:
        ladder = [(t, LEVEL_COUNTY if re.search(r"(县|区)$", dist or "") else LEVEL_DIST)
                  for t in _title_ladder(dist)[:max_titles]]
    for title, level in ladder:
        url = "https://zh.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
            "action": "parse", "page": title, "prop": "wikitext",
            "format": "json", "formatversion": "2",
        })
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                j = json.loads(r.read())
            if "parse" not in j:
                time.sleep(0.1)
                continue
            parsed = _parse_weatherbox(j["parse"]["wikitext"])
            if parsed:
                parsed["histTempWiki"] = title
                parsed["histTempLevel"] = level
                cache[key] = parsed
                return parsed
        except Exception as e:  # noqa: BLE001
            if "429" not in repr(e):
                print(f"  wiki ! {title}: {repr(e)[:60]}")
            time.sleep(1.5 if "429" in repr(e) else 0.1)
    cache[key] = None
    return None


def _nearest_era5_cache(lat: float, lng: float, cache: dict, max_delta: float = 0.25) -> dict | None:
    """Reuse a nearby ERA5 cell when API is rate-limited (≈25 km grid)."""
    best, best_d = None, max_delta
    for k, v in cache.items():
        if not k.startswith("era5:") or not v:
            continue
        try:
            clat, clng = map(float, k[5:].split(","))
        except ValueError:
            continue
        d = max(abs(clat - lat), abs(clng - lng))
        if d < best_d:
            best_d, best = d, dict(v)
    if best:
        best = dict(best)
        best["histTempNote"] = (best.get("histTempNote") or "") + "（邻近格点复用）"
    return best


def fetch_era5_extremes(lat: float, lng: float, cache: dict, sleep: float = 1.2) -> dict:
    key = f"era5:{lat:.2f},{lng:.2f}"
    if key in cache and cache[key]:
        return cache[key]
    near = _nearest_era5_cache(lat, lng, cache)
    if near:
        cache[key] = near
        return near
    url = "https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode({
        "latitude": lat, "longitude": lng,
        "start_date": f"{ERA5_Y0}-01-01", "end_date": f"{ERA5_Y1}-12-31",
        "daily": "temperature_2m_max,temperature_2m_min",
        "timezone": "auto",
    })
    last = None
    for attempt in range(8):
        try:
            j = json.loads(_get(url, timeout=180, retries=3, backoff=6.0))
            break
        except Exception as e:  # noqa: BLE001
            last = e
            wait = (12 * (attempt + 1)) if "429" in repr(e) else (3 * (attempt + 1))
            print(f"  era5 retry {attempt + 1}/8 ({lat:.2f},{lng:.2f}): {repr(e)[:80]} — sleep {wait}s")
            time.sleep(wait)
    else:
        # Persistent rate-limit / outage: reuse nearest baked ERA5 cell (≤1° ≈ 100 km)
        wide = _nearest_era5_cache(lat, lng, cache, max_delta=1.0)
        if wide:
            wide = dict(wide)
            wide["histTempNote"] = (wide.get("histTempNote") or "").replace("（邻近格点复用）", "")
            wide["histTempNote"] += "（API 限流，复用邻近格点 ERA5 极值）"
            cache[key] = wide
            return wide
        raise last
    d = j["daily"]
    tmax, tmin = d["temperature_2m_max"], d["temperature_2m_min"]
    imax = max(range(len(tmax)), key=lambda i: tmax[i] if tmax[i] is not None else -999)
    imin = min(range(len(tmin)), key=lambda i: tmin[i] if tmin[i] is not None else 999)
    out = {
        "histTempMax": round(tmax[imax], 1),
        "histTempMin": round(tmin[imin], 1),
        "histTempMaxDate": d["time"][imax],
        "histTempMinDate": d["time"][imin],
        "histTempSrc": f"open-meteo-era5-{ERA5_Y0}-{ERA5_Y1}",
        "histTempStation": None,
        "histTempNote": f"ERA5 再分析格点 {ERA5_Y0}–{ERA5_Y1} 日最高/日最低极值（≈25 km 网格，非气象站记录）",
    }
    cache[key] = out
    time.sleep(sleep)
    return out


def cluster_key(prov: str, city: str, dist: str) -> str:
    return f"{prov}|{city}|{dist}"


def load_cache() -> dict:
    if CACHE.exists():
        try:
            return json.loads(CACHE.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pass
    return {}


def save_cache(cache: dict) -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")


_PROXY_SRC = "climate-monthly-2014-2023"


def _is_proxy(entry: dict | None) -> bool:
    return bool(entry and entry.get("histTempSrc") == _PROXY_SRC)


def resolve_cluster(prov: str, city: str, dist: str, lat: float, lng: float, cache: dict,
                    skip_wiki: bool = False, *, allow_proxy_cache: bool = False) -> dict:
    ck = cluster_key(prov, city, dist)
    if ck in cache and cache[ck] and (allow_proxy_cache or not _is_proxy(cache[ck])):
        return cache[ck]
    if not skip_wiki and dist:
        wiki_dist = fetch_wiki_extremes(dist, city, cache, city_only=False)
        if wiki_dist:
            cache[ck] = wiki_dist
            return wiki_dist
    try:
        era5 = fetch_era5_extremes(lat, lng, cache)
        era5 = dict(era5)
        era5["histTempLevel"] = LEVEL_DIST if dist else LEVEL_CITY
        cache[ck] = era5
        return era5
    except Exception:
        pass
    if not skip_wiki:
        wiki_city = fetch_wiki_extremes(dist, city, cache, city_only=True)
        if wiki_city:
            cache[ck] = wiki_city
            return wiki_city
    raise RuntimeError("no hist-temp source available")


def apply_to_db(con: sqlite3.Connection, cache: dict, force: bool = False,
                skip_wiki: bool = False, upgrade_city: bool = False,
                upgrade_proxy: bool = False) -> dict:
    if force:
        where = ""
    elif upgrade_proxy:
        where = f"AND hist_temp_src = '{_PROXY_SRC}'"
    elif upgrade_city:
        where = "AND hist_temp_level = '市'"
    else:
        where = "AND (hist_temp_max IS NULL OR hist_temp_min IS NULL)"
    rows = con.execute(f"""
        SELECT id, prov, city, dist, lat, lng,
               hist_temp_max, hist_temp_min, hist_temp_src
        FROM listings
        WHERE lat IS NOT NULL {where}
        ORDER BY prov, city, dist, id
    """).fetchall()
    clusters: dict[str, list] = {}
    for r in rows:
        ck = cluster_key(r["prov"], r["city"], r["dist"] or "")
        clusters.setdefault(ck, []).append(r)

    rep = {"clusters": len(clusters), "listings": 0, "wiki": 0, "era5": 0,
           "level_dist": 0, "level_county": 0, "level_city": 0, "gaps": 0,
           "proxy_upgraded": 0, "jumps": []}
    for ck, members in sorted(clusters.items()):
        parts = ck.split("|", 2)
        prov, city = parts[0], parts[1]
        dist = parts[2] if len(parts) > 2 else ""
        lat = sum(m["lat"] for m in members) / len(members)
        lng = sum(m["lng"] for m in members) / len(members)
        old_max = members[0]["hist_temp_max"] if upgrade_proxy else None
        old_min = members[0]["hist_temp_min"] if upgrade_proxy else None
        if upgrade_city or upgrade_proxy or force:
            cache.pop(ck, None)
        try:
            data = resolve_cluster(prov, city, dist, lat, lng, cache, skip_wiki=skip_wiki)
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ {dist or city} ({prov}): {e}")
            rep["gaps"] += len(members)
            continue
        src = data.get("histTempSrc", "")
        if upgrade_proxy and src == _PROXY_SRC:
            print(f"  ✗ {dist or city} ({city}, {prov}): still proxy — no better source")
            rep["gaps"] += len(members)
            continue
        if upgrade_proxy:
            rep["proxy_upgraded"] += 1
            if old_max is not None and abs(data["histTempMax"] - old_max) > 8:
                rep["jumps"].append({"cluster": ck, "field": "max",
                                     "old": old_max, "new": data["histTempMax"], "src": src})
            if old_min is not None and abs(data["histTempMin"] - old_min) > 8:
                rep["jumps"].append({"cluster": ck, "field": "min",
                                     "old": old_min, "new": data["histTempMin"], "src": src})
        lvl = data.get("histTempLevel", LEVEL_DIST)
        if src.startswith("wikipedia"):
            rep["wiki"] += 1
        else:
            rep["era5"] += 1
        if lvl == LEVEL_DIST:
            rep["level_dist"] += 1
        elif lvl == LEVEL_COUNTY:
            rep["level_county"] += 1
        else:
            rep["level_city"] += 1
        for m in members:
            con.execute("""
                UPDATE listings SET
                  hist_temp_max=?, hist_temp_min=?,
                  hist_temp_max_date=?, hist_temp_min_date=?,
                  hist_temp_src=?, hist_temp_station=?, hist_temp_note=?,
                  hist_temp_level=?
                WHERE id=?
            """, (
                data.get("histTempMax"), data.get("histTempMin"),
                data.get("histTempMaxDate"), data.get("histTempMinDate"),
                data.get("histTempSrc"), data.get("histTempStation"), data.get("histTempNote"),
                lvl,
                m["id"],
            ))
            rep["listings"] += 1
        print(f"  ✓ {dist or city} ({city}, {prov}): {data['histTempMax']}℃ / {data['histTempMin']}℃ [{src}] ({lvl})")
        con.commit()
        save_cache(cache)
    con.commit()
    save_cache(cache)
    return rep


def main() -> None:
    import argparse
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--force", action="store_true", help="re-fetch even if DB columns populated")
    p.add_argument("--skip-wiki", action="store_true", help="ERA5 only (faster batch bake)")
    p.add_argument("--upgrade-city", action="store_true",
                   help="re-bake rows still at 市 with district-first logic")
    p.add_argument("--upgrade-proxy", action="store_true",
                   help="re-bake climate-monthly-2014-2023 proxy rows via wiki/ERA5")
    args = p.parse_args()
    cache = load_cache()
    con = sqlite3.connect(DB, timeout=120)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    cols = {r[1] for r in con.execute("PRAGMA table_info(listings)")}
    for col, decl in (
        ("hist_temp_max", "REAL"), ("hist_temp_min", "REAL"),
        ("hist_temp_max_date", "TEXT"), ("hist_temp_min_date", "TEXT"),
        ("hist_temp_src", "TEXT"), ("hist_temp_station", "TEXT"),
        ("hist_temp_note", "TEXT"), ("hist_temp_level", "TEXT"),
    ):
        if col not in cols:
            con.execute(f"ALTER TABLE listings ADD COLUMN {col} {decl}")
    con.commit()
    n = len(con.execute(
        "SELECT DISTINCT prov,city,dist FROM listings WHERE lat IS NOT NULL").fetchall())
    print(f"hist-temp: {n} district/town cluster(s)…")
    rep = apply_to_db(con, cache, force=args.force, skip_wiki=args.skip_wiki,
                      upgrade_city=args.upgrade_city, upgrade_proxy=args.upgrade_proxy)
    print("=== hist-temp report ===")
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    print("→ run `python3 tools/manage.py build` to regenerate enriched.js")


if __name__ == "__main__":
    main()
