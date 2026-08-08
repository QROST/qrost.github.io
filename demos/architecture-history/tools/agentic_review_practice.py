#!/usr/bin/env python3
"""Agentic reviewer: verify practice entities with pinned Wikidata field claims.

Adds missing field_* claims backed by structured_mapping evidence from the
hydration snapshot, then promotes the practice and every meaningful field claim
to verified under an active agentic reviewer. Skips or fails practices that
cannot be fully verified without inventing facts.
"""

from __future__ import annotations

import argparse
import copy
import json
from datetime import date
from pathlib import Path
from typing import Any, Optional

from apply_name_zh_seeds import (
    base_catalog_sha256,
    find_crosswalk_path,
    load_hydration_snapshot,
    ordered_catalog_payloads,
    rebind_crosswalk,
)
from fetch_wikidata_pilot import atomic_write_json, load_json, qid_number
from import_wikidata_pilot import (
    ARCHITECTURE_FIRM_QID,
    CONFIG_PATH,
    CatalogBuilder,
    aliases,
    descriptions,
    item_values,
    load_type_authority_snapshots,
    qid_slug,
    time_value,
)
from validate import meaningful_fact


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
CATALOG_PATH = DATA / "catalog" / "wikidata-hydration.json"
REVIEWERS_PATH = DATA / "reviewers.json"
LOG_PATH = ROOT / "tmp" / "agentic-practice-review-log.jsonl"

ADMINISTRATIVE_FIELDS = {
    "id",
    "entity_type",
    "verification_status",
    "confidence",
    "last_verified",
    "claim_ids",
    "credits",
    "unresolved_credits",
}

FIELD_CLAIM_SUFFIX = {
    "country_codes": "country-codes",
    "dissolved": "dissolved",
    "external_ids": "external-ids",
    "founded": "founded",
    "name_en": "name-en",
    "name_zh": "name-zh",
    "practice_type": "practice-type",
    "region": "region",
    "summary_en": "summary-en",
    "summary_zh": "summary-zh",
}


