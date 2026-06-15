#!/usr/bin/env python3
"""Bake nearest 高铁站 (poi.category=hsr) via Overpass — skips manage.py migrate."""
from __future__ import annotations

import sqlite3
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import enrich  # noqa: E402

DB = ROOT / "data" / "housing.db"


def main() -> None:
    con = sqlite3.connect(DB, timeout=600)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout=600000")
    rows = con.execute(
        "SELECT id, lat, lng FROM listings WHERE lat IS NOT NULL ORDER BY id"
    ).fetchall()
    done = fail = skip = 0
    for r in rows:
        lid = r["id"]
        if con.execute(
            "SELECT 1 FROM poi WHERE listing_id=? AND category='hsr'", (lid,)
        ).fetchone():
            skip += 1
            continue
        data = enrich._overpass(r["lat"], r["lng"])
        if data is None:
            fail += 1
            time.sleep(1.5)
            continue
        found = enrich._nearest_from_overpass(data, r["lat"], r["lng"])
        if "hsr" not in found:
            time.sleep(1.5)
            continue
        enrich._store_pois(con, lid, {"hsr": found["hsr"]})
        done += 1
        if done % 10 == 0:
            for attempt in range(8):
                try:
                    con.commit()
                    break
                except sqlite3.OperationalError as e:
                    if "locked" not in str(e).lower() or attempt == 7:
                        raise
                    time.sleep(5 * (attempt + 1))
            print(f"…{done} hsr baked ({skip} skip, {fail} fail)")
        time.sleep(1.5)
    for attempt in range(8):
        try:
            con.commit()
            break
        except sqlite3.OperationalError as e:
            if "locked" not in str(e).lower() or attempt == 7:
                raise
            time.sleep(5 * (attempt + 1))
    print(f"hsr backfill done: {done} new, {skip} already present, {fail} overpass fail")


if __name__ == "__main__":
    main()
