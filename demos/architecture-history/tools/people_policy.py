#!/usr/bin/env python3
"""Shared keep/drop policy for architecture-history person records."""

from __future__ import annotations

from typing import Any, Iterable

ARCHITECT_QID = "Q42973"
LANDSCAPE_ARCHITECT_QID = "Q131524"
ARCHITECT_OCCUPATION_QIDS = frozenset(
    {
        ARCHITECT_QID,
        LANDSCAPE_ARCHITECT_QID,
    }
)

SCULPTOR_QID = "Q1281618"
EDUCATOR_QID = "Q2566598"
HISTORIAN_QID = "Q201820"
ENGINEER_QID = "Q81096"
URBAN_PLANNER_QID = "Q1358267"
DESIGNER_QID = "Q5322166"
PATRON_QID = "Q82955"

OCCUPATION_TO_ROLE: dict[str, str] = {
    ARCHITECT_QID: "architect",
    LANDSCAPE_ARCHITECT_QID: "landscape_architect",
    SCULPTOR_QID: "craftsperson",
    EDUCATOR_QID: "educator",
    HISTORIAN_QID: "historian",
    ENGINEER_QID: "engineer",
    URBAN_PLANNER_QID: "urban_planner",
    DESIGNER_QID: "designer",
    PATRON_QID: "patron",
}

SCHEMA_ROLES = frozenset((*OCCUPATION_TO_ROLE.values(), "unknown"))


def item_values(record: dict[str, Any], property_id: str) -> list[str]:
    values: list[str] = []
    for statement in record.get("claims", {}).get(property_id, []):
        if statement.get("rank") == "deprecated":
            continue
        snak = statement.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        datavalue = snak.get("datavalue", {})
        if datavalue.get("type") != "wikibase-entityid":
            continue
        qid = datavalue.get("value", {}).get("id")
        if isinstance(qid, str):
            values.append(qid)
    return values


def person_occupations(record: dict[str, Any]) -> set[str]:
    return set(item_values(record, "P106"))


def has_architecture_occupation(record: dict[str, Any]) -> bool:
    return not ARCHITECT_OCCUPATION_QIDS.isdisjoint(person_occupations(record))


def derive_person_roles(
    record: dict[str, Any],
    *,
    role_from_credit: bool,
) -> list[str]:
    occupations = person_occupations(record)
    roles: list[str] = []
    for occupation_qid in sorted(occupations, key=lambda value: int(value[1:])):
        role = OCCUPATION_TO_ROLE.get(occupation_qid)
        if role and role not in roles:
            roles.append(role)
    if roles:
        return roles
    if role_from_credit:
        return ["architect"]
    # An unmapped P106 value is not evidence that a person is a historian.
    # Curated person seeds may still be displayed, but their role stays
    # explicitly unknown until a reviewed occupation mapping is added.
    return ["unknown"]


def credited_person_ids(works: Iterable[dict[str, Any]]) -> set[str]:
    credited: set[str] = set()
    for work in works:
        for credit in work.get("credits", []):
            entity_id = credit.get("entity_id")
            if isinstance(entity_id, str):
                credited.add(entity_id)
    return credited


def practice_ids(practices: Iterable[dict[str, Any]]) -> set[str]:
    return {practice["id"] for practice in practices if isinstance(practice.get("id"), str)}


def seed_people_by_policy(
    *,
    people: list[dict[str, Any]],
    works: list[dict[str, Any]],
    entity_records: dict[str, dict[str, Any]],
    seeded_qids: set[str] | None = None,
) -> set[str]:
    """Direct keeps: architect occupation, work credit, or person-seed curation."""
    people_by_id = {person["id"]: person for person in people}
    credited = credited_person_ids(works)
    seeds: set[str] = set()
    for person_id, person in people_by_id.items():
        qid = person.get("external_ids", {}).get("wikidata")
        record = entity_records.get(qid) if isinstance(qid, str) else None
        if record is not None and has_architecture_occupation(record):
            seeds.add(person_id)
        if person_id in credited:
            seeds.add(person_id)
        if isinstance(qid, str) and qid in (seeded_qids or set()):
            seeds.add(person_id)
    return seeds