class ReviewFailure(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def claim_id_for_field(qid: str, field: str) -> str:
    suffix = FIELD_CLAIM_SUFFIX[field]
    return f"claim-wd-{qid_slug(qid)}-{suffix}"


def clone_evidence(template: dict, *, locator: str, path: str, predicate: str | None) -> dict:
    evidence = copy.deepcopy(template)
    evidence["locator"] = locator
    evidence["native_field_path"] = path
    evidence["native_predicate"] = predicate
    return evidence


def reviewable_evidence(evidence: list[dict]) -> bool:
    return bool(evidence) and all(
        row.get("extraction_method") == "structured_mapping"
        for row in evidence
    )


def meaningful_practice_fields(practice: dict) -> dict[str, Any]:
    return {
        field: value
        for field, value in practice.items()
        if field not in ADMINISTRATIVE_FIELDS and meaningful_fact(value)
    }


def headquarters_geography(
    record: dict,
    country_authority: dict[str, dict],
) -> tuple[list[str], str]:
    """Map P17 country statements onto the project authority table."""
    codes: list[str] = []
    regions: list[str] = []
    for country_qid in item_values(record, "P17"):
        authority = country_authority.get(country_qid)
        if authority is None:
            continue
        iso2 = authority["iso2"]
        if iso2 not in codes:
            codes.append(iso2)
        region = authority["region"]
        if region not in regions:
            regions.append(region)
    codes.sort()
    if not regions:
        return codes, "unknown"
    if len(regions) == 1:
        return codes, regions[0]
    return codes, "transregional"


def country_statement_rows(
    record: dict,
    country_authority: dict[str, dict],
) -> list[tuple[int, dict, dict]]:
    rows: list[tuple[int, dict, dict]] = []
    for index, statement in enumerate(record.get("claims", {}).get("P17", [])):
        if statement.get("rank") == "deprecated":
            continue
        snak = statement.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        value = snak.get("datavalue", {}).get("value")
        if not isinstance(value, dict) or not isinstance(value.get("id"), str):
            continue
        authority = country_authority.get(value["id"])
        if authority is None:
            continue
        rows.append((index, statement, authority))
    return rows


def matching_time_statement(
    record: dict,
    property_id: str,
    expected: dict,
) -> Optional[tuple[int, dict]]:
    if time_value(record, property_id) != expected:
        return None
    for index, statement in enumerate(record.get("claims", {}).get(property_id, [])):
        if statement.get("rank") == "deprecated":
            continue
        one_off = {"claims": {property_id: [statement]}}
        if time_value(one_off, property_id) == expected:
            return index, statement
    return None


def architecture_firm_statement(record: dict) -> Optional[tuple[int, dict]]:
    for index, statement in enumerate(record.get("claims", {}).get("P31", [])):
        if statement.get("rank") == "deprecated":
            continue
        snak = statement.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        value = snak.get("datavalue", {}).get("value")
        if isinstance(value, dict) and value.get("id") == ARCHITECTURE_FIRM_QID:
            return index, statement
    return None


def build_field_plan(
    builder: CatalogBuilder,
    practice: dict,
    record: dict,
) -> dict[str, dict[str, Any]]:
    qid = practice["external_ids"]["wikidata"]
    plan: dict[str, dict[str, Any]] = {}
    country_authority = builder.country_authority

    if practice.get("practice_type") == "architecture_firm":
        matched = architecture_firm_statement(record)
        if matched is None:
            raise ReviewFailure(
                "practice_type is architecture_firm but P31 architecture-firm QID is absent"
            )

    for field in meaningful_practice_fields(practice):
        if field in {"name_en", "name_zh"}:
            continue
        claim_id = claim_id_for_field(qid, field)
        if field == "practice_type":
            if practice[field] != "architecture_firm":
                raise ReviewFailure(
                    f"practice_type {practice[field]!r} cannot be verified from P31 alone"
                )
            matched = architecture_firm_statement(record)
            if matched is None:
                raise ReviewFailure(
                    "practice_type claim architecture_firm but P31 statement is absent"
                )
            index, statement = matched
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_practice_type",
                "value": practice[field],
                "evidence": [
                    builder.evidence(
                        qid,
                        path=f"/claims/P31/{index}",
                        predicate="P31",
                        locator=f"{qid}/P31/{statement.get('id', index)}",
                        statement=statement,
                    )
                ],
            }
        elif field == "country_codes":
            rows = country_statement_rows(record, country_authority)
            mapped_codes = sorted({authority["iso2"] for _, _, authority in rows})
            if mapped_codes != practice[field]:
                raise ReviewFailure(
                    f"country_codes {practice[field]!r} do not match pinned P17 authority mapping"
                )
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_country_codes",
                "value": practice[field],
                "evidence": [
                    builder.evidence(
                        qid,
                        path=f"/claims/P17/{index}",
                        predicate="P17",
                        locator=f"{qid}/P17/{statement.get('id', index)}",
                        statement=statement,
                    )
                    for index, statement, authority in rows
                    if authority["iso2"] in practice[field]
                ],
            }
        elif field == "region":
            mapped_codes, mapped_region = headquarters_geography(record, country_authority)
            if mapped_region != practice[field]:
                raise ReviewFailure(
                    f"region {practice[field]!r} does not match project mapping from P17"
                )
            if meaningful_fact(practice.get("country_codes")) and mapped_codes != practice["country_codes"]:
                raise ReviewFailure("region/country_codes disagree with P17 authority mapping")
            rows = country_statement_rows(record, country_authority)
            if not rows:
                raise ReviewFailure("region is meaningful but pinned P17 country is absent")
            index, statement, _authority = rows[0]
            country_evidence = builder.evidence(
                qid,
                path=f"/claims/P17/{index}",
                predicate="P17",
                locator=f"{qid}/P17/{statement.get('id', index)}",
                statement=statement,
            )
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_region",
                "value": practice[field],
                "evidence": [
                    clone_evidence(
                        country_evidence,
                        locator=f"{qid}/project_region/{practice[field]}",
                        path=country_evidence["native_field_path"],
                        predicate=country_evidence["native_predicate"],
                    )
                ],
            }
        elif field == "external_ids":
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_external_ids",
                "value": practice[field],
                "evidence": [
                    builder.evidence(
                        qid,
                        path="/id",
                        predicate=None,
                        locator=f"{qid}/id",
                        language="en",
                    )
                ],
            }
        elif field == "summary_en":
            if descriptions(record)[0] != practice[field]:
                raise ReviewFailure("summary_en does not match pinned en description")
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_summary_en",
                "value": practice[field],
                "evidence": [
                    builder.evidence(
                        qid,
                        path="/descriptions/en",
                        predicate=None,
                        locator=f"{qid}/descriptions/en",
                        language="en",
                    )
                ],
            }
        elif field == "summary_zh":
            _summary_en, summary_zh = descriptions(record)
            if summary_zh != practice[field]:
                raise ReviewFailure("summary_zh does not match pinned zh description")
            zh_language = "zh-hans" if record.get("descriptions", {}).get("zh-hans") else "zh"
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_summary_zh",
                "value": practice[field],
                "evidence": [
                    builder.evidence(
                        qid,
                        path=f"/descriptions/{zh_language}",
                        predicate=None,
                        locator=f"{qid}/descriptions/{zh_language}",
                        language=zh_language,
                    )
                ],
            }
        elif field in {"founded", "dissolved"}:
            property_id = "P571" if field == "founded" else "P576"
            matched = matching_time_statement(record, property_id, practice[field])
            if matched is None:
                raise ReviewFailure(
                    f"{field}: pinned snapshot lacks a matching {property_id} statement"
                )
            index, statement = matched
            plan[field] = {
                "claim_id": claim_id,
                "predicate": f"field_{field}",
                "value": practice[field],
                "evidence": [
                    builder.evidence(
                        qid,
                        path=f"/claims/{property_id}/{index}",
                        predicate=property_id,
                        locator=f"{qid}/{property_id}/{statement.get('id', index)}",
                        statement=statement,
                    )
                ],
            }
        else:
            raise ReviewFailure(f"unsupported meaningful practice field {field!r}")

    for field in ("name_en", "name_zh"):
        if field not in meaningful_practice_fields(practice):
            continue
        claim_id = claim_id_for_field(qid, field)
        plan[field] = {
            "claim_id": claim_id,
            "predicate": f"field_{field}",
            "value": practice[field],
            "evidence": None,
        }

    return plan


