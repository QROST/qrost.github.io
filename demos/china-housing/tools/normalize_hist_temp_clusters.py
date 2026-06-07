#!/usr/bin/env python3
"""Ensure all listings in a (prov,city,dist) cluster share identical hist-temp values."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "housing.db"


def main() -> None:
    con = sqlite3.connect(DB, timeout=120)
    con.row_factory = sqlite3.Row
    rows = con.execute("""
        SELECT id, prov, city, dist, hist_temp_max, hist_temp_min, hist_temp_max_date,
               hist_temp_min_date, hist_temp_src, hist_temp_station, hist_temp_note, hist_temp_level
        FROM listings WHERE hist_temp_max IS NOT NULL
    """).fetchall()
    clusters: dict[str, list] = {}
    for r in rows:
        ck = f"{r['prov']}|{r['city']}|{r['dist']}"
        clusters.setdefault(ck, []).append(r)
    fixed = 0
    for members in clusters.values():
        rep = max(members, key=lambda m: (
            0 if (m["hist_temp_src"] or "").startswith("wikipedia") else
            1 if (m["hist_temp_src"] or "").startswith("open-meteo-era5") else 2))
        for m in members:
            if m["hist_temp_max"] == rep["hist_temp_max"] and m["hist_temp_min"] == rep["hist_temp_min"]:
                continue
            con.execute("""
                UPDATE listings SET hist_temp_max=?, hist_temp_min=?,
                  hist_temp_max_date=?, hist_temp_min_date=?,
                  hist_temp_src=?, hist_temp_station=?, hist_temp_note=?, hist_temp_level=?
                WHERE id=?
            """, (
                rep["hist_temp_max"], rep["hist_temp_min"],
                rep["hist_temp_max_date"], rep["hist_temp_min_date"],
                rep["hist_temp_src"], rep["hist_temp_station"], rep["hist_temp_note"],
                rep["hist_temp_level"], m["id"],
            ))
            fixed += 1
    con.commit()
    print(json.dumps({"clusters": len(clusters), "listings_fixed": fixed}, ensure_ascii=False))


if __name__ == "__main__":
    main()
