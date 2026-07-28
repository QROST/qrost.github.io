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


def wikidata_time_statement(
    year: int,
    *,
    precision: int = 9,
    rank: str = "normal",
    month: int | None = None,
    day: int | None = None,
    calendar_model: str = importer.SUPPORTED_CALENDAR_MODELS[0],
    before: int = 0,
    after: int = 0,
    timezone: int = 0,
    snaktype: str = "value",
    raw_time: str | None = None,
    qualifiers: dict | None = None,
) -> dict:
    statement = {
        "id": f"fixture-{year}-{precision}-{rank}",
        "rank": rank,
        "mainsnak": {
            "snaktype": snaktype,
        },
    }
    if snaktype != "value":
        return statement
    if month is None:
        month = 0 if precision == 9 else 1
    if day is None:
        day = 1 if precision == 11 else 0
    if raw_time is None:
        sign = "+" if year >= 0 else "-"
        raw_time = (
            f"{sign}{abs(year):04d}-{month:02d}-{day:02d}T00:00:00Z"
        )
    statement["mainsnak"]["datavalue"] = {
        "type": "time",
        "value": {
            "after": after,
            "before": before,
            "calendarmodel": calendar_model,
            "precision": precision,
            "time": raw_time,
            "timezone": timezone,
        },
    }
    if qualifiers is not None:
        statement["qualifiers"] = qualifiers
    return statement


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
        self.assertEqual(self.snapshot["queries"], [])
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

    def test_period_boundaries_are_total_and_non_overlapping(self):
        cases = {
            -1: "before_1000",
            999: "before_1000",
            1000: "1000_1499",
            1499: "1000_1499",
            1500: "1500_1799",
            1799: "1500_1799",
            1800: "1800_1918",
            1918: "1800_1918",
            1919: "1919_1945",
            1945: "1919_1945",
            1946: "1946_1979",
            1979: "1946_1979",
            1980: "1980_1999",
            1999: "1980_1999",
            2000: "2000_present",
            2026: "2000_present",
        }
        for year, expected in cases.items():
            with self.subTest(year=year):
                result = importer.derive_period_from_inception(
                    {
                        "claims": {
                            "P571": [wikidata_time_statement(year)],
                        }
                    },
                    self.config,
                )
                self.assertIsNotNone(result)
                self.assertEqual(result["period"], expected)

    def test_period_derivation_uses_best_rank_only(self):
        result = importer.derive_period_from_inception(
            {
                "claims": {
                    "P571": [
                        wikidata_time_statement(1800, rank="normal"),
                        wikidata_time_statement(2001, rank="preferred"),
                        wikidata_time_statement(1500, rank="deprecated"),
                    ],
                }
            },
            self.config,
        )
        self.assertIsNotNone(result)
        self.assertEqual(result["period"], "2000_present")
        self.assertEqual([row["index"] for row in result["rows"]], [1])

    def test_period_derivation_requires_all_best_rank_values_to_agree(self):
        agreeing = importer.derive_period_from_inception(
            {
                "claims": {
                    "P571": [
                        wikidata_time_statement(1950),
                        wikidata_time_statement(1979),
                    ],
                }
            },
            self.config,
        )
        self.assertIsNotNone(agreeing)
        self.assertEqual(agreeing["period"], "1946_1979")

        conflicting = importer.derive_period_from_inception(
            {
                "claims": {
                    "P571": [
                        wikidata_time_statement(1979),
                        wikidata_time_statement(1980),
                    ],
                }
            },
            self.config,
        )
        self.assertIsNone(conflicting)

    def test_unsupported_time_semantics_fail_closed(self):
        unsupported = {
            "decade precision": wikidata_time_statement(1900, precision=8),
            "unsupported calendar": wikidata_time_statement(
                1900,
                calendar_model="http://www.wikidata.org/entity/Q999999",
            ),
            "before uncertainty": wikidata_time_statement(1900, before=1),
            "after uncertainty": wikidata_time_statement(1900, after=1),
            "nonzero timezone": wikidata_time_statement(1900, timezone=1),
            "novalue": wikidata_time_statement(1900, snaktype="novalue"),
            "malformed timestamp": wikidata_time_statement(
                1900,
                raw_time="+1900-01-01",
            ),
            "year zero": wikidata_time_statement(0),
            "after data cutoff": wikidata_time_statement(2027),
            "invalid day": wikidata_time_statement(
                1900,
                precision=11,
                month=2,
                day=29,
            ),
            "unsupported rank": wikidata_time_statement(
                1900,
                rank="some-new-rank",
            ),
            "qualified statement": wikidata_time_statement(
                1900,
                qualifiers={
                    "P1480": [
                        {
                            "snaktype": "value",
                            "datavalue": {
                                "type": "wikibase-entityid",
                                "value": {"id": "Q5727902"},
                            },
                        }
                    ],
                },
            ),
        }
        for label, statement in unsupported.items():
            with self.subTest(label=label):
                result = importer.derive_period_from_inception(
                    {"claims": {"P571": [statement]}},
                    self.config,
                )
                self.assertIsNone(result)

    def test_official_opening_alone_never_derives_period(self):
        result = importer.derive_period_from_inception(
            {
                "claims": {
                    "P1619": [wikidata_time_statement(2000)],
                }
            },
            self.config,
        )
        self.assertIsNone(result)

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

    def test_derived_periods_have_pinned_indirect_provenance(self):
        self.assertEqual(
            self.catalog["transformer_id"],
            self.config["transformer"]["id"],
        )
        self.assertEqual(
            self.catalog["transformer_version"],
            self.config["transformer"]["version"],
        )
        self.assertEqual(
            self.catalog["generator"],
            (
                f"{self.config['transformer']['id']}@"
                f"{self.config['transformer']['version']}"
            ),
        )
        claims = {
            claim["id"]: claim
            for claim in self.catalog["claims"]
        }
        known_periods = 0
        for work in self.catalog["works"]:
            work_qid = work["external_ids"]["wikidata"]
            record = self.snapshot["entities"][work_qid]["record"]
            derived = importer.derive_period_from_inception(
                record,
                self.config,
            )
            period_claims = [
                claims[claim_id]
                for claim_id in work["claim_ids"]
                if claims[claim_id]["predicate"] == "field_period"
            ]
            if work["period"] == "unknown":
                self.assertEqual(period_claims, [])
                self.assertIsNone(derived)
                continue
            known_periods += 1
            self.assertIsNotNone(derived)
            self.assertEqual(derived["period"], work["period"])
            self.assertEqual(len(period_claims), 1)
            claim = period_claims[0]
            self.assertEqual(claim["object"]["value"], work["period"])
            self.assertEqual(
                claim["qualifiers"]["basis_property"],
                "P571",
            )
            self.assertEqual(
                claim["qualifiers"]["derivation_rule_id"],
                self.config["period_derivation"]["rule_id"],
            )
            self.assertEqual(
                claim["qualifiers"]["coverage_config_version"],
                self.config["config_version"],
            )
            self.assertEqual(
                len(claim["evidence"]),
                len(claim["qualifiers"]["source_years"]),
            )
            self.assertEqual(
                claim["qualifiers"]["source_years"],
                [row["year"] for row in derived["rows"]],
            )
            self.assertEqual(
                [
                    evidence["native_field_path"]
                    for evidence in claim["evidence"]
                ],
                [
                    f"/claims/P571/{row['index']}"
                    for row in derived["rows"]
                ],
            )
            for evidence, row in zip(claim["evidence"], derived["rows"]):
                self.assertEqual(evidence["support"], "indirect")
                self.assertEqual(evidence["native_predicate"], "P571")
                self.assertRegex(
                    evidence["native_field_path"],
                    r"^/claims/P571/\d+$",
                )
                self.assertEqual(
                    evidence["rank"],
                    row["statement"].get("rank"),
                )
                self.assertEqual(
                    evidence["qualifiers"],
                    importer.statement_qualifiers(row["statement"]),
                )
                self.assertEqual(
                    evidence["references"],
                    row["statement"].get("references", []),
                )
        # The pinned fixture currently yields 293 conservative periods after
        # rejecting every qualified P571 statement. Keep a regression floor
        # without turning the fixture census into a universal data promise.
        self.assertGreaterEqual(known_periods, 275)
        self.assertLess(known_periods, len(self.catalog["works"]))

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
