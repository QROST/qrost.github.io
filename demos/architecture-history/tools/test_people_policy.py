#!/usr/bin/env python3
"""Unit tests for architecture-history people keep/drop policy."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
POLICY_PATH = ROOT / "tools" / "people_policy.py"

spec = importlib.util.spec_from_file_location(
    "architecture_history_people_policy",
    POLICY_PATH,
)
assert spec and spec.loader
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


def person(person_id: str, qid: str, *, name_en: str) -> dict:
    return {
        "id": person_id,
        "entity_type": "person",
        "external_ids": {"wikidata": qid},
        "name_en": name_en,
        "name_zh": None,
    }


def human_record(qid: str, *, occupations: list[str] | None = None) -> dict:
    claims = {"P31": [{"mainsnak": {"snaktype": "value", "datavalue": {"type": "wikibase-entityid", "value": {"id": "Q5"}}}}]}
    if occupations:
        claims["P106"] = [
            {
                "mainsnak": {
                    "snaktype": "value",
                    "datavalue": {
                        "type": "wikibase-entityid",
                        "value": {"id": occupation_qid},
                    },
                }
            }
            for occupation_qid in occupations
        ]
    return {"id": qid, "claims": claims}


class PeoplePolicyTests(unittest.TestCase):
    def test_unmapped_occupation_is_explicitly_unknown_not_historian(self):
        record = human_record("Q900", occupations=["Q999999"])
        self.assertEqual(
            policy.derive_person_roles(record, role_from_credit=False),
            ["unknown"],
        )

    def test_work_credit_is_the_only_unknown_occupation_architect_fallback(self):
        record = human_record("Q900", occupations=["Q999999"])
        self.assertEqual(
            policy.derive_person_roles(record, role_from_credit=True),
            ["architect"],
        )

    def test_drops_confucius_without_architecture_anchor(self):
        people = [
            person("person-wd-q42973", "Q42973", name_en="Architect Seed"),
            person("person-wd-q4604", "Q4604", name_en="Confucius"),
            person("person-wd-q9047", "Q9047", name_en="Voltaire"),
        ]
        records = {
            "Q42973": human_record("Q42973", occupations=[policy.ARCHITECT_QID]),
            "Q4604": human_record("Q4604", occupations=["Q36180"]),
            "Q9047": human_record("Q9047", occupations=["Q4964182"]),
        }
        relations = [
            {
                "id": "relation-wd-influence-q4604-q9047",
                "from_id": "person-wd-q4604",
                "to_id": "person-wd-q9047",
            }
        ]
        keep, stats = policy.keep_people_by_policy(
            people=people,
            works=[],
            practices=[],
            relations=relations,
            entity_records=records,
        )
        self.assertIn("person-wd-q42973", keep)
        self.assertNotIn("person-wd-q4604", keep)
        self.assertNotIn("person-wd-q9047", keep)
        self.assertEqual(stats["seed_people"], 1)

    def test_keeps_one_hop_from_architect_anchor(self):
        people = [
            person("person-wd-q78484", "Q78484", name_en="Rudolf Steiner"),
            person("person-wd-q5879", "Q5879", name_en="Goethe"),
        ]
        records = {
            "Q78484": human_record("Q78484", occupations=[policy.ARCHITECT_QID]),
            "Q5879": human_record("Q5879", occupations=["Q49757"]),
        }
        relations = [
            {
                "id": "relation-wd-influence-q5879-q78484",
                "from_id": "person-wd-q5879",
                "to_id": "person-wd-q78484",
            }
        ]
        keep, _ = policy.keep_people_by_policy(
            people=people,
            works=[],
            practices=[],
            relations=relations,
            entity_records=records,
        )
        self.assertIn("person-wd-q78484", keep)
        self.assertIn("person-wd-q5879", keep)

    def test_does_not_chain_through_celebrity_anchors(self):
        people = [
            person("person-wd-q78484", "Q78484", name_en="Rudolf Steiner"),
            person("person-wd-q5879", "Q5879", name_en="Goethe"),
            person("person-wd-q935", "Q935", name_en="Nietzsche"),
        ]
        records = {
            "Q78484": human_record("Q78484", occupations=[policy.ARCHITECT_QID]),
            "Q5879": human_record("Q5879", occupations=["Q49757"]),
            "Q935": human_record("Q935", occupations=["Q4964182"]),
        }
        relations = [
            {
                "id": "relation-wd-influence-q5879-q78484",
                "from_id": "person-wd-q5879",
                "to_id": "person-wd-q78484",
            },
            {
                "id": "relation-wd-influence-q935-q5879",
                "from_id": "person-wd-q935",
                "to_id": "person-wd-q5879",
            },
        ]
        keep, _ = policy.keep_people_by_policy(
            people=people,
            works=[],
            practices=[],
            relations=relations,
            entity_records=records,
        )
        self.assertIn("person-wd-q78484", keep)
        self.assertIn("person-wd-q5879", keep)
        self.assertNotIn("person-wd-q935", keep)

    def test_seeded_qids_keep_historian_without_architect_occupation(self):
        people = [
            person("person-wd-q123143", "Q123143", name_en="Sigfried Giedion"),
        ]
        records = {
            "Q123143": human_record("Q123143", occupations=[policy.HISTORIAN_QID]),
        }
        dropped, _ = policy.keep_people_by_policy(
            people=people,
            works=[],
            practices=[],
            relations=[],
            entity_records=records,
        )
        kept, stats = policy.keep_people_by_policy(
            people=people,
            works=[],
            practices=[],
            relations=[],
            entity_records=records,
            seeded_qids={"Q123143"},
        )
        self.assertNotIn("person-wd-q123143", dropped)
        self.assertIn("person-wd-q123143", kept)
        self.assertEqual(stats["seed_people"], 1)

    def test_seeded_historian_is_not_a_relation_anchor(self):
        people = [
            person("person-wd-q123143", "Q123143", name_en="Sigfried Giedion"),
            person("person-wd-q9047", "Q9047", name_en="Voltaire"),
        ]
        records = {
            "Q123143": human_record("Q123143", occupations=[policy.HISTORIAN_QID]),
            "Q9047": human_record("Q9047", occupations=["Q4964182"]),
        }
        relations = [
            {
                "id": "relation-wd-influence-q9047-q123143",
                "from_id": "person-wd-q9047",
                "to_id": "person-wd-q123143",
            }
        ]
        keep, _ = policy.keep_people_by_policy(
            people=people,
            works=[],
            practices=[],
            relations=relations,
            entity_records=records,
            seeded_qids={"Q123143"},
        )
        self.assertIn("person-wd-q123143", keep)
        self.assertNotIn("person-wd-q9047", keep)

    def test_prune_catalog_people_respects_seeded_qids(self):
        catalog = {
            "people": [
                person("person-wd-q123143", "Q123143", name_en="Sigfried Giedion"),
            ],
            "works": [],
            "practices": [],
            "relations": [],
            "claims": [
                {"id": "claim-wd-q123143-name-en", "subject_id": "person-wd-q123143"},
            ],
        }
        records = {
            "Q123143": human_record("Q123143", occupations=[policy.HISTORIAN_QID]),
        }
        dropped, dropped_stats = policy.prune_catalog_people(catalog, records)
        kept, kept_stats = policy.prune_catalog_people(
            catalog,
            records,
            seeded_qids={"Q123143"},
        )
        self.assertEqual(dropped_stats["after"], 0)
        self.assertEqual(dropped_stats["dropped_people"], 1)
        self.assertEqual(kept_stats["after"], 1)
        self.assertEqual(kept["people"][0]["id"], "person-wd-q123143")
        self.assertEqual(len(kept["claims"]), 1)


if __name__ == "__main__":
    unittest.main()
