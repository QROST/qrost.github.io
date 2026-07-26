#!/usr/bin/env python3
"""Adversarial checks for the Architecture Lineages data contract."""

from __future__ import annotations

import importlib.util
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
VALIDATOR_PATH = ROOT / "tools" / "validate.py"
BUILDER_PATH = ROOT / "tools" / "build.py"

spec = importlib.util.spec_from_file_location("architecture_history_validate", VALIDATOR_PATH)
assert spec and spec.loader
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class DataContractTests(unittest.TestCase):
    def isolated_root(self) -> tempfile.TemporaryDirectory:
        temp = tempfile.TemporaryDirectory(prefix="architecture-history-contract-")
        root = Path(temp.name)
        shutil.copytree(ROOT / "assets", root / "assets")
        (root / "tools").mkdir()
        shutil.copy2(ROOT / "tools" / "schema.json", root / "tools" / "schema.json")
        return temp

    def run_validator(self, root: Path) -> subprocess.CompletedProcess:
        env = dict(os.environ)
        env["ARCH_HISTORY_ROOT"] = str(root)
        return subprocess.run(
            [sys.executable, str(VALIDATOR_PATH)],
            text=True,
            capture_output=True,
            env=env,
            check=False,
        )

    def run_builder(self, root: Path) -> subprocess.CompletedProcess:
        env = dict(os.environ)
        env["ARCH_HISTORY_ROOT"] = str(root)
        return subprocess.run(
            [sys.executable, str(BUILDER_PATH)],
            text=True,
            capture_output=True,
            env=env,
            check=False,
        )

    @staticmethod
    def unknown_date() -> dict:
        return {
            "value": None,
            "earliest": None,
            "latest": None,
            "precision": "unknown",
        }

    def add_malicious_relation_fixture(
        self,
        root: Path,
        *,
        object_entity: str = "person-b",
        reviewed_by: str = "reviewer-one",
        evidence_source: str = "wikidata",
    ) -> None:
        data = root / "assets" / "data"
        registry_path = data / "source-registry.json"
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        wikidata = next(item for item in registry["sources"] if item["id"] == "wikidata")
        wikidata["adapter_status"] = "fixture_only"
        wikidata["adapter_id"] = "wikidata-coverage-pilot"
        wikidata["adapter_version"] = "0.1.0"
        registry_path.write_text(
            json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        (data / "reviewers.json").write_text(
            json.dumps(
                {
                    "reviewers": [
                        {
                            "id": "reviewer-one",
                            "display_name": "Fixture reviewer",
                            "reviewer_type": "human",
                            "active": True,
                        }
                    ]
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        people = []
        for suffix in ("a", "b", "c"):
            people.append(
                {
                    "id": f"person-{suffix}",
                    "entity_type": "person",
                    "name_zh": None,
                    "name_en": f"Person {suffix.upper()}",
                    "name_native": None,
                    "name_zh_status": "missing",
                    "aliases_zh": [],
                    "aliases_en": [],
                    "roles": ["architect"],
                    "birth": self.unknown_date(),
                    "death": self.unknown_date(),
                    "region": "unknown",
                    "country_codes": [],
                    "external_ids": {"wikidata": f"Q{ord(suffix) - 96}"},
                    "summary_zh": "",
                    "summary_en": "",
                    "verification_status": "candidate",
                    "confidence": 0.5,
                    "last_verified": "2026-07-25",
                    "claim_ids": [],
                }
            )
        (data / "people.json").write_text(
            json.dumps({"people": people}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        record = {
            "id": "Q1",
            "lastrevid": 1,
            "modified": "2026-07-25T00:00:00Z",
            "labels": {},
            "aliases": {},
            "claims": {},
        }
        record_hash = validator.canonical_hash(record)
        query = "SELECT ?work WHERE { VALUES ?work { wd:Q1 } }"
        snapshot = {
            "snapshot_id": "wikidata-fixture-2026-07-25",
            "source_id": "wikidata",
            "adapter_id": "wikidata-coverage-pilot",
            "adapter_version": "0.1.0",
            "accessed": "2026-07-25",
            "license": "CC0-1.0",
            "endpoint": "https://query.wikidata.org/sparql",
            "selection": {
                "method": "coverage_cell_stable_hash",
                "per_cell": 1,
                "query_limit": 1,
                "seed": "fixture",
                "notes_zh": "测试快照，不是公开事实。",
                "notes_en": "Test snapshot, not a public fact.",
            },
            "queries": [
                {
                    "cell_id": "fixture-cell",
                    "region": "unknown",
                    "country_code": "US",
                    "country_qid": "Q30",
                    "query": query,
                    "query_sha256": hashlib.sha256(query.encode("utf-8")).hexdigest(),
                    "candidate_work_qids": ["Q1"],
                    "selected_work_qids": ["Q1"],
                    "eligible_credits": [],
                }
            ],
            "entities": {
                "Q1": {
                    "lastrevid": 1,
                    "record_sha256": record_hash,
                    "record": record,
                }
            },
        }
        snapshot_dir = data / "source-snapshots"
        snapshot_dir.mkdir(exist_ok=True)
        (snapshot_dir / "wikidata-fixture.json").write_text(
            json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        evidence = {
            "source_id": evidence_source,
            "snapshot_id": snapshot["snapshot_id"],
            "native_record_id": "Q1",
            "native_field_path": "claims.P1066[0]",
            "native_predicate": "P1066",
            "url": "https://www.wikidata.org/w/index.php?title=Q1&oldid=1",
            "locator": "Q1/P1066/fixture",
            "accessed": "2026-07-25",
            "support": "explicit",
            "extraction_method": "structured_mapping",
            "language": None,
            "rank": "normal",
            "qualifiers": [],
            "references": [],
            "contributors": [],
            "source_record_sha256": record_hash,
        }
        claim = {
            "id": "claim-relation",
            "subject_id": "relation-a-b",
            "predicate": "formal_teacher",
            "object": {"entity_id": object_entity},
            "qualifiers": {"from_id": "person-a"},
            "evidence": [evidence],
            "verification_status": "verified",
            "confidence": 0.95,
            "reviewed_by": reviewed_by,
            "reviewed_at": "2026-07-25",
        }
        (data / "claims.json").write_text(
            json.dumps({"claims": [claim]}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        relation = {
            "id": "relation-a-b",
            "from_id": "person-a",
            "to_id": "person-b",
            "relation_type": "formal_teacher",
            "context": {
                "institution_id": None,
                "practice_id": None,
                "work_id": None,
                "date_start": None,
                "date_end": None,
                "note_zh": "",
                "note_en": "",
            },
            "verification_status": "verified",
            "confidence": 0.95,
            "last_verified": "2026-07-25",
            "claim_id": "claim-relation",
            "rejection_reasons": [],
        }
        (data / "relations.json").write_text(
            json.dumps({"relations": [relation]}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        (data / "manifest.json").unlink()

    def test_current_scaffold_validates(self):
        result = self.run_validator(ROOT)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Validation OK", result.stdout)

    def test_closed_source_shape_rejects_unknown_field(self):
        temp = self.isolated_root()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        manifest = root / "assets" / "data" / "manifest.json"
        manifest.unlink()
        registry = root / "assets" / "data" / "source-registry.json"
        payload = json.loads(registry.read_text(encoding="utf-8"))
        payload["sources"][0]["invented_permission"] = True
        registry.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        result = self.run_validator(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unexpected property 'invented_permission'", result.stderr)

    def test_duplicate_source_id_fails(self):
        temp = self.isolated_root()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        manifest = root / "assets" / "data" / "manifest.json"
        manifest.unlink()
        registry = root / "assets" / "data" / "source-registry.json"
        payload = json.loads(registry.read_text(encoding="utf-8"))
        payload["sources"].append(dict(payload["sources"][0]))
        registry.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        result = self.run_validator(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("duplicate id 'getty-ulan'", result.stderr)

    def test_any_of_does_not_bypass_closed_object_shape(self):
        schema = json.loads(
            (ROOT / "tools" / "schema.json").read_text(encoding="utf-8")
        )
        issues = validator.schema_issues(
            {"entity_id": "person-a", "invented_field": True},
            schema["$defs"]["claimObject"],
            schema,
            "claim.object",
        )
        self.assertIn(
            "claim.object: unexpected property 'invented_field'",
            issues,
        )

    def test_any_of_still_requires_an_allowed_claim_object(self):
        schema = json.loads(
            (ROOT / "tools" / "schema.json").read_text(encoding="utf-8")
        )
        issues = validator.schema_issues(
            {},
            schema["$defs"]["claimObject"],
            schema,
            "claim.object",
        )
        self.assertIn(
            "claim.object: does not match any allowed schema",
            issues,
        )

    def test_lineage_cycle_detector(self):
        self.assertIsNone(validator.has_cycle([("a", "b"), ("b", "c")]))
        self.assertEqual(
            validator.has_cycle([("a", "b"), ("b", "c"), ("c", "a")]),
            ["a", "b", "c", "a"],
        )

    def test_manifest_is_required(self):
        temp = self.isolated_root()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        (root / "assets" / "data" / "manifest.json").unlink()
        result = self.run_validator(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("required generated manifest is missing", result.stderr)

    def test_manifest_semantics_cannot_be_forged(self):
        temp = self.isolated_root()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        manifest = root / "assets" / "data" / "manifest.json"
        payload = json.loads(manifest.read_text(encoding="utf-8"))
        payload["counts"]["works"] = 999999
        payload["schema_version"] = "bogus"
        payload["coverage"] = {"regions": {"mars": {"works": 1}}}
        manifest.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        result = self.run_validator(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("manifest.schema_version", result.stderr)
        self.assertIn("manifest.counts", result.stderr)
        self.assertIn("manifest.coverage", result.stderr)

    def test_verified_lineage_binds_exact_endpoint_and_verified_people(self):
        temp = self.isolated_root()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        self.add_malicious_relation_fixture(root, object_entity="person-c")
        result = self.run_validator(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("claim object must match relation to_id", result.stderr)
        self.assertIn("verified lineage requires verified person endpoints", result.stderr)
        self.assertIn("lacks claim-evidence authority for relationships", result.stderr)

    def test_duplicate_logical_relation_is_rejected(self):
        temp = self.isolated_root()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        self.add_malicious_relation_fixture(root)
        data = root / "assets" / "data"

        claims_path = data / "claims.json"
        claims_payload = json.loads(claims_path.read_text(encoding="utf-8"))
        duplicate_claim = dict(claims_payload["claims"][0])
        duplicate_claim["id"] = "claim-relation-duplicate"
        duplicate_claim["subject_id"] = "relation-a-b-duplicate"
        claims_payload["claims"].append(duplicate_claim)
        claims_path.write_text(
            json.dumps(claims_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        relations_path = data / "relations.json"
        relations_payload = json.loads(relations_path.read_text(encoding="utf-8"))
        duplicate_relation = dict(relations_payload["relations"][0])
        duplicate_relation["id"] = "relation-a-b-duplicate"
        duplicate_relation["claim_id"] = "claim-relation-duplicate"
        relations_payload["relations"].append(duplicate_relation)
        relations_path.write_text(
            json.dumps(relations_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        result = self.run_validator(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("duplicates logical relation 'relation-a-b'", result.stderr)

    def test_verified_relation_rejects_competing_claim(self):
        temp = self.isolated_root()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        self.add_malicious_relation_fixture(root)
        claims_path = root / "assets" / "data" / "claims.json"
        payload = json.loads(claims_path.read_text(encoding="utf-8"))
        competing = dict(payload["claims"][0])
        competing["id"] = "claim-relation-contested"
        competing["verification_status"] = "contested"
        competing["confidence"] = 0.8
        competing["reviewed_by"] = None
        competing["reviewed_at"] = None
        payload["claims"].append(competing)
        claims_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        result = self.run_validator(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "relation-a-b: verified relation has competing claims "
            "['claim-relation-contested']",
            result.stderr,
        )

    def test_entity_must_reverse_list_every_subject_claim(self):
        temp = self.isolated_root()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        self.add_malicious_relation_fixture(root)
        claims_path = root / "assets" / "data" / "claims.json"
        payload = json.loads(claims_path.read_text(encoding="utf-8"))
        payload["claims"].append(
            {
                "id": "claim-hidden",
                "subject_id": "person-a",
                "predicate": "field_name_en",
                "object": {"value": "Hidden candidate"},
                "qualifiers": {},
                "evidence": [],
                "verification_status": "candidate",
                "confidence": 0.5,
                "reviewed_by": None,
                "reviewed_at": None,
            }
        )
        claims_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        result = self.run_validator(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "claim-hidden: entity subject must list every claim in claim_ids",
            result.stderr,
        )

    def test_discovery_only_source_cannot_support_public_claim(self):
        temp = self.isolated_root()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        self.add_malicious_relation_fixture(root, evidence_source="avery-index")
        result = self.run_validator(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("source 'avery-index' is discovery/citation-only", result.stderr)

    def test_unknown_reviewer_cannot_verify_claim(self):
        temp = self.isolated_root()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        self.add_malicious_relation_fixture(root, reviewed_by="bot")
        result = self.run_validator(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("reviewed_by -> unknown reviewer 'bot'", result.stderr)

    def test_verified_relation_cannot_use_candidate_claim(self):
        temp = self.isolated_root()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        self.add_malicious_relation_fixture(root)
        claims_path = root / "assets" / "data" / "claims.json"
        payload = json.loads(claims_path.read_text(encoding="utf-8"))
        payload["claims"][0]["verification_status"] = "candidate"
        claims_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        result = self.run_validator(root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "relation and claim verification status differ",
            result.stderr,
        )

    def test_verified_entity_requires_exact_field_claims(self):
        item = {
            "id": "person-a",
            "entity_type": "person",
            "name_en": "Unsupported Name",
            "roles": ["architect"],
            "region": "europe",
            "verification_status": "verified",
            "confidence": 0.9,
            "last_verified": "2026-07-25",
            "claim_ids": ["claim-summary"],
        }
        claims = [
            {
                "id": "claim-summary",
                "subject_id": "person-a",
                "predicate": "field_summary_en",
                "object": {"value": "Only the summary is sourced."},
                "verification_status": "verified",
                "confidence": 0.9,
            }
        ]
        errors: list[str] = []
        validator.verified_field_claims(item, claims, errors)
        self.assertIn(
            "person-a: verified field 'name_en' lacks an exact verified claim",
            errors,
        )
        self.assertIn(
            "person-a: verified field 'roles' lacks an exact verified claim",
            errors,
        )

    def test_verified_field_rejects_hidden_contested_claim(self):
        item = {
            "id": "person-a",
            "entity_type": "person",
            "name_en": "Supported Name",
            "verification_status": "verified",
            "confidence": 0.9,
            "last_verified": "2026-07-25",
            "claim_ids": ["claim-name"],
        }
        claims = [
            {
                "id": "claim-name",
                "subject_id": "person-a",
                "predicate": "field_name_en",
                "object": {"value": "Supported Name"},
                "verification_status": "verified",
                "confidence": 0.9,
                "evidence": [],
            },
            {
                "id": "claim-name-contested",
                "subject_id": "person-a",
                "predicate": "field_name_en",
                "object": {"value": "Other Name"},
                "verification_status": "contested",
                "confidence": 0.8,
                "evidence": [],
            },
        ]
        errors: list[str] = []
        validator.verified_field_claims(item, claims, errors)
        self.assertIn(
            "person-a: verified field 'name_en' has competing claims "
            "['claim-name-contested']",
            errors,
        )

    def test_verified_field_rejects_different_verified_value(self):
        item = {
            "id": "person-a",
            "entity_type": "person",
            "name_en": "Canonical Name",
            "verification_status": "verified",
            "confidence": 0.9,
            "last_verified": "2026-07-25",
            "claim_ids": ["claim-name", "claim-name-other"],
        }
        claims = [
            {
                "id": "claim-name",
                "subject_id": "person-a",
                "predicate": "field_name_en",
                "object": {"value": "Canonical Name"},
                "verification_status": "verified",
                "confidence": 0.9,
                "evidence": [],
            },
            {
                "id": "claim-name-other",
                "subject_id": "person-a",
                "predicate": "field_name_en",
                "object": {"value": "Different Name"},
                "verification_status": "verified",
                "confidence": 0.9,
                "evidence": [],
            },
        ]
        errors: list[str] = []
        validator.verified_field_claims(item, claims, errors)
        self.assertIn(
            "person-a: verified field 'name_en' has competing claims "
            "['claim-name-other']",
            errors,
        )

    def test_verified_work_rejects_candidate_credit(self):
        errors: list[str] = []
        validator.validate_verified_work_credit(
            {"id": "work-a", "verification_status": "verified"},
            {"credit_status": "candidate"},
            {"verification_status": "candidate"},
            {"verification_status": "candidate"},
            errors,
        )
        self.assertIn(
            "work-a: verified work cannot include a non-verified credit",
            errors,
        )
        self.assertIn(
            "work-a: verified work cannot include a non-verified credit claim",
            errors,
        )
        self.assertIn(
            "work-a: verified work credit requires a verified contributor entity",
            errors,
        )

    def test_symmetric_relation_key_normalizes_endpoint_order(self):
        forward = {
            "from_id": "person-a",
            "to_id": "person-b",
            "relation_type": "collaborated_with",
        }
        reverse = {
            "from_id": "person-b",
            "to_id": "person-a",
            "relation_type": "collaborated_with",
        }
        self.assertEqual(
            validator.logical_relation_key(forward),
            validator.logical_relation_key(reverse),
        )

    def test_date_semantics_reject_reverse_range(self):
        errors: list[str] = []
        validator.validate_date_value(
            "work-a",
            "completion",
            {
                "value": "2000–1900",
                "earliest": 2000,
                "latest": 1900,
                "precision": "range",
            },
            errors,
        )
        self.assertIn(
            "work-a.completion: earliest year exceeds latest year",
            errors,
        )

    def test_date_semantics_bind_display_to_bounds(self):
        errors: list[str] = []
        validator.validate_date_value(
            "work-a",
            "completion",
            {
                "value": "1900",
                "earliest": 2000,
                "latest": 2000,
                "precision": "year",
            },
            errors,
        )
        self.assertIn(
            "work-a.completion: display year must equal earliest/latest bounds",
            errors,
        )

    def test_date_semantics_reject_invalid_calendar_day(self):
        errors: list[str] = []
        validator.validate_date_value(
            "work-a",
            "completion",
            {
                "value": "1900-02-29",
                "earliest": 1900,
                "latest": 1900,
                "precision": "day",
            },
            errors,
        )
        self.assertIn(
            "work-a.completion: day is invalid for its calendar month",
            errors,
        )

    def test_unknown_schema_keyword_fails_closed(self):
        issues = validator.schema_issues(
            "value",
            {"oneOf": [{"type": "string"}]},
            {},
            "fixture",
        )
        self.assertIn("validator does not implement schema keyword", issues[0])

    def test_failed_build_restores_generated_outputs(self):
        temp = self.isolated_root()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        data = root / "assets" / "data"
        before = {
            path.name: path.read_bytes()
            for path in data.glob("*.json")
            if path.name not in {"source-registry.json", "reviewers.json"}
        }
        catalog = data / "catalog"
        catalog.mkdir()
        malformed = {
            "source_id": "wikidata",
            "generated_from": "missing-snapshot",
            "generator": "test",
            "people": [],
            "practices": [],
            "places": [],
            "works": [{"id": "broken"}],
            "claims": [],
            "relations": [],
        }
        (catalog / "malformed.json").write_text(
            json.dumps(malformed, indent=2) + "\n",
            encoding="utf-8",
        )
        result = self.run_builder(root)
        self.assertNotEqual(result.returncode, 0)
        after = {
            path.name: path.read_bytes()
            for path in data.glob("*.json")
            if path.name not in {"source-registry.json", "reviewers.json"}
        }
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
