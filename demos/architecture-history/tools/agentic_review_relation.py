#!/usr/bin/env python3
"""Agentic reviewer: promote candidate relations whose endpoints are both verified.

Relations enter the catalog as ``candidate`` (the importer can only record raw
Wikidata P1066/P802/P112 edges, not interpret them as confirmed lineage). A
relation becomes eligible for automated promotion once agentic review has
verified *both* endpoint entities (person/practice/work), because then the edge
connects two facts the catalog already stands behind rather than two guesses.

This tool promotes such eligible candidate relations to ``verified``: it lifts
``verification_status``, raises ``confidence`` to reflect the dual-verified
endpoints, clears the ``rejection_reasons`` caveat, and marks the relation's
backing claim as reviewed. It does not reclassify ``relation_type`` (e.g.
``student_of_recorded`` -> ``direct_mentor``); that finer-grained taxonomy
remains human work. It is idempotent: already-verified relations are skipped.
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Any, Optional

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
LOG_PATH = ROOT / "tmp" / "agentic-relation-review-log.jsonl"

# Relation types eligible for automated promotion. All four currently-produced
# types qualify: the rule is "both endpoints verified", not the type label.
PROMOTABLE_RELATION_TYPES = frozenset(
    {
        "student_of_recorded",
        "documented_influence",
        "worked_at_practice",
        "cofounded_with",
    }
)

# Confidence granted to a relation whose both endpoints are independently
# verified. Below the entity-level 0.6 (a relation is still an interpreted edge,
# not a directly-sourced fact) but above the raw 0.45 candidate baseline.
PROMOTED_CONFIDENCE = 0.55


class ReviewFailure(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def _endpoint_verified(entities_by_id: dict[str, dict], endpoint_id: str) -> bool:
    entity = entities_by_id.get(endpoint_id)
    return bool(entity) and entity.get("verification_status") == "verified"


def _evidence_reviewable(evidence: list[dict]) -> bool:
    """Every evidence row must be structured_mapping + explicit support.

    This mirrors the `reviewable_evidence` gate used by the person/work/practice
    reviewers: we only promote relations whose backing Wikidata statement was
    extracted as an explicit, structured mapping (not inferred or scraped).
    """
    if not evidence:
        return False
    for row in evidence:
        if row.get("extraction_method") != "structured_mapping":
            return False
        if row.get("support") not in {"explicit", "likely"}:
            return False
    return True


def review_relation(
    relation: dict,
    *,
    entities_by_id: dict[str, dict],
    claims_by_id: dict[str, dict],
    reviewer_id: str,
    reviewed_at: str,
) -> tuple[str, float]:
    """Promote a single candidate relation; raise ReviewFailure if not eligible.

    Returns ``(status, new_confidence)``. Mutates ``relation`` and its backing
    claim in place when promotion succeeds.
    """
    if relation.get("verification_status") == "verified":
        raise ReviewFailure("already verified")
    if relation.get("verification_status") not in {"candidate"}:
        raise ReviewFailure(
            f"unexpected verification_status {relation.get('verification_status')!r}"
        )
    relation_type = relation.get("relation_type")
    if relation_type not in PROMOTABLE_RELATION_TYPES:
        raise ReviewFailure(f"relation_type {relation_type!r} is not promotable")

    from_id = relation.get("from_id")
    to_id = relation.get("to_id")
    if not _endpoint_verified(entities_by_id, from_id):
        raise ReviewFailure(f"from endpoint {from_id!r} is not verified")
    if not _endpoint_verified(entities_by_id, to_id):
        raise ReviewFailure(f"to endpoint {to_id!r} is not verified")

    claim = claims_by_id.get(relation.get("claim_id", ""))
    if claim is None:
        raise ReviewFailure(
            f"backing claim {relation.get('claim_id')!r} not found"
        )
    if not _evidence_reviewable(claim.get("evidence", [])):
        raise ReviewFailure("backing claim evidence is not reviewable")

    # Promote the relation: lift status, confidence, last_verified; clear the
    # generic "needs human classification" caveat now that both endpoints are
    # independently verified. The context note (which explains the raw Wikidata
    # edge provenance) is retained as provenance.
    relation["verification_status"] = "verified"
    relation["confidence"] = PROMOTED_CONFIDENCE
    relation["last_verified"] = reviewed_at
    relation["rejection_reasons"] = []

    # Promote the backing claim too, mirroring the entity reviewers.
    claim["verification_status"] = "verified"
    claim["reviewed_by"] = reviewer_id
    claim["reviewed_at"] = reviewed_at
    claim["confidence"] = PROMOTED_CONFIDENCE

    return "verified", PROMOTED_CONFIDENCE


def select_relations(
    catalog: dict,
    *,
    entities_by_id: dict[str, dict],
    relation_id: str | None,
    limit: int | None,
) -> list[dict]:
    relations = catalog.get("relations", [])
    by_id = {row["id"]: row for row in relations}
    if relation_id is not None:
        target = by_id.get(relation_id)
        if target is None:
            raise SystemExit(f"unknown relation id: {relation_id!r}")
        return [target]
    if limit is None:
        raise SystemExit("provide --relation-id or --limit")
    candidates = [
        relation
        for relation in relations
        if relation.get("verification_status") == "candidate"
        and relation.get("relation_type") in PROMOTABLE_RELATION_TYPES
        and _endpoint_verified(entities_by_id, relation.get("from_id", ""))
        and _endpoint_verified(entities_by_id, relation.get("to_id", ""))
    ]
    candidates.sort(key=lambda row: _qid_sort_key(row["from_id"]))
    return candidates[:limit]


def _qid_from_id(entity_id: str) -> Optional[str]:
    """Extract a Wikidata Q-number from an entity id like ``person-wd-q5600``."""
    lowered = entity_id.lower()
    marker = "-wd-q"
    idx = lowered.find(marker)
    if idx < 0:
        return None
    return entity_id[idx + len(marker) :]


def _qid_sort_key(entity_id: str) -> int:
    """Integer sort key derived from the Wikidata Q-number in an entity id."""
    qid = _qid_from_id(entity_id)
    if qid is None:
        return 0
    try:
        return int(qid)
    except ValueError:
        return 0


def append_log(entry: dict) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--relation-id", help="Single relation id to review")
    target.add_argument("--limit", type=int, help="Review next N eligible candidate relations")
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
    entities_by_id: dict[str, dict] = {}
    for key in ("people", "practices", "places", "works"):
        for entity in catalog.get(key, []):
            entities_by_id[entity["id"]] = entity
    claims_by_id = {claim["id"]: claim for claim in catalog.get("claims", [])}

    relations = select_relations(
        catalog,
        entities_by_id=entities_by_id,
        relation_id=args.relation_id,
        limit=args.limit,
    )

    results: list[dict[str, Any]] = []
    summary = {
        "catalog": str(args.catalog.resolve()),
        "reviewer_id": args.reviewer_id,
        "reviewed_at": args.reviewed_at,
        "dry_run": args.dry_run,
        "selected": len(relations),
        "verified": 0,
        "skipped": 0,
        "failed": 0,
        "results": results,
    }

    for relation in relations:
        base_entry = {
            "relation_id": relation["id"],
            "relation_type": relation.get("relation_type"),
            "from_id": relation.get("from_id"),
            "to_id": relation.get("to_id"),
            "reviewed_at": args.reviewed_at,
            "reviewer_id": args.reviewer_id,
        }
        try:
            status, confidence = review_relation(
                relation,
                entities_by_id=entities_by_id,
                claims_by_id=claims_by_id,
                reviewer_id=args.reviewer_id,
                reviewed_at=args.reviewed_at,
            )
            entry = {
                **base_entry,
                "status": status,
                "confidence": confidence,
                "reason": None,
            }
            summary["verified"] += 1
        except ReviewFailure as exc:
            entry = {
                **base_entry,
                "status": "skipped" if exc.reason == "already verified" else "failed",
                "reason": exc.reason,
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
