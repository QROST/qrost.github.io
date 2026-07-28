#!/usr/bin/env python3
"""Create a deterministic Getty ULAN candidate catalog overlay.

This importer is deliberately offline.  It accepts three already-pinned inputs:

* a directory of catalog JSON files, from which only *full* catalog shards are
  included (existing overlays are excluded),
* a Wikidata P245 crosswalk snapshot, and
* a Getty ULAN projection snapshot.

The two snapshots must each bind the same canonical base-catalog hash.  Their
closed input contracts are intentionally small so that a pilot cannot silently
turn a live lookup, a broad reconciliation, or a partial catalog into output.

Crosswalk snapshot::

    {
      "source_id": "wikidata", "snapshot_id": "...",
      "base_catalog_sha256": "...", "records": [
        {"entity_id": "person-wd-q1", "entity_type": "person",
         "wikidata_qid": "Q1", "ulan_subject_id": "500000001"}
      ],
      "selection": {"property_id": "P245", "selected": [...]}
    }

Getty snapshot::

    {
      "source_id": "getty-ulan", "snapshot_id": "...",
      "base_catalog_sha256": "...", "accessed": "YYYY-MM-DD",
      "records": {
        "500000001": {"projection": {...}, "projection_sha256": "..."}
      }
    }

The output is a ``catalog_overlay_v1`` document.  It is not a complete catalog
shard and intentionally contains no entities or relations.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "assets" / "data" / "catalog" / "getty-ulan-identity.json"
ROW_COUNT = 24
OVERLAY_KIND = "catalog_overlay_v1"
ULAN_NAMESPACE = "ulan"
IDENTITY_SCOPE = "getty_ulan_exact_p245_crosswalk"
TRANSFORMER_ID = "getty-ulan-p245-overlay"
TRANSFORMER_VERSION = "0.1.0"
QID_RE = re.compile(r"^Q[1-9][0-9]*$")
ULAN_RE = re.compile(r"^500[0-9]{6}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

FULL_SHARD_KEYS = {
    "source_id",
    "generated_from",
    "generator",
    "transformer_id",
    "transformer_version",
    "people",
    "practices",
    "places",
    "works",
    "claims",
    "relations",
}
ENTITY_COLLECTIONS = ("people", "practices", "places", "works")
COLLECTION_ENTITY_TYPES = {
    "people": "person",
    "practices": "practice",
    "places": "place",
    "works": "work",
}


def reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key!r}")
        result[key] = value
    return result


def load_json(path: Path) -> Any:
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle, object_pairs_hook=reject_duplicate_keys)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise ValueError(f"{path}: invalid JSON input: {error}") from error


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def canonical_hash(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def require_string(value: Any, label: str, pattern: re.Pattern[str] | None = None) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{label}: expected non-empty string")
    if pattern is not None and pattern.fullmatch(value) is None:
        raise ValueError(f"{label}: invalid value {value!r}")
    return value


def require_exact_keys(value: Any, keys: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != keys:
        observed = sorted(value) if isinstance(value, dict) else type(value).__name__
        raise ValueError(f"{label}: expected exact keys {sorted(keys)!r}, got {observed!r}")
    return value


def qid_number(qid: str) -> int:
    require_string(qid, "Wikidata QID", QID_RE)
    return int(qid[1:])


def validate_full_shard(payload: Any, label: str) -> dict[str, Any]:
    shard = require_exact_keys(payload, FULL_SHARD_KEYS, label)
    for key in ("source_id", "generated_from", "generator", "transformer_id", "transformer_version"):
        require_string(shard[key], f"{label}.{key}")
    for key in (*ENTITY_COLLECTIONS, "claims", "relations"):
        if not isinstance(shard[key], list):
            raise ValueError(f"{label}.{key}: expected array")
        for index, row in enumerate(shard[key]):
            if not isinstance(row, dict):
                raise ValueError(f"{label}.{key}[{index}]: expected object")
            require_string(row.get("id"), f"{label}.{key}[{index}].id")
    return shard


def load_full_catalog(catalog_dir: Path) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], str]:
    if not catalog_dir.is_dir():
        raise ValueError(f"catalog directory does not exist: {catalog_dir}")
    paths = sorted(catalog_dir.glob("*.json"), key=lambda path: path.name.encode("utf-8"))
    if not paths:
        raise ValueError(f"catalog directory contains no JSON shards: {catalog_dir}")
    canonical_shards: list[dict[str, Any]] = []
    entities: dict[str, dict[str, Any]] = {}
    seen_claim_ids: set[str] = set()
    for path in paths:
        payload = load_json(path)
        if isinstance(payload, dict) and payload.get("kind") == OVERLAY_KIND:
            # Overlays are deliberately outside the immutable full-catalog base.
            # They must not affect the base hash to which their own provenance binds.
            continue
        shard = validate_full_shard(payload, f"catalog/{path.name}")
        canonical_shards.append({"path": f"catalog/{path.name}", "payload": shard})
        for collection in ENTITY_COLLECTIONS:
            for entity in shard[collection]:
                entity_id = entity["id"]
                if entity_id in entities:
                    raise ValueError(f"duplicate base entity id: {entity_id}")
                entity_type = entity.get("entity_type")
                if entity_type not in {"person", "practice", "place", "work"}:
                    raise ValueError(f"{entity_id}: invalid or absent entity_type")
                if entity_type != COLLECTION_ENTITY_TYPES[collection]:
                    raise ValueError(f"{entity_id}: entity_type does not match {collection}")
                external_ids = entity.get("external_ids")
                if not isinstance(external_ids, dict):
                    raise ValueError(f"{entity_id}: external_ids must be an object")
                entities[entity_id] = entity
        for claim in shard["claims"]:
            claim_id = claim["id"]
            if claim_id in seen_claim_ids:
                raise ValueError(f"duplicate base claim id: {claim_id}")
            seen_claim_ids.add(claim_id)
    return canonical_shards, entities, canonical_hash(canonical_shards)


def validate_crosswalk(payload: Any, base_hash: str) -> tuple[str, list[dict[str, Any]]]:
    snapshot = require_exact_keys(
        payload,
        {
            "accessed",
            "adapter_id",
            "adapter_version",
            "base_catalog_sha256",
            "base_work_snapshot_id",
            "claim_evidence_allowed",
            "endpoint",
            "entities",
            "license",
            "records",
            "selection",
            "snapshot_id",
            "source_id",
        },
        "Wikidata crosswalk snapshot",
    )
    if (
        snapshot["source_id"] != "wikidata"
        or snapshot["adapter_id"] != "wikidata-hydration-pilot"
        or snapshot["adapter_version"] != "0.1.0"
        or snapshot["license"] != "CC0-1.0"
        or snapshot["claim_evidence_allowed"] is not False
    ):
        raise ValueError("Wikidata crosswalk snapshot has an incompatible authority contract")
    snapshot_id = require_string(snapshot["snapshot_id"], "Wikidata crosswalk snapshot.snapshot_id")
    if snapshot["base_catalog_sha256"] != base_hash:
        raise ValueError("Wikidata crosswalk snapshot does not bind this base catalog")
    if not isinstance(snapshot["entities"], dict) or not isinstance(snapshot["endpoint"], str):
        raise ValueError("Wikidata crosswalk snapshot must retain its adapter receipts")
    rows = snapshot["records"]
    if not isinstance(rows, list) or len(rows) != ROW_COUNT:
        raise ValueError(f"Wikidata crosswalk snapshot must contain exactly {ROW_COUNT} rows")
    selection = require_exact_keys(
        snapshot["selection"],
        {
            "discovery",
            "eligible_count",
            "method",
            "priorities",
            "property_id",
            "rank_policy",
            "seed",
            "seed_sha256",
            "selected",
            "selected_order",
            "selection_limit",
        },
        "Wikidata crosswalk selection",
    )
    if (
        selection["method"] != "bounded_p245_crosswalk_stable_hash"
        or selection["property_id"] != "P245"
        or selection["rank_policy"] != "exactly_one_non_deprecated_external_id"
        or selection["selected_order"] != "priority_then_stable_hash"
        or selection["selection_limit"] != ROW_COUNT
    ):
        raise ValueError("Wikidata crosswalk selection contract is incompatible")
    selected = selection["selected"]
    discovery = selection["discovery"]
    if not isinstance(selected, list) or len(selected) != ROW_COUNT:
        raise ValueError(f"Wikidata crosswalk selection must contain exactly {ROW_COUNT} rows")
    if not isinstance(discovery, list) or not discovery:
        raise ValueError("Wikidata crosswalk must retain P245 discovery receipts")
    expected_keys = {"entity_id", "entity_type", "wikidata_qid", "ulan_subject_id"}
    selected_keys = {
        "entity_id",
        "entity_type",
        "qid",
        "selection_order",
        "selection_priority",
        "statement_id",
        "statement_index",
        "ulan_id",
        "work_witness",
    }
    discovery_keys = {
        "content_type",
        "eligible",
        "eligible_statement_id",
        "eligible_statement_index",
        "eligible_ulan_id",
        "qid",
        "rejection_reasons",
        "request_url",
        "response_sha256",
        "retrieved_at",
        "statements",
    }
    statement_keys = {
        "datatype",
        "datavalue_type",
        "native_field_path",
        "rank",
        "snaktype",
        "statement_id",
        "statement_index",
        "value",
    }
    seen_entities: set[str] = set()
    seen_qids: set[str] = set()
    seen_ulans: set[str] = set()
    normalized: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        row = require_exact_keys(row, expected_keys, f"crosswalk.rows[{index}]")
        entity_id = require_string(row["entity_id"], f"crosswalk.rows[{index}].entity_id")
        entity_type = row["entity_type"]
        if entity_type not in {"person", "practice"}:
            raise ValueError(f"{entity_id}: crosswalk entity_type must be person or practice")
        qid = require_string(row["wikidata_qid"], f"{entity_id}.wikidata_qid", QID_RE)
        ulan_id = require_string(row["ulan_subject_id"], f"{entity_id}.ulan_subject_id", ULAN_RE)
        if entity_id in seen_entities or qid in seen_qids or ulan_id in seen_ulans:
            raise ValueError(f"{entity_id}: crosswalk must be one-to-one by entity, QID, and ULAN")
        seen_entities.add(entity_id)
        seen_qids.add(qid)
        seen_ulans.add(ulan_id)
        normalized.append({**row, "ulan_id": ulan_id})
    ordered = sorted(normalized, key=lambda row: int(row["ulan_subject_id"]))
    if [row["ulan_subject_id"] for row in rows] != [row["ulan_subject_id"] for row in ordered]:
        raise ValueError("Wikidata crosswalk records must use canonical numeric ULAN order")

    selected_by_entity: dict[str, dict[str, Any]] = {}
    for index, selected_row in enumerate(selected):
        selected_row = require_exact_keys(selected_row, selected_keys, f"crosswalk.selection.selected[{index}]")
        entity_id = require_string(selected_row["entity_id"], f"selected[{index}].entity_id")
        qid = require_string(selected_row["qid"], f"{entity_id}.qid", QID_RE)
        ulan_id = require_string(selected_row["ulan_id"], f"{entity_id}.ulan_id", ULAN_RE)
        if (
            selected_row["entity_type"] not in {"person", "practice"}
            or not isinstance(selected_row["selection_order"], int)
            or selected_row["selection_order"] != index
            or not isinstance(selected_row["selection_priority"], str)
            or not selected_row["selection_priority"]
            or not isinstance(selected_row["statement_index"], int)
            or selected_row["statement_index"] < 0
            or not isinstance(selected_row["work_witness"], dict)
            or entity_id in selected_by_entity
        ):
            raise ValueError(f"{entity_id}: selected P245 row is invalid")
        require_string(selected_row["statement_id"], f"{entity_id}.statement_id")
        selected_by_entity[entity_id] = selected_row
    if set(selected_by_entity) != seen_entities:
        raise ValueError("Wikidata crosswalk records and selected P245 rows must have the same entities")

    discovery_by_qid: dict[str, dict[str, Any]] = {}
    for index, discovery_row in enumerate(discovery):
        discovery_row = require_exact_keys(discovery_row, discovery_keys, f"crosswalk.selection.discovery[{index}]")
        qid = require_string(discovery_row["qid"], f"discovery[{index}].qid", QID_RE)
        if qid in discovery_by_qid or not isinstance(discovery_row["statements"], list):
            raise ValueError(f"{qid}: duplicate or malformed P245 discovery receipt")
        discovery_by_qid[qid] = discovery_row

    for row in normalized:
        selected_row = selected_by_entity[row["entity_id"]]
        if (
            selected_row["entity_type"] != row["entity_type"]
            or selected_row["qid"] != row["wikidata_qid"]
            or selected_row["ulan_id"] != row["ulan_subject_id"]
        ):
            raise ValueError(f"{row['entity_id']}: record and selected P245 binding disagree")
        receipt = discovery_by_qid.get(row["wikidata_qid"])
        if receipt is None:
            raise ValueError(f"{row['entity_id']}: selected QID lacks a P245 discovery receipt")
        statement_index = selected_row["statement_index"]
        statements = receipt["statements"]
        if (
            receipt["eligible"] is not True
            or receipt["eligible_statement_id"] != selected_row["statement_id"]
            or receipt["eligible_statement_index"] != statement_index
            or receipt["eligible_ulan_id"] != row["ulan_subject_id"]
            or statement_index >= len(statements)
        ):
            raise ValueError(f"{row['entity_id']}: selected P245 receipt is not eligible")
        statement = require_exact_keys(statements[statement_index], statement_keys, f"{row['entity_id']}.P245")
        if (
            statement["datatype"] != "external-id"
            or statement["datavalue_type"] != "string"
            or statement["snaktype"] != "value"
            or statement["rank"] not in {"normal", "preferred"}
            or statement["statement_id"] != selected_row["statement_id"]
            or statement["statement_index"] != statement_index
            or statement["value"] != row["ulan_subject_id"]
            or statement["native_field_path"] != f"/claims/P245/{statement_index}"
        ):
            raise ValueError(f"{row['entity_id']}: selected P245 statement binding is invalid")
        row["p245"] = {
            "property_id": "P245",
            "value": statement["value"],
            "rank": statement["rank"],
            "statement_id": statement["statement_id"],
            "statement_index": statement_index,
            "native_field_path": statement["native_field_path"],
        }
    return snapshot_id, ordered


def validate_getty_snapshot(
    payload: Any,
    base_hash: str,
    crosswalk_snapshot_id: str,
    crosswalk_rows: list[dict[str, Any]],
) -> tuple[str, str, list[dict[str, Any]]]:
    snapshot = require_exact_keys(
        payload,
        {
            "accessed",
            "adapter_id",
            "adapter_version",
            "attribution",
            "base_catalog_sha256",
            "claim_evidence_allowed",
            "crosswalk_snapshot_id",
            "license",
            "license_url",
            "projection_sha256",
            "raw_retained",
            "records",
            "selection",
            "snapshot_id",
            "source_id",
        },
        "Getty ULAN snapshot",
    )
    if (
        snapshot["source_id"] != "getty-ulan"
        or snapshot["adapter_id"] != "getty-ulan-identity-pilot"
        or snapshot["adapter_version"] != "0.1.0"
        or snapshot["claim_evidence_allowed"] is not True
        or snapshot["license"] != "ODC-By-1.0"
        or snapshot["license_url"] != "https://opendatacommons.org/licenses/by/1-0/"
        or snapshot["raw_retained"] is not False
    ):
        raise ValueError("Getty ULAN snapshot has an incompatible identity contract")
    snapshot_id = require_string(snapshot["snapshot_id"], "Getty ULAN snapshot.snapshot_id")
    if snapshot["base_catalog_sha256"] != base_hash:
        raise ValueError("Getty ULAN snapshot does not bind this base catalog")
    accessed = require_string(snapshot["accessed"], "Getty ULAN snapshot.accessed", DATE_RE)
    records = snapshot["records"]
    selection = require_exact_keys(
        snapshot["selection"],
        {
            "method",
            "seed_sha256",
            "seed_count",
            "record_count",
            "accepted_subject_ids",
            "rejections",
        },
        "Getty ULAN selection",
    )
    if (
        selection["method"] != "wikidata_p245_exact_getty_identity"
        or selection["seed_count"] != ROW_COUNT
        or not isinstance(selection["record_count"], int)
        or not 1 <= selection["record_count"] <= ROW_COUNT
        or not isinstance(records, dict)
        or len(records) != selection["record_count"]
    ):
        raise ValueError("Getty ULAN selection contract is incompatible")
    if snapshot["crosswalk_snapshot_id"] != crosswalk_snapshot_id:
        raise ValueError("Getty ULAN snapshot crosswalk dependency does not match the supplied crosswalk")
    if not isinstance(snapshot["crosswalk_snapshot_id"], str) or not snapshot["crosswalk_snapshot_id"]:
        raise ValueError("Getty ULAN snapshot must declare its crosswalk dependency")
    crosswalk_receipt = [
        {
            "entity_id": row["entity_id"],
            "entity_type": row["entity_type"],
            "ulan_subject_id": row["ulan_subject_id"],
            "wikidata_qid": row["wikidata_qid"],
        }
        for row in crosswalk_rows
    ]
    if selection["seed_sha256"] != canonical_hash(crosswalk_receipt):
        raise ValueError("Getty ULAN selection seed does not bind the supplied crosswalk records")
    preimage = {key: value for key, value in snapshot.items() if key not in {"projection_sha256", "snapshot_id"}}
    projection_hash = canonical_hash(preimage)
    if snapshot["projection_sha256"] != projection_hash or snapshot_id != f"getty-ulan-identity-{accessed}-{projection_hash[:12]}":
        raise ValueError("Getty ULAN snapshot has an invalid deterministic identity")
    wrapper_keys = {"projection", "projection_sha256"}
    projection_keys = {
        "canonical_uri", "content_type", "contributor_uris", "entity_id", "entity_type",
        "equivalent_qids", "native_record_id", "raw_response_sha256", "raw_retained",
        "representation_url", "retrieved_at", "source_uris", "subject_id", "type", "wikidata_qid",
    }
    rejection_keys = {
        "canonical_uri", "content_type", "entity_id", "entity_type", "expected_wikidata_qid",
        "native_record_id", "observed_equivalent_qids", "raw_response_sha256", "reason",
        "representation_url", "retrieved_at", "subject_id", "type",
    }
    expected_by_ulan = {row["ulan_subject_id"]: row for row in crosswalk_rows}
    accepted_subject_ids = selection["accepted_subject_ids"]
    rejections = selection["rejections"]
    if (
        not isinstance(accepted_subject_ids, list)
        or not isinstance(rejections, list)
        or len(accepted_subject_ids) != selection["record_count"]
        or len(rejections) != ROW_COUNT - selection["record_count"]
    ):
        raise ValueError("Getty ULAN selection acceptance/rejection counts are invalid")
    accepted_subject_ids = [
        require_string(subject_id, "Getty accepted subject ID", ULAN_RE)
        for subject_id in accepted_subject_ids
    ]
    if (
        len(set(accepted_subject_ids)) != len(accepted_subject_ids)
        or accepted_subject_ids != sorted(accepted_subject_ids, key=int)
        or set(accepted_subject_ids) != set(records)
        or not set(accepted_subject_ids) <= set(expected_by_ulan)
    ):
        raise ValueError("Getty ULAN accepted subjects must exactly and numerically match record keys")
    normalized: list[dict[str, Any]] = []
    for ulan_id, wrapper in records.items():
        ulan_id = require_string(ulan_id, "Getty ULAN record key", ULAN_RE)
        expected = expected_by_ulan.get(ulan_id)
        if expected is None:
            raise ValueError(f"Getty ULAN {ulan_id}: subject is outside the crosswalk")
        wrapper = require_exact_keys(wrapper, wrapper_keys, f"Getty records[{ulan_id}]")
        projection = require_exact_keys(wrapper["projection"], projection_keys, f"Getty records[{ulan_id}].projection")
        if not projection:
            raise ValueError(f"Getty ULAN {ulan_id}: projection must be a non-empty object")
        if wrapper["projection_sha256"] != canonical_hash(projection):
            raise ValueError(f"Getty ULAN {ulan_id}: projection_sha256 mismatch")
        if (
            projection["canonical_uri"] != f"http://vocab.getty.edu/ulan/{ulan_id}"
            or projection["content_type"] not in {"application/json", "application/ld+json"}
            or projection["native_record_id"] != f"ulan:{ulan_id}"
            or projection["representation_url"] != f"https://vocab.getty.edu/ulan/{ulan_id}"
            or projection["subject_id"] != ulan_id
            or not isinstance(projection["raw_response_sha256"], str)
            or SHA256_RE.fullmatch(projection["raw_response_sha256"]) is None
            or not isinstance(projection["retrieved_at"], str)
            or DATETIME_RE.fullmatch(projection["retrieved_at"]) is None
            or projection["raw_retained"] is not False
            or projection["entity_id"] != expected["entity_id"]
            or projection["entity_type"] != expected["entity_type"]
            or projection["wikidata_qid"] != expected["wikidata_qid"]
            or projection["type"] != ("Person" if expected["entity_type"] == "person" else "Group")
            or not isinstance(projection["equivalent_qids"], list)
            or projection["equivalent_qids"] != [expected["wikidata_qid"]]
        ):
            raise ValueError(f"Getty ULAN {ulan_id}: projection identity binding is invalid")
        normalized.append({"ulan_id": ulan_id, **wrapper})
    ordered_keys = sorted(records, key=lambda value: int(value))
    if list(records) != ordered_keys:
        raise ValueError("Getty ULAN records must use numeric ULAN order")
    rejected_subject_ids: list[str] = []
    for index, rejection in enumerate(rejections):
        rejection = require_exact_keys(rejection, rejection_keys, f"Getty rejection[{index}]")
        ulan_id = require_string(rejection["subject_id"], f"Getty rejection[{index}].subject_id", ULAN_RE)
        expected = expected_by_ulan.get(ulan_id)
        observed = rejection["observed_equivalent_qids"]
        if (
            expected is None
            or not isinstance(observed, list)
            or not all(isinstance(qid, str) and QID_RE.fullmatch(qid) for qid in observed)
            or observed != sorted(set(observed), key=qid_number)
            or rejection["canonical_uri"] != f"http://vocab.getty.edu/ulan/{ulan_id}"
            or rejection["content_type"] not in {"application/json", "application/ld+json"}
            or rejection["native_record_id"] != f"ulan:{ulan_id}"
            or rejection["representation_url"] != f"https://vocab.getty.edu/ulan/{ulan_id}"
            or not isinstance(rejection["raw_response_sha256"], str)
            or SHA256_RE.fullmatch(rejection["raw_response_sha256"]) is None
            or not isinstance(rejection["retrieved_at"], str)
            or DATETIME_RE.fullmatch(rejection["retrieved_at"]) is None
            or rejection["entity_id"] != expected["entity_id"]
            or rejection["entity_type"] != expected["entity_type"]
            or rejection["expected_wikidata_qid"] != expected["wikidata_qid"]
            or rejection["type"] != ("Person" if expected["entity_type"] == "person" else "Group")
            or rejection["reason"] not in {
                "missing_wikidata_equivalent",
                "conflicting_wikidata_equivalent",
            }
        ):
            raise ValueError(f"Getty ULAN {ulan_id}: rejection receipt is invalid")
        if rejection["reason"] == "missing_wikidata_equivalent" and observed:
            raise ValueError(f"Getty ULAN {ulan_id}: missing-equivalent rejection has observed QIDs")
        if (
            rejection["reason"] == "conflicting_wikidata_equivalent"
            and (not observed or observed == [expected["wikidata_qid"]])
        ):
            raise ValueError(f"Getty ULAN {ulan_id}: conflicting-equivalent rejection lacks a conflict")
        rejected_subject_ids.append(ulan_id)
    if (
        rejected_subject_ids != sorted(rejected_subject_ids, key=int)
        or len(set(rejected_subject_ids)) != len(rejected_subject_ids)
        or set(accepted_subject_ids) & set(rejected_subject_ids)
        or set(accepted_subject_ids) | set(rejected_subject_ids) != set(expected_by_ulan)
    ):
        raise ValueError("Getty ULAN accepted and rejected subjects must exactly partition the crosswalk")
    return snapshot_id, accessed, normalized


def evidence_row(getty_snapshot_id: str, accessed: str, record: dict[str, Any]) -> dict[str, Any]:
    ulan_id = record["ulan_id"]
    projection = record["projection"]
    return {
        "source_id": "getty-ulan",
        "snapshot_id": getty_snapshot_id,
        "native_record_id": projection["native_record_id"],
        "native_field_path": "/projection",
        "native_predicate": "ulan",
        "url": projection["canonical_uri"],
        "locator": projection["native_record_id"],
        "accessed": accessed,
        "support": "explicit",
        "extraction_method": "structured_mapping",
        "language": None,
        "rank": None,
        "qualifiers": [],
        "references": projection["source_uris"],
        "contributors": projection["contributor_uris"],
        "source_record_sha256": record["projection_sha256"],
    }


def build_overlay(
    catalog_dir: Path,
    crosswalk_path: Path,
    getty_path: Path,
) -> dict[str, Any]:
    _shards, entities, base_hash = load_full_catalog(catalog_dir)
    crosswalk_snapshot_id, crosswalk_rows = validate_crosswalk(load_json(crosswalk_path), base_hash)
    getty_snapshot_id, accessed, getty_records = validate_getty_snapshot(
        load_json(getty_path),
        base_hash,
        crosswalk_snapshot_id,
        crosswalk_rows,
    )
    getty_by_ulan = {record["ulan_id"]: record for record in getty_records}
    if not set(getty_by_ulan) <= {row["ulan_id"] for row in crosswalk_rows}:
        raise ValueError("Getty accepted subjects must be within the 24-row Wikidata crosswalk")
    existing_ulans = {
        value
        for entity in entities.values()
        for namespace, value in entity.get("external_ids", {}).items()
        if namespace == ULAN_NAMESPACE
    }

    patches: list[dict[str, Any]] = []
    claims: list[dict[str, Any]] = []
    for row in crosswalk_rows:
        if row["ulan_id"] not in getty_by_ulan:
            continue
        entity_id = row["entity_id"]
        entity = entities.get(entity_id)
        if entity is None:
            raise ValueError(f"{entity_id}: crosswalk target is absent from base catalog")
        if entity.get("entity_type") != row["entity_type"]:
            raise ValueError(f"{entity_id}: crosswalk entity_type conflicts with base catalog")
        external_ids = entity.get("external_ids")
        if not isinstance(external_ids, dict) or external_ids.get("wikidata") != row["wikidata_qid"]:
            raise ValueError(f"{entity_id}: base catalog Wikidata external ID conflicts with crosswalk")
        if ULAN_NAMESPACE in external_ids:
            raise ValueError(f"{entity_id}: base catalog already has a ULAN external ID")
        if row["ulan_id"] in existing_ulans:
            raise ValueError(f"{entity_id}: ULAN ID already belongs to a base catalog entity")
        final_external_ids = dict(external_ids)
        final_external_ids[ULAN_NAMESPACE] = row["ulan_id"]
        claim_id = f"claim-{entity_id}-{ULAN_NAMESPACE}-{row['ulan_id']}"
        record = getty_by_ulan[row["ulan_id"]]
        projection = record["projection"]
        if (
            projection["entity_id"] != entity_id
            or projection["entity_type"] != row["entity_type"]
            or projection["wikidata_qid"] != row["wikidata_qid"]
            or projection["equivalent_qids"].count(row["wikidata_qid"]) != 1
        ):
            raise ValueError(f"{entity_id}: Getty projection conflicts with the crosswalk identity")
        claims.append(
            {
                "id": claim_id,
                "subject_id": entity_id,
                "predicate": "field_external_ids",
                "object": {"value": final_external_ids},
                "qualifiers": {
                    "namespace": ULAN_NAMESPACE,
                    "identity_scope": IDENTITY_SCOPE,
                    "crosswalk_snapshot_id": crosswalk_snapshot_id,
                    "wikidata_qid": row["wikidata_qid"],
                    "p245": row["p245"],
                },
                "evidence": [evidence_row(getty_snapshot_id, accessed, record)],
                "verification_status": "candidate",
                "confidence": 0.5,
                "reviewed_by": None,
                "reviewed_at": None,
            }
        )
        patches.append(
            {
                "entity_id": entity_id,
                "entity_type": row["entity_type"],
                "assert_external_ids": {"wikidata": row["wikidata_qid"]},
                "add_external_ids": {ULAN_NAMESPACE: row["ulan_id"]},
                "add_claim_ids": [claim_id],
            }
        )
    # Preserve the canonical numeric ULAN order from both source snapshots.
    patches.sort(key=lambda patch: int(patch["add_external_ids"][ULAN_NAMESPACE]))
    claims.sort(key=lambda claim: int(claim["object"]["value"][ULAN_NAMESPACE]))
    overlay_identity = {
        "base_catalog_sha256": base_hash,
        "crosswalk_snapshot_id": crosswalk_snapshot_id,
        "generated_from": getty_snapshot_id,
    }
    overlay_id = f"getty-ulan-identity-{canonical_hash(overlay_identity)[:16]}"
    return {
        "kind": OVERLAY_KIND,
        "overlay_id": overlay_id,
        "source_id": "getty-ulan",
        "generated_from": getty_snapshot_id,
        "crosswalk_snapshot_id": crosswalk_snapshot_id,
        "generator": f"{TRANSFORMER_ID}@{TRANSFORMER_VERSION}",
        "transformer_id": TRANSFORMER_ID,
        "transformer_version": TRANSFORMER_VERSION,
        "base_catalog_sha256": base_hash,
        "entity_patches": patches,
        "claims": claims,
    }


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    handle = tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", delete=False)
    temporary = Path(handle.name)
    try:
        with handle:
            handle.write(content.encode("utf-8"))
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("catalog_dir", type=Path, help="directory containing catalog JSON files (overlays excluded)")
    parser.add_argument("wikidata_crosswalk", type=Path, help="closed 24-row Wikidata P245 crosswalk snapshot")
    parser.add_argument("getty_snapshot", type=Path, help="closed Getty ULAN screening snapshot for the 24-row crosswalk")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="immutable overlay output path")
    parser.add_argument("--force", action="store_true", help="allow replacement of the explicit output path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = args.output.resolve()
    if output.exists() and not args.force:
        raise SystemExit(f"refusing to replace existing overlay without --force: {output}")
    overlay = build_overlay(args.catalog_dir.resolve(), args.wikidata_crosswalk.resolve(), args.getty_snapshot.resolve())
    atomic_write_json(output, overlay)
    print(f"Wrote {output}: {len(overlay['entity_patches'])} entity patches, {len(overlay['claims'])} candidate claims")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
