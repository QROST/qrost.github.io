#!/usr/bin/env python3
"""Agentic reviewer: verify no-credit work entities with pinned Wikidata field claims.

Reviews candidate works that have empty credits and empty unresolved_credits,
adding missing field_* claims backed by structured_mapping evidence from the
hydration snapshot, then promotes the work and every meaningful field claim to
verified under an active agentic reviewer.
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
    CONFIG_PATH,
    CatalogBuilder,
    aliases,
    derive_period_from_inception,
    entity_id,
    item_values,
    load_type_authority_snapshots,
    qid_slug,
)
from validate import meaningful_fact


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
CATALOG_PATH = DATA / "catalog" / "wikidata-hydration.json"
REVIEWERS_PATH = DATA / "reviewers.json"
LOG_PATH = ROOT / "tmp" / "agentic-work-review-log.jsonl"

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

REQUIRED_WORK_FIELDS = (
    "attribution_mode",
    "credit_set_completeness",
    "status",
    "work_type_mapping_status",
)

FIELD_CLAIM_SUFFIX = {
    "aliases_en": "aliases-en",
    "aliases_zh": "aliases-zh",
    "attribution_mode": "attribution-mode",
    "coordinates": "coordinates",
    "credit_set_completeness": "credit-set-completeness",
    "dates": "dates",
    "external_ids": "external-ids",
    "name_en": "name-en",
    "name_zh": "name-zh",
    "period": "period",
    "place_id": "place-id",
    "region": "region",
    "status": "status",
    "work_type": "work-type",
    "work_type_mapping_status": "work-type-mapping-status",
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


def meaningful_work_fields(work: dict) -> dict[str, Any]:
    fields: dict[str, Any] = {}
    for field, value in work.items():
        if field in ADMINISTRATIVE_FIELDS:
            continue
        if field in REQUIRED_WORK_FIELDS:
            fields[field] = value
            continue
        if field == "coordinates":
            if meaningful_fact(value):
                fields[field] = value
            continue
        if meaningful_fact(value):
            fields[field] = value
    return fields


def existing_field_claim(
    claims_by_id: dict[str, dict],
    work: dict,
    predicate: str,
) -> Optional[dict]:
    for claim_id in work["claim_ids"]:
        claim = claims_by_id.get(claim_id)
        if claim is not None and claim["predicate"] == predicate:
            return claim
    return None


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


def no_credit_evidence(builder: CatalogBuilder, qid: str, *, locator_suffix: str) -> list[dict]:
    return [
        builder.evidence(
            qid,
            path="/id",
            predicate=None,
            locator=f"{qid}/project_{locator_suffix}",
            language="en",
        )
    ]


def build_field_plan(
    builder: CatalogBuilder,
    work: dict,
    record: dict,
    seed: dict,
    claims_by_id: dict[str, dict],
) -> dict[str, dict[str, Any]]:
    qid = work["external_ids"]["wikidata"]
    plan: dict[str, dict[str, Any]] = {}
    country_authority = builder.country_authority

    expected_place_id = entity_id("place", seed["expected_country_qid"])
    if work.get("place_id") != expected_place_id:
        raise ReviewFailure(
            f"place_id {work.get('place_id')!r} does not match hydration seed country"
        )
    if work.get("region") != seed["region"]:
        raise ReviewFailure(
            f"region {work.get('region')!r} does not match hydration seed region"
        )

    derived_work_type, derived_mapping_status, type_statement = builder.mapped_work_type(qid)
    if work["work_type_mapping_status"] != derived_mapping_status:
        raise ReviewFailure("work_type_mapping_status does not match pinned P31 mapping")
    if work["work_type"] != derived_work_type:
        raise ReviewFailure("work_type does not match pinned P31 mapping")
    if derived_mapping_status == "mapped_exact" and type_statement is None:
        raise ReviewFailure("mapped_exact work lacks a pinned P31 type statement")

    if work["work_type_mapping_status"] == "mapped_exact":
        if work["work_type"] == "unknown":
            raise ReviewFailure("mapped_exact work cannot keep work_type unknown")

    if work["period"] != "unknown":
        derived_period = derive_period_from_inception(record, builder.config)
        if derived_period is None or derived_period["period"] != work["period"]:
            raise ReviewFailure("period does not match pinned inception/opening derivation")

    coordinates = work["coordinates"]
    if meaningful_fact(coordinates):
        coordinate = builder.coordinate_value(qid)
        if coordinate is None:
            raise ReviewFailure("coordinates are set but pinned P625 is absent or ambiguous")
        _index, _statement, latitude, longitude, precision = coordinate
        if (
            coordinates["lat"] != latitude
            or coordinates["lng"] != longitude
            or coordinates.get("precision") != precision
        ):
            raise ReviewFailure("coordinates do not match pinned P625 statement")

    for field in meaningful_work_fields(work):
        if field in {"name_en", "name_zh"}:
            continue
        claim_id = claim_id_for_field(qid, field)
        if field == "aliases_en":
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_aliases_en",
                "value": work[field],
                "evidence": [
                    builder.evidence(
                        qid,
                        path="/aliases/en",
                        predicate=None,
                        locator=f"{qid}/aliases/en",
                        language="en",
                    )
                ],
            }
        elif field == "aliases_zh":
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_aliases_zh",
                "value": work[field],
                "evidence": [
                    builder.evidence(
                        qid,
                        path="/aliases/zh-hans"
                        if record.get("aliases", {}).get("zh-hans")
                        else "/aliases/zh",
                        predicate=None,
                        locator=f"{qid}/aliases/zh",
                        language="zh",
                    )
                ],
            }
        elif field == "external_ids":
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_external_ids",
                "value": work[field],
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
        elif field == "region":
            rows = country_statement_rows(record, country_authority)
            if not rows:
                raise ReviewFailure("region is meaningful but pinned P17 country is absent")
            index, statement, authority = next(
                (row for row in rows if row[2]["region"] == work["region"]),
                rows[0],
            )
            if authority["region"] != work["region"]:
                raise ReviewFailure("region does not match pinned P17 authority mapping")
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
                "value": work[field],
                "evidence": [
                    clone_evidence(
                        country_evidence,
                        locator=f"{qid}/project_region/{work[field]}",
                        path=country_evidence["native_field_path"],
                        predicate=country_evidence["native_predicate"],
                    )
                ],
            }
        elif field == "place_id":
            rows = country_statement_rows(record, country_authority)
            matching = [
                row
                for row in rows
                if entity_id("place", row[2]["country_qid"]) == work["place_id"]
            ]
            if not matching:
                raise ReviewFailure("place_id does not match any pinned P17 country place")
            index, statement, authority = matching[0]
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_place_id",
                "value": work[field],
                "evidence": [
                    builder.evidence(
                        qid,
                        path=f"/claims/P17/{index}",
                        predicate="P17",
                        locator=(
                            f"{qid}/place/{authority['country_qid']}/"
                            f"{statement.get('id', index)}"
                        ),
                        statement=statement,
                    )
                ],
            }
        elif field == "attribution_mode":
            if work["credits"] or work["unresolved_credits"]:
                raise ReviewFailure("attribution_mode review requires empty credit queues")
            if work[field] not in {"traditional_or_anonymous", "unknown"}:
                raise ReviewFailure(
                    f"unsupported no-credit attribution_mode {work[field]!r}"
                )
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_attribution_mode",
                "value": work[field],
                "evidence": no_credit_evidence(
                    builder,
                    qid,
                    locator_suffix=f"attribution_mode/{work[field]}",
                ),
            }
        elif field == "credit_set_completeness":
            if work["credits"] or work["unresolved_credits"]:
                raise ReviewFailure(
                    "credit_set_completeness review requires empty credit queues"
                )
            if work[field] != "unknown":
                raise ReviewFailure(
                    f"no-credit path only supports credit_set_completeness unknown, got {work[field]!r}"
                )
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_credit_set_completeness",
                "value": work[field],
                "evidence": no_credit_evidence(
                    builder,
                    qid,
                    locator_suffix="credit_set_completeness/unknown",
                ),
            }
        elif field == "status":
            if work[field] != "unknown":
                raise ReviewFailure(f"unsupported work status for agentic verification: {work[field]!r}")
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_status",
                "value": work[field],
                "evidence": no_credit_evidence(
                    builder,
                    qid,
                    locator_suffix=f"status/{work[field]}",
                ),
            }
        elif field == "work_type_mapping_status":
            if type_statement is not None:
                index, statement, class_qid = type_statement
                evidence = [
                    builder.evidence(
                        qid,
                        path=f"/claims/P31/{index}",
                        predicate="P31",
                        locator=f"{qid}/P31/{statement.get('id', index)}",
                        statement=statement,
                    )
                ]
            else:
                evidence = no_credit_evidence(
                    builder,
                    qid,
                    locator_suffix=f"work_type_mapping_status/{work[field]}",
                )
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_work_type_mapping_status",
                "value": work[field],
                "evidence": evidence,
            }
        elif field == "work_type":
            if work["work_type_mapping_status"] != "mapped_exact":
                raise ReviewFailure("work_type claim requires mapped_exact status")
            existing = existing_field_claim(claims_by_id, work, "field_work_type")
            if existing is None:
                raise ReviewFailure("mapped_exact work lacks an existing field_work_type claim")
            if existing["object"].get("value") != work[field]:
                raise ReviewFailure("existing field_work_type value mismatch")
            if not reviewable_evidence(existing.get("evidence", [])):
                raise ReviewFailure("existing field_work_type evidence is not structured_mapping")
            plan[field] = {
                "claim_id": existing["id"],
                "predicate": "field_work_type",
                "value": work[field],
                "evidence": None,
            }
        elif field == "period":
            if work["period"] == "unknown":
                raise ReviewFailure("period field requested but work period is unknown")
            existing = existing_field_claim(claims_by_id, work, "field_period")
            if existing is None:
                raise ReviewFailure("known period work lacks an existing field_period claim")
            if existing["object"].get("value") != work[field]:
                raise ReviewFailure("existing field_period value mismatch")
            if not reviewable_evidence(existing.get("evidence", [])):
                raise ReviewFailure("existing field_period evidence is not structured_mapping")
            if not any(row.get("support") == "explicit" for row in existing.get("evidence", [])):
                raise ReviewFailure(
                    "known period currently rests on indirect inception/opening evidence; "
                    "cannot promote to verified under explicit-evidence rules"
                )
            plan[field] = {
                "claim_id": existing["id"],
                "predicate": "field_period",
                "value": work[field],
                "evidence": None,
            }
        elif field == "dates":
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_dates",
                "value": work[field],
                "evidence": no_credit_evidence(
                    builder,
                    qid,
                    locator_suffix="dates",
                ),
            }
        elif field == "coordinates":
            existing = existing_field_claim(claims_by_id, work, "field_coordinates")
            if existing is not None:
                if existing["object"].get("value") != work[field]:
                    raise ReviewFailure("existing field_coordinates value mismatch")
                if not reviewable_evidence(existing.get("evidence", [])):
                    raise ReviewFailure(
                        "existing field_coordinates evidence is not structured_mapping"
                    )
                plan[field] = {
                    "claim_id": existing["id"],
                    "predicate": "field_coordinates",
                    "value": work[field],
                    "evidence": None,
                }
                continue
            coordinate = builder.coordinate_value(qid)
            if coordinate is None:
                raise ReviewFailure("coordinates are meaningful but pinned P625 is absent")
            index, statement, _latitude, _longitude, _precision = coordinate
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_coordinates",
                "value": work[field],
                "evidence": [
                    builder.evidence(
                        qid,
                        path=f"/claims/P625/{index}",
                        predicate="P625",
                        locator=f"{qid}/P625/{statement.get('id', index)}",
                        statement=statement,
                    )
                ],
            }
        else:
            raise ReviewFailure(f"unsupported meaningful work field {field!r}")

    for field in ("name_en", "name_zh"):
        if field not in meaningful_work_fields(work):
            continue
        claim_id = claim_id_for_field(qid, field)
        plan[field] = {
            "claim_id": claim_id,
            "predicate": f"field_{field}",
            "value": work[field],
            "evidence": None,
        }

    snapshot_aliases_en = aliases(record, ("en",))
    snapshot_aliases_zh = aliases(record, ("zh-hans", "zh"))
    if work.get("aliases_en") != snapshot_aliases_en:
        raise ReviewFailure("aliases_en do not match pinned snapshot aliases")
    if work.get("aliases_zh") != snapshot_aliases_zh:
        raise ReviewFailure("aliases_zh do not match pinned snapshot aliases")

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
    qualifiers: Optional[dict] = None,
) -> tuple[dict, bool]:
    existing = claims_by_id.get(claim_id)
    if existing is not None:
        if existing["subject_id"] != subject_id:
            raise ReviewFailure(f"{claim_id}: subject mismatch")
        if existing["predicate"] != predicate:
            raise ReviewFailure(f"{claim_id}: predicate mismatch")
        if existing["object"].get("value") != value:
            raise ReviewFailure(f"{claim_id}: object value mismatch")
        if qualifiers is not None and existing.get("qualifiers", {}) != qualifiers:
            raise ReviewFailure(f"{claim_id}: qualifiers mismatch")
        if evidence and not reviewable_evidence(existing.get("evidence", [])):
            raise ReviewFailure(f"{claim_id}: existing evidence is not structured_mapping")
        return existing, False
    claim = {
        "confidence": confidence,
        "evidence": evidence,
        "id": claim_id,
        "object": {"value": value},
        "predicate": predicate,
        "qualifiers": qualifiers or {},
        "reviewed_at": None,
        "reviewed_by": None,
        "subject_id": subject_id,
        "verification_status": "candidate",
    }
    claims_by_id[claim_id] = claim
    return claim, True


def review_work(
    work: dict,
    *,
    builder: CatalogBuilder,
    claims_by_id: dict[str, dict],
    places_by_id: dict[str, dict],
    reviewer_id: str,
    reviewed_at: str,
) -> tuple[str, int]:
    if work["verification_status"] == "verified":
        raise ReviewFailure("already verified")
    if work["credits"] or work["unresolved_credits"]:
        raise ReviewFailure("work has credits or unresolved_credits")
    if not work.get("place_id"):
        raise ReviewFailure("place_id is missing")
    place = places_by_id.get(work["place_id"])
    if place is None:
        raise ReviewFailure(f"unknown place {work['place_id']!r}")
    if place["verification_status"] != "verified":
        raise ReviewFailure(f"place {work['place_id']} is not verified")

    qid = work["external_ids"]["wikidata"]
    seed = builder.seed_by_qid.get(qid)
    if seed is None:
        raise ReviewFailure(f"snapshot lacks hydration seed for {qid}")

    wrapper = builder.entities.get(qid)
    if wrapper is None:
        raise ReviewFailure(f"snapshot lacks entity {qid}")
    record = wrapper["record"]

    plan = build_field_plan(builder, work, record, seed, claims_by_id)
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
                subject_id=work["id"],
                predicate=spec["predicate"],
                value=spec["value"],
                evidence=spec["evidence"],
                confidence=work["confidence"],
            )
            if created:
                claims_added += 1
        claim_ids.append(claim["id"])

    work["claim_ids"] = sorted(set(work["claim_ids"]) | set(claim_ids))
    work["verification_status"] = "verified"
    work["last_verified"] = reviewed_at

    for claim_id in work["claim_ids"]:
        claim = claims_by_id[claim_id]
        predicate = claim["predicate"]
        if not predicate.startswith("field_"):
            continue
        field = predicate.removeprefix("field_")
        if field not in meaningful_work_fields(work):
            continue
        if claim["object"].get("value") != work.get(field):
            raise ReviewFailure(f"{claim_id}: verified field value drift for {field}")
        claim["verification_status"] = "verified"
        claim["reviewed_by"] = reviewer_id
        claim["reviewed_at"] = reviewed_at

    return "verified", claims_added


def select_works(
    catalog: dict,
    places_by_id: dict[str, dict],
    *,
    entity_id: str | None,
    limit: int | None,
) -> list[dict]:
    works_by_id = {row["id"]: row for row in catalog["works"]}
    if entity_id is not None:
        work = works_by_id.get(entity_id)
        if work is None:
            raise SystemExit(f"unknown work entity_id: {entity_id!r}")
        return [work]
    if limit is None:
        raise SystemExit("provide --entity-id or --limit")
    candidates = [
        work
        for work in catalog["works"]
        if work.get("verification_status") == "candidate"
        and work.get("period") == "unknown"
        and not work.get("credits")
        and not work.get("unresolved_credits")
        and work.get("place_id")
        and places_by_id.get(work["place_id"], {}).get("verification_status")
        == "verified"
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
    target.add_argument("--entity-id", help="Single work entity id to review")
    target.add_argument("--limit", type=int, help="Review next N no-credit candidate works")
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
    places_by_id = {place["id"]: place for place in catalog["places"]}

    works = select_works(
        catalog,
        places_by_id,
        entity_id=args.entity_id,
        limit=args.limit,
    )
    claims_by_id = {claim["id"]: claim for claim in catalog["claims"]}

    results: list[dict[str, Any]] = []
    summary = {
        "catalog": str(args.catalog.resolve()),
        "reviewer_id": args.reviewer_id,
        "reviewed_at": args.reviewed_at,
        "dry_run": args.dry_run,
        "selected": len(works),
        "verified": 0,
        "skipped": 0,
        "failed": 0,
        "claims_added": 0,
        "results": results,
    }

    for work in works:
        qid = work["external_ids"]["wikidata"]
        base_entry = {
            "entity_id": work["id"],
            "qid": qid,
            "name_en": work["name_en"],
            "reviewed_at": args.reviewed_at,
            "reviewer_id": args.reviewer_id,
        }
        try:
            status, claims_added = review_work(
                work,
                builder=builder,
                claims_by_id=claims_by_id,
                places_by_id=places_by_id,
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