def ensure_claim(
    claims_by_id: dict[str, dict],
    *,
    claim_id: str,
    subject_id: str,
    predicate: str,
    value: Any,
    evidence: list[dict],
    confidence: float,
) -> tuple[dict, bool]:
    existing = claims_by_id.get(claim_id)
    if existing is not None:
        if existing["subject_id"] != subject_id:
            raise ReviewFailure(f"{claim_id}: subject mismatch")
        if existing["predicate"] != predicate:
            raise ReviewFailure(f"{claim_id}: predicate mismatch")
        if existing["object"].get("value") != value:
            raise ReviewFailure(f"{claim_id}: object value mismatch")
        if not reviewable_evidence(existing.get("evidence", [])):
            raise ReviewFailure(f"{claim_id}: existing evidence is not structured_mapping")
        return existing, False
    claim = {
        "confidence": confidence,
        "evidence": evidence,
        "id": claim_id,
        "object": {"value": value},
        "predicate": predicate,
        "qualifiers": {},
        "reviewed_at": None,
        "reviewed_by": None,
        "subject_id": subject_id,
        "verification_status": "candidate",
    }
    claims_by_id[claim_id] = claim
    return claim, True


def review_practice(
    practice: dict,
    *,
    builder: CatalogBuilder,
    claims_by_id: dict[str, dict],
    reviewer_id: str,
    reviewed_at: str,
) -> tuple[str, int]:
    if practice["verification_status"] == "verified":
        raise ReviewFailure("already verified")

    qid = practice["external_ids"]["wikidata"]
    wrapper = builder.entities.get(qid)
    if wrapper is None:
        raise ReviewFailure(f"snapshot lacks entity {qid}")
    record = wrapper["record"]

    plan = build_field_plan(builder, practice, record)
    claims_added = 0
    claim_ids: list[str] = []

    for field, spec in plan.items():
        claim_id = spec["claim_id"]
        if spec["evidence"] is None:
            existing = claims_by_id.get(claim_id)
            if existing is None:
                raise ReviewFailure(f"missing required existing claim {claim_id}")
            if existing["object"].get("value") != spec["value"]:
                raise ReviewFailure(f"{claim_id}: value mismatch for {field}")
            if not reviewable_evidence(existing.get("evidence", [])):
                raise ReviewFailure(f"{claim_id}: evidence is not structured_mapping")
            claim = existing
        else:
            claim, created = ensure_claim(
                claims_by_id,
                claim_id=claim_id,
                subject_id=practice["id"],
                predicate=spec["predicate"],
                value=spec["value"],
                evidence=spec["evidence"],
                confidence=practice["confidence"],
            )
            if created:
                claims_added += 1
        claim_ids.append(claim["id"])

    practice["claim_ids"] = sorted(set(practice["claim_ids"]) | set(claim_ids))
    practice["verification_status"] = "verified"
    practice["last_verified"] = reviewed_at

    for claim_id in practice["claim_ids"]:
        claim = claims_by_id[claim_id]
        predicate = claim["predicate"]
        if not predicate.startswith("field_"):
            continue
        field = predicate.removeprefix("field_")
        if field not in meaningful_practice_fields(practice):
            continue
        if claim["object"].get("value") != practice.get(field):
            raise ReviewFailure(f"{claim_id}: verified field value drift for {field}")
        claim["verification_status"] = "verified"
        claim["reviewed_by"] = reviewer_id
        claim["reviewed_at"] = reviewed_at

    return "verified", claims_added


