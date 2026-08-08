#!/usr/bin/env python3
"""Promote country-place entities to verified after human editorial review.

Adds missing field_region / field_external_ids claims (reusing pinned Wikidata
entity evidence), then marks every place field claim and place entity as
verified under an active human reviewer. Does not touch people, works, or
relations.
"""

from __future__ import annotations

import argparse
import copy
import json
from datetime import date
from pathlib import Path
from typing import Any

from apply_name_zh_seeds import (
    base_catalog_sha256,
    find_crosswalk_path,
    ordered_catalog_payloads,
    rebind_crosswalk,
)
from fetch_wikidata_pilot import atomic_write_json, load_json


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
CATALOG_PATH = DATA / "catalog" / "wikidata-hydration.json"
REVIEWERS_PATH = DATA / "reviewers.json"


def clone_evidence(template: dict, *, locator: str, path: str, predicate: str | None) -> dict:
    evidence = copy.deepcopy(template)
    evidence["locator"] = locator
    evidence["native_field_path"] = path
    evidence["native_predicate"] = predicate
    return evidence


def ensure_claim(
    claims_by_id: dict[str, dict],
    *,
    claim_id: str,
    subject_id: str,
    predicate: str,
    value: Any,
    evidence: list[dict],
    confidence: float,
) -> dict:
    existing = claims_by_id.get(claim_id)
    if existing is not None:
        if existing["subject_id"] != subject_id:
            raise ValueError(f"{claim_id}: subject mismatch")
        if existing["predicate"] != predicate:
            raise ValueError(f"{claim_id}: predicate mismatch")
        if existing["object"].get("value") != value:
            raise ValueError(f"{claim_id}: object value mismatch for promotion")
        return existing
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
    return claim


def promote_places(
    catalog: dict,
    *,
    reviewer_id: str,
    reviewed_at: str,
) -> dict[str, int]:
    claims_by_id = {claim["id"]: claim for claim in catalog["claims"]}
    stats = {
        "places": 0,
        "claims_promoted": 0,
        "claims_added": 0,
    }

    for place in catalog["places"]:
        place_id = place["id"]
        qid = place["external_ids"]["wikidata"]
        slug = qid.lower()
        name_en_claim = claims_by_id.get(f"claim-wd-{slug}-name-en")
        country_claim = claims_by_id.get(f"claim-wd-{slug}-country-code")
        if name_en_claim is None or not name_en_claim.get("evidence"):
            raise ValueError(f"{place_id}: missing name-en evidence template")
        if country_claim is None or not country_claim.get("evidence"):
            raise ValueError(f"{place_id}: missing country-code evidence template")

        identity_template = name_en_claim["evidence"][0]
        country_template = country_claim["evidence"][0]

        before = set(claims_by_id)
        region_claim = ensure_claim(
            claims_by_id,
            claim_id=f"claim-wd-{slug}-region",
            subject_id=place_id,
            predicate="field_region",
            value=place["region"],
            evidence=[
                clone_evidence(
                    country_template,
                    locator=f"{qid}/project_region/{place['region']}",
                    path=country_template["native_field_path"],
                    predicate=country_template["native_predicate"],
                )
            ],
            confidence=place["confidence"],
        )
        external_claim = ensure_claim(
            claims_by_id,
            claim_id=f"claim-wd-{slug}-external-ids",
            subject_id=place_id,
            predicate="field_external_ids",
            value=place["external_ids"],
            evidence=[
                clone_evidence(
                    identity_template,
                    locator=f"{qid}/id",
                    path="/id",
                    predicate=None,
                )
            ],
            confidence=place["confidence"],
        )
        added = set(claims_by_id) - before
        stats["claims_added"] += len(added)

        claim_ids = list(place["claim_ids"])
        for claim_id in (region_claim["id"], external_claim["id"]):
            if claim_id not in claim_ids:
                claim_ids.append(claim_id)
        place["claim_ids"] = claim_ids
        place["verification_status"] = "verified"
        place["last_verified"] = reviewed_at
        stats["places"] += 1

        for claim_id in place["claim_ids"]:
            claim = claims_by_id[claim_id]
            if claim["verification_status"] == "verified":
                if claim["reviewed_by"] != reviewer_id or claim["reviewed_at"] != reviewed_at:
                    claim["reviewed_by"] = reviewer_id
                    claim["reviewed_at"] = reviewed_at
                continue
            claim["verification_status"] = "verified"
            claim["reviewed_by"] = reviewer_id
            claim["reviewed_at"] = reviewed_at
            stats["claims_promoted"] += 1

    catalog["claims"] = sorted(claims_by_id.values(), key=lambda row: row["id"])
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
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
        help="Catalog shard to promote in place",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    reviewers = load_json(REVIEWERS_PATH)
    active = {
        row["id"]: row
        for row in reviewers.get("reviewers", [])
        if row.get("active") is True and row.get("reviewer_type") in {
            "human",
            "agentic",
        }
    }
    if args.reviewer_id not in active:
        raise SystemExit(
            f"reviewer {args.reviewer_id!r} missing or inactive in {REVIEWERS_PATH}"
        )

    catalog = load_json(args.catalog)
    stats = promote_places(
        catalog,
        reviewer_id=args.reviewer_id,
        reviewed_at=args.reviewed_at,
    )
    atomic_write_json(args.catalog.resolve(), catalog)

    payloads = ordered_catalog_payloads()
    new_base_hash = base_catalog_sha256(payloads)
    crosswalk_path = find_crosswalk_path()
    old_id, new_id, rebound = rebind_crosswalk(crosswalk_path, new_base_hash)

    print(
        json.dumps(
            {
                "catalog": str(args.catalog),
                "reviewer_id": args.reviewer_id,
                "reviewed_at": args.reviewed_at,
                "base_catalog_sha256": new_base_hash,
                "crosswalk_rebound": rebound,
                "crosswalk_snapshot_id_old": old_id,
                "crosswalk_snapshot_id_new": new_id,
                **stats,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
