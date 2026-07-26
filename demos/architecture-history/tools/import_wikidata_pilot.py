#!/usr/bin/env python3
"""Derive a deterministic candidate catalog from a pinned Wikidata snapshot."""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional


ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = (
    ROOT
    / "assets"
    / "data"
    / "methodology"
    / "wikidata-coverage-config.json"
)
CATALOG_DIR = ROOT / "assets" / "data" / "catalog"
ADAPTER_ID = "wikidata-hydration-pilot"
ADAPTER_VERSION = "0.1.0"
ARCHITECT_QID = "Q42973"
HUMAN_QID = "Q5"
ARCHITECTURE_FIRM_QID = "Q4387609"
UNKNOWN_DATE = {
    "earliest": None,
    "latest": None,
    "precision": "unknown",
    "value": None,
}


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def atomic_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = (
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
        + "\n"
    ).encode("utf-8")
    handle = tempfile.NamedTemporaryFile(
        dir=path.parent,
        prefix=f".{path.name}.",
        delete=False,
    )
    temp_path = Path(handle.name)
    try:
        with handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_path, 0o644)
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def qid_number(qid: str) -> int:
    if not qid.startswith("Q") or not qid[1:].isdigit() or qid[1] == "0":
        raise ValueError(f"invalid Wikidata QID: {qid!r}")
    return int(qid[1:])


def qid_slug(qid: str) -> str:
    qid_number(qid)
    return qid.lower()


def entity_id(kind: str, qid: str) -> str:
    return f"{kind}-wd-{qid_slug(qid)}"


def item_values(record: dict, property_id: str) -> list[str]:
    values: list[str] = []
    for statement in record.get("claims", {}).get(property_id, []):
        if statement.get("rank") == "deprecated":
            continue
        snak = statement.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        value = snak.get("datavalue", {}).get("value")
        if isinstance(value, dict) and isinstance(value.get("id"), str):
            values.append(value["id"])
    return values


def string_values(record: dict, property_id: str) -> list[str]:
    values: list[str] = []
    for statement in record.get("claims", {}).get(property_id, []):
        if statement.get("rank") == "deprecated":
            continue
        snak = statement.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        value = snak.get("datavalue", {}).get("value")
        if isinstance(value, str):
            values.append(value)
    return values


def label_value(record: dict, language: str) -> Optional[str]:
    value = record.get("labels", {}).get(language, {}).get("value")
    return value if isinstance(value, str) and value.strip() else None


def labels(record: dict) -> tuple[Optional[str], str]:
    english = label_value(record, "en")
    if not english:
        raise ValueError(f"{record.get('id')}: English label is required")
    chinese = label_value(record, "zh-hans") or label_value(record, "zh")
    return chinese, english


def aliases(record: dict, languages: tuple[str, ...]) -> list[str]:
    values: list[str] = []
    for language in languages:
        rows = record.get("aliases", {}).get(language, [])
        for row in rows if isinstance(rows, list) else []:
            value = row.get("value")
            if isinstance(value, str) and value.strip() and value not in values:
                values.append(value)
    return values


def statement_qualifiers(statement: dict) -> list[dict]:
    qualifiers = statement.get("qualifiers", {})
    if not isinstance(qualifiers, dict):
        return []
    return [
        {
            "property_id": property_id,
            "snaks": qualifiers[property_id],
        }
        for property_id in sorted(qualifiers)
    ]


