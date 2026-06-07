#!/usr/bin/env python3
"""Apply hospital-dist-batch-*-findings.json → poi lat/lng/dist_km."""
from __future__ import annotations

import json
import math
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "housing.db"
RESEARCH = ROOT / "data" / "research"
MAX_KM = 80.0


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def load_findings() -> list[dict]:
    out: list[dict] = []
    patterns = ("hospital-dist-batch-*-findings.json", "hospital-dist-round2-findings.json")
    paths: list[Path] = []
    for pat in patterns:
        paths.extend(RESEARCH.glob(pat))
    for path in sorted(set(paths)):
        data = json.loads(path.read_text(encoding="utf-8"))
        items = data.get("findings", data) if isinstance(data, dict) else data
        if isinstance(items, list):
            out.extend(items)
    return out


def main() -> None:
    findings = load_findings()
    if not findings:
        print("no hospital-dist-batch-*-findings.json found")
        return

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    applied = skipped = rejected = 0

    for f in findings:
        lid = f.get("id")
        conf = (f.get("confidence") or "").lower()
        if lid is None or conf not in ("high", "med"):
            skipped += 1
            continue

        row = con.execute(
            "SELECT lat, lng FROM listings WHERE id=?", (lid,)
        ).fetchone()
        if not row or row["lat"] is None or row["lng"] is None:
            skipped += 1
            continue

        hlat = f.get("hospital_lat")
        hlng = f.get("hospital_lng")
        if hlat is None or hlng is None:
            skipped += 1
            continue

        hlat, hlng = float(hlat), float(hlng)
        dist = f.get("dist_km")
        if dist is None:
            dist = haversine(row["lat"], row["lng"], hlat, hlng)
        else:
            dist = float(dist)

        if dist > MAX_KM:
            rejected += 1
            print(f"  ! id{lid} reject {dist:.1f}km")
            continue

        name = f.get("hospital_name")
        if not name:
            cur = con.execute(
                "SELECT name FROM poi WHERE listing_id=? AND category='hospital'", (lid,)
            ).fetchone()
            name = cur["name"] if cur else None
        if not name:
            skipped += 1
            continue

        con.execute(
            "UPDATE poi SET name=?, lat=?, lng=?, dist_km=?, source='research' "
            "WHERE listing_id=? AND category='hospital'",
            (name, round(hlat, 5), round(hlng, 5), round(dist, 1), lid),
        )
        applied += 1
        print(f"  ✓ id{lid} {name[:24]} → {dist:.1f}km ({conf})")

    con.commit()
    remaining = con.execute("""
        SELECT COUNT(*) FROM poi p
        WHERE p.category='hospital' AND p.dist_km IS NULL
    """).fetchone()[0]
    con.close()
    print(f"done: applied={applied} skipped={skipped} rejected={rejected} remaining={remaining}")


if __name__ == "__main__":
    main()
