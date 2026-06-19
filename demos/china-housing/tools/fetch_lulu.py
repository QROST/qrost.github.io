#!/usr/bin/env python3
"""Build national reference point sets for LULU (locally-unwanted land uses) —
the "不利于居住" facilities whose *distance* feeds the housing demo's
farther-is-better preference. Stdlib-only (matches the project's zero-dep ethos).

Source = OpenStreetMap via Overpass (free, no-key, WGS-84). One query per
category over the China area; ways/relations collapse to their centroid via
`out center`. Output: data/ref/lulu_<cat>_cn.json — a flat list of
{name, lat, lng} (+ optional kv) consumed offline by enrich.lulu_all().

Overpass is flaky (504/429/timeout) → multi-mirror retry with backoff. Run
per-category so a single failure is obvious and resumable (existing files are
skipped unless --force).

Usage:
    python3 tools/fetch_lulu.py                 # all categories, skip existing
    python3 tools/fetch_lulu.py --only nuclear substation
    python3 tools/fetch_lulu.py --force         # re-fetch everything
"""
from __future__ import annotations

import argparse
import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "data" / "ref"
UA = "qrost-china-housing/1.0 (+https://qrost.github.io; contact czd358121692@gmail.com)"
_SSL = ssl.create_default_context()

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Per-category Overpass body. `area.cn` is bound once in _build_query(). Each
# category yields a union of node/way/relation matches; `out center tags;`
# returns one point per element. Tags are kept so we can label + post-filter.
CATEGORIES = {
    # 污水处理厂
    "wastewater": [
        'nwr["man_made"="wastewater_plant"](area.cn);',
        'nwr["industrial"="wastewater_treatment"](area.cn);',
    ],
    # 垃圾填埋场
    "landfill": [
        'nwr["landuse"="landfill"](area.cn);',
        'nwr["amenity"="waste_disposal"](area.cn);',
        'nwr["amenity"="waste_transfer_station"](area.cn);',
    ],
    # 垃圾焚烧厂 (waste-to-energy / municipal incinerator)
    "incinerator": [
        'nwr["man_made"="incinerator"](area.cn);',
        'nwr["plant:source"="waste"](area.cn);',
        'nwr["generator:source"="waste"](area.cn);',
        'nwr["amenity"="waste_incineration"](area.cn);',
        'nwr["plant:method"="combustion"]["plant:source"="waste"](area.cn);',
    ],
    # 核电站
    "nuclear": [
        'nwr["plant:source"="nuclear"](area.cn);',
        'nwr["generator:source"="nuclear"](area.cn);',
    ],
    # 大型变电站 — fetch all substations carrying a voltage tag; the ≥220kV
    # filter happens client-side in _keep_substation (voltage strings are messy:
    # "500000;220000", "220 kV", etc.).
    "substation": ['nwr["power"="substation"]["voltage"](area.cn);'],
    # 化工园区 / 危化 — chemical industry. Coverage in CN is partial; combine an
    # explicit industrial=chemical tag with name-matched industrial parks.
    "chemical": [
        'nwr["industrial"="chemical"](area.cn);',
        'nwr["industrial"="petrochemical"](area.cn);',
        'nwr["industrial"="oil"](area.cn);',
        'nwr["man_made"="works"]["product"~"chemical|petrochemical|油|化"](area.cn);',
        'nwr["man_made"="works"]["product"~"化工|石化|化学"](area.cn);',
        'nwr["landuse"="industrial"]["name"~"化工|石化|化学|危化|炼化"](area.cn);',
    ],
    # 敏感地点 (军事) — OSM-public military areas only. CN coverage is
    # deliberately sparse; we ship what OSM has and flag the gap downstream.
    "sensitive": [
        'nwr["landuse"="military"](area.cn);',
        'nwr["military"](area.cn);',
    ],
}

