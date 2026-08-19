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
COVERAGE_CONFIG = DATA / "methodology" / "wikidata-coverage-config.json"
TYPE_AUTHORITY_SEEDS_PATH = (
    ROOT / "tools" / "wikidata-work-type-authority-seeds.json"
)

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
SYMMETRIC_RELATION_TYPES = {"collaborated_with", "cofounded_with"}
UNREVIEWABLE_EXTRACTIONS = {"ocr_candidate", "llm_candidate"}
VERIFIED_AUTHORITY = "claim_evidence"
DATE_AUTHORITY_PREDICATES = {
    "field_birth",
    "field_death",
    "field_dissolved",
    "field_founded",
    "field_period",
    "source_inception",
    "source_official_opening",
}
SUPPORTED_PERIOD_RULE = {
    "rule_id": "wikidata-p571-best-rank-period-v4",
    "basis_property": "P571",
    "fallback_property": "P1619",
    "accepted_precisions": [7, 8, 9, 10, 11],
    "accepted_calendar_models": [
        "http://www.wikidata.org/entity/Q1985727",
        "http://www.wikidata.org/entity/Q1985786",
    ],
    "latest_year_inclusive": 2026,
    "qualifier_policy": "metadata_qualifiers_allowed",
    "required_before": 0,
    "required_after": 0,
    "unsupported_result": "unknown",
    "official_opening_usage": "fallback_after_inception",
    "year_precision_lower_components": (
        "zero_or_valid_calendar_date_ignored"
    ),
}
SUPPORTED_WORK_TYPE_RULE = {
    "rule_id": "wikidata-p31-exact-instance-work-type-v1",
    "basis_property": "P31",
    "rank_policy": "non_deprecated",
    "subclass_traversal": "forbidden",
    "authority_policy": "new_mappings_require_revision_pinned_snapshot",
}
LEGACY_WORK_TYPE_ALLOWLIST_SHA256 = (
    "35758ba09c3a00ea6ea3d20776a1870a38ec136c56469b9faa9a42b0d28be4bf"
)
LEGACY_WORK_TYPE_SOURCE_CONFIG_VERSION = "0.3.0"
SUPPORTED_WORK_TYPES = {
    "building",
    "building_complex",
    "infrastructure",
    "landscape",
    "monument",
}
ENTITY_CATALOG_KEYS = ("people", "practices", "places", "works")
CATALOG_KEYS = (
    "people",
    "practices",
    "places",
    "works",
    "claims",
    "relations",
)
OVERLAY_KIND = "catalog_overlay_v1"
GETTY_ULAN_OVERLAY_TRANSFORMER_ID = "getty-ulan-p245-overlay"
GETTY_ULAN_OVERLAY_TRANSFORMER_VERSION = "0.1.0"
GETTY_ULAN_IDENTITY_SCOPE = "getty_ulan_exact_p245_crosswalk"
ULAN_ID_PATTERN = re.compile(r"^500\d{6}$")
WIKIDATA_TIME_PATTERN = re.compile(
    r"^(?P<sign>[+-])(?P<year>\d{4,})-(?P<month>\d{2})-"
    r"(?P<day>\d{2})T00:00:00Z$"
)
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
    "worked_for": ({"person"}, {"person"}),
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
        payload = load_json(path)
        shard_schema = (
            schema["$defs"]["catalogOverlayShard"]
            if payload.get("kind") == "catalog_overlay_v1"
            else schema["$defs"]["catalogShard"]
        )
        errors.extend(
            schema_issues(
                payload,
                shard_schema,
                schema,
                path.relative_to(DATA).as_posix(),
            )
        )
    for path in sorted(SNAPSHOTS.glob("*.json")) if SNAPSHOTS.exists() else []:
        if path.name.startswith("getty-ulan-identity-"):
            snapshot_schema = schema["$defs"]["gettyUlanIdentitySnapshot"]
        elif path.name.startswith("wikidata-ulan-crosswalk-"):
            snapshot_schema = schema["$defs"]["wikidataUlanCrosswalkSnapshot"]
        elif path.name.startswith("wikidata-"):
            snapshot_schema = schema["$defs"]["wikidataSnapshot"]
        else:
            errors.append(
                f"{path.relative_to(DATA).as_posix()}: no source-specific "
                "snapshot validator is registered"
            )
            continue
        errors.extend(
            schema_issues(
                load_json(path),
                snapshot_schema,
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


def is_plain_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def validate_coverage_config(
    config: Any,
    allowed_periods: set[str],
    errors: list[str],
) -> None:
    label = "wikidata coverage config"
    if not isinstance(config, dict):
        errors.append(f"{label}: root must be an object")
        return

    config_version = config.get("config_version")
    if not isinstance(config_version, str) or not re.fullmatch(
        r"\d+\.\d+\.\d+",
        config_version,
    ):
        errors.append(f"{label}: config_version must be semantic")

    transformer = config.get("transformer")
    if not isinstance(transformer, dict):
        errors.append(f"{label}: transformer must be an object")
    else:
        if set(transformer) != {"id", "version"}:
            errors.append(f"{label}: transformer has unexpected or missing fields")
        transformer_id = transformer.get("id")
        transformer_version = transformer.get("version")
        if not isinstance(transformer_id, str) or not re.fullmatch(
            r"[a-z0-9][a-z0-9-]*",
            transformer_id,
        ):
            errors.append(f"{label}: transformer.id must be a slug")
        if not isinstance(transformer_version, str) or not re.fullmatch(
            r"\d+\.\d+\.\d+",
            transformer_version,
        ):
            errors.append(f"{label}: transformer.version must be semantic")

    rule = config.get("period_derivation")
    if rule != SUPPORTED_PERIOD_RULE:
        errors.append(f"{label}: unsupported period_derivation rule")

    work_type_rule = config.get("work_type_derivation")
    expected_work_type_keys = {
        "authority_bindings",
        "authority_policy",
        "basis_property",
        "legacy_allowlist",
        "rank_policy",
        "rule_id",
        "subclass_traversal",
    }
    if (
        not isinstance(work_type_rule, dict)
        or set(work_type_rule) != expected_work_type_keys
    ):
        errors.append(f"{label}: work_type_derivation has an invalid shape")
        work_type_rule = None
    elif any(
        work_type_rule[key] != value
        for key, value in SUPPORTED_WORK_TYPE_RULE.items()
    ):
        errors.append(f"{label}: unsupported work_type_derivation rule")

    allowlist = config.get("exact_instance_allowlist")
    allowlist_qids: list[str] = []
    if not isinstance(allowlist, list) or not allowlist:
        errors.append(f"{label}: exact_instance_allowlist must be non-empty")
    else:
        for index, row in enumerate(allowlist):
            if not isinstance(row, dict) or set(row) != {
                "label_en",
                "qid",
                "work_type",
            }:
                errors.append(
                    f"{label}: exact_instance_allowlist[{index}] has an invalid shape"
                )
                continue
            qid = row["qid"]
            if not isinstance(qid, str) or not re.fullmatch(
                r"Q[1-9][0-9]*",
                qid,
            ):
                errors.append(
                    f"{label}: exact_instance_allowlist[{index}] has an invalid QID"
                )
            else:
                allowlist_qids.append(qid)
            if not isinstance(row["label_en"], str) or not row[
                "label_en"
            ].strip():
                errors.append(
                    f"{label}: exact_instance_allowlist[{index}] needs label_en"
                )
            if row["work_type"] not in SUPPORTED_WORK_TYPES:
                errors.append(
                    f"{label}: exact_instance_allowlist[{index}] has unsupported work_type"
                )
    if len(allowlist_qids) != len(set(allowlist_qids)):
        errors.append(f"{label}: exact-instance QIDs must be unique")

    if work_type_rule is not None:
        bindings = work_type_rule["authority_bindings"]
        bound_qids: list[str] = []
        snapshot_ids: list[str] = []
        if not isinstance(bindings, list) or not bindings:
            errors.append(f"{label}: authority_bindings must be non-empty")
        else:
            if len(bindings) != 1:
                errors.append(
                    f"{label}: transformer 0.4.0 requires exactly one "
                    "authority binding"
                )
            for index, binding in enumerate(bindings):
                if not isinstance(binding, dict) or set(binding) != {
                    "qids",
                    "snapshot_id",
                }:
                    errors.append(
                        f"{label}: authority_bindings[{index}] has an invalid shape"
                    )
                    continue
                snapshot_id = binding["snapshot_id"]
                qids = binding["qids"]
                if (
                    not isinstance(snapshot_id, str)
                    or not snapshot_id.startswith(
                        "wikidata-work-type-authority-"
                    )
                ):
                    errors.append(
                        f"{label}: authority_bindings[{index}] snapshot id is invalid"
                    )
                else:
                    snapshot_ids.append(snapshot_id)
                if (
                    not isinstance(qids, list)
                    or not qids
                    or not all(
                        isinstance(qid, str)
                        and re.fullmatch(r"Q[1-9][0-9]*", qid)
                        for qid in qids
                    )
                ):
                    errors.append(
                        f"{label}: authority_bindings[{index}] QIDs are invalid"
                    )
                    continue
                if qids != sorted(set(qids), key=lambda qid: int(qid[1:])):
                    errors.append(
                        f"{label}: authority_bindings[{index}] QIDs must be "
                        "unique and numerically ordered"
                    )
                bound_qids.extend(qids)
        if len(snapshot_ids) != len(set(snapshot_ids)):
            errors.append(f"{label}: authority snapshot ids must be unique")
        if len(bound_qids) != len(set(bound_qids)):
            errors.append(f"{label}: authority QIDs must be unique")
        if not set(bound_qids) <= set(allowlist_qids):
            errors.append(f"{label}: authority QID is absent from allowlist")
        legacy = work_type_rule["legacy_allowlist"]
        if not isinstance(legacy, dict) or set(legacy) != {
            "hash_algorithm",
            "rows",
            "rows_sha256",
            "source_config_version",
        }:
            errors.append(
                f"{label}: legacy_allowlist has an invalid shape"
            )
        else:
            legacy_rows = legacy["rows"]
            if (
                legacy["hash_algorithm"] != "sha256"
                or legacy["source_config_version"]
                != LEGACY_WORK_TYPE_SOURCE_CONFIG_VERSION
                or not isinstance(legacy_rows, list)
                or not legacy_rows
                or not isinstance(allowlist, list)
                or legacy["rows_sha256"]
                != LEGACY_WORK_TYPE_ALLOWLIST_SHA256
                or canonical_hash(legacy_rows)
                != LEGACY_WORK_TYPE_ALLOWLIST_SHA256
                or allowlist[: len(legacy_rows)] != legacy_rows
            ):
                errors.append(
                    f"{label}: legacy_allowlist is unsupported"
                )
            else:
                new_rows = allowlist[len(legacy_rows) :]
                new_qids = [
                    row.get("qid")
                    for row in new_rows
                    if isinstance(row, dict)
                ]
                if (
                    len(new_qids) != len(new_rows)
                    or set(new_qids) != set(bound_qids)
                ):
                    errors.append(
                        f"{label}: every non-legacy work-type mapping "
                        "requires an authority binding"
                    )

    grid = config.get("coverage_grid")
    if not isinstance(grid, dict):
        errors.append(f"{label}: coverage_grid must be an object")
        return
    periods = grid.get("periods")
    regions = grid.get("regions")
    if not isinstance(periods, list) or not periods:
        errors.append(f"{label}: periods must be a non-empty array")
        return
    if not isinstance(regions, list) or not regions or not all(
        isinstance(region, str) and region
        for region in regions
    ):
        errors.append(f"{label}: regions must be a non-empty string array")
        return
    if len(regions) != len(set(regions)):
        errors.append(f"{label}: regions must be unique")

    period_ids: list[str] = []
    previous_end: Optional[int] = None
    for index, period in enumerate(periods):
        if not isinstance(period, dict) or set(period) != {
            "id",
            "year_start_inclusive",
            "year_end_exclusive",
        }:
            errors.append(f"{label}: period {index} has an invalid shape")
            continue
        period_id = period["id"]
        start = period["year_start_inclusive"]
        end = period["year_end_exclusive"]
        if not isinstance(period_id, str) or not period_id:
            errors.append(f"{label}: period {index} requires a non-empty id")
            continue
        period_ids.append(period_id)
        if start is not None and not is_plain_int(start):
            errors.append(f"{label}: period {period_id!r} start must be an integer")
            continue
        if end is not None and not is_plain_int(end):
            errors.append(f"{label}: period {period_id!r} end must be an integer")
            continue
        if index == 0:
            if start is not None:
                errors.append(f"{label}: first period must have an open start")
        elif start != previous_end:
            errors.append(f"{label}: periods must form a contiguous partition")
        if start is not None and end is not None and start >= end:
            errors.append(f"{label}: period {period_id!r} is empty or reversed")
        if index < len(periods) - 1 and end is None:
            errors.append(f"{label}: only the final period may have an open end")
        if index == len(periods) - 1 and end is not None:
            errors.append(f"{label}: final period must have an open end")
        previous_end = end

    if len(period_ids) != len(set(period_ids)):
        errors.append(f"{label}: period ids must be unique")
    if set(period_ids) != allowed_periods:
        errors.append(f"{label}: period ids do not match the public schema")
    if not is_plain_int(grid.get("cell_count")) or grid["cell_count"] != (
        len(periods) * len(regions)
    ):
        errors.append(f"{label}: cell_count does not match periods × regions")


def configured_period_for_year(year: int, config: dict) -> Optional[str]:
    matches = []
    for period in config["coverage_grid"]["periods"]:
        start = period["year_start_inclusive"]
        end = period["year_end_exclusive"]
        if (start is None or year >= start) and (end is None or year < end):
            matches.append(period["id"])
    return matches[0] if len(matches) == 1 else None


def wikidata_calendar_day_is_valid(
    year: int,
    month: int,
    day: int,
    calendar_model: str,
) -> bool:
    if not 1 <= month <= 12:
        return False
    if calendar_model.endswith("/Q1985786"):
        leap_year = year % 4 == 0
    else:
        leap_year = year % 4 == 0 and (
            year % 100 != 0 or year % 400 == 0
        )
    month_lengths = [
        31,
        29 if leap_year else 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ]
    return 1 <= day <= month_lengths[month - 1]


def supported_wikidata_period_year(
    statement: dict,
    rule: dict,
) -> Optional[int]:
    qualifiers = statement.get("qualifiers", {})
    if (
        rule["qualifier_policy"] == "none_allowed"
        and (not isinstance(qualifiers, dict) or qualifiers)
    ):
        return None
    snak = statement.get("mainsnak", {})
    if snak.get("snaktype") != "value":
        return None
    datavalue = snak.get("datavalue", {})
    if datavalue.get("type") != "time":
        return None
    value = datavalue.get("value")
    if not isinstance(value, dict):
        return None
    precision = value.get("precision")
    if (
        not is_plain_int(precision)
        or precision not in rule["accepted_precisions"]
    ):
        return None
    if value.get("calendarmodel") not in rule["accepted_calendar_models"]:
        return None
    before = value.get("before")
    after = value.get("after")
    timezone = value.get("timezone")
    if not is_plain_int(before) or before != rule["required_before"]:
        return None
    if not is_plain_int(after) or after != rule["required_after"]:
        return None
    if not is_plain_int(timezone) or timezone != 0:
        return None
    raw_time = value.get("time")
    match = (
        WIKIDATA_TIME_PATTERN.fullmatch(raw_time)
        if isinstance(raw_time, str)
        else None
    )
    if match is None:
        return None
    year = int(match.group("year"))
    if match.group("sign") == "-":
        year = -year
    if year == 0 or year > rule["latest_year_inclusive"]:
        return None
    month = int(match.group("month"))
    day = int(match.group("day"))
    if precision == 9:
        # Mirror the importer without importing it: lower components may be
        # present, but must form a real date and never affect the derived year.
        lower_components_are_zero = month == 0 and day == 0
        lower_components_are_valid_date = wikidata_calendar_day_is_valid(
            year,
            month,
            day,
            value["calendarmodel"],
        )
        if not (
            lower_components_are_zero
            or lower_components_are_valid_date
        ):
            return None
    if precision == 10 and (not 1 <= month <= 12 or day != 0):
        return None
    if precision == 11 and not wikidata_calendar_day_is_valid(
        year,
        month,
        day,
        value["calendarmodel"],
    ):
        return None
    return year


def best_rank_wikidata_rows(
    record: dict,
    property_id: str,
) -> Optional[list[tuple[int, dict]]]:
    rows = [
        (index, statement)
        for index, statement in enumerate(
            record.get("claims", {}).get(property_id, [])
        )
        if statement.get("rank") != "deprecated"
    ]
    if any(
        statement.get("rank") not in {"preferred", "normal"}
        for _, statement in rows
    ):
        return None
    preferred = [
        (index, statement)
        for index, statement in rows
        if statement.get("rank") == "preferred"
    ]
    if preferred:
        return preferred
    return [
        (index, statement)
        for index, statement in rows
        if statement.get("rank") == "normal"
    ]


def _derive_wikidata_period_from_property(
    record: dict,
    config: dict,
    rule: dict,
    property_id: str,
) -> Optional[list[dict]]:
    rows = best_rank_wikidata_rows(record, property_id)
    if not rows:
        return None
    derived_rows = []
    for index, statement in rows:
        year = supported_wikidata_period_year(statement, rule)
        if year is None:
            return None
        period = configured_period_for_year(year, config)
        if period is None:
            return None
        derived_rows.append(
            {
                "index": index,
                "period": period,
                "statement": statement,
                "year": year,
                "property": property_id,
            }
        )
    periods = {row["period"] for row in derived_rows}
    if len(periods) != 1:
        return None
    return derived_rows


def derive_wikidata_period(record: dict, config: dict) -> Optional[dict]:
    rule = config["period_derivation"]
    basis = rule["basis_property"]
    derived_rows = _derive_wikidata_period_from_property(record, config, rule, basis)
    if derived_rows is None:
        fallback = rule.get("fallback_property")
        if fallback and fallback != basis:
            derived_rows = _derive_wikidata_period_from_property(
                record, config, rule, fallback
            )
    if derived_rows is None:
        return None
    return {
        "period": next(iter({row["period"] for row in derived_rows})),
        "rows": derived_rows,
    }


def wikidata_statement_qualifiers(statement: dict) -> list[dict]:
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


def derive_wikidata_work_type(record: dict, config: dict) -> dict:
    work_type_by_class = {
        row["qid"]: row["work_type"]
        for row in config["exact_instance_allowlist"]
    }
    matches: list[dict] = []
    for index, statement in enumerate(
        record.get("claims", {}).get("P31", [])
    ):
        if statement.get("rank") == "deprecated":
            continue
        values = wikidata_item_values(
            {"claims": {"P31": [statement]}},
            "P31",
        )
        if len(values) != 1:
            continue
        class_qid = values[0]
        work_type = work_type_by_class.get(class_qid)
        if work_type is not None:
            matches.append(
                {
                    "class_qid": class_qid,
                    "index": index,
                    "statement": statement,
                    "work_type": work_type,
                }
            )
    mapped_types = {row["work_type"] for row in matches}
    if not mapped_types:
        return {
            "mapping_status": "unmapped",
            "match": None,
            "work_type": "unknown",
        }
    if len(mapped_types) != 1:
        return {
            "mapping_status": "ambiguous",
            "match": None,
            "work_type": "unknown",
        }
    return {
        "mapping_status": "mapped_exact",
        "match": matches[0],
        "work_type": matches[0]["work_type"],
    }


def validate_work_type_claim(
    work: dict,
    claim_by_id: dict[str, dict],
    config: dict,
    work_snapshot: dict,
    errors: list[str],
) -> None:
    work_id = work["id"]
    type_claims = [
        claim_by_id[claim_id]
        for claim_id in work["claim_ids"]
        if (
            claim_id in claim_by_id
            and claim_by_id[claim_id]["predicate"] == "field_work_type"
        )
    ]
    qid = work["external_ids"].get("wikidata")
    wrapper = work_snapshot["entities"].get(qid) if qid else None
    if wrapper is None:
        errors.append(
            f"{work_id}: work-type source record is absent from the work snapshot"
        )
        return
    derived = derive_wikidata_work_type(wrapper["record"], config)
    if work["work_type_mapping_status"] != derived["mapping_status"]:
        errors.append(
            f"{work_id}: work_type_mapping_status does not match pinned P31"
        )
    if work["work_type"] != derived["work_type"]:
        errors.append(f"{work_id}: work_type does not match pinned P31")

    if derived["mapping_status"] != "mapped_exact":
        if type_claims:
            errors.append(
                f"{work_id}: unmapped/ambiguous work type cannot publish "
                "a field_work_type claim"
            )
        return
    if len(type_claims) != 1:
        errors.append(
            f"{work_id}: mapped_exact work type requires exactly one field claim"
        )
        return

    match = derived["match"]
    claim = type_claims[0]
    if claim["object"].get("value") != derived["work_type"]:
        errors.append(f"{work_id}: field_work_type object is incorrect")
    authority_snapshot_by_class = {
        qid: binding["snapshot_id"]
        for binding in config["work_type_derivation"]["authority_bindings"]
        for qid in binding["qids"]
    }
    expected_qualifiers = {
        "authority_snapshot_id": authority_snapshot_by_class.get(
            match["class_qid"]
        ),
        "basis_property": "P31",
        "coverage_config_version": config["config_version"],
        "derivation_rule_id": config["work_type_derivation"]["rule_id"],
        "matched_class_qid": match["class_qid"],
    }
    if claim["qualifiers"] != expected_qualifiers:
        errors.append(f"{work_id}: field_work_type qualifiers are incorrect")
    if len(claim["evidence"]) != 1:
        errors.append(
            f"{work_id}: field_work_type requires one direct P31 evidence row"
        )
        return
    evidence = claim["evidence"][0]
    statement = match["statement"]
    expected_path = f"/claims/P31/{match['index']}"
    expected_record_id = f"{qid}@{wrapper['lastrevid']}"
    if (
        evidence["snapshot_id"] != work_snapshot["snapshot_id"]
        or evidence["source_id"] != "wikidata"
        or evidence["native_record_id"] != expected_record_id
        or evidence["native_predicate"] != "P31"
        or evidence["native_field_path"] != expected_path
        or evidence["rank"] != statement.get("rank")
        or evidence["qualifiers"]
        != wikidata_statement_qualifiers(statement)
        or evidence["references"] != statement.get("references", [])
        or evidence["support"] != "explicit"
    ):
        errors.append(
            f"{work_id}: field_work_type evidence does not match pinned P31"
        )


def validate_work_period_claim(
    work: dict,
    claim_by_id: dict[str, dict],
    config: dict,
    snapshot_by_id: dict[str, dict],
    errors: list[str],
) -> None:
    work_id = work["id"]
    period = work["period"]
    period_claims = [
        claim_by_id[claim_id]
        for claim_id in work["claim_ids"]
        if (
            claim_id in claim_by_id
            and claim_by_id[claim_id]["predicate"] == "field_period"
        )
    ]
    if period == "unknown":
        if period_claims:
            errors.append(
                f"{work_id}: unknown period cannot publish a field_period claim"
            )
        return

    allowed_periods = {
        row["id"]
        for row in config["coverage_grid"]["periods"]
    }
    if period not in allowed_periods:
        errors.append(f"{work_id}: period is absent from the coverage partition")
    if len(period_claims) != 1:
        errors.append(
            f"{work_id}: known period requires exactly one field_period claim"
        )
        return

    claim = period_claims[0]
    if claim["object"].get("value") != period:
        errors.append(f"{work_id}: field_period claim does not match work period")
    qualifiers = claim["qualifiers"]
    expected_qualifier_keys = {
        "basis_property",
        "coverage_config_version",
        "derivation_rule_id",
        "source_years",
    }
    if set(qualifiers) != expected_qualifier_keys:
        errors.append(f"{work_id}: field_period qualifiers have an invalid shape")
        return
    rule = config["period_derivation"]
    allowed_basis = {rule["basis_property"]}
    fallback = rule.get("fallback_property")
    if fallback:
        allowed_basis.add(fallback)
    if qualifiers["basis_property"] not in allowed_basis:
        errors.append(f"{work_id}: field_period basis property is stale")
    if qualifiers["derivation_rule_id"] != rule["rule_id"]:
        errors.append(f"{work_id}: field_period derivation rule is stale")
    if qualifiers["coverage_config_version"] != config["config_version"]:
        errors.append(f"{work_id}: field_period coverage config version is stale")

    years = qualifiers["source_years"]
    if not isinstance(years, list) or not years or not all(
        is_plain_int(year)
        and year != 0
        and year <= rule["latest_year_inclusive"]
        for year in years
    ):
        errors.append(f"{work_id}: field_period source_years are invalid")
        return
    if any(
        configured_period_for_year(year, config) != period
        for year in years
    ):
        errors.append(f"{work_id}: field_period source years cross period boundaries")
    if len(claim["evidence"]) != len(years):
        errors.append(
            f"{work_id}: field_period evidence count does not match source years"
        )
    allowed_predicates = {rule["basis_property"]}
    if fallback:
        allowed_predicates.add(fallback)
    for evidence in claim["evidence"]:
        if evidence["support"] != "indirect":
            errors.append(f"{work_id}: field_period evidence must be indirect")
        if evidence["source_id"] != "wikidata":
            errors.append(f"{work_id}: field_period evidence must come from Wikidata")
        if evidence["native_predicate"] not in allowed_predicates:
            errors.append(f"{work_id}: field_period evidence predicate is invalid")
        if not re.fullmatch(
            r"/claims/(?:P571|P1619)/\d+",
            evidence["native_field_path"],
        ):
            errors.append(f"{work_id}: field_period evidence path is invalid")

    snapshot_ids = {
        evidence["snapshot_id"]
        for evidence in claim["evidence"]
    }
    if len(snapshot_ids) != 1:
        errors.append(f"{work_id}: field_period evidence must use one snapshot")
        return
    snapshot_id = next(iter(snapshot_ids))
    snapshot = snapshot_by_id.get(snapshot_id)
    if snapshot is None:
        errors.append(f"{work_id}: field_period snapshot is unavailable")
        return
    qid = work["external_ids"].get("wikidata")
    wrapper = snapshot["entities"].get(qid) if qid else None
    if wrapper is None:
        errors.append(
            f"{work_id}: field_period source record is absent from its snapshot"
        )
        return

    derived = derive_wikidata_period(wrapper["record"], config)
    if derived is None:
        errors.append(
            f"{work_id}: pinned P571 statements do not support a derived period"
        )
        return
    if derived["period"] != period:
        errors.append(
            f"{work_id}: pinned P571 statements derive a different period"
        )
    expected_paths = [
        f"/claims/{row['property']}/{row['index']}"
        for row in derived["rows"]
    ]
    actual_paths = [
        evidence["native_field_path"]
        for evidence in claim["evidence"]
    ]
    if actual_paths != expected_paths:
        errors.append(
            f"{work_id}: field_period evidence does not match best-rank P571 rows"
        )
    expected_years = [
        row["year"]
        for row in derived["rows"]
    ]
    if years != expected_years:
        errors.append(
            f"{work_id}: field_period source years do not match pinned P571 values"
        )

    expected_record_id = f"{qid}@{wrapper['lastrevid']}"
    for evidence, row in zip(claim["evidence"], derived["rows"]):
        statement = row["statement"]
        if evidence["native_record_id"] != expected_record_id:
            errors.append(
                f"{work_id}: field_period evidence targets the wrong revision"
            )
        if evidence["rank"] != statement.get("rank"):
            errors.append(
                f"{work_id}: field_period evidence rank does not match P571"
            )
        if evidence["qualifiers"] != wikidata_statement_qualifiers(statement):
            errors.append(
                f"{work_id}: field_period evidence qualifiers do not match P571"
            )
        if evidence["references"] != statement.get("references", []):
            errors.append(
                f"{work_id}: field_period evidence references do not match P571"
            )


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

    year_match = re.fullmatch(r"(-?\d{1,6})", display)
    month_match = re.fullmatch(r"(-?\d{1,6})-(\d{2})", display)
    day_match = re.fullmatch(r"(-?\d{1,6})-(\d{2})-(\d{2})", display)
    range_match = re.fullmatch(
        r"(-?\d{1,6})\s*[–—]\s*(-?\d{1,6})",
        display,
    )
    circa_match = re.fullmatch(
        r"(?:c\.?|ca\.?|circa|约)\s*(-?\d{1,6})",
        display,
        flags=re.IGNORECASE,
    )
    matches = {
        "year": year_match,
        "month": month_match,
        "day": day_match,
        "range": range_match,
        "circa": circa_match,
    }
    match = matches[precision]
    if not match:
        errors.append(
            f"{owner_id}.{field}: value {display!r} does not match {precision} precision"
        )
        return

    parsed_year = int(match.group(1))
    if parsed_year == 0:
        errors.append(f"{owner_id}.{field}: year zero is not supported")
        return

    if precision in {"year", "month", "day"}:
        if earliest != parsed_year or latest != parsed_year:
            errors.append(
                f"{owner_id}.{field}: display year must equal earliest/latest bounds"
            )

    if precision in {"month", "day"}:
        month = int(match.group(2))
        if not 1 <= month <= 12:
            errors.append(f"{owner_id}.{field}: month is outside 01-12")
            return

    if precision == "day":
        day = int(match.group(3))
        month_lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        leap_year = parsed_year % 4 == 0 and (
            parsed_year % 100 != 0 or parsed_year % 400 == 0
        )
        if leap_year:
            month_lengths[1] = 29
        if not 1 <= day <= month_lengths[month - 1]:
            errors.append(f"{owner_id}.{field}: day is invalid for its calendar month")

    if precision == "range":
        parsed_latest = int(match.group(2))
        if parsed_latest == 0:
            errors.append(f"{owner_id}.{field}: year zero is not supported")
        if earliest != parsed_year or latest != parsed_latest:
            errors.append(
                f"{owner_id}.{field}: displayed range must equal earliest/latest bounds"
            )

    if precision == "circa" and not earliest <= parsed_year <= latest:
        errors.append(
            f"{owner_id}.{field}: circa year must fall within earliest/latest bounds"
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
        "unresolved_credits",
    }
    by_predicate: dict[str, list[dict]] = {}
    for claim in claims:
        if claim["subject_id"] == item["id"]:
            by_predicate.setdefault(claim["predicate"], []).append(claim)
    for field, expected in item.items():
        if field in administrative or not meaningful_fact(expected):
            continue
        predicate = f"field_{field}"
        matches = [
            claim
            for claim in by_predicate.get(predicate, [])
            if (
                claim["id"] in item["claim_ids"]
                and claim["verification_status"] == "verified"
                and claim["object"].get("value") == expected
            )
        ]
        if not matches:
            errors.append(
                f"{item['id']}: verified field {field!r} lacks an exact verified claim"
            )
        else:
            relevant.extend(matches)
        competing = [
            claim["id"]
            for claim in by_predicate.get(predicate, [])
            if (
                claim["verification_status"] in {"contested", "declined"}
                or (
                    claim["verification_status"] == "verified"
                    and claim["object"].get("value") != expected
                )
                or any(
                    evidence["support"] == "conflicting"
                    for evidence in claim.get("evidence", [])
                )
            )
        ]
        if competing:
            errors.append(
                f"{item['id']}: verified field {field!r} has competing claims "
                f"{sorted(competing)!r}"
            )
    return relevant


def validate_verified_work_credit(
    work: dict,
    credit: dict,
    claim: dict,
    contributor: Optional[dict],
    errors: list[str],
) -> None:
    if work["verification_status"] != "verified":
        return
    if credit["credit_status"] != "verified":
        errors.append(
            f"{work['id']}: verified work cannot include a non-verified credit"
        )
    if claim["verification_status"] != "verified":
        errors.append(
            f"{work['id']}: verified work cannot include a non-verified credit claim"
        )
    if contributor is None or contributor["verification_status"] != "verified":
        errors.append(
            f"{work['id']}: verified work credit requires a verified contributor entity"
        )


def logical_relation_key(relation: dict) -> tuple[str, str, str]:
    from_id = relation["from_id"]
    to_id = relation["to_id"]
    relation_type = relation["relation_type"]
    if relation_type in SYMMETRIC_RELATION_TYPES:
        from_id, to_id = sorted((from_id, to_id))
    return from_id, to_id, relation_type


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


def merge_catalog_payloads(
    payloads: list[tuple[Path, dict]],
    errors: list[str],
) -> tuple[dict[str, list[dict]], str]:
    merged: dict[str, list[dict]] = {key: [] for key in CATALOG_KEYS}
    full_shards = [
        (path, payload)
        for path, payload in payloads
        if payload.get("kind") != OVERLAY_KIND
    ]
    overlays = [
        (path, payload)
        for path, payload in payloads
        if payload.get("kind") == OVERLAY_KIND
    ]
    base_contract = [
        {
            "path": path.relative_to(DATA).as_posix(),
            "payload": payload,
        }
        for path, payload in full_shards
    ]
    base_hash = canonical_hash(base_contract)
    for path, shard in full_shards:
        missing = [key for key in CATALOG_KEYS if not isinstance(shard.get(key), list)]
        if missing:
            errors.append(f"{path.name}: full shard lacks arrays {missing!r}")
            continue
        for key in CATALOG_KEYS:
            merged[key].extend(shard[key])

    entity_by_id: dict[str, dict] = {}
    for key in ENTITY_CATALOG_KEYS:
        for entity in merged[key]:
            entity_id = entity.get("id")
            if not isinstance(entity_id, str):
                continue
            if entity_id in entity_by_id:
                errors.append(
                    f"catalog overlay base has duplicate entity {entity_id!r}"
                )
            else:
                entity_by_id[entity_id] = entity
    base_claim_ids = {
        claim.get("id")
        for claim in merged["claims"]
        if isinstance(claim.get("id"), str)
    }
    patched_entities: set[str] = set()
    overlay_ids: set[str] = set()
    ordered_overlays = sorted(
        overlays,
        key=lambda row: str(row[1].get("overlay_id", "")).encode("utf-8"),
    )
    for path, overlay in ordered_overlays:
        overlay_id = overlay.get("overlay_id")
        if not isinstance(overlay_id, str) or not overlay_id:
            errors.append(f"{path.name}: overlay_id is required")
            continue
        if overlay_id in overlay_ids:
            errors.append(f"{path.name}: duplicate overlay_id {overlay_id!r}")
        overlay_ids.add(overlay_id)
        if overlay.get("base_catalog_sha256") != base_hash:
            errors.append(
                f"{path.name}: overlay base_catalog_sha256 does not match full shards"
            )
        claims = overlay.get("claims")
        patches = overlay.get("entity_patches")
        if not isinstance(claims, list) or not isinstance(patches, list):
            errors.append(f"{path.name}: overlay claims/patches must be arrays")
            continue
        claim_by_id = {
            claim.get("id"): claim
            for claim in claims
            if isinstance(claim, dict) and isinstance(claim.get("id"), str)
        }
        if len(claim_by_id) != len(claims):
            errors.append(f"{path.name}: overlay claim IDs must be unique")
        collisions = base_claim_ids & set(claim_by_id)
        if collisions:
            errors.append(
                f"{path.name}: overlay reuses claim IDs {sorted(collisions)!r}"
            )
        attached: set[str] = set()
        for patch in patches:
            if not isinstance(patch, dict):
                errors.append(f"{path.name}: overlay patch must be an object")
                continue
            entity_id = patch.get("entity_id")
            if not isinstance(entity_id, str):
                errors.append(f"{path.name}: overlay patch entity_id is invalid")
                continue
            if entity_id in patched_entities:
                errors.append(
                    f"{path.name}: entity {entity_id!r} is patched more than once"
                )
            entity = entity_by_id.get(entity_id)
            if entity is None:
                errors.append(
                    f"{path.name}: overlay target {entity_id!r} does not exist"
                )
                continue
            if entity.get("entity_type") != patch.get("entity_type"):
                errors.append(
                    f"{path.name}: overlay target {entity_id!r} type mismatch"
                )
            assertions = patch.get("assert_external_ids")
            additions = patch.get("add_external_ids")
            claim_ids = patch.get("add_claim_ids")
            if (
                not isinstance(assertions, dict)
                or not isinstance(additions, dict)
                or not isinstance(claim_ids, list)
            ):
                errors.append(f"{path.name}: overlay patch fields are invalid")
                continue
            for namespace, expected in assertions.items():
                if entity.get("external_ids", {}).get(namespace) != expected:
                    errors.append(
                        f"{path.name}: {entity_id!r} external ID assertion failed"
                    )
            for namespace, value in additions.items():
                if namespace in entity.get("external_ids", {}):
                    errors.append(
                        f"{path.name}: {entity_id!r} cannot replace external ID "
                        f"{namespace!r}"
                    )
                else:
                    entity["external_ids"][namespace] = value
            for claim_id in claim_ids:
                claim = claim_by_id.get(claim_id)
                if claim is None or claim.get("subject_id") != entity_id:
                    errors.append(
                        f"{path.name}: claim {claim_id!r} does not match "
                        f"target {entity_id!r}"
                    )
                    continue
                if claim_id in attached:
                    errors.append(
                        f"{path.name}: claim {claim_id!r} is attached twice"
                    )
                else:
                    attached.add(claim_id)
                    entity["claim_ids"].append(claim_id)
            patched_entities.add(entity_id)
        if attached != set(claim_by_id):
            errors.append(
                f"{path.name}: every overlay claim must be attached exactly once"
            )
        merged["claims"].extend(claims)
        base_claim_ids.update(claim_by_id)
    return merged, base_hash


def catalog_base_entity_contracts(
    payloads: list[tuple[Path, dict]],
    errors: list[str],
) -> dict[str, dict]:
    """Capture immutable base identity fields before overlays mutate the merge."""
    contracts: dict[str, dict] = {}
    for path, payload in payloads:
        if payload.get("kind") == OVERLAY_KIND:
            continue
        for key in ENTITY_CATALOG_KEYS:
            entities = payload.get(key)
            if not isinstance(entities, list):
                continue
            for entity in entities:
                if not isinstance(entity, dict):
                    continue
                entity_id = entity.get("id")
                entity_type = entity.get("entity_type")
                external_ids = entity.get("external_ids")
                if (
                    not isinstance(entity_id, str)
                    or not isinstance(entity_type, str)
                    or not isinstance(external_ids, dict)
                ):
                    continue
                if entity_id in contracts:
                    errors.append(
                        f"{path.name}: duplicate base entity contract {entity_id!r}"
                    )
                    continue
                contracts[entity_id] = {
                    "entity_type": entity_type,
                    "external_ids": dict(external_ids),
                }
    return contracts


def validate_getty_ulan_identity_overlay(
    path_name: str,
    overlay: dict,
    snapshot: dict,
    crosswalk: dict,
    base_entities: dict[str, dict],
    errors: list[str],
) -> None:
    """Bind every Getty overlay field to an accepted snapshot projection."""
    snapshot_id = snapshot["snapshot_id"]
    crosswalk_snapshot_id = crosswalk["snapshot_id"]
    base_catalog_sha256 = snapshot["base_catalog_sha256"]
    overlay_identity = {
        "base_catalog_sha256": base_catalog_sha256,
        "crosswalk_snapshot_id": crosswalk_snapshot_id,
        "generated_from": snapshot_id,
    }
    expected_header = {
        "kind": OVERLAY_KIND,
        "overlay_id": (
            "getty-ulan-identity-"
            f"{canonical_hash(overlay_identity)[:16]}"
        ),
        "source_id": "getty-ulan",
        "generated_from": snapshot_id,
        "crosswalk_snapshot_id": crosswalk_snapshot_id,
        "generator": (
            f"{GETTY_ULAN_OVERLAY_TRANSFORMER_ID}@"
            f"{GETTY_ULAN_OVERLAY_TRANSFORMER_VERSION}"
        ),
        "transformer_id": GETTY_ULAN_OVERLAY_TRANSFORMER_ID,
        "transformer_version": GETTY_ULAN_OVERLAY_TRANSFORMER_VERSION,
        "base_catalog_sha256": base_catalog_sha256,
    }
    for key, expected in expected_header.items():
        if overlay.get(key) != expected:
            errors.append(
                f"{path_name}: Getty overlay {key} is not bound to its snapshot"
            )

    crosswalk_by_ulan = {
        row["ulan_subject_id"]: row
        for row in crosswalk["records"]
    }
    selected_by_ulan = {
        row["ulan_id"]: row
        for row in crosswalk["selection"]["selected"]
    }
    discovery_by_qid = {
        row["qid"]: row
        for row in crosswalk["selection"]["discovery"]
    }
    expected_patches: list[dict] = []
    expected_claims: list[dict] = []
    for ulan_id in sorted(snapshot["records"], key=int):
        wrapper = snapshot["records"][ulan_id]
        projection = wrapper["projection"]
        row = crosswalk_by_ulan.get(ulan_id)
        selected = selected_by_ulan.get(ulan_id)
        if row is None or selected is None:
            errors.append(
                f"{path_name}: accepted Getty ULAN {ulan_id} lacks its crosswalk row"
            )
            continue
        entity_id = row["entity_id"]
        qid = row["wikidata_qid"]
        base_entity = base_entities.get(entity_id)
        discovery = discovery_by_qid.get(qid)
        statement_index = selected["statement_index"]
        if (
            base_entity is None
            or discovery is None
            or not isinstance(statement_index, int)
            or statement_index < 0
            or statement_index >= len(discovery["statements"])
        ):
            errors.append(
                f"{path_name}: accepted Getty ULAN {ulan_id} lacks base evidence"
            )
            continue
        statement = discovery["statements"][statement_index]
        base_external_ids = base_entity["external_ids"]
        if (
            base_entity["entity_type"] != row["entity_type"]
            or base_external_ids.get("wikidata") != qid
            or projection["entity_id"] != entity_id
            or projection["entity_type"] != row["entity_type"]
            or projection["wikidata_qid"] != qid
            or projection["equivalent_qids"] != [qid]
            or statement["value"] != ulan_id
        ):
            errors.append(
                f"{path_name}: accepted Getty ULAN {ulan_id} identity chain differs"
            )
            continue
        p245 = {
            "property_id": "P245",
            "value": statement["value"],
            "rank": statement["rank"],
            "statement_id": statement["statement_id"],
            "statement_index": statement_index,
            "native_field_path": statement["native_field_path"],
        }
        claim_id = f"claim-{entity_id}-ulan-{ulan_id}"
        final_external_ids = {
            **base_external_ids,
            "ulan": ulan_id,
        }
        expected_patches.append(
            {
                "entity_id": entity_id,
                "entity_type": row["entity_type"],
                "assert_external_ids": {"wikidata": qid},
                "add_external_ids": {"ulan": ulan_id},
                "add_claim_ids": [claim_id],
            }
        )
        expected_claims.append(
            {
                "id": claim_id,
                "subject_id": entity_id,
                "predicate": "field_external_ids",
                "object": {"value": final_external_ids},
                "qualifiers": {
                    "namespace": "ulan",
                    "identity_scope": GETTY_ULAN_IDENTITY_SCOPE,
                    "crosswalk_snapshot_id": crosswalk_snapshot_id,
                    "wikidata_qid": qid,
                    "p245": p245,
                },
                "evidence": [
                    {
                        "source_id": "getty-ulan",
                        "snapshot_id": snapshot_id,
                        "native_record_id": projection["native_record_id"],
                        "native_field_path": "/projection",
                        "native_predicate": "ulan",
                        "url": projection["canonical_uri"],
                        "locator": projection["native_record_id"],
                        "accessed": snapshot["accessed"],
                        "support": "explicit",
                        "extraction_method": "structured_mapping",
                        "language": None,
                        "rank": None,
                        "qualifiers": [],
                        "references": projection["source_uris"],
                        "contributors": projection["contributor_uris"],
                        "source_record_sha256": wrapper["projection_sha256"],
                    }
                ],
                "verification_status": "candidate",
                "confidence": 0.5,
                "reviewed_by": None,
                "reviewed_at": None,
            }
        )

    if overlay.get("entity_patches") != expected_patches:
        errors.append(
            f"{path_name}: Getty overlay patches are not the exact accepted set"
        )
    if overlay.get("claims") != expected_claims:
        errors.append(
            f"{path_name}: Getty overlay claims are not exact snapshot projections"
        )


def validate_getty_ulan_identity_snapshot(
    snapshot: dict,
    entity_by_id: dict[str, dict],
    snapshot_records: dict[tuple[str, str], tuple[str, str, str]],
    errors: list[str],
) -> None:
    snapshot_id = snapshot["snapshot_id"]
    preimage = {
        key: value
        for key, value in snapshot.items()
        if key not in {"projection_sha256", "snapshot_id"}
    }
    expected_projection_hash = canonical_hash(preimage)
    if snapshot["projection_sha256"] != expected_projection_hash:
        errors.append(f"{snapshot_id}: projection_sha256 mismatch")
    expected_snapshot_id = (
        f"getty-ulan-identity-{snapshot['accessed']}-"
        f"{expected_projection_hash[:12]}"
    )
    if snapshot_id != expected_snapshot_id:
        errors.append(f"{snapshot_id}: snapshot id does not bind its projection")
    records = snapshot["records"]
    selection = snapshot["selection"]
    accepted_subject_ids = selection["accepted_subject_ids"]
    rejections = selection["rejections"]
    if len(records) != selection["record_count"]:
        errors.append(f"{snapshot_id}: Getty accepted record_count mismatch")
    if list(records) != sorted(records, key=int):
        errors.append(f"{snapshot_id}: Getty ULAN records must use numeric order")
    if accepted_subject_ids != sorted(records, key=int):
        errors.append(
            f"{snapshot_id}: accepted_subject_ids differ from accepted records"
        )
    rejected_subject_ids = [
        rejection["subject_id"]
        for rejection in rejections
    ]
    if rejected_subject_ids != sorted(rejected_subject_ids, key=int):
        errors.append(f"{snapshot_id}: Getty rejections must use numeric order")
    if (
        set(accepted_subject_ids) & set(rejected_subject_ids)
        or len(set(rejected_subject_ids)) != len(rejected_subject_ids)
        or len(accepted_subject_ids) + len(rejected_subject_ids)
        != selection["seed_count"]
        or selection["seed_count"] != 24
    ):
        errors.append(
            f"{snapshot_id}: Getty acceptance/rejection partition is invalid"
        )
    entity_ids: set[str] = set()
    qids: set[str] = set()
    for ulan_id, wrapper in records.items():
        projection = wrapper["projection"]
        projection_hash = canonical_hash(projection)
        if wrapper["projection_sha256"] != projection_hash:
            errors.append(f"{snapshot_id}/{ulan_id}: projection hash mismatch")
        expected_uri = f"http://vocab.getty.edu/ulan/{ulan_id}"
        expected_representation = f"https://vocab.getty.edu/ulan/{ulan_id}"
        expected_native_id = f"ulan:{ulan_id}"
        if (
            projection["subject_id"] != ulan_id
            or projection["canonical_uri"] != expected_uri
            or projection["representation_url"] != expected_representation
            or projection["native_record_id"] != expected_native_id
            or projection["raw_retained"] is not False
        ):
            errors.append(
                f"{snapshot_id}/{ulan_id}: identity projection is not exact"
            )
        entity_id = projection["entity_id"]
        qid = projection["wikidata_qid"]
        entity = entity_by_id.get(entity_id)
        expected_type = "Person" if projection["entity_type"] == "person" else "Group"
        if (
            entity is None
            or entity.get("entity_type") != projection["entity_type"]
            or entity.get("external_ids", {}).get("wikidata") != qid
            or projection["type"] != expected_type
            or projection["equivalent_qids"] != [qid]
        ):
            errors.append(
                f"{snapshot_id}/{ulan_id}: Getty identity does not match base entity"
            )
        if entity_id in entity_ids or qid in qids:
            errors.append(
                f"{snapshot_id}/{ulan_id}: Getty identity rows must be one-to-one"
            )
        entity_ids.add(entity_id)
        qids.add(qid)
        record_key = (snapshot_id, expected_native_id)
        if record_key in snapshot_records:
            errors.append(
                f"{snapshot_id}/{ulan_id}: duplicate native record registration"
            )
        snapshot_records[record_key] = (
            "getty-ulan",
            projection_hash,
            expected_uri,
        )

    for rejection in rejections:
        ulan_id = rejection["subject_id"]
        entity_id = rejection["entity_id"]
        qid = rejection["expected_wikidata_qid"]
        expected_uri = f"http://vocab.getty.edu/ulan/{ulan_id}"
        expected_representation = f"https://vocab.getty.edu/ulan/{ulan_id}"
        expected_native_id = f"ulan:{ulan_id}"
        expected_type = (
            "Person" if rejection["entity_type"] == "person" else "Group"
        )
        entity = entity_by_id.get(entity_id)
        observed = rejection["observed_equivalent_qids"]
        observed_is_canonical = (
            isinstance(observed, list)
            and all(
                isinstance(value, str)
                and re.fullmatch(r"Q[1-9][0-9]*", value)
                for value in observed
            )
            and observed
            == sorted(set(observed), key=lambda value: int(value[1:]))
        )
        invalid_reason = (
            not observed_is_canonical
        ) or (
            rejection["reason"] == "missing_wikidata_equivalent"
            and observed != []
        ) or (
            rejection["reason"] == "conflicting_wikidata_equivalent"
            and (not observed or observed == [qid])
        )
        if (
            rejection["canonical_uri"] != expected_uri
            or rejection["representation_url"] != expected_representation
            or rejection["native_record_id"] != expected_native_id
            or rejection["type"] != expected_type
            or entity is None
            or entity.get("entity_type") != rejection["entity_type"]
            or entity.get("external_ids", {}).get("wikidata") != qid
            or invalid_reason
        ):
            errors.append(
                f"{snapshot_id}/{ulan_id}: Getty rejection receipt is invalid"
            )
        if entity_id in entity_ids or qid in qids:
            errors.append(
                f"{snapshot_id}/{ulan_id}: Getty screening rows must be one-to-one"
            )
        entity_ids.add(entity_id)
        qids.add(qid)


def validate_wikidata_ulan_crosswalk_snapshot(
    snapshot: dict,
    entity_by_id: dict[str, dict],
    snapshot_records: dict[tuple[str, str], tuple[str, str, str]],
    errors: list[str],
) -> None:
    snapshot_id = snapshot["snapshot_id"]
    preimage = {
        key: value
        for key, value in snapshot.items()
        if key != "snapshot_id"
    }
    expected_snapshot_id = (
        f"wikidata-ulan-crosswalk-{snapshot['accessed']}-"
        f"{canonical_hash(preimage)[:12]}"
    )
    if snapshot_id != expected_snapshot_id:
        errors.append(f"{snapshot_id}: snapshot id does not bind crosswalk content")

    selection = snapshot["selection"]
    seed = selection["seed"]
    discovery = selection["discovery"]
    selected = selection["selected"]
    records = snapshot["records"]
    scoped_entities = {
        entity_id: entity
        for entity_id, entity in entity_by_id.items()
        if entity.get("entity_type") in {"person", "practice"}
    }
    if len(seed) != len(scoped_entities):
        errors.append(
            f"{snapshot_id}: crosswalk seed must cover every active creator "
            f"({len(scoped_entities)}), found {len(seed)}"
        )
    if selection["seed_sha256"] != canonical_hash(seed):
        errors.append(f"{snapshot_id}: crosswalk seed hash mismatch")
    seed_qids = [row["qid"] for row in seed]
    if seed_qids != sorted(set(seed_qids), key=lambda qid: int(qid[1:])):
        errors.append(f"{snapshot_id}: crosswalk seed QIDs are not canonical")
    seed_by_qid = {row["qid"]: row for row in seed}
    if {
        (row["entity_id"], row["entity_type"], row["qid"])
        for row in seed
    } != {
        (
            entity["id"],
            entity["entity_type"],
            entity.get("external_ids", {}).get("wikidata"),
        )
        for entity in scoped_entities.values()
    }:
        errors.append(f"{snapshot_id}: crosswalk seed differs from active creators")

    discovery_qids = [row["qid"] for row in discovery]
    if discovery_qids != seed_qids:
        errors.append(f"{snapshot_id}: discovery does not cover seed QIDs in order")
    eligible_rows = [row for row in discovery if row["eligible"]]
    if selection["eligible_count"] != len(eligible_rows):
        errors.append(f"{snapshot_id}: eligible_count mismatch")

    base_eligible_by_qid: dict[str, Optional[dict]] = {}
    base_reasons_by_qid: dict[str, list[str]] = {}
    ulan_to_qids: dict[str, list[str]] = {}
    for row in discovery:
        reasons: list[str] = []
        current = [
            statement
            for statement in row["statements"]
            if statement["rank"] != "deprecated"
        ]
        if len(current) != 1:
            reasons.append("nondeprecated_statement_count_not_one")
            eligible_statement = None
        else:
            eligible_statement = current[0]
            if eligible_statement["rank"] not in {"normal", "preferred"}:
                reasons.append("unsupported_rank")
            if eligible_statement["snaktype"] != "value":
                reasons.append("non_value_snak")
            if eligible_statement["datatype"] != "external-id":
                reasons.append("not_external_id")
            if eligible_statement["datavalue_type"] != "string":
                reasons.append("not_string_value")
            if not isinstance(eligible_statement["statement_id"], str) or not (
                eligible_statement["statement_id"]
            ):
                reasons.append("missing_statement_id")
            if (
                not isinstance(eligible_statement["value"], str)
                or ULAN_ID_PATTERN.fullmatch(eligible_statement["value"]) is None
            ):
                reasons.append("invalid_ulan_id")
        if reasons:
            eligible_statement = None
        base_eligible_by_qid[row["qid"]] = eligible_statement
        base_reasons_by_qid[row["qid"]] = reasons
        if eligible_statement is not None:
            ulan_to_qids.setdefault(eligible_statement["value"], []).append(
                row["qid"]
            )

    for row in discovery:
        for expected_index, statement in enumerate(row["statements"]):
            if (
                statement["statement_index"] != expected_index
                or statement["native_field_path"]
                != f"/claims/P245/{expected_index}"
            ):
                errors.append(
                    f"{snapshot_id}/{row['qid']}: discovery statement path mismatch"
                )
        expected_statement = base_eligible_by_qid[row["qid"]]
        expected_reasons = base_reasons_by_qid[row["qid"]]
        if (
            expected_statement is not None
            and len(ulan_to_qids[expected_statement["value"]]) > 1
        ):
            expected_statement = None
            expected_reasons = ["duplicate_ulan_id"]
        expected_eligible = expected_statement is not None
        expected_statement_id = (
            expected_statement["statement_id"]
            if expected_statement is not None
            else None
        )
        expected_statement_index = (
            expected_statement["statement_index"]
            if expected_statement is not None
            else None
        )
        expected_ulan_id = (
            expected_statement["value"]
            if expected_statement is not None
            else None
        )
        if (
            row["eligible"] != expected_eligible
            or row["eligible_statement_id"] != expected_statement_id
            or row["eligible_statement_index"] != expected_statement_index
            or row["eligible_ulan_id"] != expected_ulan_id
            or row["rejection_reasons"] != expected_reasons
        ):
            errors.append(
                f"{snapshot_id}/{row['qid']}: discovery eligibility policy mismatch"
            )

    if len(selected) != 24 or len(records) != 24:
        errors.append(f"{snapshot_id}: crosswalk must select exactly 24 records")
    if [row["selection_order"] for row in selected] != list(range(len(selected))):
        errors.append(f"{snapshot_id}: crosswalk selection order is invalid")
    selected_by_qid = {row["qid"]: row for row in selected}
    if len(selected_by_qid) != len(selected):
        errors.append(f"{snapshot_id}: crosswalk selected QIDs must be unique")
    selected_ulans = [row["ulan_id"] for row in selected]
    selected_entities = [row["entity_id"] for row in selected]
    if (
        len(set(selected_ulans)) != len(selected_ulans)
        or len(set(selected_entities)) != len(selected_entities)
    ):
        errors.append(f"{snapshot_id}: crosswalk selection is not one-to-one")
    discovery_by_qid = {row["qid"]: row for row in discovery}
    for row in selected:
        seed_row = seed_by_qid.get(row["qid"])
        receipt = discovery_by_qid.get(row["qid"])
        if (
            seed_row is None
            or receipt is None
            or receipt["eligible"] is not True
            or seed_row["entity_id"] != row["entity_id"]
            or seed_row["entity_type"] != row["entity_type"]
            or receipt["eligible_ulan_id"] != row["ulan_id"]
            or receipt["eligible_statement_id"] != row["statement_id"]
            or receipt["eligible_statement_index"] != row["statement_index"]
            or row["work_witness"] not in seed_row["work_witnesses"]
        ):
            errors.append(
                f"{snapshot_id}/{row['qid']}: selected row is not bound to discovery"
            )
        witness = row["work_witness"]
        work = entity_by_id.get(witness["work_id"])
        if (
            work is None
            or work.get("entity_type") != "work"
            or work.get("external_ids", {}).get("wikidata") != witness["work_qid"]
            or work.get("region") != witness["region"]
            or work.get("period") != witness["period"]
            or not any(
                credit.get("entity_id") == row["entity_id"]
                and credit.get("entity_type") == row["entity_type"]
                for credit in work.get("credits", [])
            )
        ):
            errors.append(
                f"{snapshot_id}/{row['qid']}: work witness is not exact"
            )

    expected_records = sorted(
        [
            {
                "entity_id": row["entity_id"],
                "entity_type": row["entity_type"],
                "ulan_subject_id": row["ulan_id"],
                "wikidata_qid": row["qid"],
            }
            for row in selected
        ],
        key=lambda row: int(row["ulan_subject_id"]),
    )
    if records != expected_records:
        errors.append(f"{snapshot_id}: public records differ from selected rows")

    entities = snapshot["entities"]
    if set(entities) != set(selected_by_qid):
        errors.append(f"{snapshot_id}: pinned entity set differs from selection")
    for qid, wrapper in entities.items():
        record = wrapper["record"]
        expected_url = (
            "https://www.wikidata.org/wiki/Special:EntityData/"
            f"{qid}.json?revision={wrapper['lastrevid']}"
        )
        if (
            record.get("id") != qid
            or record.get("lastrevid") != wrapper["lastrevid"]
            or wrapper["record_sha256"] != canonical_hash(record)
            or wrapper["pinned_url"] != expected_url
            or set(record.get("claims", {})) - {"P245"}
        ):
            errors.append(f"{snapshot_id}/{qid}: pinned P245 wrapper is invalid")
            continue
        current: list[tuple[int, dict, str]] = []
        for index, statement in enumerate(record.get("claims", {}).get("P245", [])):
            if statement.get("rank") == "deprecated":
                continue
            value = (
                statement.get("mainsnak", {})
                .get("datavalue", {})
                .get("value")
            )
            if isinstance(value, str):
                current.append((index, statement, value))
        selected_row = selected_by_qid[qid]
        if (
            len(current) != 1
            or current[0][0] != selected_row["statement_index"]
            or current[0][1].get("id") != selected_row["statement_id"]
            or current[0][2] != selected_row["ulan_id"]
        ):
            errors.append(
                f"{snapshot_id}/{qid}: pinned P245 differs from selected row"
            )
        native_record_id = f"{qid}@{wrapper['lastrevid']}"
        snapshot_records[(snapshot_id, native_record_id)] = (
            "wikidata",
            wrapper["record_sha256"],
            expected_url,
        )


def validate_type_authority_seed_contract(
    seed_contract: Any,
    label: str,
    errors: list[str],
) -> Optional[dict]:
    start_error_count = len(errors)
    if not isinstance(seed_contract, dict) or set(seed_contract) != {
        "authorities",
        "base_work_snapshot_id",
        "seed_version",
    }:
        errors.append(f"{label}: invalid root shape")
        return None
    if (
        not isinstance(seed_contract["seed_version"], str)
        or not re.fullmatch(r"\d+\.\d+\.\d+", seed_contract["seed_version"])
    ):
        errors.append(f"{label}: seed_version must be semantic")
    if (
        not isinstance(seed_contract["base_work_snapshot_id"], str)
        or not seed_contract["base_work_snapshot_id"].startswith(
            "wikidata-hydration-"
        )
    ):
        errors.append(f"{label}: base work snapshot id is invalid")
    authorities = seed_contract["authorities"]
    qids: list[str] = []
    if not isinstance(authorities, list) or not authorities:
        errors.append(f"{label}: authority rows must be non-empty")
    else:
        for index, row in enumerate(authorities):
            row_label = f"{label}.authorities[{index}]"
            if not isinstance(row, dict) or set(row) != {
                "label_hint_en",
                "qid",
                "risk_tags",
                "work_type",
            }:
                errors.append(f"{row_label}: invalid shape")
                continue
            qid = row["qid"]
            risk_tags = row["risk_tags"]
            if (
                not isinstance(qid, str)
                or not re.fullmatch(r"Q[1-9][0-9]*", qid)
            ):
                errors.append(f"{row_label}: invalid QID")
            else:
                qids.append(qid)
            if (
                not isinstance(row["label_hint_en"], str)
                or not row["label_hint_en"].strip()
            ):
                errors.append(f"{row_label}: label_hint_en is required")
            if row["work_type"] not in SUPPORTED_WORK_TYPES:
                errors.append(f"{row_label}: unsupported work_type")
            if (
                not isinstance(risk_tags, list)
                or not risk_tags
                or risk_tags != sorted(set(risk_tags))
                or not all(
                    isinstance(tag, str)
                    and re.fullmatch(r"[a-z][a-z0-9_]*", tag)
                    for tag in risk_tags
                )
            ):
                errors.append(
                    f"{row_label}: risk_tags must be unique and sorted"
                )
    if qids and qids != sorted(set(qids), key=lambda qid: int(qid[1:])):
        errors.append(
            f"{label}: QIDs must be unique and numerically ordered"
        )
    if len(errors) != start_error_count:
        return None
    return seed_contract


def authority_snapshot_id(snapshot: dict, seed_sha256: str) -> str:
    aggregate = hashlib.sha256()
    for value in (
        snapshot["adapter_id"],
        snapshot["adapter_version"],
        snapshot["base_work_snapshot_id"],
        seed_sha256,
    ):
        aggregate.update(value.encode("utf-8"))
        aggregate.update(b"\0")
    for qid in sorted(
        snapshot["entities"],
        key=lambda value: int(value[1:]),
    ):
        wrapper = snapshot["entities"][qid]
        aggregate.update(qid.encode("ascii"))
        aggregate.update(b"\0")
        aggregate.update(str(wrapper["lastrevid"]).encode("ascii"))
        aggregate.update(b"\0")
        aggregate.update(wrapper["record_sha256"].encode("ascii"))
        aggregate.update(b"\0")
    return (
        f"wikidata-work-type-authority-{snapshot['accessed']}-"
        f"{aggregate.hexdigest()[:12]}"
    )


def wikidata_item_values(record: dict, property_id: str) -> list[str]:
    values: list[str] = []
    for statement in record.get("claims", {}).get(property_id, []):
        if statement.get("rank") == "deprecated":
            continue
        value = (
            statement.get("mainsnak", {})
            .get("datavalue", {})
            .get("value")
        )
        if isinstance(value, dict) and isinstance(value.get("id"), str):
            values.append(value["id"])
    return values


def wikidata_string_values(record: dict, property_id: str) -> list[str]:
    values: list[str] = []
    for statement in record.get("claims", {}).get(property_id, []):
        if statement.get("rank") == "deprecated":
            continue
        value = (
            statement.get("mainsnak", {})
            .get("datavalue", {})
            .get("value")
        )
        if isinstance(value, str):
            values.append(value)
    return values


def wikidata_iso_values(record: dict) -> list[str]:
    """ISO 3166-1 alpha-2 values from P297, including deprecated statements.

    Wikidata occasionally marks a country's sole P297 statement as deprecated
    for editorial reasons (e.g. the Kingdom-of-the-Netherlands vs. European-
    Netherlands distinction) while the value itself is still the correct ISO
    code. For country-authority verification the seed's expected code is
    already authoritative, so we accept a deprecated-rank value as a fallback
    when no preferred/normal statement is present.
    """
    preferred = wikidata_string_values(record, "P297")
    if preferred:
        return preferred
    values: list[str] = []
    for statement in record.get("claims", {}).get("P297", []):
        value = (
            statement.get("mainsnak", {})
            .get("datavalue", {})
            .get("value")
        )
        if isinstance(value, str):
            values.append(value)
    return values


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
            {"entities": 0, "verified_entities": 0, "works": 0},
        )
        row["entities"] += 1
        if item["verification_status"] == "verified":
            row["verified_entities"] += 1
        if item["entity_type"] == "work":
            row["works"] += 1

    period_rows: dict[str, dict[str, int]] = {}
    for work in payloads["works.json"]:
        period = work["period"]
        row = period_rows.setdefault(period, {"works": 0, "verified_works": 0})
        row["works"] += 1
        if work["verification_status"] == "verified":
            row["verified_works"] += 1

    sources = {source["id"]: source for source in payloads["source-registry.json"]}
    evidence_by_family: Counter[str] = Counter()
    for claim in payloads["claims.json"]:
        for evidence in claim["evidence"]:
            source = sources.get(evidence["source_id"])
            if source:
                evidence_by_family[source["source_family"]] += 1

    coverage_config = load_json(COVERAGE_CONFIG)
    coverage_cells_total = coverage_config["coverage_grid"]["cell_count"]
    coverage_cells_run = 0
    coverage_cells: list[dict] = []
    selection_methods: set[str] = set()
    if SNAPSHOTS.exists():
        for path in sorted(SNAPSHOTS.glob("*.json")):
            snapshot = load_json(path)
            selection_methods.add(snapshot["selection"]["method"])
            if snapshot["selection"]["method"] != "coverage_cell_stable_hash":
                continue
            coverage_cells_run += len(snapshot["queries"])
            for query in snapshot["queries"]:
                cell_id = query["cell_id"]
                period = cell_id.split("__", 1)[1] if "__" in cell_id else "unknown"
                candidate_count = len(query.get("candidate_work_qids") or [])
                selected_count = len(query.get("selected_work_qids") or [])
                coverage_cells.append(
                    {
                        "candidate_count": candidate_count,
                        "cell_id": cell_id,
                        "period": period,
                        "region": query["region"],
                        "selected_count": selected_count,
                        "status": (
                            "empty_observed"
                            if candidate_count == 0
                            else "sampled"
                        ),
                    }
                )
    coverage_cells.sort(key=lambda row: row["cell_id"])
    fixture_regions: Counter[str] = Counter(
        work["region"]
        for work in payloads["works.json"]
    )
    fixture_periods: Counter[str] = Counter(
        work["period"]
        for work in payloads["works.json"]
    )
    work_type_mapping: Counter[str] = Counter(
        work["work_type_mapping_status"]
        for work in payloads["works.json"]
    )

    return {
        "schema_id": "architecture-lineages",
        "schema_version": "1.5.0",
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
            "status": "not_run" if coverage_cells_run == 0 else "partial",
            "cells_total": coverage_cells_total,
            "cells_run": coverage_cells_run,
            "cells": coverage_cells,
            "selection_methods": sorted(selection_methods),
            "fixture_distribution": {
                "periods": dict(sorted(fixture_periods.items())),
                "regions": dict(sorted(fixture_regions.items())),
            },
        },
        "catalog_profile": {
            "regions": dict(sorted(region_rows.items())),
            "periods": dict(sorted(period_rows.items())),
            "verification": dict(sorted(verification.items())),
            "evidence_by_source_family": dict(sorted(evidence_by_family.items())),
            "work_type_mapping": dict(sorted(work_type_mapping.items())),
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
    entity_by_id = {
        item["id"]: item
        for item in people + practices + places + works
    }
    for namespace in ("wikidata", "ulan"):
        owners: dict[str, str] = {}
        for entity in entity_by_id.values():
            value = entity.get("external_ids", {}).get(namespace)
            if value is None:
                continue
            prior = owners.get(value)
            if prior is not None:
                errors.append(
                    f"external_ids.{namespace}: value {value!r} is shared by "
                    f"{prior!r} and {entity['id']!r}"
                )
            else:
                owners[value] = entity["id"]

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
    snapshot_records: dict[tuple[str, str], tuple[str, str, str]] = {}
    coverage_config = load_json(COVERAGE_CONFIG)
    schema = load_json(SCHEMA_PATH)
    public_periods = set(schema["$defs"]["period"]["enum"]) - {"unknown"}
    config_errors: list[str] = []
    validate_coverage_config(coverage_config, public_periods, config_errors)
    errors.extend(config_errors)
    if config_errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    committed_authority_seed: Optional[dict] = None
    if not TYPE_AUTHORITY_SEEDS_PATH.is_file():
        errors.append(
            "work-type authority seed file is missing"
        )
    else:
        committed_authority_seed = validate_type_authority_seed_contract(
            load_json(TYPE_AUTHORITY_SEEDS_PATH),
            "work-type authority seed",
            errors,
        )
    country_authority = {
        row["country_qid"]: row
        for row in coverage_config["country_region_authority"]
    }

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

        if source_id == "getty-ulan":
            validate_getty_ulan_identity_snapshot(
                snapshot,
                entity_by_id,
                snapshot_records,
                errors,
            )
            continue
        if (
            source_id == "wikidata"
            and snapshot.get("selection", {}).get("method")
            == "bounded_p245_crosswalk_stable_hash"
        ):
            validate_wikidata_ulan_crosswalk_snapshot(
                snapshot,
                entity_by_id,
                snapshot_records,
                errors,
            )
            continue

        selection = snapshot["selection"]
        method = selection["method"]
        authority_qids: list[str] = []
        if method == "pinned_hydration_fixtures":
            if selection["per_cell"] is not None or selection["query_limit"] is not None:
                errors.append(
                    f"{snapshot_id}: hydration fixtures require null query limits"
                )
            if snapshot["queries"]:
                errors.append(f"{snapshot_id}: hydration fixtures cannot contain queries")
            if "authority_qids" in selection:
                errors.append(
                    f"{snapshot_id}: hydration fixtures cannot contain authority_qids"
                )
            if "authority_seed" in selection:
                errors.append(
                    f"{snapshot_id}: hydration fixtures cannot contain authority_seed"
                )
            if "base_work_snapshot_id" in snapshot:
                errors.append(
                    f"{snapshot_id}: hydration fixtures cannot bind a base snapshot"
                )
            expected_seed_hash = canonical_hash(snapshot["seeds"])
        elif method == "exact_instance_allowlist_authority":
            authority_qids = selection.get("authority_qids", [])
            authority_seed = selection.get("authority_seed")
            if (
                selection["per_cell"] is not None
                or selection["query_limit"] is not None
            ):
                errors.append(
                    f"{snapshot_id}: type authorities require null query limits"
                )
            if snapshot["queries"] or snapshot["seeds"]:
                errors.append(
                    f"{snapshot_id}: type authorities cannot contain queries or seeds"
                )
            if (
                not isinstance(authority_qids, list)
                or not authority_qids
                or not all(
                    isinstance(qid, str)
                    and re.fullmatch(r"Q[1-9][0-9]*", qid)
                    for qid in authority_qids
                )
                or authority_qids
                != sorted(set(authority_qids), key=lambda qid: int(qid[1:]))
            ):
                errors.append(
                    f"{snapshot_id}: type authority QIDs must be unique and "
                    "numerically ordered"
                )
                authority_qids = []
            if not snapshot.get("base_work_snapshot_id"):
                errors.append(
                    f"{snapshot_id}: type authorities require a base work snapshot"
                )
            validated_authority_seed = (
                validate_type_authority_seed_contract(
                    authority_seed,
                    f"{snapshot_id}: embedded authority seed",
                    errors,
                )
            )
            if (
                committed_authority_seed is not None
                and validated_authority_seed is not None
                and validated_authority_seed != committed_authority_seed
            ):
                errors.append(
                    f"{snapshot_id}: embedded authority seed does not match "
                    "the committed seed contract"
                )
            if validated_authority_seed is None:
                expected_seed_hash = ""
            else:
                expected_seed_hash = canonical_hash(
                    validated_authority_seed
                )
                seed_qids = [
                    row["qid"]
                    for row in validated_authority_seed["authorities"]
                ]
                if authority_qids != seed_qids:
                    errors.append(
                        f"{snapshot_id}: authority_qids do not match "
                        "the embedded seed contract"
                    )
                if (
                    snapshot.get("base_work_snapshot_id")
                    != validated_authority_seed["base_work_snapshot_id"]
                ):
                    errors.append(
                        f"{snapshot_id}: base work snapshot does not match "
                        "the embedded seed contract"
                    )
                if snapshot_id != authority_snapshot_id(
                    snapshot,
                    expected_seed_hash,
                ):
                    errors.append(
                        f"{snapshot_id}: snapshot id does not bind the "
                        "authority seed and pinned revisions"
                    )
        else:
            if selection["per_cell"] is None or selection["query_limit"] is None:
                errors.append(
                    f"{snapshot_id}: coverage selection requires positive query limits"
                )
            if not snapshot["queries"]:
                errors.append(f"{snapshot_id}: coverage selection requires queries")
            if snapshot["seeds"]:
                errors.append(f"{snapshot_id}: coverage selection cannot contain fixture seeds")
            if "authority_qids" in selection:
                errors.append(
                    f"{snapshot_id}: coverage selection cannot contain authority_qids"
                )
            if "authority_seed" in selection:
                errors.append(
                    f"{snapshot_id}: coverage selection cannot contain authority_seed"
                )
            if "base_work_snapshot_id" in snapshot:
                errors.append(
                    f"{snapshot_id}: coverage selection cannot bind a base snapshot"
                )
            expected_seed_hash = hashlib.sha256(
                selection["seed"].encode("utf-8")
            ).hexdigest()
        if selection["seed_sha256"] != expected_seed_hash:
            errors.append(f"{snapshot_id}: selection seed_sha256 mismatch")

        seed_qids = [seed["qid"] for seed in snapshot["seeds"]]
        for qid, count in Counter(seed_qids).items():
            if count > 1:
                errors.append(f"{snapshot_id}: duplicate hydration seed {qid!r}")

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
            revision_id = f"{qid}@{wrapper['lastrevid']}"
            expected_url = (
                "https://www.wikidata.org/wiki/Special:EntityData/"
                f"{qid}.json?revision={wrapper['lastrevid']}"
            )
            if wrapper["pinned_url"] != expected_url:
                errors.append(f"{snapshot_id}/{qid}: pinned_url mismatch")
            if not wrapper["content_type"].lower().startswith("application/json"):
                errors.append(f"{snapshot_id}/{qid}: content_type must be JSON")
            snapshot_records[(snapshot_id, revision_id)] = (
                source_id,
                wrapper["record_sha256"],
                wrapper["pinned_url"],
            )
        required_records = (
            selected_across_cells | set(seed_qids) | set(authority_qids)
        )
        missing_selected = required_records - set(snapshot["entities"])
        if missing_selected:
            errors.append(
                f"{snapshot_id}: selected/seed work records are missing: "
                f"{sorted(missing_selected)!r}"
            )
        if method == "exact_instance_allowlist_authority":
            extra_authorities = set(snapshot["entities"]) - set(authority_qids)
            if extra_authorities:
                errors.append(
                    f"{snapshot_id}: type authority snapshot has extra entities: "
                    f"{sorted(extra_authorities)!r}"
                )
        for seed in snapshot["seeds"]:
            record = snapshot["entities"].get(seed["qid"], {}).get("record")
            if record is None:
                continue
            english_label = record.get("labels", {}).get("en", {}).get("value")
            if not english_label:
                errors.append(
                    f"{snapshot_id}/{seed['qid']}: seed work requires an English label"
                )
            country_values = set(wikidata_item_values(record, "P17"))
            if seed["expected_country_qid"] not in country_values:
                errors.append(
                    f"{snapshot_id}/{seed['qid']}: expected country "
                    f"{seed['expected_country_qid']!r} is absent from P17"
                )
            expected_authority = {
                "country_qid": seed["expected_country_qid"],
                "iso2": seed["expected_country_code"],
                "region": seed["region"],
            }
            if country_authority.get(seed["expected_country_qid"]) != expected_authority:
                errors.append(
                    f"{snapshot_id}/{seed['qid']}: seed geography does not "
                    "match country authority"
                )
            country_record = (
                snapshot["entities"]
                .get(seed["expected_country_qid"], {})
                .get("record")
            )
            if country_record is None:
                errors.append(
                    f"{snapshot_id}/{seed['qid']}: country authority record is missing"
                )
            elif seed["expected_country_code"] not in set(
                wikidata_iso_values(country_record)
            ):
                errors.append(
                    f"{snapshot_id}/{seed['expected_country_qid']}: expected "
                    "ISO code is absent from pinned P297"
                )

    for snapshot in snapshot_payloads:
        if (
            snapshot["selection"]["method"]
            != "exact_instance_allowlist_authority"
        ):
            continue
        snapshot_id = snapshot["snapshot_id"]
        base_snapshot_id = snapshot.get("base_work_snapshot_id")
        base_snapshot = snapshot_by_id.get(base_snapshot_id)
        if base_snapshot is None:
            errors.append(
                f"{snapshot_id}: base work snapshot {base_snapshot_id!r} is unavailable"
            )
        elif (
            base_snapshot["selection"]["method"]
            != "pinned_hydration_fixtures"
        ):
            errors.append(
                f"{snapshot_id}: base work snapshot must be a hydration fixture"
            )

    allowlist_by_qid = {
        row["qid"]: row
        for row in coverage_config["exact_instance_allowlist"]
    }
    committed_seed_by_qid = {
        row["qid"]: row
        for row in (
            committed_authority_seed["authorities"]
            if committed_authority_seed is not None
            else []
        )
    }
    for binding in coverage_config["work_type_derivation"][
        "authority_bindings"
    ]:
        snapshot_id = binding["snapshot_id"]
        expected_qids = binding["qids"]
        snapshot = snapshot_by_id.get(snapshot_id)
        if snapshot is None:
            errors.append(
                f"work-type authority binding references missing snapshot "
                f"{snapshot_id!r}"
            )
            continue
        if (
            snapshot["selection"]["method"]
            != "exact_instance_allowlist_authority"
        ):
            errors.append(
                f"{snapshot_id}: configured work-type authority has wrong method"
            )
            continue
        if snapshot["selection"].get("authority_qids") != expected_qids:
            errors.append(
                f"{snapshot_id}: configured work-type authority QIDs mismatch"
            )
        for qid in expected_qids:
            record = (
                snapshot["entities"].get(qid, {}).get("record")
            )
            if record is None:
                continue
            english_label = (
                record.get("labels", {}).get("en", {}).get("value")
            )
            if english_label != allowlist_by_qid[qid]["label_en"]:
                errors.append(
                    f"{snapshot_id}/{qid}: authority English label does not "
                    "match the exact-instance allowlist"
                )
            seed_row = committed_seed_by_qid.get(qid)
            if (
                seed_row is None
                or seed_row["label_hint_en"]
                != allowlist_by_qid[qid]["label_en"]
                or seed_row["work_type"]
                != allowlist_by_qid[qid]["work_type"]
            ):
                errors.append(
                    f"{snapshot_id}/{qid}: committed authority seed does not "
                    "match the exact-instance allowlist"
                )
            if not set(record.get("claims", {})) <= {"P279"}:
                errors.append(
                    f"{snapshot_id}/{qid}: authority record contains "
                    "non-P279 claims"
                )

    catalog_payloads = [
        (path, load_json(path))
        for path in sorted(
            CATALOG.glob("*.json"),
            key=lambda item: item.name.encode("utf-8"),
        )
    ] if CATALOG.exists() else []
    base_entity_contract_by_id = catalog_base_entity_contracts(
        catalog_payloads,
        errors,
    )
    merged_catalog, active_base_catalog_sha256 = merge_catalog_payloads(
        catalog_payloads,
        errors,
    )
    for snapshot in snapshot_payloads:
        source_id = snapshot.get("source_id")
        selection_method = snapshot.get("selection", {}).get("method")
        is_ulan_crosswalk = (
            source_id == "wikidata"
            and selection_method == "bounded_p245_crosswalk_stable_hash"
        )
        is_getty_identity = source_id == "getty-ulan"
        if (
            (is_ulan_crosswalk or is_getty_identity)
            and snapshot.get("base_catalog_sha256")
            != active_base_catalog_sha256
        ):
            errors.append(
                f"{snapshot.get('snapshot_id')}: base catalog hash does not "
                "match the active full catalog"
            )
        if not is_getty_identity:
            continue
        crosswalk = snapshot_by_id.get(snapshot.get("crosswalk_snapshot_id"))
        if (
            crosswalk is None
            or crosswalk.get("source_id") != "wikidata"
            or crosswalk.get("selection", {}).get("method")
            != "bounded_p245_crosswalk_stable_hash"
            or crosswalk.get("claim_evidence_allowed") is not False
        ):
            errors.append(
                f"{snapshot.get('snapshot_id')}: Getty identity snapshot lacks "
                "its exact Wikidata ULAN crosswalk"
            )
            continue
        if snapshot.get("selection", {}).get("seed_sha256") != canonical_hash(
            crosswalk["records"]
        ):
            errors.append(
                f"{snapshot.get('snapshot_id')}: Getty selection hash does not "
                "bind the crosswalk records"
            )
        crosswalk_by_ulan = {
            row["ulan_subject_id"]: row
            for row in crosswalk["records"]
        }
        getty_records = snapshot.get("records", {})
        rejections = snapshot.get("selection", {}).get("rejections", [])
        rejected_by_ulan = {
            row.get("subject_id"): row
            for row in rejections
            if isinstance(row, dict)
        }
        screened_ulans = set(getty_records) | set(rejected_by_ulan)
        if (
            screened_ulans != set(crosswalk_by_ulan)
            or set(getty_records) & set(rejected_by_ulan)
            or snapshot.get("selection", {}).get("seed_count")
            != len(crosswalk_by_ulan)
        ):
            errors.append(
                f"{snapshot.get('snapshot_id')}: Getty screening partition and "
                "crosswalk ULAN identifiers differ"
            )
            continue
        for ulan_id, wrapper in getty_records.items():
            row = crosswalk_by_ulan[ulan_id]
            projection = wrapper["projection"]
            if (
                projection["entity_id"] != row["entity_id"]
                or projection["entity_type"] != row["entity_type"]
                or projection["wikidata_qid"] != row["wikidata_qid"]
            ):
                errors.append(
                    f"{snapshot.get('snapshot_id')}/{ulan_id}: Getty projection "
                    "differs from its crosswalk row"
                )
        for ulan_id, rejection in rejected_by_ulan.items():
            row = crosswalk_by_ulan[ulan_id]
            if (
                rejection["entity_id"] != row["entity_id"]
                or rejection["entity_type"] != row["entity_type"]
                or rejection["expected_wikidata_qid"]
                != row["wikidata_qid"]
            ):
                errors.append(
                    f"{snapshot.get('snapshot_id')}/{ulan_id}: Getty rejection "
                    "differs from its crosswalk row"
                )

    catalog_work_snapshot: Optional[dict] = None
    for path, shard in catalog_payloads:
        is_overlay = shard.get("kind") == OVERLAY_KIND
        if not is_overlay:
            missing_full_keys = [
                key for key in CATALOG_KEYS if key not in shard
            ]
            for key in missing_full_keys:
                errors.append(f"{path.name}: full shard lacks {key!r}")
            if missing_full_keys:
                continue
        source_id = shard.get("source_id")
        if source_id not in source_ids:
            errors.append(
                f"{path.name}: source_id -> unknown source {source_id!r}"
            )
        generated_from = shard.get("generated_from")
        snapshot = snapshot_by_id.get(generated_from)
        if snapshot is None:
            errors.append(
                f"{path.name}: generated_from -> unknown snapshot "
                f"{generated_from!r}"
            )
        elif snapshot["source_id"] != source_id:
            errors.append(
                f"{path.name}: shard source does not match generating snapshot"
            )

        if is_overlay:
            if shard.get("base_catalog_sha256") != active_base_catalog_sha256:
                errors.append(
                    f"{path.name}: overlay is not bound to the active base catalog"
                )
            if snapshot is not None and snapshot.get(
                "claim_evidence_allowed"
            ) is not True:
                errors.append(
                    f"{path.name}: overlay generating snapshot is not claim evidence"
                )
            crosswalk = snapshot_by_id.get(shard.get("crosswalk_snapshot_id"))
            if crosswalk is None:
                errors.append(
                    f"{path.name}: crosswalk_snapshot_id is unavailable"
                )
            elif (
                crosswalk.get("source_id") != "wikidata"
                or crosswalk.get("claim_evidence_allowed") is not False
            ):
                errors.append(
                    f"{path.name}: crosswalk snapshot must be Wikidata "
                    "authority-only data"
                )
            if (
                source_id == "getty-ulan"
                and snapshot is not None
                and crosswalk is not None
            ):
                validate_getty_ulan_identity_overlay(
                    path.name,
                    shard,
                    snapshot,
                    crosswalk,
                    base_entity_contract_by_id,
                    errors,
                )
        else:
            if (
                snapshot is not None
                and snapshot["source_id"] == source_id
                and source_id == "wikidata"
                and shard["works"]
                and snapshot["selection"]["method"]
                == "pinned_hydration_fixtures"
            ):
                if catalog_work_snapshot is not None:
                    errors.append(
                        "catalog: multiple Wikidata work snapshots are active"
                    )
                catalog_work_snapshot = snapshot
            if (
                snapshot is not None
                and snapshot["source_id"] == source_id
                and (
                    shard["transformer_id"]
                    != coverage_config["transformer"]["id"]
                    or shard["transformer_version"]
                    != coverage_config["transformer"]["version"]
                    or shard["generator"]
                    != (
                        f"{coverage_config['transformer']['id']}@"
                        f"{coverage_config['transformer']['version']}"
                    )
                )
            ):
                errors.append(
                    f"{path.name}: transformer does not match coverage config"
                )
            source = source_by_id.get(source_id)
            if (
                source
                and source["adapter_status"] == "fixture_only"
            ):
                fixture_graph = (
                    shard["people"]
                    + shard["practices"]
                    + shard["places"]
                    + shard["works"]
                    + shard["relations"]
                    + shard["claims"]
                )
                if any(
                    item["verification_status"] != "candidate"
                    for item in fixture_graph
                ):
                    errors.append(
                        f"{path.name}: fixture-only adapters may emit candidates only"
                    )

        for claim in shard.get("claims", []):
            for evidence in claim.get("evidence", []):
                if evidence.get("source_id") != source_id:
                    errors.append(
                        f"{path.name}/{claim.get('id')}: evidence source escapes shard"
                    )
                if evidence.get("snapshot_id") != generated_from:
                    errors.append(
                        f"{path.name}/{claim.get('id')}: evidence snapshot escapes shard"
                    )

    if catalog_work_snapshot is None:
        errors.append("catalog: active Wikidata work snapshot is unavailable")
        catalog_work_snapshot = {
            "entities": {},
            "snapshot_id": "missing-work-snapshot",
        }
    else:
        for snapshot in snapshot_payloads:
            if (
                snapshot.get("source_id") == "wikidata"
                and snapshot.get("selection", {}).get("method")
                == "bounded_p245_crosswalk_stable_hash"
                and snapshot.get("base_work_snapshot_id")
                != catalog_work_snapshot["snapshot_id"]
            ):
                errors.append(
                    f"{snapshot.get('snapshot_id')}: base work snapshot does "
                    "not match the active Wikidata catalog"
                )
        for binding in coverage_config["work_type_derivation"][
            "authority_bindings"
        ]:
            authority_snapshot = snapshot_by_id.get(
                binding["snapshot_id"]
            )
            if (
                authority_snapshot is not None
                and authority_snapshot.get("base_work_snapshot_id")
                != catalog_work_snapshot["snapshot_id"]
            ):
                errors.append(
                    f"{binding['snapshot_id']}: base work snapshot does not "
                    "match the active Wikidata catalog"
                )

    public_graph_arrays = {
        "people": people,
        "practices": practices,
        "places": places,
        "works": works,
        "claims": claims,
        "relations": relations,
    }
    for key, expected_records in merged_catalog.items():
        if public_graph_arrays[key] != expected_records:
            errors.append(
                f"{key}.json: public array does not equal ordered catalog merge"
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
        if implemented and not any(
            snapshot["source_id"] == source["id"]
            for snapshot in snapshot_payloads
        ):
            errors.append(
                f"source {source['id']!r}: implemented adapter status requires "
                "a committed source snapshot"
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

    for claim in claims:
        subject = entity_by_id.get(claim["subject_id"])
        if subject is not None and claim["id"] not in subject["claim_ids"]:
            errors.append(
                f"{claim['id']}: entity subject must list every claim in claim_ids"
            )

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
    unresolved_credit_claim_ids: set[str] = set()
    for work in works:
        work_id = work["id"]
        validate_work_period_claim(
            work,
            claim_by_id,
            coverage_config,
            snapshot_by_id,
            errors,
        )
        validate_work_type_claim(
            work,
            claim_by_id,
            coverage_config,
            catalog_work_snapshot,
            errors,
        )
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
        if (
            work["verification_status"] == "verified"
            and work["unresolved_credits"]
        ):
            errors.append(
                f"{work_id}: verified work cannot retain unresolved credits"
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
                validate_verified_work_credit(
                    work,
                    credit,
                    claim,
                    entity_by_id.get(credit["entity_id"]),
                    errors,
                )
        for unresolved in work["unresolved_credits"]:
            unresolved_claim_id = unresolved["claim_id"]
            if unresolved_claim_id not in claim_ids:
                errors.append(
                    f"{work_id}: unresolved credit claim_id -> unknown claim "
                    f"{unresolved_claim_id!r}"
                )
                continue
            unresolved_credit_claim_ids.add(unresolved_claim_id)
            claim = claim_by_id[unresolved_claim_id]
            if claim["subject_id"] != work_id:
                errors.append(
                    f"{work_id}: unresolved credit claim must have work as subject"
                )
            if claim["predicate"] != "unresolved_credited_contributor":
                errors.append(
                    f"{work_id}: unresolved credit claim must use "
                    "unresolved_credited_contributor"
                )
            value = claim["object"].get("value")
            if (
                not isinstance(value, dict)
                or value.get("wikidata_qid") != unresolved["source_entity_qid"]
                or value.get("rejection_reason") != unresolved["rejection_reason"]
            ):
                errors.append(
                    f"{work_id}: unresolved credit claim object mismatch"
                )
            if unresolved_claim_id not in work["claim_ids"]:
                errors.append(
                    f"{work_id}: unresolved credit claim must be listed in claim_ids"
                )

    for claim in claims:
        if (
            claim["predicate"] == "credited_contributor"
            and claim["id"] not in credit_claim_ids
        ):
            errors.append(
                f"{claim['id']}: credited_contributor claim has no matching work credit"
            )
        if (
            claim["predicate"] == "unresolved_credited_contributor"
            and claim["id"] not in unresolved_credit_claim_ids
        ):
            errors.append(
                f"{claim['id']}: unresolved credit claim has no matching queue item"
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
        elif (
            claim["predicate"] in DATE_AUTHORITY_PREDICATES
            or claim["predicate"].startswith("field_dates")
        ):
            authority_dimension = "dates"
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
            elif snapshot.get("claim_evidence_allowed", True) is not True:
                errors.append(
                    f"{claim_id}: snapshot {snapshot_id!r} is authority-only "
                    "and cannot support a public claim"
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
                elif snapshot_record[2] != evidence["url"]:
                    errors.append(f"{claim_id}: evidence URL is not revision-pinned")
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

    logical_relation_keys: dict[tuple[str, str, str], str] = {}
    for relation in relations:
        logical_key = logical_relation_key(relation)
        prior_id = logical_relation_keys.get(logical_key)
        if prior_id is not None:
            errors.append(
                f"{relation['id']}: duplicates logical relation {prior_id!r} "
                f"for {logical_key!r}"
            )
        else:
            logical_relation_keys[logical_key] = relation["id"]

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
        if relation["verification_status"] == "verified":
            competing = [
                other["id"]
                for other in claims
                if (
                    other["subject_id"] == relation_id
                    and other["id"] != claim["id"]
                    and (
                        other["verification_status"] in {"contested", "declined"}
                        or any(
                            evidence["support"] == "conflicting"
                            for evidence in other["evidence"]
                        )
                    )
                )
            ]
            if competing:
                errors.append(
                    f"{relation_id}: verified relation has competing claims "
                    f"{sorted(competing)!r}"
                )
        if relation["relation_type"] in LINEAGE_TYPES and relation["verification_status"] == "verified":
            lineage_edges.append((relation["from_id"], relation["to_id"]))
            source_birth = known_year(person_by_id.get(relation["from_id"], {}).get("birth"))
            target_birth = known_year(person_by_id.get(relation["to_id"], {}).get("birth"))
            if source_birth is not None and target_birth is not None and source_birth > target_birth:
                errors.append(f"{relation_id}: mentor/teacher born after student")

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
