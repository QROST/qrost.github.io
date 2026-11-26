#!/usr/bin/env python3
"""Shared keep/drop policy for architecture-history person records."""

from __future__ import annotations

from typing import Any, Iterable

ARCHITECT_QID = "Q42973"
LANDSCAPE_ARCHITECT_QID = "Q2815948"
ARCHITECT_OCCUPATION_QIDS = frozenset(
    {
        ARCHITECT_QID,
        LANDSCAPE_ARCHITECT_QID,
    }
)

SCULPTOR_QID = "Q1281618"
EDUCATOR_QID = "Q974144"
HISTORIAN_QID = "Q201788"
ENGINEER_QID = "Q81096"
URBAN_PLANNER_QID = "Q131062"
DESIGNER_QID = "Q5322166"
PATRON_QID = "Q516590"
PATRON_OF_THE_ARTS_QID = "Q15472169"
CIVIL_ENGINEER_QID = "Q13582652"
MASTER_BUILDER_QID = "Q1340643"
GOLDSMITH_QID = "Q211423"
STAINED_GLASS_ARTIST_QID = "Q2205972"
ARCHITECTURAL_COLORIST_QID = "Q29167172"
JEWELRY_DESIGNER_QID = "Q2519376"
INTERIOR_ARCHITECT_QID = "Q103893954"

OCCUPATION_TO_ROLE: dict[str, str] = {
    ARCHITECT_QID: "architect",
    LANDSCAPE_ARCHITECT_QID: "landscape_architect",
    SCULPTOR_QID: "craftsperson",
    GOLDSMITH_QID: "craftsperson",
    STAINED_GLASS_ARTIST_QID: "craftsperson",
    EDUCATOR_QID: "educator",
    HISTORIAN_QID: "historian",
    ENGINEER_QID: "engineer",
    CIVIL_ENGINEER_QID: "engineer",
    MASTER_BUILDER_QID: "engineer",
    URBAN_PLANNER_QID: "urban_planner",
    DESIGNER_QID: "designer",
    INTERIOR_ARCHITECT_QID: "designer",
    ARCHITECTURAL_COLORIST_QID: "designer",
    JEWELRY_DESIGNER_QID: "designer",
    PATRON_QID: "patron",
    PATRON_OF_THE_ARTS_QID: "patron",
}

SCHEMA_ROLES = frozenset((*OCCUPATION_TO_ROLE.values(), "unknown"))

# Occupations that write about architecture. They belong in the catalog but
# are not evidence of a role, so they stay unmapped above.
ARCHITECTURE_WRITING_OCCUPATION_QIDS = frozenset(
    {
        "Q11486702",  # architectural historian
        "Q17391654",  # architecture critic
        "Q17391659",  # architectural theoretician
    }
)

# Person-seed QIDs that resolve to somebody else: a name collision at intake
# attached an architect's name to an unrelated item. They are withheld until
# the seed points at the intended person.
WITHHELD_PERSON_QIDS = frozenset(
    {
        "Q10530652",  # "Hugo Sarmiento": association football player
        "Q107144100",  # "Michael Stock": media critic
        "Q1162955",  # "Daniel Tovar": actor
        "Q116659497",  # "Kate Davies": novelist
        "Q15981913",  # "Hamed Khosravi": association football player
        "Q256186",  # "Laura Allen": actor
        "Q49031",  # "Julia King": engineer and politician
        "Q5125282",  # "Claire Phillips": spy
        "Q5525088",  # "Gary Fox": farmer and politician
        "Q6790250",  # "Matthew Butcher": police officer
        "Q6939241",  # "Murray Fraser": law professor
        "Q7441055",  # "Sean Hanna": politician
        "Q9023914",  # "Angela Pang": singer
    }
)


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


def has_recognised_occupation(record: dict[str, Any]) -> bool:
    """Whether a person's occupation gives them a place in the catalog.

    True for a mapped role (architect, engineer, patron, ...) and for the
    architecture-writing occupations. False for painters, philosophers,
    composers and everyone else the lineage traversal met only as somebody's
    teacher, employer or influence: a relationship alone does not admit them.
    """
    if derive_person_roles(record, role_from_credit=False) != ["unknown"]:
        return True
    return not ARCHITECTURE_WRITING_OCCUPATION_QIDS.isdisjoint(
        person_occupations(record)
    )


def withheld_person_ids(people: Iterable[dict[str, Any]]) -> set[str]:
    return {
        person["id"]
        for person in people
        if str(person.get("external_ids", {}).get("wikidata", "")).upper()
        in WITHHELD_PERSON_QIDS
    }


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
    withheld = withheld_person_ids(people)
    seeds: set[str] = set()
    for person_id, person in people_by_id.items():
        if person_id in withheld:
            continue
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
    """Apply architect/credit/curated seeds plus relation closure from architect/practice anchors.

    The relation closure keeps a one-hop neighbour of an architect or practice
    only when the neighbour's own occupation belongs to the catalog.
    """
    people_by_id = {person["id"]: person for person in people}
    withheld = withheld_person_ids(people)
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

    def neighbour_can_be_kept(person_id: str) -> bool:
        if person_id in withheld or person_id in keep_people:
            return False
        qid = people_by_id[person_id].get("external_ids", {}).get("wikidata")
        record = entity_records.get(qid) if isinstance(qid, str) else None
        return record is not None and has_recognised_occupation(record)

    while changed:
        changed = False
        iterations += 1
        for relation in relations:
            from_id = relation.get("from_id")
            to_id = relation.get("to_id")
            if not isinstance(from_id, str) or not isinstance(to_id, str):
                continue
            if from_id in anchors and to_id in people_by_id and neighbour_can_be_kept(to_id):
                keep_people.add(to_id)
                relation_kept += 1
                changed = True
            if to_id in anchors and from_id in people_by_id and neighbour_can_be_kept(from_id):
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
