#!/usr/bin/env python3
"""Unit tests for Wikidata coverage discovery helpers."""

from __future__ import annotations

import hashlib
import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
FETCHER_PATH = ROOT / "tools" / "fetch_wikidata_coverage.py"
CONFIG_PATH = (
    ROOT
    / "assets"
    / "data"
    / "methodology"
    / "wikidata-coverage-config.json"
)

spec = importlib.util.spec_from_file_location(
    "architecture_history_wikidata_coverage",
    FETCHER_PATH,
)
assert spec and spec.loader
coverage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coverage)


class WikidataCoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = coverage.load_json(CONFIG_PATH)

    def test_cell_id_generation(self):
        self.assertEqual(
            coverage.cell_id_for("east_asia", "before_1000"),
            "east_asia__before_1000",
        )
        self.assertEqual(
            coverage.cell_id_for("oceania", "2000_present"),
            "oceania__2000_present",
        )
        cells = coverage.iter_cells(self.config)
        self.assertEqual(len(cells), 72)
        cell_ids = [cell_id for cell_id, _, _ in cells]
        self.assertEqual(len(cell_ids), len(set(cell_ids)))

    def test_country_pick_is_deterministic(self):
        seed = self.config["selection"]["seed"]
        countries = coverage.countries_for_region(self.config, "east_asia")
        cell_id = "east_asia__before_1000"
        first = coverage.pick_country(seed, cell_id, countries)
        second = coverage.pick_country(seed, cell_id, countries)
        self.assertEqual(first, second)
        self.assertEqual(first["region"], "east_asia")
        digest = hashlib.sha256(f"{seed}|{cell_id}".encode("utf-8")).hexdigest()
        index = int(digest, 16) % len(countries)
        self.assertEqual(first, countries[index])

    def test_stable_hash_selection_order(self):
        seed = "wd-coverage-v0.1.0"
        cell_id = "europe__1800_1918"
        candidates = ["Q500", "Q42", "Q100", "Q7", "Q300"]
        selected = coverage.stable_pick_candidates(
            seed=seed,
            cell_id=cell_id,
            candidates=candidates,
            per_cell=3,
            already_selected=set(),
        )
        expected = sorted(
            (
                hashlib.sha256(f"{seed}|{cell_id}|{qid}".encode("utf-8")).hexdigest(),
                coverage.qid_number(qid),
                qid,
            )
            for qid in candidates
        )[:3]
        self.assertEqual(selected, [qid for _, _, qid in expected])

    def test_stable_hash_selection_skips_prior_cells(self):
        seed = "wd-coverage-v0.1.0"
        cell_id = "europe__1800_1918"
        candidates = ["Q500", "Q42", "Q100"]
        already = {"Q42"}
        selected = coverage.stable_pick_candidates(
            seed=seed,
            cell_id=cell_id,
            candidates=candidates,
            per_cell=2,
            already_selected=already,
        )
        self.assertNotIn("Q42", selected)
        self.assertLessEqual(len(selected), 2)

    def test_sparql_query_contains_allowlist_and_no_subclass_traversal(self):
        period = next(
            row
            for row in self.config["coverage_grid"]["periods"]
            if row["id"] == "1500_1799"
        )
        query = coverage.build_cell_sparql(
            config=self.config,
            country_qid="Q142",
            period=period,
            query_limit=201,
        )
        for row in self.config["exact_instance_allowlist"]:
            self.assertIn(f"wd:{row['qid']}", query)
        self.assertIn("VALUES ?type", query)
        self.assertIn("wdt:P31 ?type", query)
        self.assertIn("wdt:P17 wd:Q142", query)
        self.assertIn("wdt:P571", query)
        self.assertIn("wdt:P1619", query)
        self.assertNotIn("wikibase:timePrecision", query)
        self.assertIn("FILTER(LANG(?label) = \"en\")", query)
        self.assertIn("LIMIT 201", query)
        self.assertNotIn("wdt:P279", query)
        self.assertNotIn("ORDER BY", query.upper())
        self.assertNotIn("SITELINK", query.upper())

    def test_unique_candidates_preserves_order_and_cap(self):
        raw = ["Q2", "Q1", "Q2", "Q3", "Q4", "Q5"]
        self.assertEqual(
            coverage.unique_candidates(raw, 3),
            ["Q2", "Q1", "Q3"],
        )

    def test_coverage_snapshot_id_is_stable(self):
        queries = [
            {
                "cell_id": "b__p",
                "selected_work_qids": ["Q2", "Q1"],
            },
            {
                "cell_id": "a__p",
                "selected_work_qids": ["Q3"],
            },
        ]
        first = coverage.coverage_snapshot_id(
            "2026-08-07",
            seed="wd-coverage-v0.1.0",
            queries=queries,
        )
        second = coverage.coverage_snapshot_id(
            "2026-08-07",
            seed="wd-coverage-v0.1.0",
            queries=list(reversed(queries)),
        )
        self.assertEqual(first, second)
        self.assertTrue(first.startswith("wikidata-coverage-2026-08-07-"))


if __name__ == "__main__":
    unittest.main()
