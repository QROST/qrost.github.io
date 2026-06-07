#!/usr/bin/env python3
"""Normalize hist-temp to district-cluster level using climate normals (no API)."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "housing.db"
LEVEL_DIST = "区镇/街道"
LEVEL_COUNTY = "区县"


def cluster_climate_proxy(con: sqlite3.Connection, members: list[int]) -> dict | None:
    highs, lows = [], []
    for lid in members:
        row = con.execute(
            "SELECT MAX(tmax) AS hi, MIN(tmin) AS lo FROM climate WHERE listing_id=?", (lid,),
        ).fetchone()
        if row and row["hi"] is not None and row["lo"] is not None:
            highs.append(row["hi"])
            lows.append(row["lo"])
    if not highs:
        return None
    return {
        "histTempMax": round(max(highs), 1),
        "histTempMin": round(min(lows), 1),
        "histTempMaxDate": None,
        "histTempMinDate": None,
        "histTempSrc": "climate-monthly-2014-2023",
        "histTempStation": None,
        "histTempNote": "ERA5 2014–2023 月均极值（区内并集，非全历史站址记录）",
        "histTempLevel": LEVEL_DIST,
    }


def main() -> None:
    con = sqlite3.connect(DB, timeout=120)
    con.row_factory = sqlite3.Row
    rows = con.execute("""
        SELECT id, prov, city, dist, hist_temp_src, hist_temp_level
        FROM listings ORDER BY prov, city, dist, id
    """).fetchall()
    clusters: dict[str, list] = {}
    for r in rows:
        ck = f"{r['prov']}|{r['city']}|{r['dist']}"
        clusters.setdefault(ck, []).append(r)

    n = 0
    for ck, members in clusters.items():
        ids = [m["id"] for m in members]
        # Only normalize climate-monthly rows (per-listing drift) or missing
        needs = [m for m in members if m["hist_temp_src"] == "climate-monthly-2014-2023"
                 or m["hist_temp_level"] == "市"]
        if not needs and all(m["hist_temp_src"] for m in members):
            continue
        dist = members[0]["dist"] or ""
        data = cluster_climate_proxy(con, ids)
        if not data:
            continue
        if dist.endswith("县") or dist.endswith("区") and "市" not in dist:
            data["histTempLevel"] = LEVEL_COUNTY if dist.endswith("县") else LEVEL_DIST
        for m in members:
            if m["hist_temp_src"] and m["hist_temp_src"].startswith("wikipedia"):
                continue
            if m["hist_temp_src"] and m["hist_temp_src"].startswith("open-meteo-era5"):
                continue
            con.execute("""
                UPDATE listings SET hist_temp_max=?, hist_temp_min=?,
                  hist_temp_max_date=?, hist_temp_min_date=?,
                  hist_temp_src=?, hist_temp_station=?, hist_temp_note=?, hist_temp_level=?
                WHERE id=?
            """, (
                data["histTempMax"], data["histTempMin"],
                data.get("histTempMaxDate"), data.get("histTempMinDate"),
                data["histTempSrc"], data.get("histTempStation"), data["histTempNote"],
                data["histTempLevel"], m["id"],
            ))
            n += 1
    con.commit()
    stats = con.execute("""
        SELECT hist_temp_level, COUNT(*) FROM listings
        WHERE hist_temp_max IS NOT NULL GROUP BY hist_temp_level
    """).fetchall()
    print(json.dumps({"normalized": n, "by_level": {r[0]: r[1] for r in stats}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
