#!/usr/bin/env python3
"""Unit tests for agentic_review_relation.

Covers the promotion rule (both endpoints verified + structured_mapping
evidence), the skip path (already verified), and the failure paths (endpoint
not verified, non-candidate status, non-promotable type, missing/unreviewable
backing claim). These are pure unit tests on in-memory fixtures; they do not
touch the real catalog shard.
"""

from __future__ import annotations

import copy
import importlib.util
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = Path(__file__).resolve().parent

# Load agentic_review_relation as a sibling module (it imports from
# apply_name_zh_seeds / fetch_wikidata_pilot which live next to it).
spec = importlib.util.spec_from_file_location(
    "agentic_review_relation", TOOLS / "agentic_review_relation.py"
)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
sys.modules["agentic_review_relation"] = module
# apply_name_zh_seeds / fetch_wikidata_pilot are imported by the target module;
# make sure they are importable from the tools dir.
sys.path.insert(0, str(TOOLS))
spec.loader.exec_module(module)

review_relation = module.review_relation
ReviewFailure = module.ReviewFailure
PROMOTED_CONFIDENCE = module.PROMOTED_CONFIDENCE


def _entity(entity_id: str, status: str = "verified", entity_type: str = "person") -> dict:
    return {
        "id": entity_id,
        "entity_type": entity_type,
        "verification_status": status,
        "name_en": entity_id,
    }


def _relation(
    rid: str,
    *,
    from_id: str = "person-wd-q1",
    to_id: str = "person-wd-q2",
    relation_type: str = "student_of_recorded",
    status: str = "candidate",
    claim_id: str = "claim-r1",
) -> dict:
    return {
        "id": rid,
        "from_id": from_id,
        "to_id": to_id,
        "relation_type": relation_type,
        "verification_status": status,
        "confidence": 0.45,
        "claim_id": claim_id,
        "last_verified": "2026-01-01",
        "rejection_reasons": ["Requires human classification and stronger relationship evidence."],
        "context": {"note_en": "raw edge", "note_zh": "原始边"},
    }


def _claim(claim_id: str, *, evidence: list[dict] | None = None) -> dict:
    if evidence is None:
        evidence = [
            {
                "extraction_method": "structured_mapping",
                "support": "explicit",
            }
        ]
    return {
        "id": claim_id,
        "subject_id": "relation-r1",
        "predicate": "student_of_recorded",
        "verification_status": "candidate",
        "confidence": 0.45,
        "evidence": evidence,
        "object": {},
        "qualifiers": {},
    }


class ReviewRelationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.entities = {
            "person-wd-q1": _entity("person-wd-q1"),
            "person-wd-q2": _entity("person-wd-q2"),
            "practice-wd-q3": _entity("practice-wd-q3", entity_type="practice"),
        }
        self.claims = {"claim-r1": _claim("claim-r1")}

    def test_promotes_when_both_endpoints_verified(self) -> None:
        relation = _relation("relation-r1")
        status, confidence = review_relation(
            relation,
            entities_by_id=self.entities,
            claims_by_id=self.claims,
            reviewer_id="reviewer-agentic-cursor",
            reviewed_at="2026-08-09",
        )
        self.assertEqual(status, "verified")
        self.assertEqual(confidence, PROMOTED_CONFIDENCE)
        self.assertEqual(relation["verification_status"], "verified")
        self.assertEqual(relation["confidence"], PROMOTED_CONFIDENCE)
        self.assertEqual(relation["last_verified"], "2026-08-09")
        self.assertEqual(relation["rejection_reasons"], [])
        claim = self.claims["claim-r1"]
        self.assertEqual(claim["verification_status"], "verified")
        self.assertEqual(claim["reviewed_by"], "reviewer-agentic-cursor")
        self.assertEqual(claim["reviewed_at"], "2026-08-09")

    def test_skips_already_verified(self) -> None:
        relation = _relation("relation-r1", status="verified")
        with self.assertRaises(ReviewFailure) as ctx:
            review_relation(
                relation,
                entities_by_id=self.entities,
                claims_by_id=self.claims,
                reviewer_id="reviewer-agentic-cursor",
                reviewed_at="2026-08-09",
            )
        self.assertEqual(ctx.exception.reason, "already verified")

    def test_fails_when_from_endpoint_not_verified(self) -> None:
        self.entities["person-wd-q1"]["verification_status"] = "candidate"
        relation = _relation("relation-r1")
        with self.assertRaises(ReviewFailure) as ctx:
            review_relation(
                relation,
                entities_by_id=self.entities,
                claims_by_id=self.claims,
                reviewer_id="reviewer-agentic-cursor",
                reviewed_at="2026-08-09",
            )
        self.assertIn("from endpoint", ctx.exception.reason)

    def test_fails_when_to_endpoint_missing(self) -> None:
        relation = _relation("relation-r1", to_id="person-wd-q404")
        with self.assertRaises(ReviewFailure) as ctx:
            review_relation(
                relation,
                entities_by_id=self.entities,
                claims_by_id=self.claims,
                reviewer_id="reviewer-agentic-cursor",
                reviewed_at="2026-08-09",
            )
        self.assertIn("to endpoint", ctx.exception.reason)

    def test_fails_when_backing_claim_missing(self) -> None:
        relation = _relation("relation-r1", claim_id="claim-missing")
        with self.assertRaises(ReviewFailure) as ctx:
            review_relation(
                relation,
                entities_by_id=self.entities,
                claims_by_id=self.claims,
                reviewer_id="reviewer-agentic-cursor",
                reviewed_at="2026-08-09",
            )
        self.assertIn("backing claim", ctx.exception.reason)

    def test_fails_when_evidence_not_reviewable(self) -> None:
        self.claims["claim-r1"]["evidence"] = [
            {"extraction_method": "inferred", "support": "explicit"}
        ]
        relation = _relation("relation-r1")
        with self.assertRaises(ReviewFailure) as ctx:
            review_relation(
                relation,
                entities_by_id=self.entities,
                claims_by_id=self.claims,
                reviewer_id="reviewer-agentic-cursor",
                reviewed_at="2026-08-09",
            )
        self.assertEqual(ctx.exception.reason, "backing claim evidence is not reviewable")

    def test_fails_when_evidence_empty(self) -> None:
        self.claims["claim-r1"]["evidence"] = []
        relation = _relation("relation-r1")
        with self.assertRaises(ReviewFailure) as ctx:
            review_relation(
                relation,
                entities_by_id=self.entities,
                claims_by_id=self.claims,
                reviewer_id="reviewer-agentic-cursor",
                reviewed_at="2026-08-09",
            )
        self.assertEqual(ctx.exception.reason, "backing claim evidence is not reviewable")

    def test_promotes_all_four_relation_types(self) -> None:
        for rtype in (
            "student_of_recorded",
            "documented_influence",
            "worked_at_practice",
            "cofounded_with",
        ):
            relation = _relation(
                f"relation-{rtype}",
                to_id="practice-wd-q3" if rtype in {"worked_at_practice", "cofounded_with"} else "person-wd-q2",
                relation_type=rtype,
                claim_id=f"claim-{rtype}",
            )
            self.claims[f"claim-{rtype}"] = _claim(f"claim-{rtype}")
            status, _ = review_relation(
                relation,
                entities_by_id=self.entities,
                claims_by_id=self.claims,
                reviewer_id="reviewer-agentic-cursor",
                reviewed_at="2026-08-09",
            )
            self.assertEqual(status, "verified", msg=f"failed for {rtype}")

    def test_idempotent_second_run_skips(self) -> None:
        relation = _relation("relation-r1")
        review_relation(
            relation,
            entities_by_id=self.entities,
            claims_by_id=self.claims,
            reviewer_id="reviewer-agentic-cursor",
            reviewed_at="2026-08-09",
        )
        # second call must raise "already verified", not re-promote
        with self.assertRaises(ReviewFailure) as ctx:
            review_relation(
                relation,
                entities_by_id=self.entities,
                claims_by_id=self.claims,
                reviewer_id="reviewer-agentic-cursor",
                reviewed_at="2026-08-09",
            )
        self.assertEqual(ctx.exception.reason, "already verified")


if __name__ == "__main__":
    unittest.main(verbosity=2)
