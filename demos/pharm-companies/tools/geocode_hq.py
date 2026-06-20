#!/usr/bin/env python3
"""Geocode roster-company HQ cities to lat/lng via a world-cities gazetteer, emitting
one HQ `site` per company into tmp/research/enrich-hq-sites.json. This puts every
roster company on the world map without per-company agent research.

Gazetteer: lutangar/cities.json ({name,lat,lng,country=ISO2}). Cached at /tmp/cities_gazetteer;
re-fetched if absent. Re-runnable: only emits HQ sites for companies that don't already have one.
"""
from __future__ import annotations
import json, re, sys, unicodedata, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
GAZ = Path("/tmp/cities_gazetteer")
GAZ_URL = "https://raw.githubusercontent.com/lutangar/cities.json/master/cities.json"
OUT = ROOT / "tmp" / "research" / "enrich-hq-sites.json"

ALIAS = {  # common hq_city -> gazetteer name normalizations
    "new york city": "new york", "south san francisco": "san francisco",
    "cambridge ma": "cambridge", "petach tikva": "petah tikva", "petach tikvah": "petah tikva",
    "bagsvaerd": "bagsvaerd", "bagsværd": "bagsvaerd",
    "new taipei": "taipei", "new taipei city": "taipei", "taipei county": "taipei",
    "hsinchu county": "hsinchu", "taichung county": "taichung", "kaohsiung county": "kaohsiung",
}
# China/Taiwan province- or region-level hq_city -> a representative capital city (approx for map)
PROV_CAPITAL = {
    "guangdong": "guangzhou", "jiangsu": "nanjing", "zhejiang": "hangzhou", "shandong": "jinan",
    "henan": "zhengzhou", "hebei": "shijiazhuang", "hubei": "wuhan", "hunan": "changsha",
    "anhui": "hefei", "sichuan": "chengdu", "fujian": "fuzhou", "jiangxi": "nanchang",
    "yunnan": "kunming", "shaanxi": "xian", "shanxi": "taiyuan", "liaoning": "shenyang",
    "jilin": "changchun", "heilongjiang": "harbin", "guizhou": "guiyang", "gansu": "lanzhou",
    "hainan": "haikou", "guangxi": "nanning", "inner mongolia": "hohhot", "xinjiang": "urumqi",
    "ningxia": "yinchuan", "qinghai": "xining", "tibet": "lhasa", "chongqing": "chongqing",
    "tianjin": "tianjin", "beijing": "beijing", "shanghai": "shanghai",
}

# Hardcoded coords for well-known HQ cities the gazetteer misses (final fallback).
CITY_COORD = {
    ("US", "new york"): (40.7128, -74.0060), ("DE", "bad homburg"): (50.2268, 8.6182),
    ("CH", "st gallen"): (47.4245, 9.3767), ("US", "south san francisco"): (37.6547, -122.4077),
    ("US", "thousand oaks"): (34.1706, -118.8376), ("GB", "abingdon"): (51.6743, -1.2826),
    ("DK", "hellerup"): (55.7327, 12.5719), ("US", "foster city"): (37.5585, -122.2711),
}

def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = s.lower().split(",")[0].split("(")[0]
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def ensure_gaz() -> None:
    if GAZ.exists() and GAZ.stat().st_size > 1_000_000:
        return
    print("fetching gazetteer ...")
    urllib.request.urlretrieve(GAZ_URL, GAZ)

def build_index() -> dict:
    rows = json.loads(GAZ.read_text(encoding="utf-8"))
    idx: dict[tuple, tuple] = {}
    for r in rows:
        cc = (r.get("country") or "").upper()
        nm = norm(r.get("name"))
        if not cc or not nm:
            continue
        key = (cc, nm)
        if key not in idx:  # first occurrence wins
            try:
                idx[key] = (round(float(r["lat"]), 4), round(float(r["lng"]), 4))
            except (KeyError, ValueError, TypeError):
                pass
    return idx

def main() -> int:
    ensure_gaz()
    idx = build_index()
    print(f"gazetteer index: {len(idx)} (country,city) keys")
    companies = json.loads((DATA / "companies.json").read_text())["companies"]

    # Skip companies that already have a RESEARCHED (non-geocoded) site; geocode everyone else
    # with an hq_city — covers roster companies AND deep companies added without their own sites
    # (e.g. the "notable" expansion wave). Re-runnable: this shard is rebuilt from scratch each run.
    has_real_site = set()
    for s in json.loads((DATA / "sites.json").read_text()).get("sites", []):
        srcs = s.get("sources") or []
        if not any("lutangar" in (src.get("url") or "") for src in srcs):
            has_real_site.add(s.get("company_id"))

    sites, hit, miss, misses = [], 0, 0, []
    for c in companies:
        if c["id"] in has_real_site:
            continue
        city = c.get("hq_city")
        cc = c.get("country", "").upper()
        if not city or not cc:
            continue
        n = norm(city)
        n = ALIAS.get(n, n)
        coord = idx.get((cc, n))
        if not coord:
            coord = idx.get((cc, n.replace(" city", "").strip()))
        if not coord and cc in ("CN", "TW") and n in PROV_CAPITAL:  # province/region -> capital
            coord = idx.get((cc, PROV_CAPITAL[n]))
        if not coord:
            coord = CITY_COORD.get((cc, n)) or CITY_COORD.get((cc, n.replace(" city", "").strip()))
        if not coord:
            miss += 1; misses.append(f"{c['id']}:{city}/{cc}"); continue
        lat, lng = coord
        nm_en = (c.get("name_en") or c["id"])
        nm_zh = (c.get("name_zh") or nm_en)
        sites.append({
            "id": f"{c['id']}-hq", "company_id": c["id"],
            "name_en": f"{nm_en} HQ", "name_zh": f"{nm_zh} 总部",
            "site_type": "HQ", "country": cc, "city": city,
            "lat": lat, "lng": lng, "is_subsidiary": False,
            "confidence": 0.6, "last_verified": "2026-06",
            "sources": [{"url": "https://github.com/lutangar/cities.json", "title": "world cities gazetteer (HQ city geocode)", "accessed": "2026-06"}],
        })
        hit += 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"sites": sites}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"geocoded HQ sites: {hit} hit, {miss} miss -> {OUT}")
    if misses:
        print("  sample misses:", ", ".join(misses[:25]))
    return 0

if __name__ == "__main__":
    sys.exit(main())
