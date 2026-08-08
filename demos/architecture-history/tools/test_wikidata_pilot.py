#!/usr/bin/env python3
"""Regression checks for the pinned Wikidata hydration pilot."""

from __future__ import annotations

import copy
import hashlib
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

EXPECTED_NEW_PERIOD_ASSIGNMENTS = {
    "work-wd-q1012374": "1500_1799",
    "work-wd-q1013399": "1500_1799",
    "work-wd-q1054169": "2000_present",
    "work-wd-q1068063": "1800_1918",
    "work-wd-q106843470": "2000_present",
    "work-wd-q1138070": "1946_1979",
    "work-wd-q1139574": "2000_present",
    "work-wd-q1140026": "1946_1979",
    "work-wd-q11819": "1800_1918",
    "work-wd-q125006": "1800_1918",
    "work-wd-q127097": "1800_1918",
    "work-wd-q131330": "1500_1799",
    "work-wd-q133525": "2000_present",
    "work-wd-q1397013": "1946_1979",
    "work-wd-q147312": "1800_1918",
    "work-wd-q14862239": "2000_present",
    "work-wd-q1655766": "1980_1999",
    "work-wd-q16566": "1500_1799",
    "work-wd-q173882": "1500_1799",
    "work-wd-q1740490": "1500_1799",
    "work-wd-q1821821": "1946_1979",
    "work-wd-q1831907": "1500_1799",
    "work-wd-q18536": "2000_present",
    "work-wd-q1881229": "2000_present",
    "work-wd-q193682": "1980_1999",
    "work-wd-q20196262": "2000_present",
    "work-wd-q206220": "1500_1799",
    "work-wd-q208559": "1500_1799",
    "work-wd-q2379884": "2000_present",
    "work-wd-q2429287": "1500_1799",
    "work-wd-q244877": "2000_present",
    "work-wd-q252575": "1000_1499",
    "work-wd-q265129": "1800_1918",
    "work-wd-q2746031": "2000_present",
    "work-wd-q29247": "1980_1999",
    "work-wd-q29286": "1000_1499",
    "work-wd-q327940": "1800_1918",
    "work-wd-q35525": "1800_1918",
    "work-wd-q3678603": "2000_present",
    "work-wd-q390124": "1919_1945",
    "work-wd-q457453": "1919_1945",
    "work-wd-q45957": "1500_1799",
    "work-wd-q466835": "1946_1979",
    "work-wd-q46996829": "2000_present",
    "work-wd-q4720740": "1946_1979",
    "work-wd-q494407": "1919_1945",
    "work-wd-q570949": "2000_present",
    "work-wd-q606763": "1000_1499",
    "work-wd-q613355": "1500_1799",
    "work-wd-q62408": "1000_1499",
    "work-wd-q6352575": "1946_1979",
    "work-wd-q6373": "1500_1799",
    "work-wd-q699614": "2000_present",
    "work-wd-q712476": "1800_1918",
    "work-wd-q7169478": "2000_present",
    "work-wd-q752669": "1946_1979",
    "work-wd-q779736": "1946_1979",
    "work-wd-q795228": "1946_1979",
    "work-wd-q840886": "1800_1918",
    "work-wd-q874557": "1919_1945",
    "work-wd-q917274": "2000_present",
}
PRIOR_PERIOD_ASSIGNMENT_SHA256 = (
    "b32f3e5efc648916453e21ecd06dcc42e8987e8cd03c62aabeed19472f85fd4f"
)
NEW_WORK_TYPE_AUTHORITY_QIDS = {
    "Q2977",
    "Q3950",
    "Q92026",
    "Q1060829",
    "Q1307276",
    "Q7138926",
}
NEW_WORK_TYPE_WORK_IDS_SHA256 = (
    "0a51e352312a5465b1765bd7817e960ae3da832adb97e6f0eec93e22d111eb08"
)


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
        cls.authority_snapshots = importer.load_type_authority_snapshots(
            cls.config
        )
        cls.seed_file = load_json(ROOT / "tools" / "wikidata-hydration-seeds.json")
        cls.authority_seed_file = load_json(
            ROOT / "tools" / "wikidata-work-type-authority-seeds.json"
        )

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

    def test_year_precision_accepts_only_zero_or_valid_date_components(self):
        valid = {
            "zero lower components": wikidata_time_statement(1603),
            "valid lower date": wikidata_time_statement(
                1603,
                month=1,
                day=17,
            ),
            "gregorian leap day": wikidata_time_statement(
                2000,
                month=2,
                day=29,
            ),
            "julian leap day": wikidata_time_statement(
                1500,
                month=2,
                day=29,
                calendar_model=importer.SUPPORTED_CALENDAR_MODELS[1],
            ),
        }
        for label, statement in valid.items():
            with self.subTest(label=label):
                year = importer.supported_wikidata_year(
                    statement,
                    self.config["period_derivation"],
                )
                self.assertIsNotNone(year)

        invalid = {
            "month without day": wikidata_time_statement(
                1900,
                month=1,
                day=0,
            ),
            "day without month": wikidata_time_statement(
                1900,
                month=0,
                day=1,
            ),
            "invalid gregorian leap day": wikidata_time_statement(
                1900,
                month=2,
                day=29,
            ),
            "invalid month": wikidata_time_statement(
                1900,
                month=13,
                day=1,
            ),
        }
        for label, statement in invalid.items():
            with self.subTest(label=label):
                self.assertIsNone(
                    importer.supported_wikidata_year(
                        statement,
                        self.config["period_derivation"],
                    )
                )

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
        }
        for label, statement in unsupported.items():
            with self.subTest(label=label):
                result = importer.derive_period_from_inception(
                    {"claims": {"P571": [statement]}},
                    self.config,
                )
                self.assertIsNone(result)

    def test_metadata_qualifiers_are_accepted_on_p571(self):
        statement = wikidata_time_statement(
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
        )
        result = importer.derive_period_from_inception(
            {"claims": {"P571": [statement]}},
            self.config,
        )
        self.assertIsNotNone(result)
        self.assertEqual(result["period"], "1800_1918")

    def test_official_opening_derives_period_as_fallback(self):
        result = importer.derive_period_from_inception(
            {
                "claims": {
                    "P1619": [wikidata_time_statement(2000)],
                }
            },
            self.config,
        )
        self.assertIsNotNone(result)
        self.assertEqual(result["period"], "2000_present")
        self.assertEqual(result["rows"][0]["property"], "P1619")

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
        first = importer.CatalogBuilder(
            self.snapshot,
            self.config,
            self.authority_snapshots,
        ).build()
        second = importer.CatalogBuilder(
            self.snapshot,
            self.config,
            self.authority_snapshots,
        ).build()
        self.assertEqual(first, second)

    def test_editorial_place_verification_layer(self):
        imported = importer.CatalogBuilder(
            self.snapshot,
            self.config,
            self.authority_snapshots,
        ).build()
        for key in ("relations",):
            self.assertEqual(imported[key], self.catalog[key])
        self.assertEqual(
            [person["id"] for person in imported["people"]],
            [person["id"] for person in self.catalog["people"]],
        )
        self.assertEqual(
            [practice["id"] for practice in imported["practices"]],
            [practice["id"] for practice in self.catalog["practices"]],
        )
        self.assertEqual(
            [work["id"] for work in imported["works"]],
            [work["id"] for work in self.catalog["works"]],
        )

        self.assertEqual(
            [place["id"] for place in imported["places"]],
            [place["id"] for place in self.catalog["places"]],
        )
        verified_places = [
            place
            for place in self.catalog["places"]
            if place["verification_status"] == "verified"
        ]
        self.assertEqual(len(verified_places), len(self.catalog["places"]))
        self.assertTrue(verified_places)

        claim_by_id = {claim["id"]: claim for claim in self.catalog["claims"]}
        for place in verified_places:
            self.assertEqual(place["last_verified"], "2026-08-07")
            for claim_id in place["claim_ids"]:
                claim = claim_by_id[claim_id]
                self.assertEqual(claim["verification_status"], "verified")
                self.assertEqual(claim["reviewed_by"], "reviewer-agentic-cursor")
                self.assertEqual(claim["reviewed_at"], "2026-08-07")
                field = claim["predicate"].removeprefix("field_")
                self.assertEqual(claim["object"].get("value"), place[field])

        reviewers = load_json(ROOT / "assets" / "data" / "reviewers.json")
        active = {
            row["id"]: row
            for row in reviewers["reviewers"]
            if row.get("active")
        }
        self.assertIn("reviewer-agentic-cursor", active)
        self.assertEqual(active["reviewer-agentic-cursor"]["reviewer_type"], "agentic")

        verified_people = [
            person
            for person in self.catalog["people"]
            if person["verification_status"] == "verified"
        ]
        self.assertGreaterEqual(len(verified_people), 1)
        for person in verified_people:
            self.assertEqual(person["last_verified"], "2026-08-07")
            for claim_id in person["claim_ids"]:
                claim = claim_by_id[claim_id]
                self.assertEqual(claim["verification_status"], "verified")
                self.assertEqual(claim["reviewed_by"], "reviewer-agentic-cursor")

        verified_practices = [
            practice
            for practice in self.catalog["practices"]
            if practice["verification_status"] == "verified"
        ]
        verified_works = [
            work
            for work in self.catalog["works"]
            if work["verification_status"] == "verified"
        ]
        self.assertEqual(len(verified_practices), len(self.catalog["practices"]))
        self.assertGreaterEqual(len(verified_works), 1)
        for practice in verified_practices:
            self.assertEqual(practice["last_verified"], "2026-08-07")
            for claim_id in practice["claim_ids"]:
                claim = claim_by_id[claim_id]
                self.assertEqual(claim["verification_status"], "verified")
                self.assertEqual(claim["reviewed_by"], "reviewer-agentic-cursor")
        for work in verified_works:
            self.assertEqual(work["last_verified"], "2026-08-07")
            self.assertEqual(work["period"], "unknown")
            self.assertFalse(work.get("credits"))
            self.assertFalse(work.get("unresolved_credits"))
            field_claims = [
                claim_by_id[claim_id]
                for claim_id in work["claim_ids"]
                if claim_by_id[claim_id]["predicate"].startswith("field_")
            ]
            self.assertTrue(field_claims)
            self.assertTrue(
                any(claim["verification_status"] == "verified" for claim in field_claims)
            )
            for claim in field_claims:
                if claim["verification_status"] != "verified":
                    continue
                self.assertEqual(claim["reviewed_by"], "reviewer-agentic-cursor")

        non_editorial_statuses = {
            item["verification_status"]
            for item in self.catalog["relations"]
        }
        self.assertEqual(non_editorial_statuses, {"candidate"})

    def test_work_type_authority_sidecar_is_revision_pinned(self):
        bindings = self.config["work_type_derivation"]["authority_bindings"]
        self.assertEqual(len(bindings), 1)
        binding = bindings[0]
        self.assertEqual(set(binding["qids"]), NEW_WORK_TYPE_AUTHORITY_QIDS)
        snapshot = self.authority_snapshots[binding["snapshot_id"]]
        seed_qids = sorted(
            (
                row["qid"]
                for row in self.authority_seed_file["authorities"]
            ),
            key=lambda qid: int(qid[1:]),
        )
        self.assertEqual(binding["qids"], seed_qids)
        self.assertEqual(
            snapshot["base_work_snapshot_id"],
            self.authority_seed_file["base_work_snapshot_id"],
        )
        self.assertEqual(
            snapshot["base_work_snapshot_id"],
            self.snapshot["snapshot_id"],
        )
        self.assertEqual(
            snapshot["selection"]["method"],
            "exact_instance_allowlist_authority",
        )
        self.assertEqual(snapshot["selection"]["authority_qids"], binding["qids"])
        self.assertEqual(
            snapshot["selection"]["authority_seed"],
            self.authority_seed_file,
        )
        self.assertEqual(
            snapshot["selection"]["seed_sha256"],
            importer.canonical_hash(self.authority_seed_file),
        )
        self.assertEqual(
            snapshot["snapshot_id"],
            importer.authority_snapshot_id(
                snapshot,
                snapshot["selection"]["seed_sha256"],
            ),
        )
        self.assertEqual(set(snapshot["entities"]), NEW_WORK_TYPE_AUTHORITY_QIDS)
        allowlist = {
            row["qid"]: row
            for row in self.config["exact_instance_allowlist"]
        }
        for qid, wrapper in snapshot["entities"].items():
            revision = wrapper["lastrevid"]
            record = wrapper["record"]
            self.assertEqual(record["id"], qid)
            self.assertEqual(record["lastrevid"], revision)
            self.assertEqual(
                wrapper["pinned_url"],
                "https://www.wikidata.org/wiki/Special:EntityData/"
                f"{qid}.json?revision={revision}",
            )
            self.assertEqual(
                wrapper["record_sha256"],
                importer.canonical_hash(record),
            )
            self.assertEqual(
                record["labels"]["en"]["value"],
                allowlist[qid]["label_en"],
            )
            self.assertLessEqual(set(record["claims"]), {"P279"})

    def test_work_type_authority_seed_hash_binds_full_semantics(self):
        binding = self.config["work_type_derivation"][
            "authority_bindings"
        ][0]
        snapshot_id = binding["snapshot_id"]
        mutations = {
            "work_type": lambda seed: seed["authorities"][0].update(
                {"work_type": "monument"}
            ),
            "risk_tags": lambda seed: seed["authorities"][0][
                "risk_tags"
            ].append("semantic_drift"),
            "label": lambda seed: seed["authorities"][0].update(
                {"label_hint_en": "Drifted label"}
            ),
            "base_snapshot": lambda seed: seed.update(
                {"base_work_snapshot_id": "wikidata-hydration-missing"}
            ),
            "seed_version": lambda seed: seed.update(
                {"seed_version": "0.1.1"}
            ),
        }
        for label, mutate in mutations.items():
            with self.subTest(label=label):
                snapshots = copy.deepcopy(self.authority_snapshots)
                seed = snapshots[snapshot_id]["selection"][
                    "authority_seed"
                ]
                mutate(seed)
                with self.assertRaises(ValueError):
                    importer.validate_type_authority_snapshots(
                        self.config,
                        self.snapshot["snapshot_id"],
                        snapshots,
                    )

    def test_new_unbound_work_type_mapping_fails_closed(self):
        malformed = copy.deepcopy(self.config)
        malformed["exact_instance_allowlist"].append(
            {
                "label_en": "unreviewed class",
                "qid": "Q999999999",
                "work_type": "building",
            }
        )
        with self.assertRaisesRegex(ValueError, "authority binding"):
            importer.validate_transform_config(malformed)

        malformed = copy.deepcopy(self.config)
        legacy = malformed["work_type_derivation"]["legacy_allowlist"]
        legacy["rows"][0]["work_type"] = "monument"
        legacy["rows_sha256"] = importer.canonical_hash(legacy["rows"])
        malformed["exact_instance_allowlist"][0]["work_type"] = "monument"
        with self.assertRaisesRegex(ValueError, "legacy work-type"):
            importer.validate_transform_config(malformed)

    def test_new_work_type_mapping_batch_is_exact(self):
        affected_ids = []
        claims_by_id = {
            claim["id"]: claim
            for claim in self.catalog["claims"]
        }
        prior_work_type_by_class = {
            row["qid"]: row["work_type"]
            for row in self.config["exact_instance_allowlist"]
            if row["qid"] not in NEW_WORK_TYPE_AUTHORITY_QIDS
        }
        for work in self.catalog["works"]:
            qid = work["external_ids"]["wikidata"]
            record = self.snapshot["entities"][qid]["record"]
            direct_classes = [
                value
                for statement in record.get("claims", {}).get("P31", [])
                if statement.get("rank") != "deprecated"
                for value in importer.item_values(
                    {"claims": {"P31": [statement]}},
                    "P31",
                )
            ]
            if not set(direct_classes) & NEW_WORK_TYPE_AUTHORITY_QIDS:
                continue
            claim = next(
                (
                    claims_by_id[claim_id]
                    for claim_id in work["claim_ids"]
                    if claims_by_id[claim_id]["predicate"]
                    == "field_work_type"
                ),
                None,
            )
            self.assertEqual(work["work_type"], "building")
            self.assertEqual(work["work_type_mapping_status"], "mapped_exact")
            self.assertIsNotNone(claim)
            prior_mapped_types = {
                prior_work_type_by_class[class_qid]
                for class_qid in direct_classes
                if class_qid in prior_work_type_by_class
            }
            prior_status = (
                "unmapped"
                if not prior_mapped_types
                else "mapped_exact"
                if len(prior_mapped_types) == 1
                else "ambiguous"
            )
            if prior_status == "unmapped":
                affected_ids.append(work["id"])
                self.assertIn(
                    claim["qualifiers"]["matched_class_qid"],
                    NEW_WORK_TYPE_AUTHORITY_QIDS,
                )
                self.assertEqual(
                    claim["qualifiers"]["authority_snapshot_id"],
                    next(iter(self.authority_snapshots)),
                )
        affected_ids.sort()
        self.assertEqual(len(affected_ids), 44)
        self.assertEqual(
            hashlib.sha256(
                json.dumps(
                    affected_ids,
                    ensure_ascii=False,
                    separators=(",", ":"),
                ).encode("utf-8")
            ).hexdigest(),
            NEW_WORK_TYPE_WORK_IDS_SHA256,
        )
        statuses = {
            status: sum(
                work["work_type_mapping_status"] == status
                for work in self.catalog["works"]
            )
            for status in ("mapped_exact", "unmapped", "ambiguous")
        }
        self.assertEqual(
            statuses,
            {"mapped_exact": 286, "unmapped": 255, "ambiguous": 18},
        )

    def test_automatic_records_remain_candidates(self):
        imported = importer.CatalogBuilder(
            self.snapshot,
            self.config,
            self.authority_snapshots,
        ).build()
        graph = (
            imported["people"]
            + imported["practices"]
            + imported["places"]
            + imported["works"]
            + imported["relations"]
        )
        self.assertTrue(graph)
        self.assertEqual(
            {item["verification_status"] for item in graph},
            {"candidate"},
        )
        self.assertEqual(
            {claim["verification_status"] for claim in imported["claims"]},
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
                derived["rows"][0]["property"],
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
                    f"/claims/{row['property']}/{row['index']}"
                    for row in derived["rows"]
                ],
            )
            for evidence, row in zip(claim["evidence"], derived["rows"]):
                self.assertEqual(evidence["support"], "indirect")
                self.assertEqual(evidence["native_predicate"], row["property"])
                self.assertRegex(
                    evidence["native_field_path"],
                    rf"^/claims/{row['property']}/\d+$",
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
        # The pinned fixture still leaves unsupported or qualified P571 values
        # unknown. Keep a regression floor without turning its census into a
        # universal data promise; the exact fixture delta is asserted below.
        self.assertGreaterEqual(known_periods, 275)
        self.assertLess(known_periods, len(self.catalog["works"]))

    def test_period_fixture_census_and_prior_assignments_are_stable(self):
        assignments = {
            work["id"]: work["period"]
            for work in self.catalog["works"]
        }
        self.assertEqual(
            {
                work_id: assignments[work_id]
                for work_id in EXPECTED_NEW_PERIOD_ASSIGNMENTS
            },
            EXPECTED_NEW_PERIOD_ASSIGNMENTS,
        )
        prior_assignments = {
            work_id: period
            for work_id, period in assignments.items()
            if (
                period != "unknown"
                and work_id not in EXPECTED_NEW_PERIOD_ASSIGNMENTS
            )
        }
        prior_payload = json.dumps(
            prior_assignments,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        self.assertEqual(len(prior_assignments), 339)
        self.assertEqual(
            hashlib.sha256(prior_payload).hexdigest(),
            PRIOR_PERIOD_ASSIGNMENT_SHA256,
        )
        self.assertEqual(
            sum(period != "unknown" for period in assignments.values()),
            400,
        )
        self.assertEqual(
            sum(period == "unknown" for period in assignments.values()),
            159,
        )
        self.assertEqual(
            sum(
                claim["predicate"] == "field_period"
                for claim in self.catalog["claims"]
            ),
            400,
        )

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
