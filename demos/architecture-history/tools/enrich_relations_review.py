#!/usr/bin/env python3
"""Enrich relation review context with bilingual endpoint names and disclaimers."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from apply_name_zh_seeds import (
    base_catalog_sha256,
    find_crosswalk_path,
    ordered_catalog_payloads,
    rebind_crosswalk,
)
from fetch_wikidata_pilot import atomic_write_json, load_json
from import_wikidata_pilot import student_recorded_review_context


ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "assets" / "data" / "catalog" / "wikidata-hydration.json"
LOG_PATH = ROOT / "tmp" / "enrich-relations-review-log.jsonl"


def append_log(entry: dict) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n")


def enrich_relations(catalog: dict, *, dry_run: bool) -> dict[str, Any]:
    people_by_id = {person["id"]: person for person in catalog["people"]}
    updated = 0
    date_start_set = 0

    for relation in catalog.get("relations", []):
        if relation.get("relation_type") != "student_of_recorded":
            continue
        if relation.get("verification_status") != "candidate":
            continue

        from_person = people_by_id.get(relation["from_id"])
        to_person = people_by_id.get(relation["to_id"])
        if from_person is None or to_person is None:
            append_log(
                {
                    "relation_id": relation["id"],
                    "status": "skipped",
                    "reason": "missing endpoint person",
                }
            )
            continue

        enriched_context = student_recorded_review_context(from_person, to_person)
        context = relation.setdefault("context", {})
        changed = False

        for field, value in enriched_context.items():
            if context.get(field) != value:
                context[field] = value
                changed = True

        if enriched_context.get("date_start") is not None and context.get("date_start"):
            date_start_set += 1

        relation["relation_type"] = "student_of_recorded"
        relation["verification_status"] = "candidate"

        if changed:
            updated += 1
            append_log(
                {
                    "relation_id": relation["id"],
                    "status": "enriched",
                    "from_id": relation["from_id"],
                    "to_id": relation["to_id"],
                    "date_start": context.get("date_start"),
                }
            )

    return {
        "relations_total": len(catalog.get("relations", [])),
        "relations_updated": updated,
        "date_start_set": date_start_set,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--catalog",
        type=Path,
        default=CATALOG_PATH,
        help="Catalog shard to update",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Plan enrichment without writing catalog or crosswalk",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    catalog = load_json(args.catalog.resolve())
    stats = enrich_relations(catalog, dry_run=args.dry_run)
    report = {
        "catalog": str(args.catalog.resolve()),
        "dry_run": args.dry_run,
        **stats,
    }

    if not args.dry_run and stats["relations_updated"] > 0:
        atomic_write_json(args.catalog.resolve(), catalog)
        payloads = ordered_catalog_payloads()
        new_base_hash = base_catalog_sha256(payloads)
        crosswalk_path = find_crosswalk_path()
        old_id, new_id, rebound = rebind_crosswalk(crosswalk_path, new_base_hash)
        report["base_catalog_sha256"] = new_base_hash
        report["crosswalk_rebound"] = rebound
        report["crosswalk_snapshot_id_old"] = old_id
        report["crosswalk_snapshot_id_new"] = new_id

    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
