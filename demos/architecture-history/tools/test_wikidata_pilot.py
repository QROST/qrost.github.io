#!/usr/bin/env python3
"""Regression checks for the pinned Wikidata hydration pilot."""

from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
IMPORTER_PATH = ROOT / "tools" / "import_wikidata_pilot.py"

spec = importlib.util.spec_from_file_location(
    "architecture_history_wikidata_importer",
    IMPORTER_PATH,
)
assert spec and spec.loader
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


class WikidataPilotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = load_json(
            ROOT
            / "assets"
            / "data"
            / "catalog"
            / "wikidata-hydration.json"
        )
        snapshot_id = cls.catalog["generated_from"]
        cls.snapshot_path = (
            ROOT
            / "assets"
            / "data"
            / "source-snapshots"
            / f"{snapshot_id}.json"
        )
        if not cls.snapshot_path.is_file():
            raise AssertionError(
                f"catalog references missing hydration snapshot {snapshot_id}"
            )
        cls.snapshot = load_json(cls.snapshot_path)
        if cls.snapshot["snapshot_id"] != snapshot_id:
            raise AssertionError(
                "catalog generated_from does not match snapshot payload"
            )
        cls.config = load_json(
            ROOT
            / "assets"
            / "data"
            / "methodology"
            / "wikidata-coverage-config.json"
        )
        cls.seed_file = load_json(ROOT / "tools" / "wikidata-hydration-seeds.json")

    def test_seed_set_and_coverage_grid_are_fixed(self):
        self.assertEqual(self.snapshot["seeds"], self.seed_file["seeds"])
        self.assertEqual(len(self.snapshot["seeds"]), len(self.catalog["works"]))
        self.assertGreaterEqual(len(self.snapshot["seeds"]), 500)
        self.assertEqual(
            {seed["region"] for seed in self.snapshot["seeds"]},
            set(self.config["coverage_grid"]["regions"]),
        )
        self.assertEqual(
            self.config["coverage_grid"]["cell_count"],
            len(self.config["coverage_grid"]["regions"])
            * len(self.config["coverage_grid"]["periods"]),
        )
        self.assertEqual(self.config["coverage_grid"]["cell_count"], 72)

    def test_every_entity_is_revision_pinned(self):
        for qid, wrapper in self.snapshot["entities"].items():
            revision = wrapper["lastrevid"]
            self.assertEqual(wrapper["record"]["id"], qid)
            self.assertEqual(wrapper["record"]["lastrevid"], revision)
            self.assertEqual(
                wrapper["pinned_url"],
                "https://www.wikidata.org/wiki/Special:EntityData/"
                f"{qid}.json?revision={revision}",
            )
            self.assertRegex(wrapper["record_sha256"], r"^[0-9a-f]{64}$")
            self.assertNotIn("source_response_sha256", wrapper)

    def test_import_is_deterministic(self):
        first = importer.CatalogBuilder(self.snapshot, self.config).build()
        second = importer.CatalogBuilder(self.snapshot, self.config).build()
        self.assertEqual(first, second)
        self.assertEqual(first, self.catalog)

    def test_automatic_records_remain_candidates(self):
        graph = (
            self.catalog["people"]
            + self.catalog["practices"]
            + self.catalog["places"]
            + self.catalog["works"]
            + self.catalog["relations"]
        )
        self.assertTrue(graph)
        self.assertEqual(
            {item["verification_status"] for item in graph},
            {"candidate"},
        )
        self.assertEqual(
            {claim["verification_status"] for claim in self.catalog["claims"]},
            {"candidate"},
        )

    def test_dates_and_credit_completeness_fail_closed(self):
        for work in self.catalog["works"]:
            self.assertEqual(work["credit_set_completeness"], "unknown")
            for date_value in work["dates"].values():
                self.assertEqual(date_value["precision"], "unknown")
                self.assertIsNone(date_value["value"])
                self.assertIsNone(date_value["earliest"])
                self.assertIsNone(date_value["latest"])
        source_date_claims = {
            claim["predicate"]
            for claim in self.catalog["claims"]
            if claim["predicate"].startswith("source_")
        }
        self.assertTrue(
            source_date_claims
            <= {"source_inception", "source_official_opening"}
        )
        self.assertIn("source_inception", source_date_claims)

    def test_raw_lineage_edges_never_become_mentorship(self):
        self.assertTrue(self.catalog["relations"])
        for relation in self.catalog["relations"]:
            self.assertEqual(relation["relation_type"], "student_of_recorded")
            self.assertEqual(relation["verification_status"], "candidate")
            self.assertTrue(relation["rejection_reasons"])

    def test_claim_evidence_resolves_to_pinned_snapshot(self):
        wrappers = self.snapshot["entities"]
        for claim in self.catalog["claims"]:
            self.assertTrue(claim["evidence"])
            for evidence in claim["evidence"]:
                qid, revision_text = evidence["native_record_id"].split("@", 1)
                wrapper = wrappers[qid]
                self.assertEqual(int(revision_text), wrapper["lastrevid"])
                self.assertEqual(evidence["url"], wrapper["pinned_url"])
                self.assertEqual(
                    evidence["source_record_sha256"],
                    wrapper["record_sha256"],
                )

    def test_p84_credit_targets_match_source_statements(self):
        claims = {
            claim["id"]: claim
            for claim in self.catalog["claims"]
        }
        entity_qids = {
            item["id"]: item["external_ids"]["wikidata"]
            for item in self.catalog["people"] + self.catalog["practices"]
        }
        for work in self.catalog["works"]:
            work_qid = work["external_ids"]["wikidata"]
            for credit in work["credits"]:
                claim = claims[credit["claim_id"]]
                contributor_qid = entity_qids[credit["entity_id"]]
                for evidence in claim["evidence"]:
                    source_qid = evidence["native_record_id"].split("@", 1)[0]
                    self.assertEqual(source_qid, work_qid)
                    self.assertEqual(evidence["native_predicate"], "P84")
                    index = int(evidence["native_field_path"].rsplit("/", 1)[1])
                    statement = self.snapshot["entities"][work_qid]["record"][
                        "claims"
                    ]["P84"][index]
                    self.assertEqual(
                        importer.item_values(
                            {"claims": {"P84": [statement]}},
                            "P84",
                        ),
                        [contributor_qid],
                    )

    def test_every_p84_is_resolved_or_queued(self):
        source_paths: set[tuple[str, str]] = set()
        for seed in self.snapshot["seeds"]:
            qid = seed["qid"]
            statements = self.snapshot["entities"][qid]["record"].get(
                "claims",
                {},
            ).get("P84", [])
            for index, statement in enumerate(statements):
                if statement.get("rank") != "deprecated":
                    source_paths.add((qid, f"/claims/P84/{index}"))

        catalog_paths: set[tuple[str, str]] = set()
        claims = {
            claim["id"]: claim
            for claim in self.catalog["claims"]
        }
        for work in self.catalog["works"]:
            for credit in work["credits"] + work["unresolved_credits"]:
                claim = claims[credit["claim_id"]]
                self.assertEqual(len(claim["evidence"]), 1)
                evidence = claim["evidence"][0]
                source_qid = evidence["native_record_id"].split("@", 1)[0]
                catalog_paths.add((source_qid, evidence["native_field_path"]))
        self.assertEqual(source_paths, catalog_paths)

    def test_country_authority_matches_pinned_p297(self):
        authority = {
            row["country_qid"]: row
            for row in self.config["country_region_authority"]
        }
        for seed in self.snapshot["seeds"]:
            row = authority[seed["expected_country_qid"]]
            self.assertEqual(row["iso2"], seed["expected_country_code"])
            self.assertEqual(row["region"], seed["region"])
            country_record = self.snapshot["entities"][row["country_qid"]]["record"]
            iso_codes = [
                statement.get("mainsnak", {})
                .get("datavalue", {})
                .get("value")
                for statement in country_record.get("claims", {}).get("P297", [])
                if statement.get("mainsnak", {}).get("snaktype") == "value"
            ]
            self.assertIn(
                row["iso2"],
                iso_codes,
            )

    def test_raw_lineage_direction_matches_p1066_and_p802(self):
        claims = {
            claim["id"]: claim
            for claim in self.catalog["claims"]
        }
        people = {
            person["id"]: person["external_ids"]["wikidata"]
            for person in self.catalog["people"]
        }
        for relation in self.catalog["relations"]:
            from_qid = people[relation["from_id"]]
            to_qid = people[relation["to_id"]]
            claim = claims[relation["claim_id"]]
            for evidence in claim["evidence"]:
                source_qid = evidence["native_record_id"].split("@", 1)[0]
                property_id = evidence["native_predicate"]
                index = int(evidence["native_field_path"].rsplit("/", 1)[1])
                statement = self.snapshot["entities"][source_qid]["record"][
                    "claims"
                ][property_id][index]
                targets = importer.item_values(
                    {"claims": {property_id: [statement]}},
                    property_id,
                )
                if property_id == "P1066":
                    self.assertEqual(source_qid, to_qid)
                    self.assertEqual(targets, [from_qid])
                elif property_id == "P802":
                    self.assertEqual(source_qid, from_qid)
                    self.assertEqual(targets, [to_qid])
                else:
                    self.fail(f"unexpected lineage predicate {property_id}")

    def test_bilingual_and_map_fixture_floor(self):
        works = self.catalog["works"]
        people = self.catalog["people"]
        self.assertGreaterEqual(len(works), 500)
        self.assertGreaterEqual(
            sum(work["name_zh"] is not None for work in works),
            int(len(works) * 0.9),
        )
        self.assertGreaterEqual(
            sum(
                work["coordinates"]["lat"] is not None
                for work in works
            ),
            int(len(works) * 0.9),
        )
        self.assertGreaterEqual(
            sum(
                person["name_zh"] is not None
                for person in people
            ),
            int(len(people) * 0.5),
        )
        for work in works:
            if work["work_type_mapping_status"] == "mapped_exact":
                self.assertNotEqual(work["work_type"], "unknown")
            else:
                self.assertEqual(work["work_type"], "unknown")


if __name__ == "__main__":
    unittest.main()
