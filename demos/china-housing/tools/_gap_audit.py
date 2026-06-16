#!/usr/bin/env python3
"""Read-only gap audit → data/research/gap-audit-YYYY-MM-DD.json"""
from __future__ import annotations

import json
import sqlite3
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "housing.db"
OUT = ROOT / "data" / "research" / f"gap-audit-{date.today().isoformat()}.json"

POI_CATS = ("hospital", "train", "metro", "airport", "coast", "hsr")
LOUWANG = list(range(333, 347))


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


def _dim(ids: list[int]) -> dict:
    return {"count": len(ids), "ids": ids}


def _louwang_flags(missing_map: dict[str, list[int]]) -> dict:
    out = {}
    for dim, ids in missing_map.items():
        hit = [i for i in LOUWANG if i in ids]
        out[dim] = {"count": len(hit), "ids": hit, "complete": len(hit) == 0}
    return out


def main() -> None:
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row

    listings = [dict(r) for r in con.execute(
        "SELECT id, lat, lng, elevation, daily_climate, built_year, built_year_src, "
        "hist_temp_max, hist_temp_min, hist_temp_src, hazards_local "
        "FROM listings ORDER BY id"
    )]
    total = len(listings)
    all_ids = [r["id"] for r in listings]

    pois_by_lid: dict[int, dict[str, dict]] = {}
    for r in con.execute(
        "SELECT listing_id, category, name, dist_km, subtype, source FROM poi"
    ):
        pois_by_lid.setdefault(r["listing_id"], {})[r["category"]] = dict(r)

    missing: dict[str, list[int]] = {
        "built_year": [],
        "built_year_src": [],
        "hist_temp_max_min": [],
        "hist_temp_src": [],
        "elevation": [],
        "daily_climate": [],
        "climate_monthly": [],
        "hazards_local": [],
        "geocode_lat_lng": [],
    }
    for cat in POI_CATS:
        missing[f"poi_{cat}"] = []

    for r in listings:
        lid = r["id"]
        if r["built_year"] is None:
            missing["built_year"].append(lid)
        if _is_blank(r["built_year_src"]):
            missing["built_year_src"].append(lid)
        if r["hist_temp_max"] is None or r["hist_temp_min"] is None:
            missing["hist_temp_max_min"].append(lid)
        if _is_blank(r["hist_temp_src"]):
            missing["hist_temp_src"].append(lid)
        if r["elevation"] is None:
            missing["elevation"].append(lid)
        if not _daily_climate_ok(r["daily_climate"]):
            missing["daily_climate"].append(lid)
        if not _climate_monthly_ok(con, lid):
            missing["climate_monthly"].append(lid)
        if not _hazards_ok(r["hazards_local"]):
            missing["hazards_local"].append(lid)
        if r["lat"] is None or r["lng"] is None:
            missing["geocode_lat_lng"].append(lid)

        pois = pois_by_lid.get(lid, {})
        for cat in POI_CATS:
            if cat == "hsr":
                if not _hsr_ok(pois):
                    missing["poi_hsr"].append(lid)
            elif not _poi_ok(pois.get(cat)):
                missing[f"poi_{cat}"].append(lid)

    gaps = {k: _dim(v) for k, v in missing.items()}
    complete = {k: total - gaps[k]["count"] for k in gaps}

    report = {
        "audit": "gap-audit",
        "created": date.today().isoformat(),
        "source": "data/housing.db",
        "sop": "tools/SOP-ADD-CITY.md",
        "total_listings": total,
        "id_range": [min(all_ids), max(all_ids)],
        "gaps": gaps,
        "complete": complete,
        "louwang_batch": {
            "label": "tier1-louwang-2026-06",
            "ids": LOUWANG,
            "per_dimension": _louwang_flags(missing),
            "fully_enriched": all(
                i not in ids for ids in missing.values() for i in LOUWANG
            ),
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT} — {total} listings")
    for k, g in gaps.items():
        if g["count"]:
            print(f"  {k}: {g['count']}")


if __name__ == "__main__":
    main()