class CatalogBuilder:
    def __init__(self, snapshot: dict, config: dict):
        self.snapshot = snapshot
        self.config = config
        self.snapshot_id = snapshot["snapshot_id"]
        self.accessed = snapshot["accessed"]
        self.entities = snapshot["entities"]
        self.seed_by_qid = {
            seed["qid"]: seed
            for seed in snapshot["seeds"]
        }
        self.work_type_by_class = {
            row["qid"]: row["work_type"]
            for row in config["exact_instance_allowlist"]
        }
        self.country_authority = {
            row["country_qid"]: row
            for row in config["country_region_authority"]
        }
        self.people: dict[str, dict] = {}
        self.practices: dict[str, dict] = {}
        self.places: dict[str, dict] = {}
        self.works: dict[str, dict] = {}
        self.claims: dict[str, dict] = {}
        self.relations: dict[str, dict] = {}

    def record(self, qid: str) -> dict:
        wrapper = self.entities.get(qid)
        if wrapper is None:
            raise ValueError(f"snapshot lacks required entity {qid}")
        return wrapper["record"]

    def evidence(
        self,
        qid: str,
        *,
        path: str,
        predicate: Optional[str],
        locator: str,
        language: Optional[str] = None,
        statement: Optional[dict] = None,
    ) -> dict:
        wrapper = self.entities[qid]
        return {
            "accessed": self.accessed,
            "contributors": [],
            "extraction_method": "structured_mapping",
            "language": language,
            "locator": locator,
            "native_field_path": path,
            "native_predicate": predicate,
            "native_record_id": f"{qid}@{wrapper['lastrevid']}",
            "qualifiers": (
                statement_qualifiers(statement)
                if statement is not None
                else []
            ),
            "rank": statement.get("rank") if statement is not None else None,
            "references": (
                statement.get("references", [])
                if statement is not None
                else []
            ),
            "snapshot_id": self.snapshot_id,
            "source_id": "wikidata",
            "source_record_sha256": wrapper["record_sha256"],
            "support": "explicit",
            "url": wrapper["pinned_url"],
        }

    def add_claim(
        self,
        *,
        claim_id: str,
        subject_id: str,
        predicate: str,
        object_value: dict,
        evidence: list[dict],
        confidence: float = 0.6,
        qualifiers: Optional[dict] = None,
    ) -> str:
        if claim_id in self.claims:
            raise ValueError(f"duplicate generated claim id {claim_id}")
        self.claims[claim_id] = {
            "confidence": confidence,
            "evidence": evidence,
            "id": claim_id,
            "object": object_value,
            "predicate": predicate,
            "qualifiers": qualifiers or {},
            "reviewed_at": None,
            "reviewed_by": None,
            "subject_id": subject_id,
            "verification_status": "candidate",
        }
        return claim_id

    def add_name_claims(
        self,
        *,
        qid: str,
        subject_id: str,
        chinese: Optional[str],
        english: str,
    ) -> list[str]:
        claim_ids: list[str] = []
        en_id = f"claim-wd-{qid_slug(qid)}-name-en"
        claim_ids.append(
            self.add_claim(
                claim_id=en_id,
                subject_id=subject_id,
                predicate="field_name_en",
                object_value={"value": english},
                evidence=[
                    self.evidence(
                        qid,
                        path="/labels/en",
                        predicate=None,
                        locator=f"{qid}/labels/en",
                        language="en",
                    )
                ],
            )
        )
        if chinese:
            zh_language = (
                "zh-hans"
                if label_value(self.record(qid), "zh-hans")
                else "zh"
            )
            zh_id = f"claim-wd-{qid_slug(qid)}-name-zh"
            claim_ids.append(
                self.add_claim(
                    claim_id=zh_id,
                    subject_id=subject_id,
                    predicate="field_name_zh",
                    object_value={"value": chinese},
                    evidence=[
                        self.evidence(
                            qid,
                            path=f"/labels/{zh_language}",
                            predicate=None,
                            locator=f"{qid}/labels/{zh_language}",
                            language=zh_language,
                        )
                    ],
                )
            )
        return claim_ids

    def ensure_person(
        self,
        qid: str,
        *,
        role_from_credit: bool,
    ) -> Optional[str]:
        person_id = entity_id("person", qid)
        if person_id in self.people:
            return person_id
        record = self.record(qid)
        instances = set(item_values(record, "P31"))
        occupations = set(item_values(record, "P106"))
        if HUMAN_QID not in instances:
            return None
        if not role_from_credit and ARCHITECT_QID not in occupations:
            return None
        try:
            chinese, english = labels(record)
        except ValueError:
            return None
        claim_ids = self.add_name_claims(
            qid=qid,
            subject_id=person_id,
            chinese=chinese,
            english=english,
        )
        self.people[person_id] = {
            "aliases_en": aliases(record, ("en",)),
            "aliases_zh": aliases(record, ("zh-hans", "zh")),
            "birth": dict(UNKNOWN_DATE),
            "claim_ids": claim_ids,
            "confidence": 0.6,
            "country_codes": [],
            "death": dict(UNKNOWN_DATE),
            "entity_type": "person",
            "external_ids": {"wikidata": qid},
            "id": person_id,
            "last_verified": self.accessed,
            "name_en": english,
            "name_native": None,
            "name_zh": chinese,
            "name_zh_status": (
                "source_label_candidate"
                if chinese
                else "missing"
            ),
            "region": "unknown",
            "roles": ["architect"],
            "summary_en": "",
            "summary_zh": "",
            "verification_status": "candidate",
        }
        return person_id

    def ensure_practice(self, qid: str) -> Optional[str]:
        practice_id = entity_id("practice", qid)
        if practice_id in self.practices:
            return practice_id
        record = self.record(qid)
        if ARCHITECTURE_FIRM_QID not in set(item_values(record, "P31")):
            return None
        try:
            chinese, english = labels(record)
        except ValueError:
            return None
        claim_ids = self.add_name_claims(
            qid=qid,
            subject_id=practice_id,
            chinese=chinese,
            english=english,
        )
        self.practices[practice_id] = {
            "claim_ids": claim_ids,
            "confidence": 0.6,
            "country_codes": [],
            "dissolved": dict(UNKNOWN_DATE),
            "entity_type": "practice",
            "external_ids": {"wikidata": qid},
            "founded": dict(UNKNOWN_DATE),
            "id": practice_id,
            "last_verified": self.accessed,
            "name_en": english,
            "name_native": None,
            "name_zh": chinese,
            "practice_type": "architecture_firm",
            "region": "unknown",
            "summary_en": "",
            "summary_zh": "",
            "verification_status": "candidate",
        }
        return practice_id

    def ensure_country_place(self, seed: dict) -> str:
        qid = seed["expected_country_qid"]
        authority = self.country_authority.get(qid)
        expected_authority = {
            "country_qid": qid,
            "iso2": seed["expected_country_code"],
            "region": seed["region"],
        }
        if authority != expected_authority:
            raise ValueError(
                f"{seed['qid']}: seed geography does not match country authority"
            )
        place_id = entity_id("place", qid)
        if place_id in self.places:
            existing = self.places[place_id]
            if existing["region"] != seed["region"]:
                raise ValueError(f"{qid}: seed countries cannot span project regions")
            return place_id
        record = self.record(qid)
        chinese, english = labels(record)
        claim_ids = self.add_name_claims(
            qid=qid,
            subject_id=place_id,
            chinese=chinese,
            english=english,
        )
        iso_statement: Optional[tuple[int, dict]] = None
        for index, statement in enumerate(record.get("claims", {}).get("P297", [])):
            if statement.get("rank") == "deprecated":
                continue
            values = string_values(
                {"claims": {"P297": [statement]}},
                "P297",
            )
            if values == [authority["iso2"]]:
                iso_statement = (index, statement)
                break
        if iso_statement is None:
            raise ValueError(
                f"{qid}: country authority ISO code is absent from pinned P297"
            )
        iso_index, iso_source = iso_statement
        country_code_claim_id = f"claim-wd-{qid_slug(qid)}-country-code"
        claim_ids.append(
            self.add_claim(
                claim_id=country_code_claim_id,
                subject_id=place_id,
                predicate="field_country_code",
                object_value={"value": authority["iso2"]},
                evidence=[
                    self.evidence(
                        qid,
                        path=f"/claims/P297/{iso_index}",
                        predicate="P297",
                        locator=f"{qid}/P297/{iso_source.get('id', iso_index)}",
                        statement=iso_source,
                    )
                ],
            )
        )
        self.places[place_id] = {
            "claim_ids": claim_ids,
            "confidence": 0.6,
            "country_code": authority["iso2"],
            "entity_type": "place",
            "external_ids": {"wikidata": qid},
            "id": place_id,
            "last_verified": self.accessed,
            "lat": None,
            "lng": None,
            "name_en": english,
            "name_native": None,
            "name_zh": chinese,
            "region": authority["region"],
            "verification_status": "candidate",
        }
        return place_id

    def mapped_work_type(
        self,
        qid: str,
    ) -> tuple[str, str, Optional[tuple[int, dict]]]:
        record = self.record(qid)
        matches: list[tuple[int, dict, str]] = []
        for index, statement in enumerate(record.get("claims", {}).get("P31", [])):
            if statement.get("rank") == "deprecated":
                continue
            values = item_values({"claims": {"P31": [statement]}}, "P31")
            if not values:
                continue
            work_type = self.work_type_by_class.get(values[0])
            if work_type:
                matches.append((index, statement, work_type))
        mapped_types = {row[2] for row in matches}
        if not mapped_types:
            return "unknown", "unmapped", None
        if len(mapped_types) != 1:
            return "unknown", "ambiguous", None
        first = matches[0]
        return first[2], "mapped_exact", (first[0], first[1])

    def coordinate_value(
        self,
        qid: str,
    ) -> Optional[tuple[int, dict, float, float, Optional[float]]]:
        record = self.record(qid)
        candidates: list[tuple[int, dict, float, float, Optional[float]]] = []
        for index, statement in enumerate(record.get("claims", {}).get("P625", [])):
            if statement.get("rank") == "deprecated":
                continue
            snak = statement.get("mainsnak", {})
            if snak.get("snaktype") != "value":
                continue
            value = snak.get("datavalue", {}).get("value")
            if not isinstance(value, dict):
                continue
            latitude = value.get("latitude")
            longitude = value.get("longitude")
            precision = value.get("precision")
            if not isinstance(latitude, (int, float)) or not isinstance(
                longitude,
                (int, float),
            ):
                continue
            if precision is not None and not isinstance(precision, (int, float)):
                continue
            candidates.append(
                (
                    index,
                    statement,
                    float(latitude),
                    float(longitude),
                    float(precision) if precision is not None else None,
                )
            )
        unique = {
            (row[2], row[3], row[4])
            for row in candidates
        }
        if len(unique) != 1:
            return None
        return candidates[0]

    def source_date_claims(self, qid: str, work_id: str) -> list[str]:
        claim_ids: list[str] = []
        predicates = {
            "P571": "source_inception",
            "P1619": "source_official_opening",
        }
        record = self.record(qid)
        for property_id, predicate in predicates.items():
            for index, statement in enumerate(
                record.get("claims", {}).get(property_id, [])
            ):
                if statement.get("rank") == "deprecated":
                    continue
                snak = statement.get("mainsnak", {})
                if snak.get("snaktype") != "value":
                    continue
                value = snak.get("datavalue", {}).get("value")
                if not isinstance(value, dict) or not isinstance(
                    value.get("time"),
                    str,
                ):
                    continue
                claim_id = (
                    f"claim-wd-{qid_slug(qid)}-"
                    f"{property_id.lower()}-{index + 1}"
                )
                claim_ids.append(
                    self.add_claim(
                        claim_id=claim_id,
                        subject_id=work_id,
                        predicate=predicate,
                        object_value={
                            "value": {
                                "after": value.get("after"),
                                "before": value.get("before"),
                                "calendarmodel": value.get("calendarmodel"),
                                "precision": value.get("precision"),
                                "time": value.get("time"),
                                "timezone": value.get("timezone"),
                            }
                        },
                        evidence=[
                            self.evidence(
                                qid,
                                path=f"/claims/{property_id}/{index}",
                                predicate=property_id,
                                locator=(
                                    f"{qid}/{property_id}/"
                                    f"{statement.get('id', index)}"
                                ),
                                statement=statement,
                            )
                        ],
                        confidence=0.55,
                    )
                )
        return claim_ids

    def add_work(self, seed: dict) -> None:
        qid = seed["qid"]
        record = self.record(qid)
        chinese, english = labels(record)
        work_id = entity_id("work", qid)
        place_id = self.ensure_country_place(seed)
        authority = self.country_authority[seed["expected_country_qid"]]
        claim_ids = self.add_name_claims(
            qid=qid,
            subject_id=work_id,
            chinese=chinese,
            english=english,
        )

        work_type, work_type_mapping_status, type_statement = (
            self.mapped_work_type(qid)
        )
        if type_statement is not None:
            index, statement = type_statement
            type_claim_id = f"claim-wd-{qid_slug(qid)}-work-type"
            claim_ids.append(
                self.add_claim(
                    claim_id=type_claim_id,
                    subject_id=work_id,
                    predicate="field_work_type",
                    object_value={"value": work_type},
                    evidence=[
                        self.evidence(
                            qid,
                            path=f"/claims/P31/{index}",
                            predicate="P31",
                            locator=f"{qid}/P31/{statement.get('id', index)}",
                            statement=statement,
                        )
                    ],
                )
            )

        coordinates = {
            "claim_id": None,
            "lat": None,
            "lng": None,
            "precision": None,
        }
        coordinate = self.coordinate_value(qid)
        if coordinate is not None:
            index, statement, latitude, longitude, precision = coordinate
            coordinate_claim_id = f"claim-wd-{qid_slug(qid)}-coordinates"
            coordinates = {
                "claim_id": coordinate_claim_id,
                "lat": latitude,
                "lng": longitude,
                "precision": precision,
            }
            claim_ids.append(
                self.add_claim(
                    claim_id=coordinate_claim_id,
                    subject_id=work_id,
                    predicate="field_coordinates",
                    object_value={"value": coordinates},
                    evidence=[
                        self.evidence(
                            qid,
                            path=f"/claims/P625/{index}",
                            predicate="P625",
                            locator=f"{qid}/P625/{statement.get('id', index)}",
                            statement=statement,
                        )
                    ],
                )
            )

        credits: list[dict] = []
        unresolved_credits: list[dict] = []

        def queue_unresolved_credit(
            index: int,
            statement: dict,
            contributor_qid: Optional[str],
            reason: str,
        ) -> None:
            contributor_record = (
                self.record(contributor_qid)
                if contributor_qid is not None
                else {}
            )
            source_label_zh = (
                label_value(contributor_record, "zh-hans")
                or label_value(contributor_record, "zh")
            )
            source_label_en = label_value(contributor_record, "en")
            claim_id = (
                f"claim-wd-{qid_slug(qid)}-p84-unresolved-{index + 1}"
            )
            claim_ids.append(
                self.add_claim(
                    claim_id=claim_id,
                    subject_id=work_id,
                    predicate="unresolved_credited_contributor",
                    object_value={
                        "value": {
                            "rejection_reason": reason,
                            "wikidata_qid": contributor_qid,
                        }
                    },
                    evidence=[
                        self.evidence(
                            qid,
                            path=f"/claims/P84/{index}",
                            predicate="P84",
                            locator=f"{qid}/P84/{statement.get('id', index)}",
                            statement=statement,
                        )
                    ],
                    confidence=0.55,
                )
            )
            unresolved_credits.append(
                {
                    "claim_id": claim_id,
                    "rejection_reason": reason,
                    "source_entity_qid": contributor_qid,
                    "source_label_en": source_label_en,
                    "source_label_zh": source_label_zh,
                    "source_property": "P84",
                }
            )

        for index, statement in enumerate(record.get("claims", {}).get("P84", [])):
            if statement.get("rank") == "deprecated":
                continue
            values = item_values({"claims": {"P84": [statement]}}, "P84")
            if len(values) != 1:
                queue_unresolved_credit(
                    index,
                    statement,
                    None,
                    "invalid_source_snak",
                )
                continue
            contributor_qid = values[0]
            contributor_id = self.ensure_person(
                contributor_qid,
                role_from_credit=True,
            )
            contributor_type = "person"
            if contributor_id is None:
                contributor_id = self.ensure_practice(contributor_qid)
                contributor_type = "practice"
            if contributor_id is None:
                contributor_record = self.record(contributor_qid)
                reason = (
                    "missing_english_label"
                    if not label_value(contributor_record, "en")
                    else "unresolved_entity_type"
                )
                queue_unresolved_credit(
                    index,
                    statement,
                    contributor_qid,
                    reason,
                )
                continue
            credit_claim_id = (
                f"claim-wd-{qid_slug(qid)}-p84-"
                f"{qid_slug(contributor_qid)}-{index + 1}"
            )
            claim_ids.append(
                self.add_claim(
                    claim_id=credit_claim_id,
                    subject_id=work_id,
                    predicate="credited_contributor",
                    object_value={"entity_id": contributor_id},
                    qualifiers={"phase": "unknown", "role": "architect"},
                    evidence=[
                        self.evidence(
                            qid,
                            path=f"/claims/P84/{index}",
                            predicate="P84",
                            locator=f"{qid}/P84/{statement.get('id', index)}",
                            statement=statement,
                        )
                    ],
                )
            )
            credits.append(
                {
                    "claim_id": credit_claim_id,
                    "credit_status": "candidate",
                    "entity_id": contributor_id,
                    "entity_type": contributor_type,
                    "phase": "unknown",
                    "role": "architect",
                }
            )

        claim_ids.extend(self.source_date_claims(qid, work_id))
        self.works[work_id] = {
            "aliases_en": aliases(record, ("en",)),
            "aliases_zh": aliases(record, ("zh-hans", "zh")),
            "attribution_mode": "unknown",
            "claim_ids": claim_ids,
            "confidence": 0.6,
            "coordinates": coordinates,
            "credit_set_completeness": "unknown",
            "credits": credits,
            "dates": {
                "completion": dict(UNKNOWN_DATE),
                "construction_start": dict(UNKNOWN_DATE),
                "design": dict(UNKNOWN_DATE),
            },
            "entity_type": "work",
            "external_ids": {"wikidata": qid},
            "id": work_id,
            "last_verified": self.accessed,
            "name_en": english,
            "name_native": None,
            "name_zh": chinese,
            "period": "unknown",
            "place_id": place_id,
            "region": authority["region"],
            "significance_en": [],
            "significance_zh": [],
            "status": "unknown",
            "summary_en": "",
            "summary_zh": "",
            "verification_status": "candidate",
            "work_type": work_type,
            "work_type_mapping_status": work_type_mapping_status,
            "unresolved_credits": unresolved_credits,
        }

    def add_lineage_review_relations(self) -> None:
        edges: dict[tuple[str, str], list[dict]] = defaultdict(list)
        for person in list(self.people.values()):
            student_or_teacher_qid = person["external_ids"]["wikidata"]
            record = self.record(student_or_teacher_qid)
            statements_by_property = {
                "P1066": ("target_is_teacher", record.get("claims", {}).get("P1066", [])),
                "P802": ("target_is_student", record.get("claims", {}).get("P802", [])),
            }
            for property_id, (direction, statements) in statements_by_property.items():
                for index, statement in enumerate(statements):
                    if statement.get("rank") == "deprecated":
                        continue
                    values = item_values(
                        {"claims": {property_id: [statement]}},
                        property_id,
                    )
                    if len(values) != 1 or values[0] not in self.entities:
                        continue
                    linked_qid = values[0]
                    linked_person_id = self.ensure_person(
                        linked_qid,
                        role_from_credit=False,
                    )
                    if linked_person_id is None:
                        continue
                    current_person_id = entity_id("person", student_or_teacher_qid)
                    if direction == "target_is_teacher":
                        from_id, to_id = linked_person_id, current_person_id
                    else:
                        from_id, to_id = current_person_id, linked_person_id
                    evidence = self.evidence(
                        student_or_teacher_qid,
                        path=f"/claims/{property_id}/{index}",
                        predicate=property_id,
                        locator=(
                            f"{student_or_teacher_qid}/{property_id}/"
                            f"{statement.get('id', index)}"
                        ),
                        statement=statement,
                    )
                    edges[(from_id, to_id)].append(evidence)

        for from_id, to_id in sorted(edges):
            from_qid = self.people[from_id]["external_ids"]["wikidata"]
            to_qid = self.people[to_id]["external_ids"]["wikidata"]
            relation_id = (
                f"relation-wd-student-recorded-"
                f"{qid_slug(from_qid)}-{qid_slug(to_qid)}"
            )
            claim_id = f"claim-{relation_id}"
            self.add_claim(
                claim_id=claim_id,
                subject_id=relation_id,
                predicate="student_of_recorded",
                object_value={"entity_id": to_id},
                qualifiers={"from_id": from_id},
                evidence=edges[(from_id, to_id)],
                confidence=0.45,
            )
            self.relations[relation_id] = {
                "claim_id": claim_id,
                "confidence": 0.45,
                "context": {
                    "date_end": None,
                    "date_start": None,
                    "institution_id": None,
                    "note_en": (
                        "Raw Wikidata P1066/P802 review edge; it does not by "
                        "itself establish teacher, mentor, or apprenticeship."
                    ),
                    "note_zh": (
                        "Wikidata P1066/P802 原始待审边；本身不能证明教师、导师"
                        "或学徒关系。"
                    ),
                    "practice_id": None,
                    "work_id": None,
                },
                "from_id": from_id,
                "id": relation_id,
                "last_verified": self.accessed,
                "rejection_reasons": [
                    "Requires human classification and stronger relationship evidence."
                ],
                "relation_type": "student_of_recorded",
                "to_id": to_id,
                "verification_status": "candidate",
            }

    def build(self) -> dict:
        if self.snapshot["adapter_id"] != ADAPTER_ID:
            raise ValueError("snapshot adapter_id does not match importer")
        if self.snapshot["adapter_version"] != ADAPTER_VERSION:
            raise ValueError("snapshot adapter_version does not match importer")
        if self.snapshot["selection"]["method"] != "pinned_hydration_fixtures":
            raise ValueError("importer only accepts pinned hydration fixtures")
        for seed in sorted(
            self.snapshot["seeds"],
            key=lambda item: qid_number(item["qid"]),
        ):
            self.add_work(seed)
        self.add_lineage_review_relations()
        return {
            "claims": sorted(self.claims.values(), key=lambda item: item["id"]),
            "generated_from": self.snapshot_id,
            "generator": f"{ADAPTER_ID}@{ADAPTER_VERSION}",
            "people": sorted(self.people.values(), key=lambda item: item["id"]),
            "places": sorted(self.places.values(), key=lambda item: item["id"]),
            "practices": sorted(self.practices.values(), key=lambda item: item["id"]),
            "relations": sorted(self.relations.values(), key=lambda item: item["id"]),
            "source_id": "wikidata",
            "works": sorted(self.works.values(), key=lambda item: item["id"]),
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=CATALOG_DIR / "wikidata-hydration.json",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow replacement of an existing catalog shard.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    snapshot_path = args.snapshot.resolve()
    output = args.output.resolve()
    if output.exists() and not args.force:
        raise SystemExit(f"refusing to replace existing catalog without --force: {output}")
    snapshot = load_json(snapshot_path)
    config = load_json(CONFIG_PATH)
    catalog = CatalogBuilder(snapshot, config).build()
    atomic_write_json(output, catalog)
    print(
        f"Wrote {output.relative_to(ROOT) if output.is_relative_to(ROOT) else output}: "
        f"{len(catalog['people'])} people, "
        f"{len(catalog['practices'])} practices, "
        f"{len(catalog['places'])} places, "
        f"{len(catalog['works'])} works, "
        f"{len(catalog['relations'])} review relations, "
        f"{len(catalog['claims'])} claims",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
