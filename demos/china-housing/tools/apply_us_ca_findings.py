#!/usr/bin/env python3
"""Apply verified US-CA listing research (POI + pricing) from us-ca-listings-2026-06.json."""
from __future__ import annotations

import json
import math
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "housing.db"
FINDINGS = ROOT / "data" / "research" / "us-ca-listings-2026-06.json"


def hav(lat1, lng1, lat2, lng2):
    r = 6371.0
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lng2 - lng1) * p / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def upsert_poi(cur, lid, cat, name, lat, lng, dist_km):
    cur.execute(
        "INSERT OR REPLACE INTO poi (listing_id, category, name, lat, lng, dist_km, source) "
        "VALUES (?,?,?,?,?,?, 'research')",
        (lid, cat, name, lat, lng, round(dist_km, 1) if dist_km is not None else None),
    )


def main():
    data = json.loads(FINDINGS.read_text(encoding="utf-8"))
    findings = data.get("findings", data if isinstance(data, list) else [])
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    for f in findings:
        lid = f["id"]
        row = cur.execute("SELECT lat, lng FROM listings WHERE id=?", (lid,)).fetchone()
        if not row:
            print(f"! skip #{lid}: no listing")
            continue
        lat, lng = row["lat"], row["lng"]

        if f.get("priceWan") is not None:
            cur.execute("UPDATE listings SET priceWan=? WHERE id=?", (f["priceWan"], lid))
            print(f"#{lid} priceWan → {f['priceWan']} ({f.get('priceWanMethod', '?')})")

        if f.get("lat") and f.get("lng"):
            cur.execute(
                "UPDATE listings SET lat=?, lng=?, geo_level='loc', geo_label='调研细化', geo_source='research' WHERE id=?",
                (f["lat"], f["lng"], lid),
            )

        # airport / coast with verified coords
        if f.get("airport_name"):
            alat, alng = f.get("airport_lat"), f.get("airport_lng")
            d = f.get("airport_dist_km") or (hav(lat, lng, alat, alng) if alat else None)
            upsert_poi(cur, lid, "airport", f["airport_name"], alat, alng, d)

        if f.get("coast_name"):
            d = f.get("coast_dist_km")
            upsert_poi(cur, lid, "coast", f["coast_name"], None, None, d)

        for cat, key in (("hospital", "hospital_name"), ("mall", "mall_name"),
                         ("metro", "metro_name"), ("train", "train_name")):
            name = f.get(key)
            if not name:
                continue
            plat, plng = f.get(f"{cat}_lat"), f.get(f"{cat}_lng")
            if plat is None or plng is None:
                continue
            d_k = f.get(f"{cat}_dist_km") or hav(lat, lng, plat, plng)
            upsert_poi(cur, lid, cat, name, plat, plng, d_k)

        cur.execute("INSERT OR REPLACE INTO poi_done (listing_id) VALUES (?)", (lid,))

    con.commit()
    con.close()
    print("✓ apply_us_ca_findings done")


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import enrich  # noqa: E402
    from manage import connect  # noqa: E402

    main()
    con = connect()
    enrich.risk_all(con, print)
    con.close()
