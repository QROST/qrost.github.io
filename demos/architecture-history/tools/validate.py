#!/usr/bin/env python3
"""Validate the Architecture Lineages source-first data graph."""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Optional


ROOT = Path(
    os.environ.get(
        "ARCH_HISTORY_ROOT",
        str(Path(__file__).resolve().parent.parent),
    )
).resolve()
DATA = ROOT / "assets" / "data"
SCHEMA_PATH = ROOT / "tools" / "schema.json"
MANIFEST_PATH = DATA / "manifest.json"

FILE_KEYS = {
    "source-registry.json": "sources",
    "people.json": "people",
    "practices.json": "practices",
    "places.json": "places",
    "works.json": "works",
    "claims.json": "claims",
    "relations.json": "relations",
}

LINEAGE_TYPES = {"direct_mentor", "apprenticed_under", "formal_teacher"}
GAME_TYPES = LINEAGE_TYPES
UNREVIEWABLE_EXTRACTIONS = {"ocr_candidate", "llm_candidate"}


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def records(filename: str) -> list[dict]:
    payload = load_json(DATA / filename)
    return payload[FILE_KEYS[filename]]


def resolve_ref(root_schema: dict, ref: str) -> dict:
    if not ref.startswith("#/"):
        raise ValueError(f"unsupported external schema reference: {ref}")
    node: Any = root_schema
    for part in ref[2:].split("/"):
        node = node[part.replace("~1", "/").replace("~0", "~")]
    return node


def matches_type(value: Any, expected: str) -> bool:
    mapping = {
        "object": dict,
        "array": list,
        "string": str,
        "number": (int, float),
        "integer": int,
        "boolean": bool,
        "null": type(None),
    }
    python_type = mapping[expected]
    if expected in {"number", "integer"} and isinstance(value, bool):
        return False
    return isinstance(value, python_type)