def relation_anchor_entities(
    *,
    people: list[dict[str, Any]],
    practices: list[dict[str, Any]],
    entity_records: dict[str, dict[str, Any]],
) -> set[str]:
    """Endpoints that may propagate keeps through relations: architects and practices."""
    anchors = practice_ids(practices)
    for person in people:
        person_id = person["id"]
        qid = person.get("external_ids", {}).get("wikidata")
        record = entity_records.get(qid) if isinstance(qid, str) else None
        if record is not None and has_architecture_occupation(record):
            anchors.add(person_id)
    return anchors


def keep_people_by_policy(
    *,
    people: list[dict[str, Any]],
    works: list[dict[str, Any]],
    practices: list[dict[str, Any]],
    relations: list[dict[str, Any]],
    entity_records: dict[str, dict[str, Any]],
    seeded_qids: set[str] | None = None,
) -> tuple[set[str], dict[str, int]]:
    """Apply architect/credit/curated seeds plus relation closure from architect/practice anchors."""
    people_by_id = {person["id"]: person for person in people}
    seeds = seed_people_by_policy(
        people=people,
        works=works,
        entity_records=entity_records,
        seeded_qids=seeded_qids,
    )
    anchors = relation_anchor_entities(
        people=people,
        practices=practices,
        entity_records=entity_records,
    )
    keep_people = set(seeds)
    changed = True
    iterations = 0
    relation_kept = 0
    while changed:
        changed = False
        iterations += 1
        for relation in relations:
            from_id = relation.get("from_id")
            to_id = relation.get("to_id")
            if not isinstance(from_id, str) or not isinstance(to_id, str):
                continue
            if from_id in anchors and to_id in people_by_id and to_id not in keep_people:
                keep_people.add(to_id)
                relation_kept += 1
                changed = True
            if to_id in anchors and from_id in people_by_id and from_id not in keep_people:
                keep_people.add(from_id)
                relation_kept += 1
                changed = True

    return keep_people, {
        "seed_people": len(seeds),
        "relation_kept": relation_kept,
        "iterations": iterations,
    }


def prune_catalog_people(
    catalog: dict[str, Any],
    entity_records: dict[str, dict[str, Any]],
    *,
    sample_limit: int = 20,
    seeded_qids: set[str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    people = catalog.get("people", [])
    works = catalog.get("works", [])
    practices = catalog.get("practices", [])
    relations = catalog.get("relations", [])
    claims = catalog.get("claims", [])

    before_people = len(people)
    before_relations = len(relations)
    keep_people, policy_stats = keep_people_by_policy(
        people=people,
        works=works,
        practices=practices,
        relations=relations,
        entity_records=entity_records,
        seeded_qids=seeded_qids,
    )
    dropped_people = {
        person["id"]: person.get("external_ids", {}).get("wikidata")
        for person in people
        if person["id"] not in keep_people
    }

    kept_people = [person for person in people if person["id"] in keep_people]
    dropped_person_ids = set(dropped_people.keys())

    kept_relations = [
        relation
        for relation in relations
        if relation.get("from_id") not in dropped_person_ids
        and relation.get("to_id") not in dropped_person_ids
    ]
    dropped_relation_ids = {
        relation["id"]
        for relation in relations
        if relation.get("from_id") in dropped_person_ids
        or relation.get("to_id") in dropped_person_ids
    }

    kept_claims = [
        claim
        for claim in claims
        if claim.get("subject_id") not in dropped_person_ids
        and claim.get("subject_id") not in dropped_relation_ids
    ]
    dropped_claims = len(claims) - len(kept_claims)

    pruned = dict(catalog)
    pruned["people"] = kept_people
    pruned["relations"] = kept_relations
    pruned["claims"] = kept_claims

    sample_dropped_qids = [
        qid
        for qid in sorted(
            (value for value in dropped_people.values() if isinstance(value, str)),
            key=lambda value: int(value[1:]),
        )[:sample_limit]
    ]

    stats = {
        "before": before_people,
        "before_relations": before_relations,
        "after": len(kept_people),
        "after_relations": len(kept_relations),
        "dropped_people": len(dropped_people),
        "dropped_relations": len(dropped_relation_ids),
        "dropped_claims": dropped_claims,
        "seed_people": policy_stats["seed_people"],
        "relation_kept": policy_stats["relation_kept"],
        "iterations": policy_stats["iterations"],
        "sample_dropped_qids": sample_dropped_qids,
    }
    return pruned, stats
