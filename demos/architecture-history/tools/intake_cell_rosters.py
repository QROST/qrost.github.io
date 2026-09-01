#!/usr/bin/env python3
"""Turn the cell-verification report into pipeline intake artifacts.

Inputs:
    tmp/research/cells/verification-report.json  (from verify_cells.py --json)

Outputs:
    1. Appends new entries to tools/wikidata-hydration-seeds.json
       person_seeds (missing roster people that have a Wikidata QID).
    2. Archives blocked names (no Wikidata item) to
       tmp/research/cells/blocked.json for retry when upstream grows.
    3. Emits work-seed candidates from the roster key_works that are absent
       from the published works table, each pre-checked against Wikidata
       P17 so expected_country_qid/code/region are correct for the fetcher
       gate, to tmp/research/cells/work-seed-candidates.json.

Usage:
    python3 tools/intake_cell_rosters.py [--max-work-seeds 400] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
CELLS = ROOT / "tmp" / "research" / "cells"
SEEDS_PATH = ROOT / "tools" / "wikidata-hydration-seeds.json"
CONFIG_PATH = DATA / "methodology" / "wikidata-coverage-config.json"
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
ENTITY_DATA = "https://www.wikidata.org/wiki/Special:EntityData"


def http_json(url: str) -> dict:
    request = urllib.request.Request(
        url, headers={"User-Agent": "qrost-architecture-history/1.0"}
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def work_country(qid: str, authority: dict[str, dict]) -> dict | None:
    """Resolve a work's P17 country against the authority table."""
    try:
        payload = http_json(f"{ENTITY_DATA}/{qid}.json")
    except Exception as exc:  # noqa: BLE001 - network best-effort
        print(f"  ! {qid}: fetch failed ({exc})")
        return None
    entities = payload.get("entities", {})
    record = entities.get(qid)
    if not record:
        return None
    label = record.get("labels", {}).get("en", {}).get("value") or ""
    p84 = [
        st["mainsnak"]["datavalue"]["value"]["id"]
        for st in record.get("claims", {}).get("P84", [])
        if st.get("mainsnak", {}).get("snaktype") == "value"
    ]
    countries = [
        st["mainsnak"]["datavalue"]["value"]["id"]
        for st in record.get("claims", {}).get("P17", [])
        if st.get("mainsnak", {}).get("snaktype") == "value"
    ]
    for country_qid in countries:
        row = authority.get(country_qid)
        if row:
            return {
                "qid": qid,
                "label_hint_en": label,
                "expected_country_qid": country_qid,
                "expected_country_code": row["iso2"],
                "region": row["region"],
                "has_p84": bool(p84),
                "p84": p84[:6],
            }
    print(f"  ! {qid} ({label}): P17 {countries} has no authority row")
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-work-seeds", type=int, default=400)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    report = json.loads(
        (CELLS / "verification-report.json").read_text(encoding="utf-8")
    )
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    authority = {
        row["country_qid"]: row for row in config["country_region_authority"]
    }
    seeds_doc = json.loads(SEEDS_PATH.read_text(encoding="utf-8"))
    existing_person_seeds = {s["qid"] for s in seeds_doc.get("person_seeds", [])}
    existing_work_seeds = {s["qid"] for s in seeds_doc.get("seeds", [])}

    works = json.loads((DATA / "works.json").read_text(encoding="utf-8"))["works"]
    works_by_qid = {
        (w.get("external_ids") or {}).get("wikidata") for w in works
    }

    new_person_seeds: list[dict] = []
    blocked: list[dict] = []
    work_candidates: dict[str, dict] = {}

    for region, region_report in report["regions"].items():
        for period in PERIODS:
            cell = region_report["cells"][period]
            for miss in cell["missing"]:
                if miss["qid"] in existing_person_seeds:
                    continue
                existing_person_seeds.add(miss["qid"])
                new_person_seeds.append(
                    {
                        "qid": miss["qid"],
                        "label_hint_en": miss["name_en"],
                        "_cell": f"{region}/{period}",
                    }
                )
            for blk in cell["blocked"]:
                blocked.append({**blk, "_cell": f"{region}/{period}"})
            for entry in cell.get("missing_works", []):
                qid = entry.get("qid")
                if (
                    qid
                    and qid not in works_by_qid
                    and qid not in existing_work_seeds
                    and qid not in work_candidates
                ):
                    work_candidates[qid] = {**entry, "_cell": f"{region}/{period}"}

    print(f"new person seeds: {len(new_person_seeds)}")
    print(f"blocked (no Wikidata item): {len(blocked)}")
    print(f"work-seed candidates to resolve: {len(work_candidates)}")

    resolved: list[dict] = []
    items = list(work_candidates.items())
    for index, (qid, entry) in enumerate(items[: args.max_work_seeds], 1):
        row = work_country(qid, authority)
        if row:
            row["_cell"] = entry["_cell"]
            resolved.append(row)
        if index % 25 == 0:
            print(f"  resolved {index}/{min(len(items), args.max_work_seeds)}")
        time.sleep(0.3)

    (CELLS / "work-seed-candidates.json").write_text(
        json.dumps(resolved, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    (CELLS / "blocked.json").write_text(
        json.dumps(blocked, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"work seeds resolved: {len(resolved)} (of {len(items)} candidates)")
    p84_less = [r for r in resolved if not r["has_p84"]]
    print(f"  note: {len(p84_less)} resolved works lack P84 credits")

    if args.dry_run:
        return 0

    for seed in new_person_seeds:
        seed.pop("_cell", None)
    seeds_doc.setdefault("person_seeds", []).extend(new_person_seeds)
    seeds_doc["person_seeds_basis"] = (
        "canon blocked from work-seeding by missing Wikidata P84 anchors, plus "
        "explicitly curated theorists, historians, critics, engineer-builders, "
        "and cell-verification roster intake (region x period canonical "
        "completeness pass, 2026-08)"
    )
    SEEDS_PATH.write_text(
        json.dumps(seeds_doc, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    print(f"seeds file updated: {len(seeds_doc['person_seeds'])} person seeds total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
