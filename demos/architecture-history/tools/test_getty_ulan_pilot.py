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
validator = load_module(
    "architecture_history_validate_getty_ulan_pilot",
    "validate.py",
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


def synthetic_projection(row: dict, *, qids: list[str] | None = None) -> dict:
    subject_id = row["ulan_subject_id"]
    if qids is None:
        qids = [row["wikidata_qid"]]
    return {
        "canonical_uri": f"http://vocab.getty.edu/ulan/{subject_id}",
        "contributor_uris": [f"http://vocab.getty.edu/ulan/contrib/{subject_id}"],
        "content_type": "application/ld+json",
        "entity_id": row["entity_id"],
        "entity_type": row["entity_type"],
        "equivalent_qids": qids,
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


def accepted_screening(row: dict) -> dict:
    return {"projection": synthetic_projection(row), "status": "accepted"}


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

    def test_all_exact_screening_accepts_all_24_and_hashes_are_recomputable(self):
        path = next(SNAPSHOTS.glob("wikidata-ulan-crosswalk-*.json"))
        crosswalk_snapshot = load_json(path)

        with mock.patch.object(getty, "fetch_one", side_effect=accepted_screening):
            snapshot = getty.build_snapshot(copy.deepcopy(crosswalk_snapshot), "2026-07-28")
        self.assertEqual(snapshot["source_id"], "getty-ulan")
        self.assertTrue(snapshot["claim_evidence_allowed"])
        self.assertEqual(snapshot["base_catalog_sha256"], crosswalk_snapshot["base_catalog_sha256"])
        self.assertEqual(len(snapshot["records"]), 24)
        self.assertEqual(list(snapshot["records"]), sorted(snapshot["records"], key=int))
        self.assertEqual(snapshot["selection"]["accepted_subject_ids"], list(snapshot["records"]))
        self.assertEqual(snapshot["selection"]["rejections"], [])
        self.assertEqual(snapshot["selection"]["record_count"], 24)
        self.assertEqual(snapshot["selection"]["seed_count"], 24)
        preimage = dict(snapshot)
        projection_sha256 = preimage.pop("projection_sha256")
        snapshot_id = preimage.pop("snapshot_id")
        self.assertEqual(projection_sha256, getty.canonical_hash(preimage))
        self.assertEqual(snapshot_id, f"getty-ulan-identity-2026-07-28-{projection_sha256[:12]}")
        for entry in snapshot["records"].values():
            self.assertEqual(set(entry), {"projection", "projection_sha256"})
            self.assertEqual(entry["projection_sha256"], getty.canonical_hash(entry["projection"]))

    def test_mixed_screening_is_deterministic_and_imports_only_accepted_identities(self):
        path = next(SNAPSHOTS.glob("wikidata-ulan-crosswalk-*.json"))
        crosswalk_snapshot = load_json(path)
        missing_id = crosswalk_snapshot["records"][0]["ulan_subject_id"]
        conflicting_id = crosswalk_snapshot["records"][1]["ulan_subject_id"]

        def mixed_screening(row: dict) -> dict:
            subject_id = row["ulan_subject_id"]
            if subject_id == missing_id:
                projection = synthetic_projection(row, qids=[])
                return {
                    "rejection": getty.rejection_receipt(
                        projection, "missing_wikidata_equivalent"
                    ),
                    "status": "rejected",
                }
            if subject_id == conflicting_id:
                projection = synthetic_projection(row, qids=["Q42"])
                return {
                    "rejection": getty.rejection_receipt(
                        projection, "conflicting_wikidata_equivalent"
                    ),
                    "status": "rejected",
                }
            return accepted_screening(row)

        with mock.patch.object(getty, "fetch_one", side_effect=mixed_screening):
            first = getty.build_snapshot(copy.deepcopy(crosswalk_snapshot), "2026-07-28")
        with mock.patch.object(getty, "fetch_one", side_effect=mixed_screening):
            second = getty.build_snapshot(copy.deepcopy(crosswalk_snapshot), "2026-07-28")
        self.assertEqual(first, second)
        self.assertEqual(first["selection"]["accepted_subject_ids"], list(first["records"]))
        self.assertEqual(first["selection"]["record_count"], 22)
        self.assertEqual(
            [row["subject_id"] for row in first["selection"]["rejections"]],
            sorted([missing_id, conflicting_id], key=int),
        )
        self.assertEqual(
            [row["reason"] for row in first["selection"]["rejections"]],
            [
                "missing_wikidata_equivalent" if subject_id == missing_id else "conflicting_wikidata_equivalent"
                for subject_id in sorted([missing_id, conflicting_id], key=int)
            ],
        )
        preimage = dict(first)
        self.assertEqual(
            first["projection_sha256"],
            getty.canonical_hash({key: value for key, value in preimage.items() if key not in {"projection_sha256", "snapshot_id"}}),
        )
        with tempfile.TemporaryDirectory() as temporary:
            snapshot_path = Path(temporary) / "getty.json"
            snapshot_path.write_text(
                json.dumps(first, ensure_ascii=False),
                encoding="utf-8",
            )
            overlay = importer.build_overlay(
                ROOT / "assets" / "data" / "catalog",
                path,
                snapshot_path,
            )
        self.assertEqual(overlay["kind"], "catalog_overlay_v1")
        self.assertRegex(overlay["overlay_id"], r"^getty-ulan-identity-[0-9a-f]{16}$")
        self.assertEqual(len(overlay["entity_patches"]), 22)
        self.assertEqual(len(overlay["claims"]), 22)
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
        self.assertNotIn(missing_id, ulan_ids)
        self.assertNotIn(conflicting_id, ulan_ids)

    def test_malformed_screening_exception_prevents_snapshot(self):
        path = next(SNAPSHOTS.glob("wikidata-ulan-crosswalk-*.json"))
        crosswalk_snapshot = load_json(path)

        def malformed_screening(row: dict) -> dict:
            if row["ulan_subject_id"] == crosswalk_snapshot["records"][0]["ulan_subject_id"]:
                raise RuntimeError("synthetic malformed Linked Art type")
            return accepted_screening(row)

        with mock.patch.object(getty, "fetch_one", side_effect=malformed_screening):
            with self.assertRaisesRegex(RuntimeError, "no snapshot written"):
                getty.build_snapshot(copy.deepcopy(crosswalk_snapshot), "2026-07-28")

    @unittest.skip(
        "getty-ulan temporarily downgraded (endpoint returned HTTP 499 for "
        "24/24 records); re-enable once Getty ULAN recovers and the overlay "
        "chain is regenerated."
    )
    def test_committed_overlay_exactly_matches_the_accepted_11_of_24(self):
        crosswalk_path = next(SNAPSHOTS.glob("wikidata-ulan-crosswalk-*.json"))
        getty_path = next(SNAPSHOTS.glob("getty-ulan-identity-*.json"))
        overlay_path = ROOT / "assets" / "data" / "catalog" / "getty-ulan-identity.json"
        crosswalk_snapshot = load_json(crosswalk_path)
        getty_snapshot = load_json(getty_path)
        overlay = load_json(overlay_path)
        accepted = set(getty_snapshot["records"])
        rejected = {
            row["subject_id"]
            for row in getty_snapshot["selection"]["rejections"]
        }
        patch_ulans = {
            patch["add_external_ids"]["ulan"]
            for patch in overlay["entity_patches"]
        }
        claim_ulans = {
            claim["object"]["value"]["ulan"]
            for claim in overlay["claims"]
        }
        self.assertEqual(len(accepted), 11)
        self.assertEqual(len(rejected), 13)
        self.assertFalse(accepted & rejected)
        self.assertEqual(accepted | rejected, {
            row["ulan_subject_id"]
            for row in crosswalk_snapshot["records"]
        })
        self.assertEqual(patch_ulans, accepted)
        self.assertEqual(claim_ulans, accepted)

        payloads = [
            (path, load_json(path))
            for path in sorted(
                (ROOT / "assets" / "data" / "catalog").glob("*.json"),
                key=lambda item: item.name.encode("utf-8"),
            )
        ]
        errors: list[str] = []
        base_entities = validator.catalog_base_entity_contracts(payloads, errors)
        validator.validate_getty_ulan_identity_overlay(
            overlay_path.name,
            overlay,
            getty_snapshot,
            crosswalk_snapshot,
            base_entities,
            errors,
        )
        self.assertEqual(errors, [])

    @unittest.skip(
        "getty-ulan temporarily downgraded (endpoint returned HTTP 499 for "
        "24/24 records); re-enable once Getty ULAN recovers and the overlay "
        "chain is regenerated."
    )
    def test_getty_overlay_validator_rejects_identity_and_attribution_tampering(self):
        crosswalk_snapshot = load_json(
            next(SNAPSHOTS.glob("wikidata-ulan-crosswalk-*.json"))
        )
        getty_snapshot = load_json(
            next(SNAPSHOTS.glob("getty-ulan-identity-*.json"))
        )
        overlay_path = ROOT / "assets" / "data" / "catalog" / "getty-ulan-identity.json"
        overlay = load_json(overlay_path)
        payloads = [
            (path, load_json(path))
            for path in sorted(
                (ROOT / "assets" / "data" / "catalog").glob("*.json"),
                key=lambda item: item.name.encode("utf-8"),
            )
        ]
        base_entities = validator.catalog_base_entity_contracts(payloads, [])
        rejected_ulan = getty_snapshot["selection"]["rejections"][0]["subject_id"]
        mutations = {
            "reference": lambda value: value["claims"][0]["evidence"][0].update(
                {"references": ["javascript:wrong-attribution"]}
            ),
            "contributor": lambda value: value["claims"][0]["evidence"][0].update(
                {"contributors": ["javascript:wrong-attribution"]}
            ),
            "claim_ulan": lambda value: value["claims"][0]["object"]["value"].update(
                {"ulan": rejected_ulan}
            ),
            "patch_ulan": lambda value: value["entity_patches"][0][
                "add_external_ids"
            ].update({"ulan": rejected_ulan}),
        }
        for name, mutate in mutations.items():
            with self.subTest(name=name):
                tampered = copy.deepcopy(overlay)
                mutate(tampered)
                errors: list[str] = []
                validator.validate_getty_ulan_identity_overlay(
                    overlay_path.name,
                    tampered,
                    getty_snapshot,
                    crosswalk_snapshot,
                    base_entities,
                    errors,
                )
                self.assertTrue(errors)
                self.assertTrue(
                    any("exact" in error for error in errors),
                    errors,
                )


if __name__ == "__main__":
    unittest.main()