MIN_VOLTAGE_V = 220_000  # "大型变电站" threshold
# Mainland-China bbox sanity gate — drop any OSM point outside it (mis-tagged /
# wrong-hemisphere nodes occasionally slip through area queries). Generous to keep
# Xinjiang/Tibet/Hainan/island coverage.
BBOX = {"lat_min": 17.0, "lat_max": 54.5, "lng_min": 72.0, "lng_max": 135.5}


def _in_china(lat: float, lng: float) -> bool:
    return (BBOX["lat_min"] <= lat <= BBOX["lat_max"]
            and BBOX["lng_min"] <= lng <= BBOX["lng_max"])


def _build_query(body_lines: list[str]) -> str:
    inner = "\n  ".join(body_lines)
    return (
        '[out:json][timeout:200];\n'
        # CN + HK + TW: Hong Kong & Taiwan facilities carry ISO3166-1 HK / TW and
        # are absent from a CN-only area, so include them explicitly — their
        # listings need their OWN local 不利设施, not a cross-border proxy.
        'area["ISO3166-1"~"^(CN|HK|TW)$"]->.cn;\n'
        '(\n  ' + inner + '\n);\n'
        'out center tags;'
    )


def _build_query_around(body_lines: list[str], lat: float, lng: float, radius_m: int) -> str:
    """Like _build_query but a local radius (no area) — for per-listing search
    where we don't keep a national ref set (e.g. California)."""
    inner = "\n  ".join(ln.replace("(area.cn)", f"(around:{radius_m},{lat},{lng})") for ln in body_lines)
    return '[out:json][timeout:120];\n(\n  ' + inner + '\n);\nout center tags;'


# Per-category radius (m) for the per-listing local search: dense nuisances need
# only a near ring; sparse-but-want-far classes (nuclear/sensitive) need a wide one.
_LOCAL_RADIUS_M = {
    "wastewater": 60_000, "landfill": 60_000, "incinerator": 80_000,
    "nuclear": 250_000, "substation": 40_000, "chemical": 80_000, "sensitive": 120_000,
}


def fetch_around(lat: float, lng: float) -> dict:
    """Nearest facility per category within a local radius of one point. Returns
    {cat: {name, lat, lng, dist_km}} (omits categories with no hit). Used for
    California listings — local search, no all-US dataset."""
    out = {}
    for cat, body in CATEGORIES.items():
        radius = _LOCAL_RADIUS_M.get(cat, 80_000)
        data = _fetch(_build_query_around(body, lat, lng, radius), f"{cat}@{lat:.2f},{lng:.2f}")
        if data is None:
            continue
        best = None
        for el in data.get("elements", []):
            co = _coord(el)
            if not co:
                continue
            tags = el.get("tags", {})
            if cat == "substation" and not _keep_substation(tags):
                continue
            from math import radians, sin, cos, asin, sqrt
            p1, p2 = radians(lat), radians(co[0])
            dp, dl = radians(co[0] - lat), radians(co[1] - lng)
            km = 2 * 6371.0 * asin(sqrt(sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2))
            if best is None or km < best[0]:
                best = (km, _name(tags), round(co[0], 5), round(co[1], 5))
        if best:
            out[cat] = {"name": best[1], "lat": best[2], "lng": best[3], "dist_km": round(best[0], 1)}
        time.sleep(1.0)  # polite between category queries
    return out


def _post(url: str, query: str, timeout: int = 200) -> dict:
    req = urllib.request.Request(
        url, data=query.encode("utf-8"),
        headers={"User-Agent": UA, "Content-Type": "text/plain; charset=utf-8"},
    )
    with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _fetch(query: str, label: str) -> dict | None:
    """Try each mirror with backoff. Returns parsed JSON or None on total fail."""
    for attempt in range(1, 4):
        for url in MIRRORS:
            try:
                data = _post(url, query)
                n = len(data.get("elements", []))
                print(f"    ✓ {label}: {n} elements via {url.split('/')[2]}")
                return data
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as e:
                code = getattr(e, "code", "")
                print(f"    · {label}: {url.split('/')[2]} failed ({code or e}); next mirror")
                time.sleep(2)
        wait = 10 * attempt
        print(f"    … all mirrors failed (attempt {attempt}/3); backoff {wait}s")
        time.sleep(wait)
    return None