def select_practices(
    catalog: dict,
    *,
    entity_id: str | None,
    limit: int | None,
) -> list[dict]:
    practices_by_id = {row["id"]: row for row in catalog["practices"]}
    if entity_id is not None:
        practice = practices_by_id.get(entity_id)
        if practice is None:
            raise SystemExit(f"unknown practice entity_id: {entity_id!r}")
        return [practice]
    if limit is None:
        raise SystemExit("provide --entity-id or --limit")
    candidates = [
        practice
        for practice in catalog["practices"]
        if practice.get("verification_status") == "candidate"
    ]
    candidates.sort(
        key=lambda row: (
            0 if row.get("name_zh") is not None else 1,
            qid_number(row["external_ids"]["wikidata"]),
        )
    )
    return candidates[:limit]


def append_log(entry: dict) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--entity-id", help="Single practice entity id to review")
    target.add_argument("--limit", type=int, help="Review next N candidate practices")
    parser.add_argument(
        "--reviewer-id",
        default="reviewer-agentic-cursor",
        help="Active human or agentic reviewer id from reviewers.json",
    )
    parser.add_argument(
        "--reviewed-at",
        default=date.today().isoformat(),
        help="Review date YYYY-MM-DD",
    )
    parser.add_argument(
        "--catalog",
        type=Path,
        default=CATALOG_PATH,
        help="Catalog shard to update",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Plan and log reviews without writing catalog or crosswalk",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be >= 1")

    reviewers = load_json(REVIEWERS_PATH)
    active = {
        row["id"]: row
        for row in reviewers.get("reviewers", [])
        if row.get("active") is True and row.get("reviewer_type") in {"human", "agentic"}
    }
    if args.reviewer_id not in active:
        raise SystemExit(
            f"reviewer {args.reviewer_id!r} missing or inactive in {REVIEWERS_PATH}"
        )

    catalog = load_json(args.catalog.resolve())
    snapshot = load_hydration_snapshot(catalog["generated_from"])
    config = load_json(CONFIG_PATH)
    authority_snapshots = load_type_authority_snapshots(config)
    builder = CatalogBuilder(snapshot, config, authority_snapshots)

    practices = select_practices(catalog, entity_id=args.entity_id, limit=args.limit)
    claims_by_id = {claim["id"]: claim for claim in catalog["claims"]}

    results: list[dict[str, Any]] = []
    summary = {
        "catalog": str(args.catalog.resolve()),
        "reviewer_id": args.reviewer_id,
        "reviewed_at": args.reviewed_at,
        "dry_run": args.dry_run,
        "selected": len(practices),
        "verified": 0,
        "skipped": 0,
        "failed": 0,
        "claims_added": 0,
        "results": results,
    }

    for practice in practices:
        qid = practice["external_ids"]["wikidata"]
        base_entry = {
            "entity_id": practice["id"],
            "qid": qid,
            "name_en": practice["name_en"],
            "reviewed_at": args.reviewed_at,
            "reviewer_id": args.reviewer_id,
        }
        try:
            status, claims_added = review_practice(
                practice,
                builder=builder,
                claims_by_id=claims_by_id,
                reviewer_id=args.reviewer_id,
                reviewed_at=args.reviewed_at,
            )
            entry = {
                **base_entry,
                "status": status,
                "reason": None,
                "claims_added": claims_added,
            }
            summary["verified"] += 1
            summary["claims_added"] += claims_added
        except ReviewFailure as exc:
            entry = {
                **base_entry,
                "status": "skipped" if exc.reason == "already verified" else "failed",
                "reason": exc.reason,
                "claims_added": 0,
            }
            if exc.reason == "already verified":
                summary["skipped"] += 1
            else:
                summary["failed"] += 1
        results.append(entry)
        append_log(entry)

    if not args.dry_run and summary["verified"] > 0:
        catalog["claims"] = sorted(claims_by_id.values(), key=lambda row: row["id"])
        atomic_write_json(args.catalog.resolve(), catalog)

        payloads = ordered_catalog_payloads()
        new_base_hash = base_catalog_sha256(payloads)
        crosswalk_path = find_crosswalk_path()
        old_id, new_id, rebound = rebind_crosswalk(crosswalk_path, new_base_hash)
        summary["base_catalog_sha256"] = new_base_hash
        summary["crosswalk_rebound"] = rebound
        summary["crosswalk_snapshot_id_old"] = old_id
        summary["crosswalk_snapshot_id_new"] = new_id

    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