def schema_issues(
    value: Any,
    schema: dict,
    root_schema: dict,
    path: str,
) -> list[str]:
    if "$ref" in schema:
        return schema_issues(value, resolve_ref(root_schema, schema["$ref"]), root_schema, path)
    issues: list[str] = []
    if "anyOf" in schema:
        branches = [
            schema_issues(value, branch, root_schema, path)
            for branch in schema["anyOf"]
        ]
        if not any(not branch_errors for branch_errors in branches):
            issues.append(f"{path}: does not match any allowed schema")
        # `anyOf` is one constraint among potentially many. Keep checking sibling
        # keywords such as `properties` and `additionalProperties`; returning
        # early here would silently turn a closed object into an open one.
    if "const" in schema and value != schema["const"]:
        issues.append(f"{path}: expected constant {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        issues.append(f"{path}: value {value!r} is not in enum")
    expected_type = schema.get("type")
    if expected_type:
        allowed = expected_type if isinstance(expected_type, list) else [expected_type]
        if not any(matches_type(value, item) for item in allowed):
            issues.append(f"{path}: expected type {allowed!r}, got {type(value).__name__}")
            return issues

    if isinstance(value, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in value:
                issues.append(f"{path}: missing required property {key!r}")
        properties = schema.get("properties", {})
        for key, item in value.items():
            child_path = f"{path}.{key}"
            if key in properties:
                issues.extend(
                    schema_issues(item, properties[key], root_schema, child_path)
                )
            elif schema.get("additionalProperties") is False:
                issues.append(f"{path}: unexpected property {key!r}")
            elif isinstance(schema.get("additionalProperties"), dict):
                issues.extend(
                    schema_issues(
                        item,
                        schema["additionalProperties"],
                        root_schema,
                        child_path,
                    )
                )
        if "propertyNames" in schema:
            for key in value:
                issues.extend(
                    schema_issues(
                        key,
                        schema["propertyNames"],
                        root_schema,
                        f"{path}.<propertyName>",
                    )
                )

    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            issues.append(f"{path}: requires at least {schema['minItems']} item(s)")
        if schema.get("uniqueItems"):
            serialized = [
                json.dumps(item, ensure_ascii=False, sort_keys=True)
                for item in value
            ]
            if len(serialized) != len(set(serialized)):
                issues.append(f"{path}: array items must be unique")
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(value):
                issues.extend(
                    schema_issues(
                        item,
                        item_schema,
                        root_schema,
                        f"{path}[{index}]",
                    )
                )

    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            issues.append(f"{path}: string is shorter than minLength")
        pattern = schema.get("pattern")
        if pattern and not re.search(pattern, value):
            issues.append(f"{path}: value {value!r} does not match {pattern!r}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            issues.append(f"{path}: value is below minimum {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            issues.append(f"{path}: value is above maximum {schema['maximum']}")
    return issues


def add_schema_errors(errors: list[str]) -> None:
    schema = load_json(SCHEMA_PATH)
    for filename, file_schema in schema["file_schemas"].items():
        path = DATA / filename
        if not path.exists():
            errors.append(f"{filename}: required data file is missing")
            continue
        errors.extend(
            schema_issues(load_json(path), file_schema, schema, filename)
        )


def duplicate_ids(items: list[dict], label: str, errors: list[str]) -> set[str]:
    ids = [item.get("id") for item in items if item.get("id")]
    for item_id, count in Counter(ids).items():
        if count > 1:
            errors.append(f"{label}: duplicate id {item_id!r}")
    return set(ids)


def known_year(date_value: Optional[dict]) -> Optional[int]:
    if not isinstance(date_value, dict):
        return None
    for key in ("earliest", "latest"):
        value = date_value.get(key)
        if isinstance(value, int):
            return value
    value = date_value.get("value")
    if isinstance(value, str) and len(value) >= 4:
        try:
            return int(value[:4])
        except ValueError:
            return None
    return None


def has_cycle(edges: list[tuple[str, str]]) -> Optional[list[str]]:
    graph: dict[str, list[str]] = {}
    for source, target in edges:
        graph.setdefault(source, []).append(target)
    visiting: set[str] = set()
    visited: set[str] = set()
    stack: list[str] = []

    def visit(node: str) -> Optional[list[str]]:
        if node in visiting:
            if node in stack:
                start = stack.index(node)
                return stack[start:] + [node]
            return [node, node]
        if node in visited:
            return None
        visiting.add(node)
        stack.append(node)
        for target in graph.get(node, []):
            cycle = visit(target)
            if cycle:
                return cycle
        stack.pop()
        visiting.remove(node)
        visited.add(node)
        return None

    for node in graph:
        cycle = visit(node)
        if cycle:
            return cycle
    return None


def hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def data_files() -> list[Path]:
    return sorted(
        (
            path
            for path in DATA.rglob("*.json")
            if path != MANIFEST_PATH
        ),
        key=lambda path: path.relative_to(DATA).as_posix().encode("utf-8"),
    )


def data_version(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in paths:
        rel = path.relative_to(DATA).as_posix().encode("utf-8")
        digest.update(rel)
        digest.update(b"\0")
        digest.update(path.read_bytes())
    return digest.hexdigest()


def validate_manifest(errors: list[str]) -> None:
    if not MANIFEST_PATH.exists():
        return
    manifest = load_json(MANIFEST_PATH)
    paths = data_files()
    expected_paths = [path.relative_to(DATA).as_posix() for path in paths]
    declared = manifest.get("files", {})
    if sorted(declared) != sorted(expected_paths):
        errors.append(
            "manifest.files does not exactly match committed JSON inputs: "
            f"expected={expected_paths!r} declared={sorted(declared)!r}"
        )
        return
    for path in paths:
        rel = path.relative_to(DATA).as_posix()
        declared_hash = (declared.get(rel) or {}).get("sha256")
        actual_hash = hash_file(path)
        if declared_hash != actual_hash:
            errors.append(f"manifest.files[{rel!r}].sha256 mismatch")
    actual_version = data_version(paths)
    if manifest.get("data_version") != actual_version:
        errors.append(
            f"manifest.data_version mismatch: {manifest.get('data_version')!r} != {actual_version!r}"
        )


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    add_schema_errors(errors)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    sources = records("source-registry.json")
    people = records("people.json")
    practices = records("practices.json")
    places = records("places.json")
    works = records("works.json")
    claims = records("claims.json")
    relations = records("relations.json")

    source_ids = duplicate_ids(sources, "sources", errors)
    people_ids = duplicate_ids(people, "people", errors)
    practice_ids = duplicate_ids(practices, "practices", errors)
    place_ids = duplicate_ids(places, "places", errors)
    work_ids = duplicate_ids(works, "works", errors)
    claim_ids = duplicate_ids(claims, "claims", errors)
    relation_ids = duplicate_ids(relations, "relations", errors)

    entity_groups = {
        "person": people_ids,
        "practice": practice_ids,
        "place": place_ids,
        "work": work_ids,
    }
    entity_ids = set().union(*entity_groups.values())
    if sum(len(group) for group in entity_groups.values()) != len(entity_ids):
        seen: Counter[str] = Counter()
        for group in entity_groups.values():
            seen.update(group)
        for item_id, count in seen.items():
            if count > 1:
                errors.append(f"entity graph: id {item_id!r} reused across entity types")

    source_by_id = {item["id"]: item for item in sources}
    claim_by_id = {item["id"]: item for item in claims}
    relation_by_id = {item["id"]: item for item in relations}
    person_by_id = {item["id"]: item for item in people}

    for source in sources:
        operations = source["allowed_operations"]
        if source["reuse_class"] == "structured_ingest_allowed" and not operations["redistribute_metadata"]:
            errors.append(
                f"source {source['id']!r}: structured ingest requires redistribute_metadata=true"
            )
        if source["reuse_class"] == "unknown_fail_closed" and any(operations.values()):
            errors.append(
                f"source {source['id']!r}: unknown_fail_closed must deny all operations"
            )

    for item in people + practices + places + works:
        item_id = item["id"]
        for claim_id in item["claim_ids"]:
            if claim_id not in claim_ids:
                errors.append(f"{item_id}: claim_ids -> unknown claim {claim_id!r}")
            elif claim_by_id[claim_id]["subject_id"] != item_id:
                errors.append(
                    f"{item_id}: claim {claim_id!r} subject is "
                    f"{claim_by_id[claim_id]['subject_id']!r}"
                )
        if item["verification_status"] == "verified":
            if not item["claim_ids"]:
                errors.append(f"{item_id}: verified entity requires at least one claim")
            elif not any(
                claim_by_id.get(claim_id, {}).get("verification_status") == "verified"
                for claim_id in item["claim_ids"]
            ):
                errors.append(f"{item_id}: verified entity requires a verified claim")
        elif not item["claim_ids"]:
            warnings.append(f"{item_id}: candidate entity has no source claim yet")

    for person in people:
        birth = known_year(person.get("birth"))
        death = known_year(person.get("death"))
        if birth is not None and death is not None and death < birth:
            errors.append(f"{person['id']}: death year precedes birth year")

    credit_claim_ids: set[str] = set()
    for work in works:
        work_id = work["id"]
        if work["place_id"] not in place_ids:
            errors.append(f"{work_id}: place_id -> unknown place {work['place_id']!r}")
        if (
            not work["credits"]
            and work["attribution_mode"]
            not in {"traditional_or_anonymous", "unknown"}
        ):
            errors.append(
                f"{work_id}: empty credits require traditional_or_anonymous or unknown attribution"
            )
        for credit in work["credits"]:
            expected_group = entity_groups[credit["entity_type"]]
            if credit["entity_id"] not in expected_group:
                errors.append(
                    f"{work_id}: credit {credit['entity_id']!r} is not a known "
                    f"{credit['entity_type']}"
                )
            if credit["claim_id"] not in claim_ids:
                errors.append(
                    f"{work_id}: credit claim_id -> unknown claim {credit['claim_id']!r}"
                )
            else:
                credit_claim_ids.add(credit["claim_id"])
                claim = claim_by_id[credit["claim_id"]]
                if claim["subject_id"] != work_id:
                    errors.append(
                        f"{work_id}: credit claim {credit['claim_id']!r} must have work as subject"
                    )

    valid_claim_subjects = entity_ids | relation_ids
    for claim in claims:
        claim_id = claim["id"]
        if claim["subject_id"] not in valid_claim_subjects:
            errors.append(
                f"{claim_id}: subject_id -> unknown entity/relation {claim['subject_id']!r}"
            )
        object_id = claim["object"].get("entity_id")
        if object_id and object_id not in entity_ids:
            errors.append(f"{claim_id}: object.entity_id -> unknown entity {object_id!r}")
        if claim["confidence"] > 0.5 and not claim["evidence"]:
            errors.append(f"{claim_id}: confidence>0.5 requires evidence")
        supports = Counter()
        for evidence in claim["evidence"]:
            source_id = evidence["source_id"]
            if source_id not in source_ids:
                errors.append(f"{claim_id}: evidence -> unknown source {source_id!r}")
            supports[evidence["support"]] += 1
        if claim["verification_status"] == "verified":
            if not claim["reviewed_by"] or not claim["reviewed_at"]:
                errors.append(f"{claim_id}: verified claim requires reviewer and review date")
            if not supports["explicit"]:
                errors.append(f"{claim_id}: verified claim requires explicit evidence")
            for evidence in claim["evidence"]:
                if evidence["extraction_method"] in UNREVIEWABLE_EXTRACTIONS:
                    errors.append(
                        f"{claim_id}: {evidence['extraction_method']} cannot directly support verified"
                    )
        if claim["verification_status"] == "contested" and not supports["conflicting"]:
            warnings.append(f"{claim_id}: contested claim has no evidence marked conflicting")

    lineage_edges: list[tuple[str, str]] = []
    for relation in relations:
        relation_id = relation["id"]
        if relation["from_id"] == relation["to_id"]:
            errors.append(f"{relation_id}: self relation is forbidden")
        if relation["from_id"] not in people_ids | practice_ids:
            errors.append(f"{relation_id}: from_id -> unknown person/practice")
        if relation["to_id"] not in people_ids | practice_ids:
            errors.append(f"{relation_id}: to_id -> unknown person/practice")
        context = relation["context"]
        if context["practice_id"] and context["practice_id"] not in practice_ids:
            errors.append(
                f"{relation_id}: context.practice_id -> unknown practice "
                f"{context['practice_id']!r}"
            )
        if context["work_id"] and context["work_id"] not in work_ids:
            errors.append(
                f"{relation_id}: context.work_id -> unknown work {context['work_id']!r}"
            )
        if relation["claim_id"] not in claim_ids:
            errors.append(f"{relation_id}: claim_id -> unknown claim {relation['claim_id']!r}")
            continue
        claim = claim_by_id[relation["claim_id"]]
        if claim["subject_id"] != relation_id:
            errors.append(f"{relation_id}: relation claim subject must be the relation id")
        if claim["predicate"] != relation["relation_type"]:
            errors.append(
                f"{relation_id}: claim predicate {claim['predicate']!r} does not match relation type"
            )
        if relation["relation_type"] in LINEAGE_TYPES and relation["verification_status"] == "verified":
            lineage_edges.append((relation["from_id"], relation["to_id"]))
            source_birth = known_year(person_by_id.get(relation["from_id"], {}).get("birth"))
            target_birth = known_year(person_by_id.get(relation["to_id"], {}).get("birth"))
            if source_birth is not None and target_birth is not None and source_birth > target_birth:
                errors.append(f"{relation_id}: mentor/teacher born after student")
        if relation["game_eligibility"]:
            if relation["relation_type"] not in GAME_TYPES:
                errors.append(f"{relation_id}: relation type is not eligible for game upgrades")
            if relation["verification_status"] != "verified" or relation["confidence"] < 0.9:
                errors.append(
                    f"{relation_id}: game eligibility requires verified status and confidence>=0.9"
                )
            if relation["rejection_reasons"]:
                errors.append(f"{relation_id}: eligible relation cannot have rejection reasons")
            if claim["verification_status"] != "verified" or claim["confidence"] < 0.9:
                errors.append(
                    f"{relation_id}: eligible relation requires a verified claim at confidence>=0.9"
                )
            families = {
                source_by_id[evidence["source_id"]]["source_family"]
                for evidence in claim["evidence"]
                if evidence["source_id"] in source_by_id and evidence["support"] == "explicit"
            }
            if not families:
                errors.append(f"{relation_id}: eligible relation needs explicit source evidence")

    cycle = has_cycle(lineage_edges)
    if cycle:
        errors.append(f"verified lineage graph contains a directed cycle: {' -> '.join(cycle)}")

    validate_manifest(errors)

    for warning in warnings:
        print(f"WARN: {warning}", file=sys.stderr)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(
            f"Validation failed: {len(errors)} error(s), {len(warnings)} warning(s).",
            file=sys.stderr,
        )
        return 1

    print(
        "Validation OK: "
        f"{len(sources)} sources, {len(people)} people, {len(practices)} practices, "
        f"{len(places)} places, {len(works)} works, {len(relations)} relations, "
        f"{len(claims)} claims; {len(warnings)} warning(s)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
