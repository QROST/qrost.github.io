#!/usr/bin/env python3
"""Agentic reviewer: verify person entities with pinned Wikidata field claims.

Adds missing field_* claims backed by structured_mapping evidence from the
hydration snapshot, then promotes the person and every meaningful field claim
to verified under an active agentic reviewer. Skips or fails people that
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
    ARCHITECT_QID,
    CONFIG_PATH,
    CatalogBuilder,
    aliases,
    descriptions,
    label_value,
    load_name_zh_seeds,
    load_type_authority_snapshots,
    nationality_geography,
    qid_slug,
    time_value,
)
from validate import meaningful_fact


LANDSCAPE_ARCHITECT_QID = "Q2374149"
SCULPTOR_QID = "Q1281618"
EDUCATOR_QID = "Q2566598"
ROLE_OCCUPATION_QIDS = {
    "architect": ARCHITECT_QID,
    "landscape_architect": LANDSCAPE_ARCHITECT_QID,
    "craftsperson": SCULPTOR_QID,
    "educator": EDUCATOR_QID,
}


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
CATALOG_PATH = DATA / "catalog" / "wikidata-hydration.json"
REVIEWERS_PATH = DATA / "reviewers.json"
LOG_PATH = ROOT / "tmp" / "agentic-review-log.jsonl"

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
    "aliases_en": "aliases-en",
    "aliases_zh": "aliases-zh",
    "birth": "birth",
    "death": "death",
    "roles": "roles",
    "country_codes": "country-codes",
    "region": "region",
    "external_ids": "external-ids",
    "summary_en": "summary-en",
    "summary_zh": "summary-zh",
    "name_zh_status": "name-zh-status",
    "name_en": "name-en",
    "name_zh": "name-zh",
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


def meaningful_person_fields(person: dict) -> dict[str, Any]:
    return {
        field: value
        for field, value in person.items()
        if field not in ADMINISTRATIVE_FIELDS and meaningful_fact(value)
    }


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


def occupation_statement(record: dict, occupation_qid: str) -> Optional[tuple[int, dict]]:
    for index, statement in enumerate(record.get("claims", {}).get("P106", [])):
        if statement.get("rank") == "deprecated":
            continue
        snak = statement.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        value = snak.get("datavalue", {}).get("value")
        if isinstance(value, dict) and value.get("id") == occupation_qid:
            return index, statement
    return None


def architect_statement(record: dict) -> Optional[tuple[int, dict]]:
    return occupation_statement(record, ARCHITECT_QID)


def citizenship_statement_rows(
    record: dict,
    country_authority: dict[str, dict],
) -> list[tuple[int, dict, dict]]:
    rows: list[tuple[int, dict, dict]] = []
    for index, statement in enumerate(record.get("claims", {}).get("P27", [])):
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


def name_zh_status_evidence(
    builder: CatalogBuilder,
    qid: str,
    record: dict,
    person: dict,
    name_zh_seeds: dict[str, dict],
) -> list[dict]:
    status = person["name_zh_status"]
    seed = name_zh_seeds.get(qid)
    if seed is not None and seed.get("name_zh_status") == status:
        return [builder.langlink_name_zh_evidence(qid, seed)]
    if status == "source_label_candidate":
        zh_language = "zh-hans" if label_value(record, "zh-hans") else "zh"
        if not label_value(record, zh_language):
            raise ReviewFailure(
                f"name_zh_status is source_label_candidate but {zh_language} label is absent"
            )
        return [
            builder.evidence(
                qid,
                path=f"/labels/{zh_language}",
                predicate=None,
                locator=f"{qid}/labels/{zh_language}",
                language=zh_language,
            )
        ]
    if status == "missing":
        if label_value(record, "zh-hans") or label_value(record, "zh"):
            raise ReviewFailure("name_zh_status is missing but a zh label is present")
        return [
            builder.evidence(
                qid,
                path="/labels/zh",
                predicate=None,
                locator=f"{qid}/project_name_zh_status/missing",
                language="zh",
            )
        ]
    raise ReviewFailure(f"unsupported name_zh_status for agentic verification: {status!r}")


def build_field_plan(
    builder: CatalogBuilder,
    person: dict,
    record: dict,
    name_zh_seeds: dict[str, dict],
) -> dict[str, dict[str, Any]]:
    qid = person["external_ids"]["wikidata"]
    plan: dict[str, dict[str, Any]] = {}
    country_authority = builder.country_authority

    for field in meaningful_person_fields(person):
        if field in {"name_en", "name_zh"}:
            continue
        claim_id = claim_id_for_field(qid, field)
        if field == "aliases_en":
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_aliases_en",
                "value": person[field],
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
                "value": person[field],
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
        elif field in {"birth", "death"}:
            property_id = "P569" if field == "birth" else "P570"
            matched = matching_time_statement(record, property_id, person[field])
            if matched is None:
                raise ReviewFailure(
                    f"{field}: pinned snapshot lacks a matching {property_id} statement"
                )
            index, statement = matched
            plan[field] = {
                "claim_id": claim_id,
                "predicate": f"field_{field}",
                "value": person[field],
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
        elif field == "roles":
            roles = person["roles"]
            if len(roles) != 1 or roles[0] not in ROLE_OCCUPATION_QIDS:
                raise ReviewFailure(
                    f"roles {roles!r} cannot be verified from a single mapped P106 occupation"
                )
            role = roles[0]
            occupation_qid = ROLE_OCCUPATION_QIDS[role]
            matched = occupation_statement(record, occupation_qid)
            if matched is None:
                raise ReviewFailure(
                    f"roles claim {role!r} but P106 occupation {occupation_qid} is absent"
                )
            index, statement = matched
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_roles",
                "value": person[field],
                "evidence": [
                    builder.evidence(
                        qid,
                        path=f"/claims/P106/{index}",
                        predicate="P106",
                        locator=f"{qid}/P106/{statement.get('id', index)}",
                        statement=statement,
                    )
                ],
            }
        elif field == "country_codes":
            rows = citizenship_statement_rows(record, country_authority)
            mapped_codes = sorted(
                {
                    authority["iso2"]
                    for _, _, authority in rows
                }
            )
            if mapped_codes != person[field]:
                raise ReviewFailure(
                    f"country_codes {person[field]!r} do not match pinned P27 authority mapping"
                )
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_country_codes",
                "value": person[field],
                "evidence": [
                    builder.evidence(
                        qid,
                        path=f"/claims/P27/{index}",
                        predicate="P27",
                        locator=f"{qid}/P27/{statement.get('id', index)}",
                        statement=statement,
                    )
                    for index, statement, authority in rows
                    if authority["iso2"] in person[field]
                ],
            }
        elif field == "region":
            mapped_codes, mapped_region = nationality_geography(record, country_authority)
            if mapped_region != person[field]:
                raise ReviewFailure(
                    f"region {person[field]!r} does not match project mapping from P27"
                )
            if meaningful_fact(person.get("country_codes")) and mapped_codes != person["country_codes"]:
                raise ReviewFailure("region/country_codes disagree with P27 authority mapping")
            rows = citizenship_statement_rows(record, country_authority)
            if not rows:
                raise ReviewFailure("region is meaningful but pinned P27 citizenship is absent")
            index, statement, _authority = rows[0]
            country_evidence = builder.evidence(
                qid,
                path=f"/claims/P27/{index}",
                predicate="P27",
                locator=f"{qid}/P27/{statement.get('id', index)}",
                statement=statement,
            )
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_region",
                "value": person[field],
                "evidence": [
                    clone_evidence(
                        country_evidence,
                        locator=f"{qid}/project_region/{person[field]}",
                        path=country_evidence["native_field_path"],
                        predicate=country_evidence["native_predicate"],
                    )
                ],
            }
        elif field == "external_ids":
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_external_ids",
                "value": person[field],
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
            if descriptions(record)[0] != person[field]:
                raise ReviewFailure("summary_en does not match pinned en description")
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_summary_en",
                "value": person[field],
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
            if summary_zh != person[field]:
                raise ReviewFailure("summary_zh does not match pinned zh description")
            zh_language = "zh-hans" if record.get("descriptions", {}).get("zh-hans") else "zh"
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_summary_zh",
                "value": person[field],
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
        elif field == "name_zh_status":
            plan[field] = {
                "claim_id": claim_id,
                "predicate": "field_name_zh_status",
                "value": person[field],
                "evidence": name_zh_status_evidence(
                    builder,
                    qid,
                    record,
                    person,
                    name_zh_seeds,
                ),
            }
        else:
            raise ReviewFailure(f"unsupported meaningful person field {field!r}")

    for field in ("name_en", "name_zh"):
        if field not in meaningful_person_fields(person):
            continue
        claim_id = claim_id_for_field(qid, field)
        plan[field] = {
            "claim_id": claim_id,
            "predicate": f"field_{field}",
            "value": person[field],
            "evidence": None,
        }

    snapshot_aliases_en = aliases(record, ("en",))
    snapshot_aliases_zh = aliases(record, ("zh-hans", "zh"))
    if person.get("aliases_en") != snapshot_aliases_en:
        raise ReviewFailure("aliases_en do not match pinned snapshot aliases")
    if person.get("aliases_zh") != snapshot_aliases_zh:
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


def review_person(
    person: dict,
    *,
    builder: CatalogBuilder,
    claims_by_id: dict[str, dict],
    name_zh_seeds: dict[str, dict],
    reviewer_id: str,
    reviewed_at: str,
) -> tuple[str, int]:
    if person["verification_status"] == "verified":
        raise ReviewFailure("already verified")

    qid = person["external_ids"]["wikidata"]
    wrapper = builder.entities.get(qid)
    if wrapper is None:
        raise ReviewFailure(f"snapshot lacks entity {qid}")
    record = wrapper["record"]

    plan = build_field_plan(builder, person, record, name_zh_seeds)
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
                subject_id=person["id"],
                predicate=spec["predicate"],
                value=spec["value"],
                evidence=spec["evidence"],
                confidence=person["confidence"],
            )
            if created:
                claims_added += 1
        claim_ids.append(claim["id"])

    person["claim_ids"] = sorted(set(person["claim_ids"]) | set(claim_ids))
    person["verification_status"] = "verified"
    person["last_verified"] = reviewed_at

    for claim_id in person["claim_ids"]:
        claim = claims_by_id[claim_id]
        predicate = claim["predicate"]
        if not predicate.startswith("field_"):
            continue
        field = predicate.removeprefix("field_")
        if field not in meaningful_person_fields(person):
            continue
        if claim["object"].get("value") != person.get(field):
            raise ReviewFailure(f"{claim_id}: verified field value drift for {field}")
        claim["verification_status"] = "verified"
        claim["reviewed_by"] = reviewer_id
        claim["reviewed_at"] = reviewed_at

    return "verified", claims_added


def select_people(catalog: dict, *, entity_id: str | None, limit: int | None) -> list[dict]:
    people_by_id = {person["id"]: person for person in catalog["people"]}
    if entity_id is not None:
        person = people_by_id.get(entity_id)
        if person is None:
            raise SystemExit(f"unknown person entity_id: {entity_id!r}")
        return [person]
    if limit is None:
        raise SystemExit("provide --entity-id or --limit")
    candidates = [
        person
        for person in catalog["people"]
        if person.get("verification_status") == "candidate"
        and person.get("name_zh") is not None
    ]
    candidates.sort(key=lambda row: qid_number(row["external_ids"]["wikidata"]))
    return candidates[:limit]


def append_log(entry: dict) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--entity-id", help="Single person entity id to review")
    target.add_argument("--limit", type=int, help="Review next N candidate people with name_zh")
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
    name_zh_seeds = load_name_zh_seeds()

    people = select_people(catalog, entity_id=args.entity_id, limit=args.limit)
    claims_by_id = {claim["id"]: claim for claim in catalog["claims"]}

    results: list[dict[str, Any]] = []
    summary = {
        "catalog": str(args.catalog.resolve()),
        "reviewer_id": args.reviewer_id,
        "reviewed_at": args.reviewed_at,
        "dry_run": args.dry_run,
        "selected": len(people),
        "verified": 0,
        "skipped": 0,
        "failed": 0,
        "claims_added": 0,
        "results": results,
    }

    for person in people:
        qid = person["external_ids"]["wikidata"]
        base_entry = {
            "entity_id": person["id"],
            "qid": qid,
            "name_en": person["name_en"],
            "reviewed_at": args.reviewed_at,
            "reviewer_id": args.reviewer_id,
        }
        if args.limit is not None and person.get("name_zh") is None:
            entry = {
                **base_entry,
                "status": "skipped",
                "reason": "name_zh is null",
                "claims_added": 0,
            }
            results.append(entry)
            summary["skipped"] += 1
            append_log(entry)
            continue
        try:
            status, claims_added = review_person(
                person,
                builder=builder,
                claims_by_id=claims_by_id,
                name_zh_seeds=name_zh_seeds,
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
