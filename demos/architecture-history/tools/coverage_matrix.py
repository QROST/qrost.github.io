#!/usr/bin/env python3
"""Print the year-by-region coverage matrix from the published JSON tables.

Reads people/works/relations from assets/data/ and prints:

1. works:  period x region matrix (the 8 canonical periods + unknown)
2. people: birth-bucket x region matrix
3. relation type/status summary
4. gap report: matrix cells thinner than a floor, so intake planning has a
   machine-readable list of where the catalog is thin.

Usage:
    python3 tools/coverage_matrix.py [--floor 5] [--json]
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"

PERIODS = [
    "before_1000",
    "1000_1499",
    "1500_1799",
    "1800_1918",
    "1919_1945",
    "1946_1979",
    "1980_1999",
    "2000_present",
    "unknown",
]
REGIONS = [
    "africa",
    "latin_america_caribbean",
    "north_america",
    "south_asia",
    "southeast_asia",
    "east_asia",
    "central_west_asia",
    "oceania",
    "europe",
    "transregional",
    "unknown",
]


def load(name: str) -> list[dict]:
    payload = json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))
    return payload[name]


def birth_bucket(person: dict) -> str:
    birth = person.get("birth") or {}
    value = birth.get("earliest") or birth.get("latest")
    if value is None:
        return "unknown"
    value = int(value)
    if value < 1000:
        return "before_1000"
    if value < 1500:
        return "1000_1499"
    if value < 1800:
        return "1500_1799"
    if value <= 1918:
        return "1800_1918"
    if value <= 1945:
        return "1919_1945"
    if value <= 1979:
        return "1946_1979"
    if value <= 1999:
        return "1980_1999"
    return "2000_present"


def print_matrix(title: str, counter: Counter, periods: list[str]) -> None:
    print(f"=== {title} ===")
    header = "period\\region".ljust(16) + "".join(r[:9].rjust(11) for r in REGIONS)
    print(header)
    for period in periods:
        row = period[:15].ljust(16) + "".join(
            str(counter[(period, r)]).rjust(11) for r in REGIONS
        )
        print(row)
    total = "TOTAL".ljust(16) + "".join(
        str(sum(counter[(p, r)] for p in periods)).rjust(11) for r in REGIONS
    )
    print(total)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--floor", type=int, default=5,
                        help="flag region-period cells with fewer people than this")
    parser.add_argument("--json", action="store_true",
                        help="emit the gap report as JSON instead of text")
    args = parser.parse_args()

    people = load("people")
    works = load("works")
    relations = load("relations")

    work_cells: Counter = Counter(
        (w.get("period", "unknown"), w.get("region", "unknown")) for w in works
    )
    person_cells: Counter = Counter(
        (birth_bucket(p), p.get("region", "unknown")) for p in people
    )

    gaps = []
    for region in REGIONS:
        for period in PERIODS:
            if period == "unknown":
                continue
            pc = person_cells[(period, region)]
            wc = work_cells[(period, region)]
            if pc < args.floor:
                gaps.append({
                    "region": region,
                    "period": period,
                    "people": pc,
                    "works": wc,
                    "kind": "empty" if pc == 0 and wc == 0 else "thin",
                })

    if args.json:
        print(json.dumps({
            "counts": {
                "people": len(people),
                "works": len(works),
                "relations": len(relations),
            },
            "gaps": sorted(gaps, key=lambda g: (g["people"], g["works"])),
        }, ensure_ascii=False, indent=1))
        return 0

    print_matrix("WORKS: period x region", work_cells, PERIODS)
    print()
    print_matrix("PEOPLE: birth bucket x region", person_cells, PERIODS)
    print()
    print("=== RELATIONS ===")
    print("total:", len(relations))
    print("by type:", dict(Counter(r.get("relation_type", "?") for r in relations)))
    print("by status:", dict(
        Counter(r.get("verification_status", "?") for r in relations)
    ))
    print()
    empty = [g for g in gaps if g["kind"] == "empty"]
    thin = [g for g in gaps if g["kind"] == "thin"]
    print(f"=== GAP REPORT (floor={args.floor} people/cell) ===")
    print(f"empty cells (0 people, 0 works): {len(empty)}")
    for g in empty:
        print(f"  {g['region']:26} {g['period']:14}")
    print(f"thin cells (people below floor): {len(thin)}")
    for g in thin:
        print(f"  {g['region']:26} {g['period']:14} people={g['people']} works={g['works']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
