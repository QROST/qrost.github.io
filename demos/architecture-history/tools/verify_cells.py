#!/usr/bin/env python3
"""Verify catalog coverage against canonical region-period rosters.

Reads roster files (tmp/research/cells/<region>-roster.json) produced by
region research, matches every roster entry against the published people
table (Wikidata QID first, normalized-name fallback), and prints a
per-cell verification report:

    cell = region x period (bucket the roster entry was canonically
    assigned to by the researcher)

For each cell: roster size, entries already in catalog, entries missing
(no catalog person). Missing entries with a Wikidata QID are intake
candidates (person seeds); entries without one are blocked on upstream
Wikidata growth and are archived, not silently dropped.

Usage:
    python3 tools/verify_cells.py [--cells-dir tmp/research/cells]
                                  [--json] [--region africa]
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
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
]


def normalize(value: str | None) -> str | None:
    if not value:
        return None
    text = unicodedata.normalize("NFD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^0-9a-zA-Z\u4e00-\u9fff]+", " ", text.lower())
    text = " ".join(text.split())
    return text or None


def build_indexes(people: list[dict]) -> tuple[dict, dict]:
    by_qid: dict[str, dict] = {}
    by_name: dict[str, list[dict]] = {}
    for person in people:
        qid = (person.get("external_ids") or {}).get("wikidata")
        if qid:
            by_qid[qid] = person
        for field in ("name_en", "name_zh"):
            key = normalize(person.get(field))
            if key:
                by_name.setdefault(key, []).append(person)
        for field in ("aliases_en", "aliases_zh"):
            for alias in person.get(field) or []:
                key = normalize(alias)
                if key:
                    by_name.setdefault(key, []).append(person)
    return by_qid, by_name


def match(
    entry: dict, by_qid: dict[str, dict], by_name: dict[str, list[dict]]
) -> tuple[dict | None, str]:
    qid = entry.get("qid")
    if qid and qid in by_qid:
        return by_qid[qid], "qid"
    for field in ("name_en", "name_zh", "name_original"):
        key = normalize(entry.get(field))
        if key and key in by_name:
            return by_name[key][0], "name"
    return None, ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cells-dir",
        default=str(ROOT / "tmp" / "research" / "cells"),
        help="directory holding <region>-roster.json files",
    )
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--region", help="restrict the report to one region")
    args = parser.parse_args()

    cells_dir = Path(args.cells_dir)
    people = json.loads((DATA / "people.json").read_text(encoding="utf-8"))["people"]
    works = json.loads((DATA / "works.json").read_text(encoding="utf-8"))["works"]
    works_by_qid = {
        (w.get("external_ids") or {}).get("wikidata"): w
        for w in works
        if (w.get("external_ids") or {}).get("wikidata")
    }
    by_qid, by_name = build_indexes(people)

    regions = [
        "africa",
        "latin_america_caribbean",
        "north_america",
        "south_asia",
        "southeast_asia",
        "east_asia",
        "central_west_asia",
        "oceania",
        "europe",
    ]
    roster_files = [
        cells_dir / f"{region}-roster.json" for region in regions
        if (cells_dir / f"{region}-roster.json").exists()
    ]
    if not roster_files:
        raise SystemExit(f"no roster files under {cells_dir}")

    report: dict = {"regions": {}, "totals": {}}
    total = {"roster": 0, "present": 0, "missing": 0, "blocked": 0, "works_roster": 0, "works_missing": 0}

    for path in roster_files:
        roster = json.loads(path.read_text(encoding="utf-8"))
        region = roster.get("region") or path.stem.removesuffix("-roster")
        if args.region and region != args.region:
            continue
        region_report = {"cells": {}, "notes": roster.get("notes", {})}
        for period in PERIODS:
            entries = roster.get("buckets", {}).get(period, [])
            cell = {
                "roster": len(entries),
                "present": [],
                "missing": [],
                "blocked": [],
                "region_mismatch": [],
            }
            for entry in entries:
                person, how = match(entry, by_qid, by_name)
                if person is not None:
                    cell["present"].append(
                        {
                            "name_en": entry.get("name_en"),
                            "qid": entry.get("qid"),
                            "matched_by": how,
                            "catalog_id": person["id"],
                            "catalog_region": person.get("region"),
                        }
                    )
                    total["present"] += 1
                    if person.get("region") != region:
                        cell["region_mismatch"].append(
                            {
                                "name_en": entry.get("name_en"),
                                "catalog_region": person.get("region"),
                            }
                        )
                elif entry.get("qid"):
                    cell["missing"].append(
                        {
                            "name_en": entry.get("name_en"),
                            "name_zh": entry.get("name_zh"),
                            "qid": entry.get("qid"),
                            "birth_year": entry.get("birth_year"),
                            "canonicity_note_en": entry.get("canonicity_note_en"),
                        }
                    )
                    total["missing"] += 1
                else:
                    cell["blocked"].append(
                        {
                            "name_en": entry.get("name_en"),
                            "name_zh": entry.get("name_zh"),
                            "canonicity_note_en": entry.get("canonicity_note_en"),
                        }
                    )
                    total["blocked"] += 1
                total["roster"] += 1
                for work in entry.get("key_works") or []:
                    if not work.get("qid"):
                        continue
                    total["works_roster"] += 1
                    if work["qid"] not in works_by_qid:
                        total["works_missing"] += 1
            region_report["cells"][period] = cell
        report["regions"][region] = region_report

    report["totals"] = total

    if args.json:
        out_path = cells_dir / "verification-report.json"
        out_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(f"wrote {out_path}")

    for region, region_report in report["regions"].items():
        print(f"=== {region} ===")
        for period in PERIODS:
            cell = region_report["cells"][period]
            flag = "OK " if not cell["missing"] and not cell["blocked"] else "GAP"
            print(
                f"  {flag} {period:14} roster={cell['roster']:3} "
                f"present={len(cell['present']):3} "
                f"missing={len(cell['missing']):3} blocked={len(cell['blocked']):2}"
            )
            for miss in cell["missing"]:
                note = (miss.get("canonicity_note_en") or "")[:60]
                print(
                    f"      - MISSING {miss['name_en']} ({miss.get('qid')}) {note}"
                )
        notes = region_report.get("notes") or {}
        structural = {
            k: v for k, v in notes.items() if k != "general" and v
        }
        if structural:
            print("  notes:")
            for key, value in structural.items():
                print(f"    {key}: {value[:160]}")
    print(
        f"=== TOTALS roster={total['roster']} present={total['present']} "
        f"missing={total['missing']} blocked={total['blocked']} | "
        f"key_works={total['works_roster']} works_missing={total['works_missing']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
