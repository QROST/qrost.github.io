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
CATALOG = DATA / "catalog"
SNAPSHOTS = DATA / "source-snapshots"
SCHEMA_PATH = ROOT / "tools" / "schema.json"
MANIFEST_PATH = DATA / "manifest.json"

FILE_KEYS = {
    "source-registry.json": "sources",
    "reviewers.json": "reviewers",
    "people.json": "people",
    "practices.json": "practices",
    "places.json": "places",
    "works.json": "works",
    "claims.json": "claims",
    "relations.json": "relations",
}

LINEAGE_TYPES = {"direct_mentor", "master_of_apprentice", "formal_teacher"}
GAME_TYPES = LINEAGE_TYPES
UNREVIEWABLE_EXTRACTIONS = {"ocr_candidate", "llm_candidate"}
VERIFIED_AUTHORITY = "claim_evidence"
SUPPORTED_SCHEMA_KEYWORDS = {
    "$ref",
    "type",
    "const",
    "enum",
    "anyOf",
    "required",
    "properties",
    "additionalProperties",
    "propertyNames",
    "items",
    "minItems",
    "uniqueItems",
    "minLength",
    "pattern",
    "minimum",
    "maximum",
}
RELATION_ENDPOINT_TYPES = {
    "direct_mentor": ({"person"}, {"person"}),
    "master_of_apprentice": ({"person"}, {"person"}),
    "formal_teacher": ({"person"}, {"person"}),
    "student_of_recorded": ({"person"}, {"person"}),
    "worked_at_practice": ({"person"}, {"practice"}),
    "practice_successor": ({"practice"}, {"practice"}),
    "collaborated_with": ({"person", "practice"}, {"person", "practice"}),
    "cofounded_with": ({"person", "practice"}, {"person", "practice"}),
    "documented_influence": ({"person", "practice"}, {"person", "practice"}),
}


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
    unknown_keywords = set(schema) - SUPPORTED_SCHEMA_KEYWORDS
    if unknown_keywords:
        return [
            f"{path}: validator does not implement schema keyword(s) "
            f"{sorted(unknown_keywords)!r}"
        ]
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
    for path in sorted(CATALOG.glob("*.json")) if CATALOG.exists() else []:
        errors.extend(
            schema_issues(
                load_json(path),
                schema["$defs"]["catalogShard"],
                schema,
                path.relative_to(DATA).as_posix(),
            )
        )
    for path in sorted(SNAPSHOTS.glob("*.json")) if SNAPSHOTS.exists() else []:
        if not path.name.startswith("wikidata-"):
            errors.append(
                f"{path.relative_to(DATA).as_posix()}: no source-specific "
                "snapshot validator is registered"
            )
            continue
        errors.extend(
            schema_issues(
                load_json(path),
                schema["$defs"]["wikidataSnapshot"],
                schema,
                path.relative_to(DATA).as_posix(),
            )
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


def meaningful_fact(value: Any) -> bool:
    if value is None or value == "" or value == [] or value == {}:
        return False
    if isinstance(value, str) and value == "unknown":
        return False
    if isinstance(value, dict):
        if set(value) == {"value", "earliest", "latest", "precision"}:
            return not (
                value.get("precision") == "unknown"
                and value.get("value") is None
                and value.get("earliest") is None
                and value.get("latest") is None
            )
        if set(value) == {"lat", "lng", "precision", "claim_id"}:
            return value.get("lat") is not None and value.get("lng") is not None
        return any(meaningful_fact(item) for item in value.values())
    return True


def validate_date_value(
    owner_id: str,
    field: str,
    value: dict,
    errors: list[str],
) -> None:
    precision = value["precision"]
    earliest = value["earliest"]
    latest = value["latest"]
    display = value["value"]
    if precision == "unknown":
        if display is not None or earliest is not None or latest is not None:
            errors.append(
                f"{owner_id}.{field}: unknown precision requires null date values"
            )
        return
    if display is None or earliest is None or latest is None:
        errors.append(
            f"{owner_id}.{field}: known precision requires value and year bounds"
        )
        return
    if earliest > latest:
        errors.append(f"{owner_id}.{field}: earliest year exceeds latest year")
    patterns = {
        "day": r"^-?\d{1,6}-\d{2}-\d{2}$",
        "month": r"^-?\d{1,6}-\d{2}$",
        "year": r"^-?\d{1,6}$",
    }
    pattern = patterns.get(precision)
    if pattern and not re.fullmatch(pattern, display):
        errors.append(
            f"{owner_id}.{field}: value {display!r} does not match {precision} precision"
        )


def entity_type_for_id(
    entity_id: str,
    groups: dict[str, set[str]],
) -> Optional[str]:
    for entity_type, ids in groups.items():
        if entity_id in ids:
            return entity_type
    return None


def verified_field_claims(
    item: dict,
    claims: list[dict],
    errors: list[str],
) -> list[dict]:
    relevant: list[dict] = []
    administrative = {
        "id",
        "entity_type",
        "verification_status",
        "confidence",
        "last_verified",
        "claim_ids",
        "credits",
    }
    by_predicate: dict[str, list[dict]] = {}
    for claim in claims:
        if (
            claim["id"] in item["claim_ids"]
            and claim["subject_id"] == item["id"]
            and claim["verification_status"] == "verified"
        ):
            by_predicate.setdefault(claim["predicate"], []).append(claim)
    for field, expected in item.items():
        if field in administrative or not meaningful_fact(expected):
            continue
        predicate = f"field_{field}"
        matches = [
            claim
            for claim in by_predicate.get(predicate, [])
            if claim["object"].get("value") == expected
        ]
        if not matches:
            errors.append(
                f"{item['id']}: verified field {field!r} lacks an exact verified claim"
            )
        else:
            relevant.extend(matches)
    return relevant


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


def canonical_hash(value: Any) -> str:
    raw = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


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


def record_count(path: Path) -> int:
    rel = path.relative_to(DATA).as_posix()
    if rel in FILE_KEYS:
        payload = load_json(path)
        return len(payload[FILE_KEYS[rel]])
    payload = load_json(path)
    if isinstance(payload, list):
        return len(payload)
    if isinstance(payload, dict):
        arrays = [value for value in payload.values() if isinstance(value, list)]
        if len(arrays) == 1:
            return len(arrays[0])
    return 1


def expected_manifest(paths: list[Path]) -> dict:
    payloads = {
        filename: load_json(DATA / filename)[key]
        for filename, key in FILE_KEYS.items()
    }
    entities = (
        payloads["people.json"]
        + payloads["practices.json"]
        + payloads["places.json"]
        + payloads["works.json"]
    )
    published_graph = entities + payloads["relations.json"]
    verification = Counter(item["verification_status"] for item in published_graph)

    region_rows: dict[str, dict[str, int]] = {}
    for item in entities:
        region = item.get("region", "unknown")
        row = region_rows.setdefault(
            region,
            {"discovered_entities": 0, "verified_entities": 0, "works": 0},
        )
        row["discovered_entities"] += 1
        if item["verification_status"] == "verified":
            row["verified_entities"] += 1
        if item["entity_type"] == "work":
            row["works"] += 1

    period_rows: dict[str, dict[str, int]] = {}
    for work in payloads["works.json"]:
        period = work["period"]
        row = period_rows.setdefault(period, {"discovered": 0, "verified": 0})
        row["discovered"] += 1
        if work["verification_status"] == "verified":
            row["verified"] += 1

    sources = {source["id"]: source for source in payloads["source-registry.json"]}
    evidence_by_family: Counter[str] = Counter()
    for claim in payloads["claims.json"]:
        for evidence in claim["evidence"]:
            source = sources.get(evidence["source_id"])
            if source:
                evidence_by_family[source["source_family"]] += 1

    return {
        "schema_id": "architecture-lineages",
        "schema_version": "1.1.0",
        "hash_algorithm": "sha256",
        "data_version": data_version(paths),
        "data_as_of": load_json(DATA / "source-registry.json")["data_as_of"],
        "counts": {
            "sources": len(payloads["source-registry.json"]),
            "reviewers": len(payloads["reviewers.json"]),
            "people": len(payloads["people.json"]),
            "practices": len(payloads["practices.json"]),
            "places": len(payloads["places.json"]),
            "works": len(payloads["works.json"]),
            "claims": len(payloads["claims.json"]),
            "relations": len(payloads["relations.json"]),
            "verified_entities_and_relations": verification["verified"],
            "candidate_entities_and_relations": verification["candidate"],
            "contested_entities_and_relations": verification["contested"],
            "declined_entities_and_relations": verification["declined"],
        },
        "coverage": {
            "regions": dict(sorted(region_rows.items())),
            "periods": dict(sorted(period_rows.items())),
            "verification": dict(sorted(verification.items())),
            "evidence_by_source_family": dict(sorted(evidence_by_family.items())),
        },
        "files": {
            path.relative_to(DATA).as_posix(): {
                "sha256": hash_file(path),
                "count": record_count(path),
            }
            for path in paths
        },
    }


def validate_manifest(errors: list[str]) -> None:
    if not MANIFEST_PATH.exists():
        errors.append("manifest.json: required generated manifest is missing")
        return
    manifest = load_json(MANIFEST_PATH)
    paths = data_files()
    expected = expected_manifest(paths)
    if manifest != expected:
        for key in expected:
            if manifest.get(key) != expected[key]:
                errors.append(f"manifest.{key} does not match derived build state")
        unexpected = set(manifest) - set(expected)
        if unexpected:
            errors.append(
                f"manifest contains unexpected keys: {sorted(unexpected)!r}"
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
    reviewers = records("reviewers.json")
    people = records("people.json")
    practices = records("practices.json")
    places = records("places.json")
    works = records("works.json")
    claims = records("claims.json")
    relations = records("relations.json")

    source_ids = duplicate_ids(sources, "sources", errors)
    reviewer_ids = duplicate_ids(reviewers, "reviewers", errors)
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
    reviewer_by_id = {item["id"]: item for item in reviewers}
    claim_by_id = {item["id"]: item for item in claims}
    relation_by_id = {item["id"]: item for item in relations}
    person_by_id = {item["id"]: item for item in people}

    snapshot_payloads = [
        load_json(path)
        for path in sorted(SNAPSHOTS.glob("*.json"))
    ] if SNAPSHOTS.exists() else []
    snapshot_id_values = [
        snapshot["snapshot_id"]
        for snapshot in snapshot_payloads
    ]
    for snapshot_id, count in Counter(snapshot_id_values).items():
        if count > 1:
            errors.append(f"source snapshots: duplicate id {snapshot_id!r}")
    snapshot_ids = set(snapshot_id_values)
    snapshot_by_id = {
        snapshot["snapshot_id"]: snapshot
        for snapshot in snapshot_payloads
    }
    snapshot_records: dict[tuple[str, str], tuple[str, str]] = {}

    for snapshot in snapshot_payloads:
        snapshot_id = snapshot["snapshot_id"]
        source_id = snapshot["source_id"]
        source = source_by_id.get(source_id)
        if source is None:
            errors.append(f"{snapshot_id}: source_id -> unknown source {source_id!r}")
        else:
            if source["adapter_id"] != snapshot["adapter_id"]:
                errors.append(f"{snapshot_id}: adapter_id does not match source registry")
            if source["adapter_version"] != snapshot["adapter_version"]:
                errors.append(f"{snapshot_id}: adapter_version does not match source registry")
            if source["metadata_license"] != snapshot["license"]:
                errors.append(f"{snapshot_id}: license does not match source registry")
            if not source["allowed_operations"]["retain_snapshot"]:
                errors.append(f"{snapshot_id}: source registry forbids retained snapshots")

        cell_ids: set[str] = set()
        selected_across_cells: set[str] = set()
        for query in snapshot["queries"]:
            cell_id = query["cell_id"]
            if cell_id in cell_ids:
                errors.append(f"{snapshot_id}: duplicate coverage cell {cell_id!r}")
            cell_ids.add(cell_id)
            if hashlib.sha256(query["query"].encode("utf-8")).hexdigest() != query["query_sha256"]:
                errors.append(f"{snapshot_id}/{cell_id}: query_sha256 mismatch")
            candidate_qids = set(query["candidate_work_qids"])
            selected_qids = set(query["selected_work_qids"])
            if not selected_qids <= candidate_qids:
                errors.append(
                    f"{snapshot_id}/{cell_id}: selected works must be candidates"
                )
            duplicates = selected_across_cells & selected_qids
            if duplicates:
                errors.append(
                    f"{snapshot_id}: selected works appear in multiple cells: "
                    f"{sorted(duplicates)!r}"
                )
            selected_across_cells.update(selected_qids)
            for credit in query["eligible_credits"]:
                if credit["work_qid"] not in candidate_qids:
                    errors.append(
                        f"{snapshot_id}/{cell_id}: eligible credit references "
                        f"non-candidate work {credit['work_qid']!r}"
                    )

        for qid, wrapper in snapshot["entities"].items():
            record = wrapper["record"]
            if record.get("id") != qid:
                errors.append(f"{snapshot_id}/{qid}: record.id mismatch")
            if record.get("lastrevid") != wrapper["lastrevid"]:
                errors.append(f"{snapshot_id}/{qid}: lastrevid mismatch")
            actual_hash = canonical_hash(record)
            if actual_hash != wrapper["record_sha256"]:
                errors.append(f"{snapshot_id}/{qid}: record_sha256 mismatch")
            snapshot_records[(snapshot_id, qid)] = (
                source_id,
                wrapper["record_sha256"],
            )
        missing_selected = selected_across_cells - set(snapshot["entities"])
        if missing_selected:
            errors.append(
                f"{snapshot_id}: selected work records are missing: "
                f"{sorted(missing_selected)!r}"
            )

    if CATALOG.exists():
        for path in sorted(CATALOG.glob("*.json")):
            shard = load_json(path)
            if shard["source_id"] not in source_ids:
                errors.append(
                    f"{path.name}: source_id -> unknown source {shard['source_id']!r}"
                )
            snapshot = snapshot_by_id.get(shard["generated_from"])
            if snapshot is None:
                errors.append(
                    f"{path.name}: generated_from -> unknown snapshot "
                    f"{shard['generated_from']!r}"
                )
            elif snapshot["source_id"] != shard["source_id"]:
                errors.append(
                    f"{path.name}: shard source does not match generating snapshot"
                )

    for source in sources:
        operations = source["allowed_operations"]
        implementation_status = source["adapter_status"]
        implemented = implementation_status in {
            "fixture_only",
            "tested",
            "production_ready",
        }
        if implemented and (
            source["adapter_id"] is None or source["adapter_version"] is None
        ):
            errors.append(
                f"source {source['id']!r}: implemented adapter status requires "
                "adapter_id and adapter_version"
            )
        if not implemented and (
            source["adapter_id"] is not None or source["adapter_version"] is not None
        ):
            errors.append(
                f"source {source['id']!r}: unimplemented/discovery adapter "
                "status requires null adapter fields"
            )
        if source["reuse_class"] == "structured_ingest_allowed" and not operations["redistribute_metadata"]:
            errors.append(
                f"source {source['id']!r}: structured ingest requires redistribute_metadata=true"
            )
        if source["reuse_class"] == "unknown_fail_closed" and any(operations.values()):
            errors.append(
                f"source {source['id']!r}: unknown_fail_closed must deny all operations"
            )
        if (
            source["adapter_status"] == "discovery_only"
            and operations["derive_facts"]
        ):
            errors.append(
                f"source {source['id']!r}: discovery_only cannot derive public facts"
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
            field_claims = verified_field_claims(item, claims, errors)
            if field_claims and item["confidence"] > min(
                claim["confidence"] for claim in field_claims
            ):
                errors.append(
                    f"{item_id}: entity confidence exceeds a supporting field claim"
                )
        elif not item["claim_ids"]:
            warnings.append(f"{item_id}: candidate entity has no source claim yet")

    for person in people:
        validate_date_value(person["id"], "birth", person["birth"], errors)
        validate_date_value(person["id"], "death", person["death"], errors)
        birth = known_year(person.get("birth"))
        death = known_year(person.get("death"))
        if birth is not None and death is not None and death < birth:
            errors.append(f"{person['id']}: death year precedes birth year")

    for practice in practices:
        validate_date_value(practice["id"], "founded", practice["founded"], errors)
        validate_date_value(practice["id"], "dissolved", practice["dissolved"], errors)
        founded = known_year(practice["founded"])
        dissolved = known_year(practice["dissolved"])
        if founded is not None and dissolved is not None and dissolved < founded:
            errors.append(f"{practice['id']}: dissolved year precedes founded year")

    for place in places:
        if (place["lat"] is None) != (place["lng"] is None):
            errors.append(f"{place['id']}: latitude/longitude must be paired")

    credit_claim_ids: set[str] = set()
    for work in works:
        work_id = work["id"]
        for field, date_value in work["dates"].items():
            validate_date_value(work_id, f"dates.{field}", date_value, errors)
        design_year = known_year(work["dates"]["design"])
        start_year = known_year(work["dates"]["construction_start"])
        completion_year = known_year(work["dates"]["completion"])
        if (
            design_year is not None
            and completion_year is not None
            and completion_year < design_year
        ):
            errors.append(f"{work_id}: completion precedes design date")
        if (
            start_year is not None
            and completion_year is not None
            and completion_year < start_year
        ):
            errors.append(f"{work_id}: completion precedes construction start")
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
        coordinates = work["coordinates"]
        has_lat = coordinates["lat"] is not None
        has_lng = coordinates["lng"] is not None
        if has_lat != has_lng:
            errors.append(f"{work_id}: coordinate latitude/longitude must be paired")
        if has_lat and not coordinates["claim_id"]:
            errors.append(f"{work_id}: coordinates require a source claim")
        if coordinates["claim_id"] and coordinates["claim_id"] not in claim_ids:
            errors.append(
                f"{work_id}: coordinates claim_id -> unknown claim "
                f"{coordinates['claim_id']!r}"
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
                if claim["predicate"] != "credited_contributor":
                    errors.append(
                        f"{work_id}: credit claim {credit['claim_id']!r} must use "
                        "credited_contributor"
                    )
                if claim["object"].get("entity_id") != credit["entity_id"]:
                    errors.append(
                        f"{work_id}: credit claim object must match contributor"
                    )
                if claim["qualifiers"].get("role") != credit["role"]:
                    errors.append(f"{work_id}: credit claim role qualifier mismatch")
                if claim["qualifiers"].get("phase") != credit["phase"]:
                    errors.append(f"{work_id}: credit claim phase qualifier mismatch")
                if claim["verification_status"] != credit["credit_status"]:
                    errors.append(f"{work_id}: credit and claim verification status differ")
                if credit["claim_id"] not in work["claim_ids"]:
                    errors.append(f"{work_id}: credit claim must be listed in claim_ids")

    for claim in claims:
        if claim["predicate"] != "credited_contributor":
            continue
        if claim["id"] not in credit_claim_ids:
            errors.append(
                f"{claim['id']}: credited_contributor claim has no matching work credit"
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
        if (claim["reviewed_by"] is None) != (claim["reviewed_at"] is None):
            errors.append(
                f"{claim_id}: reviewer and review date must both be set or both be null"
            )
        if claim["reviewed_by"] is not None:
            reviewer = reviewer_by_id.get(claim["reviewed_by"])
            if reviewer is None:
                errors.append(
                    f"{claim_id}: reviewed_by -> unknown reviewer "
                    f"{claim['reviewed_by']!r}"
                )
            elif not reviewer["active"]:
                errors.append(f"{claim_id}: reviewer is inactive")

        if claim["subject_id"] in relation_ids:
            authority_dimension = "relationships"
        elif claim["predicate"] == "credited_contributor":
            authority_dimension = "work_credits"
        elif claim["predicate"] in {
            "field_name_zh",
            "field_name_en",
            "field_name_native",
            "field_aliases_zh",
            "field_aliases_en",
        }:
            authority_dimension = "names"
        else:
            authority_dimension = "identity"

        supports = Counter()
        verified_authority_evidence = 0
        for evidence in claim["evidence"]:
            source_id = evidence["source_id"]
            if source_id not in source_ids:
                errors.append(f"{claim_id}: evidence -> unknown source {source_id!r}")
            else:
                source = source_by_id[source_id]
                if not source["allowed_operations"]["derive_facts"]:
                    errors.append(
                        f"{claim_id}: source {source_id!r} is discovery/citation-only"
                    )
                if not source["allowed_operations"]["retain_snapshot"]:
                    errors.append(
                        f"{claim_id}: source {source_id!r} forbids retained snapshots"
                    )
                if (
                    evidence["support"] == "explicit"
                    and source["authority_profile"][authority_dimension]
                    == VERIFIED_AUTHORITY
                ):
                    verified_authority_evidence += 1
            snapshot_id = evidence["snapshot_id"]
            snapshot = snapshot_by_id.get(snapshot_id)
            if snapshot is None:
                errors.append(
                    f"{claim_id}: evidence -> unknown source snapshot {snapshot_id!r}"
                )
            elif snapshot["source_id"] != source_id:
                errors.append(
                    f"{claim_id}: evidence source does not match snapshot source"
                )
            native_record_id = evidence["native_record_id"]
            if native_record_id is None:
                errors.append(f"{claim_id}: evidence requires a native_record_id")
            else:
                snapshot_record = snapshot_records.get(
                    (snapshot_id, native_record_id)
                )
                if snapshot_record is None:
                    errors.append(
                        f"{claim_id}: evidence record {native_record_id!r} "
                        f"is absent from snapshot {snapshot_id!r}"
                    )
                elif snapshot_record[1] != evidence["source_record_sha256"]:
                    errors.append(
                        f"{claim_id}: evidence source_record_sha256 mismatch"
                    )
            supports[evidence["support"]] += 1
        if claim["verification_status"] == "verified":
            if not claim["reviewed_by"] or not claim["reviewed_at"]:
                errors.append(f"{claim_id}: verified claim requires reviewer and review date")
            if not supports["explicit"]:
                errors.append(f"{claim_id}: verified claim requires explicit evidence")
            if supports["conflicting"]:
                errors.append(f"{claim_id}: verified claim cannot contain conflicting evidence")
            if not verified_authority_evidence:
                errors.append(
                    f"{claim_id}: verified claim lacks claim-evidence authority "
                    f"for {authority_dimension}"
                )
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
        from_type = entity_type_for_id(relation["from_id"], entity_groups)
        to_type = entity_type_for_id(relation["to_id"], entity_groups)
        allowed_endpoints = RELATION_ENDPOINT_TYPES[relation["relation_type"]]
        if from_type not in allowed_endpoints[0] or to_type not in allowed_endpoints[1]:
            errors.append(
                f"{relation_id}: endpoint types {from_type!r}->{to_type!r} "
                f"are invalid for {relation['relation_type']}"
            )
        context = relation["context"]
        if (
            context["date_start"] is not None
            and context["date_end"] is not None
            and context["date_end"] < context["date_start"]
        ):
            errors.append(f"{relation_id}: context end year precedes start year")
        if context["institution_id"] is not None:
            errors.append(
                f"{relation_id}: institution context is unsupported until "
                "institution entities are modeled"
            )
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
        if claim["object"].get("entity_id") != relation["to_id"]:
            errors.append(f"{relation_id}: claim object must match relation to_id")
        if claim["qualifiers"].get("from_id") != relation["from_id"]:
            errors.append(f"{relation_id}: claim from_id qualifier mismatch")
        if claim["verification_status"] != relation["verification_status"]:
            errors.append(f"{relation_id}: relation and claim verification status differ")
        if claim["confidence"] != relation["confidence"]:
            errors.append(f"{relation_id}: relation and claim confidence differ")
        if (
            relation["verification_status"] == "verified"
            and relation["relation_type"] in LINEAGE_TYPES
        ):
            if claim["verification_status"] != "verified":
                errors.append(f"{relation_id}: verified relation requires verified claim")
            if (
                person_by_id.get(relation["from_id"], {}).get("verification_status")
                != "verified"
                or person_by_id.get(relation["to_id"], {}).get("verification_status")
                != "verified"
            ):
                errors.append(
                    f"{relation_id}: verified lineage requires verified person endpoints"
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
            competing = [
                other
                for other in claims
                if other["subject_id"] == relation_id
                and other["id"] != claim["id"]
                and (
                    other["verification_status"] in {"contested", "declined"}
                    or any(
                        evidence["support"] == "conflicting"
                        for evidence in other["evidence"]
                    )
                )
            ]
            if competing:
                errors.append(
                    f"{relation_id}: eligible relation has contested/declined competing claims"
                )
            families = {
                source_by_id[evidence["source_id"]]["source_family"]
                for evidence in claim["evidence"]
                if (
                    evidence["source_id"] in source_by_id
                    and evidence["support"] == "explicit"
                    and source_by_id[evidence["source_id"]]["authority_profile"][
                        "relationships"
                    ]
                    == VERIFIED_AUTHORITY
                )
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
