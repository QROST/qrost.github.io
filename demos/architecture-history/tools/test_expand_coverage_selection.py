#!/usr/bin/env python3
"""Unit tests for offline coverage selection expansion."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = (
    ROOT
    / "assets"
    / "data"
    / "methodology"
    / "wikidata-coverage-config.json"
)

EXPAND_PATH = ROOT / "tools" / "expand_coverage_selection.py"
COVERAGE_PATH = ROOT / "tools" / "fetch_wikidata_coverage.py"

expand_spec = importlib.util.spec_from_file_location(
    "architecture_history_expand_coverage",
    EXPAND_PATH,
)
assert expand_spec and expand_spec.loader
expand = importlib.util.module_from_spec(expand_spec)
expand_spec.loader.exec_module(expand)

coverage_spec = importlib.util.spec_from_file_location(
    "architecture_history_wikidata_coverage_for_expand",
    COVERAGE_PATH,
)
assert coverage_spec and coverage_spec.loader
coverage = importlib.util.module_from_spec(coverage_spec)
coverage_spec.loader.exec_module(coverage)


def minimal_snapshot(*, queries: list[dict]) -> dict:
    return {
        "accessed": "2026-08-07",
        "entities": {},
        "queries": queries,
        "selection": {
            "method": "coverage_cell_stable_hash",
            "per_cell": 2,
            "query_limit": 10,
            "seed": "wd-coverage-v0.1.0",
        },
    }


class ExpandCoverageSelectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = coverage.load_json(CONFIG_PATH)

    def test_per_cell_raise_increases_selected_count(self):
        shared_candidates = ["Q100", "Q200", "Q300", "Q400", "Q500", "Q600"]
        queries = [
            {
                "cell_id": "east_asia__before_1000",
                "region": "east_asia",
                "country_code": "CN",
                "country_qid": "Q148",
                "candidate_work_qids": shared_candidates,
                "selected_work_qids": ["Q100", "Q200"],
                "eligible_credits": [],
            },
            {
                "cell_id": "east_asia__1000_1499",
                "region": "east_asia",
                "country_code": "JP",
                "country_qid": "Q17",
                "candidate_work_qids": shared_candidates,
                "selected_work_qids": ["Q300", "Q400"],
                "eligible_credits": [],
            },
        ]
        snapshot = minimal_snapshot(queries=queries)

        low = expand.reselect_coverage(
            snapshot,
            self.config,
            per_cell=2,
            period_order="oldest_first",
        )
        high = expand.reselect_coverage(
            snapshot,
            self.config,
            per_cell=4,
            period_order="oldest_first",
        )

        low_count = sum(
            len(query["selected_work_qids"]) for query in low["queries"]
        )
        high_count = sum(
            len(query["selected_work_qids"]) for query in high["queries"]
        )
        self.assertEqual(low_count, 4)
        self.assertGreater(high_count, low_count)
        self.assertEqual(high["selection"]["per_cell"], 4)

    def test_period_order_changes_selection_when_qids_overlap(self):
        overlap = ["Q42", "Q7", "Q100", "Q200"]
        queries = [
            {
                "cell_id": "europe__1946_1979",
                "region": "europe",
                "country_code": "FR",
                "country_qid": "Q142",
                "candidate_work_qids": overlap,
                "selected_work_qids": [],
                "eligible_credits": [],
            },
            {
                "cell_id": "europe__2000_present",
                "region": "europe",
                "country_code": "DE",
                "country_qid": "Q183",
                "candidate_work_qids": overlap,
                "selected_work_qids": [],
                "eligible_credits": [],
            },
        ]
        snapshot = minimal_snapshot(queries=queries)

        oldest_first = expand.reselect_coverage(
            snapshot,
            self.config,
            per_cell=2,
            period_order="oldest_first",
        )
        newest_first = expand.reselect_coverage(
            snapshot,
            self.config,
            per_cell=2,
            period_order="newest_first",
        )

        by_cell = lambda payload: {
            query["cell_id"]: list(query["selected_work_qids"])
            for query in payload["queries"]
        }
        self.assertNotEqual(
            by_cell(oldest_first),
            by_cell(newest_first),
        )
        self.assertIn(
            "period_order=newest_first",
            newest_first["selection"]["notes_en"],
        )


if __name__ == "__main__":
    unittest.main()
