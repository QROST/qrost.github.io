#!/usr/bin/env python3
"""Backfill remaining climate-monthly proxy rows from ERA5 cache or same-city donor."""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from fetch_hist_temp_extremes import (  # noqa: E402
    LEVEL_DIST,
    _nearest_era5_cache,
    cluster_key,
    load_cache,
    save_cache,
)

DB = ROOT / "data" / "housing.db"
PROXY = "climate-monthly-2014-2023"
ERA5 = "open-meteo-era5-1940-2023"


def same_city_donor(con: sqlite3.Connection, prov: str, city: str) -> dict | None:
    row = con.execute(
        """
        SELECT hist_temp_max, hist_temp_min, hist_temp_max_date, hist_temp_min_date,
               hist_temp_src, hist_temp_station, hist_temp_note, hist_temp_level
        FROM listings
        WHERE prov=? AND city=? AND hist_temp_src=?
        LIMIT 1
        """,
        (prov, city, ERA5),
    ).fetchone()
    if not row:
        return None
    note = (row["hist_temp_note"] or "") + "（同市 ERA5 样本复用）"
    return _row_to_data(row, note)


def _row_to_data(row: sqlite3.Row, note: str) -> dict:
    return {
        "histTempMax": row["hist_temp_max"],
        "histTempMin": row["hist_temp_min"],
        "histTempMaxDate": row["hist_temp_max_date"],
        "histTempMinDate": row["hist_temp_min_date"],
        "histTempSrc": ERA5,
        "histTempStation": row["hist_temp_station"],
        "histTempNote": note,
        "histTempLevel": row["hist_temp_level"] or LEVEL_DIST,
    }


def same_province_donor(con: sqlite3.Connection, prov: str, lat: float, lng: float) -> dict | None:
    rows = con.execute(
        """
        SELECT hist_temp_max, hist_temp_min, hist_temp_max_date, hist_temp_min_date,
               hist_temp_src, hist_temp_station, hist_temp_note, hist_temp_level, lat, lng
        FROM listings
        WHERE prov=? AND hist_temp_src=?
        """,
        (prov, ERA5),
    ).fetchall()
    if not rows:
        return None
    best = min(rows, key=lambda r: (r["lat"] - lat) ** 2 + (r["lng"] - lng) ** 2)
    note = (best["hist_temp_note"] or "") + "（同省最近 ERA5 格点复用）"
    return _row_to_data(best, note)


def main() -> int:
    cache = load_cache()
    con = sqlite3.connect(DB, timeout=120)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        f"SELECT id, prov, city, dist, lat, lng FROM listings WHERE hist_temp_src=?",
        (PROXY,),
    ).fetchall()
    clusters: dict[str, list] = {}
    for r in rows:
        ck = cluster_key(r["prov"], r["city"], r["dist"] or "")
        clusters.setdefault(ck, []).append(r)

    fixed = 0
    gaps = 0
    for ck, members in sorted(clusters.items()):
        lat = sum(m["lat"] for m in members) / len(members)
        lng = sum(m["lng"] for m in members) / len(members)
        prov, city = members[0]["prov"], members[0]["city"]
        dist = members[0]["dist"] or ""
        data = _nearest_era5_cache(lat, lng, cache, max_delta=3.0)
        if data:
            data = dict(data)
            data["histTempNote"] = (data.get("histTempNote") or "").replace("（邻近格点复用）", "")
            data["histTempNote"] += "（API 限流，复用邻近格点 ERA5 极值）"
            data["histTempLevel"] = LEVEL_DIST
            data["histTempSrc"] = ERA5
        else:
            data = same_city_donor(con, prov, city)
        if not data:
            data = same_province_donor(con, prov, lat, lng)
        if not data:
            print(f"  ✗ {dist or city} ({city}, {prov}): no donor")
            gaps += len(members)
            continue
        for m in members:
            con.execute(
                """
                UPDATE listings SET
                  hist_temp_max=?, hist_temp_min=?,
                  hist_temp_max_date=?, hist_temp_min_date=?,
                  hist_temp_src=?, hist_temp_station=?, hist_temp_note=?,
                  hist_temp_level=?
                WHERE id=?
                """,
                (
                    data["histTempMax"], data["histTempMin"],
                    data.get("histTempMaxDate"), data.get("histTempMinDate"),
                    data["histTempSrc"], data.get("histTempStation"), data.get("histTempNote"),
                    data.get("histTempLevel", LEVEL_DIST),
                    m["id"],
                ),
            )
        fixed += len(members)
        print(f"  ✓ {dist or city} ({city}, {prov}): {data['histTempMax']}℃ / {data['histTempMin']}℃ [{data['histTempSrc']}]")
    con.commit()
    save_cache(cache)
    print(f"backfill: {fixed} listings upgraded, {gaps} still gap")
    return 1 if gaps else 0


if __name__ == "__main__":
    raise SystemExit(main())
