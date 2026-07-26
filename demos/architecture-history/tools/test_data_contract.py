#!/usr/bin/env python3
"""Adversarial checks for the Architecture Lineages data contract."""

from __future__ import annotations

import importlib.util
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


if __name__ == "__main__":
    unittest.main()
