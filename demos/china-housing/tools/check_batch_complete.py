#!/usr/bin/env python3
"""Read-only batch completeness gate — run before ``manage.py build``.

Prints missing mandatory enrich fields per listing id (range or whole DB).
Stdlib only. Exit 1 if any gap remains.

Usage:
  python3 tools/check_batch_complete.py --from 357 --to 359
  python3 tools/check_batch_complete.py --ids 333,334,335
  python3 tools/check_batch_complete.py            # whole DB summary
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "housing.db"
HAZARD_RESEARCH = ROOT / "data" / "hazard_research.json"
RESEARCH_DIR = ROOT / "data" / "research"

POI_CATS = ("hospital", "train", "airport", "coast", "hsr")
# Mainland prefecture-level cities with metro — skip metro gap elsewhere.
_METRO_CITIES = frozenset({
    "北京市", "上海市", "天津市", "重庆市", "广州市", "深圳市", "成都市", "武汉市",
    "西安市", "杭州市", "南京市", "苏州市", "无锡市", "常州市", "宁波市", "青岛市",
    "大连市", "沈阳市", "长春市", "哈尔滨市", "郑州市", "长沙市", "昆明市", "贵阳市",
    "南宁市", "福州市", "厦门市", "南昌市", "合肥市", "济南市", "石家庄市", "太原市",
    "兰州市", "乌鲁木齐市", "呼和浩特市", "海口市", "香港", "台北市", "新北市", "桃园市",
    "台中市", "台南市", "高雄市",
})

# Province-only hazard headlines (must differ when prefKey exists in hazard_research).
_PROV_HEADLINES: dict[str, str] = {}


def _load_prov_headlines() -> dict[str, str]:
    if _PROV_HEADLINES:
        return _PROV_HEADLINES
    enrich_path = ROOT / "tools" / "enrich.py"
    if not enrich_path.exists():
        return {}
    text = enrich_path.read_text(encoding="utf-8")
    import re

    block = re.search(r"PROVINCE_HAZARDS\s*=\s*\{", text)
    if not block:
        return {}
    # Minimal parse: "省名": {"headline": "…"
    for m in re.finditer(
        r'"([^"]+)":\s*\{\s*"headline":\s*"([^"]+)"', text[block.start() : block.start() + 12000]
    ):
        _PROV_HEADLINES[m.group(1)] = m.group(2)
    return _PROV_HEADLINES


def _is_blank(v) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def _poi_ok(row: dict | None) -> bool:
    if not row:
        return False
    return not _is_blank(row.get("name")) or row.get("dist_km") is not None


def _hsr_ok(pois: dict) -> bool:
    if _poi_ok(pois.get("hsr")):
        return True
    tr = pois.get("train")
    return bool(tr and tr.get("subtype") == "highspeed" and not _is_blank(tr.get("name")))


def _climate_monthly_ok(con: sqlite3.Connection, lid: int) -> bool:
    rows = con.execute(
        "SELECT month, tmean, tmax, tmin, precip FROM climate WHERE listing_id=? ORDER BY month",
        (lid,),
    ).fetchall()
    if len(rows) < 12:
        return False
    months = {r["month"] for r in rows}
    if months != set(range(1, 13)):
        return False
    return all(
        r["tmean"] is not None and r["tmax"] is not None
        and r["tmin"] is not None and r["precip"] is not None
        for r in rows
    )


def _daily_climate_ok(raw: str | None) -> bool:
    if _is_blank(raw):
        return False
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        return False
    return bool(obj.get("curve") or obj.get("comfortDays") is not None)


def _hazards_ok(raw: str | None) -> bool:
    if _is_blank(raw):
        return False
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        return False
    hazards = obj.get("hazards")
    return isinstance(hazards, list) and len(hazards) > 0


def _metro_required(city: str, prov: str) -> bool:
    base = (city or "").split("-")[0]
    if prov in ("香港", "台湾", "California"):
        return base in _METRO_CITIES or prov == "香港"
    return base in _METRO_CITIES or base.endswith("市")


def _load_hazard_pref_keys() -> set[str]:
    if not HAZARD_RESEARCH.exists():
        return set()
    data = json.loads(HAZARD_RESEARCH.read_text(encoding="utf-8"))
    findings = data.get("findings", data if isinstance(data, list) else [])
    return {f["prefKey"] for f in findings if f.get("prefKey")}


def _load_built_unknown_ids() -> set[int]:
    out: set[int] = set()
    if not RESEARCH_DIR.is_dir():
        return out
    for path in RESEARCH_DIR.glob("built-year*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            items = data
        else:
            items = data.get("findings", [])
        for f in items:
            if f.get("confidence") == "none" and f.get("id") is not None:
                out.add(int(f["id"]))
    return out


def _load_rent_research_ids() -> dict[int, dict]:
    """ids with portal research or documented no-market in rent-backfill JSON."""
    out: dict[int, dict] = {}
    if not RESEARCH_DIR.is_dir():
        return out
    for path in RESEARCH_DIR.glob("rent*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            items = data
        else:
            items = data.get("findings", [])
        for f in items:
            lid = f.get("id")
            if lid is not None:
                out[int(lid)] = f
    return out


def _pref_key(prov: str, city: str) -> str:
    return f"{prov}|{(city or '').split('-')[0]}"


def _hazard_province_only(prov: str, city: str, hazards_raw: str | None, pref_keys: set[str],
                          prov_headlines: dict[str, str]) -> bool:
    """True when prefecture research exists but listing still has province headline."""
    pk = _pref_key(prov, city)
    if pk not in pref_keys:
        return False
    if _is_blank(hazards_raw):
        return True
    try:
        obj = json.loads(hazards_raw)
    except json.JSONDecodeError:
        return True
    headline = obj.get("headline") or ""
    prov_hl = prov_headlines.get(prov, "")
    return bool(prov_hl and headline == prov_hl)


def _checks_for_row(
    con: sqlite3.Connection,
    r: sqlite3.Row,
    pois: dict,
    poi_done: bool,
    built_unknown: set[int],
    rent_research: dict[int, dict],
    pref_keys: set[str],
    prov_headlines: dict[str, str],
) -> list[str]:
    gaps: list[str] = []
    lid = r["id"]

    if r["lat"] is None or r["lng"] is None:
        gaps.append("geocode_lat_lng")
    if not _climate_monthly_ok(con, lid):
        gaps.append("climate_12mo")
    if not _daily_climate_ok(r["daily_climate"]):
        gaps.append("daily_climate")
    if r["elevation"] is None:
        gaps.append("elevation")
    rel = con.execute("SELECT terrain_relief FROM listings WHERE id=?", (lid,)).fetchone()
    if rel is None or rel["terrain_relief"] is None:
        gaps.append("relief")
    rk = con.execute("SELECT listing_id FROM risk WHERE listing_id=?", (lid,)).fetchone()
    if rk is None:
        gaps.append("risk")
    if not _hazards_ok(r["hazards_local"]):
        gaps.append("hazards_local")
    elif _hazard_province_only(r["prov"], r["city"], r["hazards_local"], pref_keys, prov_headlines):
        gaps.append("hazard_merge_prefecture")

    for cat in POI_CATS:
        if cat == "hsr":
            if not _hsr_ok(pois):
                gaps.append("poi_hsr")
        elif not _poi_ok(pois.get(cat)):
            gaps.append(f"poi_{cat}")

    if _metro_required(r["city"], r["prov"]) and not _poi_ok(pois.get("metro")):
        gaps.append("poi_metro")

    if r["lat"] is not None and not poi_done:
        gaps.append("poi_done")

    if r["built_year"] is None and lid not in built_unknown:
        if _is_blank(r["built_year_src"]):
            gaps.append("built_year_or_documented_unknown")

    if r["hist_temp_max"] is None or r["hist_temp_min"] is None:
        gaps.append("hist_temp_max_min")

    rr = rent_research.get(lid)
    if rr is None and r["rent"] <= 0:
        gaps.append("rent_or_research")

    return gaps


def main() -> int:
    ap = argparse.ArgumentParser(description="Check batch enrich completeness (read-only)")
    ap.add_argument("--from", dest="id_from", type=int, help="first listing id (inclusive)")
    ap.add_argument("--to", dest="id_to", type=int, help="last listing id (inclusive)")
    ap.add_argument("--ids", help="comma-separated ids")
    ap.add_argument("--json", action="store_true", help="emit machine-readable report")
    args = ap.parse_args()

    if not DB.exists():
        print(f"! missing {DB}", file=sys.stderr)
        return 2

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row

    if args.ids:
        id_set = {int(x.strip()) for x in args.ids.split(",") if x.strip()}
        where = f"id IN ({','.join('?' * len(id_set))})"
        params: list = sorted(id_set)
    elif args.id_from is not None:
        lo = args.id_from
        hi = args.id_to if args.id_to is not None else lo
        where = "id BETWEEN ? AND ?"
        params = [lo, hi]
    else:
        where = "1=1"
        params = []

    listings = con.execute(
        f"SELECT id, prov, city, dist, loc, lat, lng, elevation, daily_climate, "
        f"built_year, built_year_src, hist_temp_max, hist_temp_min, rent, hazards_local "
        f"FROM listings WHERE {where} ORDER BY id",
        params,
    ).fetchall()

    pois_by_lid: dict[int, dict] = {}
    for row in con.execute(
        "SELECT listing_id, category, name, dist_km, subtype FROM poi"
    ):
        pois_by_lid.setdefault(row["listing_id"], {})[row["category"]] = dict(row)

    poi_done_ids = {
        r[0] for r in con.execute("SELECT listing_id FROM poi_done")
    }

    built_unknown = _load_built_unknown_ids()
    rent_research = _load_rent_research_ids()
    pref_keys = _load_hazard_pref_keys()
    prov_headlines = _load_prov_headlines()

    report: dict = {"total": len(listings), "complete": 0, "incomplete": 0, "by_id": {}}
    any_gap = False

    for r in listings:
        lid = r["id"]
        gaps = _checks_for_row(
            con, r, pois_by_lid.get(lid, {}), lid in poi_done_ids,
            built_unknown, rent_research, pref_keys, prov_headlines,
        )
        if gaps:
            any_gap = True
            report["incomplete"] += 1
            report["by_id"][str(lid)] = {
                "loc": f"{r['prov']}{r['city']}{r['loc']}",
                "missing": gaps,
            }
        else:
            report["complete"] += 1

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"check_batch_complete: {report['complete']}/{report['total']} OK")
        for lid, info in sorted(report["by_id"].items(), key=lambda x: int(x[0])):
            print(f"  id={lid} {info['loc']}: {', '.join(info['missing'])}")
        if not any_gap:
            print("BATCH_COMPLETE_OK")

    return 1 if any_gap else 0


if __name__ == "__main__":
    sys.exit(main())
