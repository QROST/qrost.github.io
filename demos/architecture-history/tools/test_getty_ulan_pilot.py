#!/usr/bin/env python3
"""Offline regression tests for the bounded Wikidata-to-Getty ULAN pilot."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parent.parent
SNAPSHOTS = ROOT / "assets" / "data" / "source-snapshots"


def load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / filename)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


crosswalk = load_module(
    "architecture_history_wikidata_ulan_crosswalk",
    "fetch_wikidata_ulan_crosswalk.py",
)
getty = load_module(
    "architecture_history_getty_ulan_pilot",
    "fetch_getty_ulan_pilot.py",
)
importer = load_module(
    "architecture_history_import_getty_ulan_pilot",
    "import_getty_ulan_pilot.py",
)


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def p245_statement(
    value: str,
    *,
    rank: str = "normal",
    statement_id: str = "Q42$fixture",
    snaktype: str = "value",
    datatype: str = "external-id",
    datavalue_type: str = "string",
) -> dict:
    statement = {
        "id": statement_id,
        "rank": rank,
        "mainsnak": {
            "datatype": datatype,
            "snaktype": snaktype,
        },
    }
    if snaktype == "value":
        statement["mainsnak"]["datavalue"] = {
            "type": datavalue_type,
            "value": value,
        }
    return statement


def linked_art_payload(
    *,
    subject_id: str = "500000129",
    type_name: str = "Group",
    qid: str = "Q320788",
) -> dict:
    canonical = f"http://vocab.getty.edu/ulan/{subject_id}"
    return {
        "@context": "https://linked.art/ns/v1/linked-art.json",
        "id": canonical,
        "type": type_name,
        "_label": "This label must not be retained",
        "equivalent": [
            {"id": f"https://www.wikidata.org/entity/{qid}"},
        ],
        "identified_by": [
            {"type": "Name", "content": "This name must not be retained"}
        ],
        "referred_to_by": [
            {"type": "LinguisticObject", "content": "No description retention"}
        ],
        "member_of": [{"id": "https://example.invalid/relationship"}],
        "https://vocab.getty.edu/ontology#identifies": [
            {"id": "http://vocab.getty.edu/ulan/contrib/42"},
            {"id": "http://vocab.getty.edu/ulan/source/99"},
            {"id": "https://example.invalid/ulan/contrib/42"},
            {"id": "https://example.invalid/ulan/source/99"},
        ],
    }


class WikidataUlanCrosswalkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        paths = sorted(SNAPSHOTS.glob("wikidata-ulan-crosswalk-*.json"))
        if len(paths) != 1:
            raise AssertionError(f"expected one committed ULAN crosswalk, got {paths!r}")
        cls.snapshot = load_json(paths[0])

    def test_real_snapshot_stable_selection_recomputes_exactly(self):
        selection = self.snapshot["selection"]
        recomputed = crosswalk.stable_selection(
            selection["seed"], selection["discovery"]
        )
        self.assertEqual(recomputed, selection["selected"])
        self.assertEqual(
            crosswalk.public_crosswalk_records(recomputed), self.snapshot["records"]
        )
        self.assertEqual(crosswalk.canonical_hash(selection["seed"]), selection["seed_sha256"])
        self.assertEqual(len(recomputed), crosswalk.SELECTION_LIMIT)

    def test_p245_eligibility_rejects_multiple_deprecated_and_invalid_values(self):
        cases = {
            "multiple_current": [
                p245_statement("500000129"),
                p245_statement("500000130", statement_id="Q42$second"),
            ],
            "deprecated_only": [p245_statement("500000129", rank="deprecated")],
            "invalid_value": [p245_statement("not-a-ulan-id")],
        }
        for name, statements in cases.items():
            with self.subTest(name=name):
                normalized = [
                    crosswalk.normalize_statement(statement, index)
                    for index, statement in enumerate(statements)
                ]
                eligible, reasons = crosswalk.eligibility(normalized)
                self.assertIsNone(eligible)
                self.assertTrue(reasons)
        invalid = [crosswalk.normalize_statement(cases["invalid_value"][0], 0)]
        self.assertIn("invalid_ulan_id", crosswalk.eligibility(invalid)[1])


class GettyUlanPilotTests(unittest.TestCase):
    def setUp(self):
        self.row = {
            "entity_id": "practice-wd-q320788",
            "entity_type": "practice",
            "ulan_subject_id": "500000129",
            "wikidata_qid": "Q320788",
        }
        self.representation_url = "https://vocab.getty.edu/ulan/500000129"

    def test_linked_art_projection_keeps_only_identity_and_provenance_uris(self):
        raw = json.dumps(linked_art_payload(), ensure_ascii=False).encode("utf-8")
        projection = getty.project_response(
            self.row, raw, "application/ld+json", self.representation_url
        )
        self.assertEqual(projection["canonical_uri"], "http://vocab.getty.edu/ulan/500000129")
        self.assertEqual(projection["type"], "Group")
        self.assertEqual(projection["equivalent_qids"], ["Q320788"])
        self.assertEqual(projection["contributor_uris"], ["http://vocab.getty.edu/ulan/contrib/42"])
        self.assertEqual(projection["source_uris"], ["http://vocab.getty.edu/ulan/source/99"])
        self.assertEqual(projection["raw_response_sha256"], hashlib.sha256(raw).hexdigest())
        self.assertFalse(projection["raw_retained"])
        forbidden = {"_label", "content", "identified_by", "member_of", "referred_to_by"}
        self.assertFalse(forbidden & set(projection))
        self.assertNotIn("This name", json.dumps(projection, ensure_ascii=False))
        self.assertNotIn("No description", json.dumps(projection, ensure_ascii=False))

    def test_projection_rejects_qid_and_type_mismatches(self):
        qid_mismatch = json.dumps(linked_art_payload(qid="Q42")).encode("utf-8")
        with self.assertRaisesRegex(RuntimeError, "selected QID"):
            getty.project_response(
                self.row, qid_mismatch, "application/ld+json", self.representation_url
            )
        type_mismatch = json.dumps(linked_art_payload(type_name="Person")).encode("utf-8")
        with self.assertRaisesRegex(RuntimeError, "expected exact ULAN type"):
            getty.project_response(
                self.row, type_mismatch, "application/ld+json", self.representation_url
            )

    def test_snapshot_hashes_and_closed_projection_shape_are_recomputable(self):
        path = next(SNAPSHOTS.glob("wikidata-ulan-crosswalk-*.json"))
        crosswalk_snapshot = load_json(path)

        def synthetic_fetch(row: dict) -> dict:
            subject_id = row["ulan_subject_id"]
            return {
                "canonical_uri": f"http://vocab.getty.edu/ulan/{subject_id}",
                "contributor_uris": [f"http://vocab.getty.edu/ulan/contrib/{subject_id}"],
                "content_type": "application/ld+json",
                "entity_id": row["entity_id"],
                "entity_type": row["entity_type"],
                "equivalent_qids": [row["wikidata_qid"]],
                "native_record_id": f"ulan:{subject_id}",
                "raw_response_sha256": "0" * 64,
                "raw_retained": False,
                "representation_url": f"https://vocab.getty.edu/ulan/{subject_id}",
                "retrieved_at": "2026-07-28T00:00:00Z",
                "source_uris": [f"http://vocab.getty.edu/ulan/source/{subject_id}"],
                "subject_id": subject_id,
                "type": "Person" if row["entity_type"] == "person" else "Group",
                "wikidata_qid": row["wikidata_qid"],
            }

        with mock.patch.object(getty, "fetch_one", side_effect=synthetic_fetch):
            snapshot = getty.build_snapshot(copy.deepcopy(crosswalk_snapshot), "2026-07-28")
        self.assertEqual(snapshot["source_id"], "getty-ulan")
        self.assertTrue(snapshot["claim_evidence_allowed"])
        self.assertEqual(snapshot["base_catalog_sha256"], crosswalk_snapshot["base_catalog_sha256"])
        self.assertEqual(len(snapshot["records"]), 24)
        self.assertEqual(list(snapshot["records"]), sorted(snapshot["records"], key=int))
        preimage = dict(snapshot)
        projection_sha256 = preimage.pop("projection_sha256")
        snapshot_id = preimage.pop("snapshot_id")
        self.assertEqual(projection_sha256, getty.canonical_hash(preimage))
        self.assertEqual(snapshot_id, f"getty-ulan-identity-2026-07-28-{projection_sha256[:12]}")
        for entry in snapshot["records"].values():
            self.assertEqual(set(entry), {"projection", "projection_sha256"})
            self.assertEqual(entry["projection_sha256"], getty.canonical_hash(entry["projection"]))

    def test_identity_snapshot_imports_as_candidate_only_overlay(self):
        path = next(SNAPSHOTS.glob("wikidata-ulan-crosswalk-*.json"))
        crosswalk_snapshot = load_json(path)

        def synthetic_fetch(row: dict) -> dict:
            subject_id = row["ulan_subject_id"]
            return {
                "canonical_uri": f"http://vocab.getty.edu/ulan/{subject_id}",
                "contributor_uris": [],
                "content_type": "application/json",
                "entity_id": row["entity_id"],
                "entity_type": row["entity_type"],
                "equivalent_qids": [row["wikidata_qid"]],
                "native_record_id": f"ulan:{subject_id}",
                "raw_response_sha256": "1" * 64,
                "raw_retained": False,
                "representation_url": f"https://vocab.getty.edu/ulan/{subject_id}",
                "retrieved_at": "2026-07-28T00:00:00Z",
                "source_uris": [],
                "subject_id": subject_id,
                "type": "Person" if row["entity_type"] == "person" else "Group",
                "wikidata_qid": row["wikidata_qid"],
            }

        with mock.patch.object(getty, "fetch_one", side_effect=synthetic_fetch):
            snapshot = getty.build_snapshot(
                copy.deepcopy(crosswalk_snapshot),
                "2026-07-28",
            )
        with tempfile.TemporaryDirectory() as temporary:
            snapshot_path = Path(temporary) / "getty.json"
            snapshot_path.write_text(
                json.dumps(snapshot, ensure_ascii=False),
                encoding="utf-8",
            )
            overlay = importer.build_overlay(
                ROOT / "assets" / "data" / "catalog",
                path,
                snapshot_path,
            )
        self.assertEqual(overlay["kind"], "catalog_overlay_v1")
        self.assertRegex(overlay["overlay_id"], r"^getty-ulan-identity-[0-9a-f]{16}$")
        self.assertEqual(len(overlay["entity_patches"]), 24)
        self.assertEqual(len(overlay["claims"]), 24)
        self.assertNotIn("relations", overlay)
        self.assertNotIn("people", overlay)
        self.assertTrue(
            all(
                claim["predicate"] == "field_external_ids"
                and claim["verification_status"] == "candidate"
                and claim["confidence"] == 0.5
                and claim["reviewed_by"] is None
                and claim["reviewed_at"] is None
                and len(claim["evidence"]) == 1
                and claim["evidence"][0]["source_id"] == "getty-ulan"
                for claim in overlay["claims"]
            )
        )
        ulan_ids = [
            patch["add_external_ids"]["ulan"]
            for patch in overlay["entity_patches"]
        ]
        self.assertEqual(ulan_ids, sorted(ulan_ids, key=int))


if __name__ == "__main__":
    unittest.main()
