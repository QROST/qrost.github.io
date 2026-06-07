#!/usr/bin/env python3
"""Backfill hospital dist_km for research name-only POI rows."""
from __future__ import annotations

import sqlite3
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from enrich import geocode_query, haversine, _listing_city  # noqa: E402

DB = ROOT / "data" / "housing.db"
POI_MAX_KM = 80.0  # rural / county hospitals may be farther than merge_research default


def geocode_hospital(name: str, row: sqlite3.Row, prov: str):
    city = _listing_city(row)
    dist = (row["dist"] or "").strip()
    queries = []
    for base in (
        f"{dist}, {city}, {prov}",
        f"{city}, {prov}",
        f"{dist}, {prov}",
        prov,
    ):
        queries.append(f"{name}, {base}")
        if "卫生院" not in name and "医院" in name:
            queries.append(f"{name}, {base}")
    seen = set()
    for q in queries:
        if q in seen:
            continue
        seen.add(q)
        g = geocode_query(q, prov)
        time.sleep(1.1)
        if g:
            return g
    return None


def main() -> None:
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    rows = con.execute("""
        SELECT p.listing_id, p.name, l.prov, l.city, l.dist, l.loc, l.lat, l.lng
        FROM poi p JOIN listings l ON l.id = p.listing_id
        WHERE p.category='hospital' AND (p.dist_km IS NULL OR p.lat IS NULL)
        ORDER BY p.listing_id
    """).fetchall()
    filled = rejected = 0
    for r in rows:
        if r["lat"] is None or r["lng"] is None:
            print(f"  skip id{r['listing_id']} — listing not geocoded")
            continue
        g = geocode_hospital(r["name"], r, r["prov"])
        if not g:
            print(f"  ! id{r['listing_id']} geocode fail: {r['name']}")
            continue
        d = haversine(r["lat"], r["lng"], g[0], g[1])
        if d > POI_MAX_KM:
            print(f"  ! id{r['listing_id']} reject {d:.1f}km {r['name']}")
            rejected += 1
            continue
        con.execute(
            "UPDATE poi SET lat=?, lng=?, dist_km=?, source='research' "
            "WHERE listing_id=? AND category='hospital'",
            (round(g[0], 5), round(g[1], 5), round(d, 1), r["listing_id"]),
        )
        filled += 1
        print(f"  ✓ id{r['listing_id']} {r['name'][:20]} → {d:.1f}km")
    # id 234 missing entirely — insert if still absent
    r234 = con.execute(
        "SELECT l.* FROM listings l WHERE l.id=234 AND NOT EXISTS "
        "(SELECT 1 FROM poi WHERE listing_id=234 AND category='hospital')"
    ).fetchone()
    if r234:
        for nm in ("惠东县平海镇卫生院", "惠东县第二人民医院"):
            g = geocode_hospital(nm, r234, r234["prov"])
            if g:
                d = haversine(r234["lat"], r234["lng"], g[0], g[1])
                if d <= POI_MAX_KM:
                    con.execute(
                        "INSERT OR REPLACE INTO poi (listing_id,category,name,lat,lng,dist_km,source) "
                        "VALUES (234,'hospital',?,?,?,?,'research')",
                        (nm, round(g[0], 5), round(g[1], 5), round(d, 1)),
                    )
                    filled += 1
                    print(f"  ✓ id234 inserted {nm} → {d:.1f}km")
                    break
    con.commit()
    con.close()
    print(f"done: filled={filled} rejected={rejected}")


if __name__ == "__main__":
    main()
