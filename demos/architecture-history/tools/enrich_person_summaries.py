#!/usr/bin/env python3
"""Fill empty person summary_zh/summary_en from pinned Wikidata descriptions."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Any

from apply_name_zh_seeds import (
    base_catalog_sha256,
    find_crosswalk_path,
    load_hydration_snapshot,
    ordered_catalog_payloads,
    rebind_crosswalk,
)
from fetch_wikidata_pilot import atomic_write_json, load_json
from import_wikidata_pilot import (
    CONFIG_PATH,
    CatalogBuilder,
    descriptions,
    load_type_authority_snapshots,
    qid_slug,
)


ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "assets" / "data" / "catalog" / "wikidata-hydration.json"
LOG_PATH = ROOT / "tmp" / "enrich-person-summaries-log.jsonl"
REVIEWER_ID = "reviewer-agentic-cursor"


def claim_id_for_summary(qid: str, field: str) -> str:
    suffix = "summary-zh" if field == "summary_zh" else "summary-en"
    return f"claim-wd-{qid_slug(qid)}-{suffix}"


def empty_summary(value: Any) -> bool:
    return value is None or value == ""


def append_log(entry: dict) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n")


def enrich_summaries(
    catalog: dict,
    *,
    builder: CatalogBuilder,
    reviewed_at: str,
    dry_run: bool,
) -> dict[str, Any]:
    claims_by_id = {claim["id"]: claim for claim in catalog["claims"]}
    summary_zh_filled = 0
    summary_en_filled = 0
    claims_added = 0
    claims_promoted = 0

    for person in catalog["people"]:
        if person.get("verification_status") not in {"candidate", "verified"}:
            continue
        qid = person["external_ids"]["wikidata"]
        wrapper = builder.entities.get(qid)
        if wrapper is None:
            append_log(
                {
                    "entity_id": person["id"],
                    "qid": qid,
                    "status": "skipped",
                    "reason": "snapshot lacks entity",
                }
            )
            continue

        record = wrapper["record"]
        snapshot_summary_en, snapshot_summary_zh = descriptions(record)
        person_verified = person.get("verification_status") == "verified"
        changes: list[str] = []

        for field, snapshot_text, language in (
            ("summary_zh", snapshot_summary_zh, None),
            ("summary_en", snapshot_summary_en, "en"),
        ):
            if not empty_summary(person.get(field)):
                continue
            if empty_summary(snapshot_text):
                continue

            if field == "summary_zh":
                zh_language = (
                    "zh-hans" if record.get("descriptions", {}).get("zh-hans") else "zh"
                )
                evidence = [
                    builder.evidence(
                        qid,
                        path=f"/descriptions/{zh_language}",
                        predicate=None,
                        locator=f"{qid}/descriptions/{zh_language}",
                        language=zh_language,
                    )
                ]
            else:
                evidence = [
                    builder.evidence(
                        qid,
                        path="/descriptions/en",
                        predicate=None,
                        locator=f"{qid}/descriptions/en",
                        language="en",
                    )
                ]

            claim_id = claim_id_for_summary(qid, field)
            predicate = f"field_{field}"
            existing = claims_by_id.get(claim_id)
            if existing is None:
                claim = {
                    "confidence": person["confidence"],
                    "evidence": evidence,
                    "id": claim_id,
                    "object": {"value": snapshot_text},
                    "predicate": predicate,
                    "qualifiers": {},
                    "reviewed_at": reviewed_at if person_verified else None,
                    "reviewed_by": REVIEWER_ID if person_verified else None,
                    "subject_id": person["id"],
                    "verification_status": (
                        "verified" if person_verified else "candidate"
                    ),
                }
                claims_by_id[claim_id] = claim
                claims_added += 1
            else:
                claim = existing
                if claim["object"].get("value") != snapshot_text:
                    append_log(
                        {
                            "entity_id": person["id"],
                            "qid": qid,
                            "status": "skipped",
                            "reason": f"{claim_id} value mismatch",
                            "field": field,
                        }
                    )
                    continue
                if person_verified and claim.get("verification_status") != "verified":
                    claim["verification_status"] = "verified"
                    claim["reviewed_by"] = REVIEWER_ID
                    claim["reviewed_at"] = reviewed_at
                    claims_promoted += 1

            person[field] = snapshot_text
            if claim_id not in person.get("claim_ids", []):
                person.setdefault("claim_ids", []).append(claim_id)
            changes.append(field)
            if field == "summary_zh":
                summary_zh_filled += 1
            else:
                summary_en_filled += 1

        if changes:
            append_log(
                {
                    "entity_id": person["id"],
                    "qid": qid,
                    "status": "enriched",
                    "fields": changes,
                    "verification_status": person["verification_status"],
                }
            )

    if not dry_run:
        catalog["claims"] = sorted(claims_by_id.values(), key=lambda row: row["id"])
        for person in catalog["people"]:
            person["claim_ids"] = sorted(set(person.get("claim_ids", [])))

    return {
        "summary_zh_filled": summary_zh_filled,
        "summary_en_filled": summary_en_filled,
        "claims_added": claims_added,
        "claims_promoted": claims_promoted,
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
        "--reviewed-at",
        default=date.today().isoformat(),
        help="Review date for promoted claims on verified people",
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
    snapshot = load_hydration_snapshot(catalog["generated_from"])
    config = load_json(CONFIG_PATH)
    authority_snapshots = load_type_authority_snapshots(config)
    builder = CatalogBuilder(snapshot, config, authority_snapshots)

    stats = enrich_summaries(
        catalog,
        builder=builder,
        reviewed_at=args.reviewed_at,
        dry_run=args.dry_run,
    )

    report = {
        "catalog": str(args.catalog.resolve()),
        "dry_run": args.dry_run,
        **stats,
    }

    if not args.dry_run and (
        stats["summary_zh_filled"] > 0
        or stats["summary_en_filled"] > 0
        or stats["claims_promoted"] > 0
    ):
        atomic_write_json(args.catalog.resolve(), catalog)
        payloads = ordered_catalog_payloads()
        new_base_hash = base_catalog_sha256(payloads)
        crosswalk_path = find_crosswalk_path()
        old_id, new_id, rebound = rebind_crosswalk(crosswalk_path, new_base_hash)
        report["base_catalog_sha256"] = new_base_hash
        report["crosswalk_rebound"] = rebound
        report["crosswalk_snapshot_id_old"] = old_id
        report["crosswalk_snapshot_id_new"] = new_id

    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
