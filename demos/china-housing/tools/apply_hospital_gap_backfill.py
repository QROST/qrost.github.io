#!/usr/bin/env python3
"""Apply hospital-gap-backfill JSON → poi.category=hospital (INSERT if missing).

Geocodes each unique hospital_name once (not per listing) to stay within Nominatim pacing.
Format: {findings:[{id, hospital_name, source?, confidence?}, …]} or bare list.
"""
from __future__ import annotations

import json
import sqlite3
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from enrich import geocode_query, haversine, _listing_city  # noqa: E402

DB = ROOT / "data" / "housing.db"
MAX_KM = 80.0


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data/research/hospital-gap-backfill-2026-06.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    findings = data.get("findings", data) if isinstance(data, dict) else data

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row

    # Geocode each unique hospital once (reuse row context from first listing needing it).
    coords: dict[str, tuple[float, float]] = {}
    for f in findings:
        name = (f.get("hospital_name") or "").strip()
        if not name or name in coords:
            continue
        lid = f["id"]
        row = con.execute(
            "SELECT prov, city, dist, lat, lng FROM listings WHERE id=?", (lid,)
        ).fetchone()
        if not row:
            continue
        city = _listing_city(row)
        prov = row["prov"]
        # Prefer explicit coords in JSON (avoids Nominatim 429 during batch backfill).
        hlat, hlng = f.get("hospital_lat"), f.get("hospital_lng")
        if hlat is not None and hlng is not None:
            coords[name] = (float(hlat), float(hlng))
            print(f"  coords ✓ {name[:32]} → ({hlat}, {hlng}) [json]")
            continue
        g = geocode_query(f"{name}, {city}, {prov}", prov)
        time.sleep(1.1)
        if not g:
            g = geocode_query(f"{name}, {prov}", prov)
            time.sleep(1.1)
        if g:
            coords[name] = (g[0], g[1])
            print(f"  geocode ✓ {name[:32]} → ({g[0]:.5f}, {g[1]:.5f})")
        else:
            print(f"  geocode ! {name[:32]} → fail (will name-only insert)")

    applied = name_only = rejected = skipped = 0
    for f in findings:
        lid = f.get("id")
        name = (f.get("hospital_name") or "").strip()
        if lid is None or not name:
            skipped += 1
            continue
        row = con.execute("SELECT lat, lng, prov FROM listings WHERE id=?", (lid,)).fetchone()
        if not row or row["lat"] is None:
            skipped += 1
            continue
        cur = con.execute(
            "SELECT dist_km, source FROM poi WHERE listing_id=? AND category='hospital'", (lid,)
        ).fetchone()
        if cur and cur["source"] == "research" and cur["dist_km"] is not None and cur["dist_km"] >= 0.5:
            skipped += 1
            continue

        g = coords.get(name)
        if g:
            d = haversine(row["lat"], row["lng"], g[0], g[1])
            if d > MAX_KM:
                rejected += 1
                print(f"  ! id{lid} reject {d:.1f}km {name[:24]}")
                continue
            con.execute(
                "INSERT OR REPLACE INTO poi (listing_id,category,name,lat,lng,dist_km,source,subtype) "
                "VALUES (?,?,?,?,?,?,'research',NULL)",
                (lid, "hospital", name, round(g[0], 5), round(g[1], 5), round(d, 1)),
            )
            applied += 1
            print(f"  ✓ id{lid} {name[:28]} → {d:.1f}km")
        else:
            con.execute(
                "INSERT OR REPLACE INTO poi (listing_id,category,name,lat,lng,dist_km,source,subtype) "
                "VALUES (?,?,?,NULL,NULL,NULL,'research',NULL)",
                (lid, "hospital", name),
            )
            name_only += 1
            print(f"  ~ id{lid} {name[:28]} (name-only, no geocode)")

    con.commit()
    missing = con.execute("""
        SELECT COUNT(*) FROM listings l
        LEFT JOIN poi p ON p.listing_id=l.id AND p.category='hospital' AND p.name IS NOT NULL
        WHERE l.lat IS NOT NULL AND p.name IS NULL
    """).fetchone()[0]
    con.close()
    print(f"done: applied={applied} name_only={name_only} rejected={rejected} skipped={skipped} still_missing={missing}")


if __name__ == "__main__":
    main()
