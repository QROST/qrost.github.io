#!/usr/bin/env python3
"""Unit tests for architect-centric hydration seed expansion."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
FETCHER_PATH = ROOT / "tools" / "fetch_architect_works.py"
CONFIG_PATH = (
    ROOT
    / "assets"
    / "data"
    / "methodology"
    / "wikidata-coverage-config.json"
)

spec = importlib.util.spec_from_file_location(
    "architecture_history_fetch_architect_works",
    FETCHER_PATH,
)
assert spec and spec.loader
architect_works = importlib.util.module_from_spec(spec)
spec.loader.exec_module(architect_works)


class FetchArchitectWorksTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = architect_works.load_json(CONFIG_PATH)

    def test_sparql_contains_architect_and_allowlist(self):
        query = architect_works.build_architect_sparql(
            architect_qid="Q180374",
            config=self.config,
        )
        self.assertIn("wdt:P84 wd:Q180374", query)
        self.assertIn("wdt:P31 ?type", query)
        self.assertIn("wdt:P17 ?country", query)
        self.assertIn('FILTER(LANG(?label) = "en")', query)
        for row in self.config["exact_instance_allowlist"]:
            self.assertIn(f"wd:{row['qid']}", query)

    def test_expand_skips_existing_and_applies_soft_cap(self):
        seeds_payload = {
            "seed_version": "0.1.0",
            "seeds": [
                {
                    "expected_country_code": "US",
                    "expected_country_qid": "Q30",
                    "label_hint_en": "Existing Work",
                    "qid": "Q100",
                    "region": "north_america",
                    "risk_tags": [],
                }
            ],
        }

        def fake_runner(_query, *, last_request_at=None):
            del last_request_at
            return [
                {
                    "work_qid": "Q100",
                    "country_qid": "Q30",
                    "label_en": "Existing Work",
                },
                {
                    "work_qid": "Q200",
                    "country_qid": "Q30",
                    "label_en": "New Work",
                },
                {
                    "work_qid": "Q300",
                    "country_qid": "Q999999",
                    "label_en": "Unknown Country",
                },
                {
                    "work_qid": "Q400",
                    "country_qid": "Q30",
                    "label_en": "Capped Work",
                },
            ], 0.0

        updated, stats = architect_works.expand_architect_works(
            "Q180374",
            seeds_payload,
            self.config,
            soft_cap=1,
            sparql_runner=fake_runner,
        )
        self.assertEqual(stats["hits"], 4)
        self.assertEqual(stats["skipped_existing"], 1)
        self.assertEqual(stats["skipped_unknown_country"], 1)
        self.assertEqual(stats["added"], 1)
        self.assertEqual(stats["capped"], 1)
        qids = [seed["qid"] for seed in updated["seeds"]]
        self.assertEqual(qids, ["Q100", "Q200"])
        new_seed = updated["seeds"][1]
        self.assertEqual(
            new_seed["risk_tags"],
            ["architect_expansion", "architect_gehry"],
        )


if __name__ == "__main__":
    unittest.main()