def _coord(el: dict) -> tuple[float, float] | None:
    if el.get("type") == "node" and "lat" in el:
        return el["lat"], el["lon"]
    c = el.get("center")
    if c:
        return c["lat"], c["lon"]
    return None


def _name(tags: dict) -> str:
    return (tags.get("name:zh") or tags.get("name") or tags.get("name:en")
            or tags.get("operator") or "").strip()


def _max_voltage(tags: dict) -> int:
    raw = tags.get("voltage", "")
    best = 0
    for tok in str(raw).replace("kV", "").replace("kv", "").split(";"):
        tok = tok.strip()
        if not tok:
            continue
        try:
            v = float(tok)
        except ValueError:
            continue
        # heuristic: values < 2000 are almost certainly stated in kV
        v = v * 1000 if v < 2000 else v
        best = max(best, int(v))
    return best


def _keep_substation(tags: dict) -> bool:
    return _max_voltage(tags) >= MIN_VOLTAGE_V


def fetch_category(cat: str) -> list[dict]:
    body = CATEGORIES[cat]
    data = _fetch(_build_query(body), cat)
    if data is None:
        raise RuntimeError(f"Overpass totally failed for {cat}")
    seen: dict[tuple, dict] = {}
    dropped = 0
    out_of_bbox = 0
    for el in data.get("elements", []):
        co = _coord(el)
        if not co:
            continue
        tags = el.get("tags", {})
        if cat == "substation" and not _keep_substation(tags):
            dropped += 1
            continue
        if not _in_china(co[0], co[1]):
            out_of_bbox += 1
            continue
        lat, lng = round(co[0], 5), round(co[1], 5)
        key = (lat, lng)
        if key in seen:
            continue
        rec = {"name": _name(tags), "lat": lat, "lng": lng}
        if cat == "substation":
            rec["kv"] = _max_voltage(tags) // 1000
        seen[key] = rec
    out = list(seen.values())
    if cat == "substation":
        print(f"    substation: kept {len(out)} ≥{MIN_VOLTAGE_V//1000}kV (dropped {dropped} lower-voltage)")
    if out_of_bbox:
        print(f"    {cat}: dropped {out_of_bbox} out-of-China-bbox point(s)")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only", nargs="*", choices=list(CATEGORIES), help="subset of categories")
    ap.add_argument("--force", action="store_true", help="re-fetch even if ref file exists")
    args = ap.parse_args()

    REF.mkdir(parents=True, exist_ok=True)
    cats = args.only or list(CATEGORIES)
    summary = []
    for cat in cats:
        out_path = REF / f"lulu_{cat}_cn.json"
        if out_path.exists() and not args.force:
            existing = json.loads(out_path.read_text(encoding="utf-8"))
            print(f"⏭  {cat}: {len(existing)} pts (exists, skip; --force to refetch)")
            summary.append((cat, len(existing), "cached"))
            continue
        print(f"▶ {cat} …")
        try:
            pts = fetch_category(cat)
        except RuntimeError as e:
            print(f"✗ {cat}: {e}")
            summary.append((cat, 0, "FAILED"))
            continue
        out_path.write_text(json.dumps(pts, ensure_ascii=False), encoding="utf-8")
        print(f"✓ {cat}: {len(pts)} pts → {out_path.relative_to(ROOT)}")
        summary.append((cat, len(pts), "ok"))
        time.sleep(3)  # polite gap between category queries

    print("\n=== summary ===")
    for cat, n, st in summary:
        print(f"  {cat:12} {n:6} {st}")
    return 0 if all(st != "FAILED" for _, _, st in summary) else 1


if __name__ == "__main__":
    sys.exit(main())
