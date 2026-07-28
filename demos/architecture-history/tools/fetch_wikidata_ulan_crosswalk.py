#!/usr/bin/env python3
"""Fetch a bounded, revision-pinned Wikidata P245 crosswalk snapshot.

The public catalog remains the authority for which local people and practices
are in scope. Discovery reads only P245, records a normalized receipt for every
catalog QID, and then selects a deterministic 24-row review fixture. The
result is crosswalk evidence only: it cannot create claims or verify identity.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import urllib.parse
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

from fetch_wikidata_pilot import (
    ADAPTER_ID,
    ADAPTER_VERSION,
    ENTITY_DATA_BASE,
    atomic_write_json,
    canonical_bytes,
    canonical_hash,
    fetch_pinned_entity,
    load_json,
    qid_number,
    request_bytes,
)


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
CATALOG_DIR = DATA / "catalog"
SNAPSHOT_DIR = DATA / "source-snapshots"
PEOPLE_PATH = DATA / "people.json"
PRACTICES_PATH = DATA / "practices.json"
WORKS_PATH = DATA / "works.json"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
PROPERTY_ID = "P245"
ULAN_ID_PATTERN = re.compile(r"^500\d{6}$")
SELECTION_LIMIT = 24
SELECTION_SALT = "architecture-history-wikidata-ulan-crosswalk-v1"
REGION_ORDER = (
    "africa",
    "central_west_asia",
    "east_asia",
    "europe",
    "latin_america_caribbean",
    "north_america",
    "oceania",
    "south_asia",
    "southeast_asia",
)
PERIOD_ORDER = (
    "before_1000",
    "1000_1499",
    "1500_1799",
    "1800_1918",
    "1919_1945",
    "1946_1979",
    "1980_1999",
    "2000_present",
)
ALL_PERIODS = set(PERIOD_ORDER) | {"unknown"}
ENTITY_TYPES = {"person", "practice"}


def utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .strftime("%Y-%m-%dT%H:%M:%SZ")
    )


def load_collection(path: Path, key: str) -> list[dict]:
    payload = load_json(path)
    if not isinstance(payload, dict) or set(payload) != {key}:
        raise RuntimeError(f"{path.name}: expected a closed {key!r} collection")
    rows = payload[key]
    if not isinstance(rows, list):
        raise RuntimeError(f"{path.name}: {key!r} must be an array")
    return rows


def ordered_qids(values: Iterable[str]) -> list[str]:
    return sorted(set(values), key=qid_number)


def catalog_inputs() -> tuple[list[dict], str, str]:
    """Return non-overlay catalog receipts, their hash, and work snapshot id."""
    receipts: list[dict] = []
    work_snapshot_ids: set[str] = set()
    paths = sorted(CATALOG_DIR.glob("*.json"), key=lambda path: path.name.encode())
    for path in paths:
        payload = load_json(path)
        if not isinstance(payload, dict):
            raise RuntimeError(f"{path.name}: catalog shard must be an object")
        if payload.get("kind") == "catalog_overlay_v1":
            continue
        receipts.append(
            {
                "path": f"catalog/{path.name}",
                "payload": payload,
            }
        )
        if payload.get("source_id") == "wikidata" and payload.get("works"):
            snapshot_id = payload.get("generated_from")
            if not isinstance(snapshot_id, str) or not snapshot_id:
                raise RuntimeError(
                    f"{path.name}: Wikidata work shard lacks generated_from"
                )
            work_snapshot_ids.add(snapshot_id)
    if not receipts:
        raise RuntimeError("catalog has no non-overlay shards")
    if len(work_snapshot_ids) != 1:
        raise RuntimeError(
            "catalog must resolve to exactly one active Wikidata work snapshot"
        )
    return (
        receipts,
        hashlib.sha256(canonical_bytes(receipts)).hexdigest(),
        next(iter(work_snapshot_ids)),
    )


def normalized_work_witness(work: dict) -> dict:
    external_ids = work.get("external_ids")
    work_qid = external_ids.get("wikidata") if isinstance(external_ids, dict) else None
    qid_number(work_qid)
    work_id = work.get("id")
    region = work.get("region")
    period = work.get("period")
    if not isinstance(work_id, str) or not work_id:
        raise RuntimeError("work lacks a stable local id")
    if region not in REGION_ORDER:
        raise RuntimeError(f"{work_id}: unsupported work region {region!r}")
    if period not in ALL_PERIODS:
        raise RuntimeError(f"{work_id}: unsupported work period {period!r}")
    return {
        "period": period,
        "region": region,
        "work_id": work_id,
        "work_qid": work_qid,
    }


def derive_entity_seed() -> list[dict]:
    people = load_collection(PEOPLE_PATH, "people")
    practices = load_collection(PRACTICES_PATH, "practices")
    works = load_collection(WORKS_PATH, "works")

    entities: dict[str, dict] = {}
    qid_to_entity: dict[str, str] = {}
    for entity_type, rows in (("person", people), ("practice", practices)):
        for row in rows:
            entity_id = row.get("id")
            external_ids = row.get("external_ids")
            qid = (
                external_ids.get("wikidata")
                if isinstance(external_ids, dict)
                else None
            )
            qid_number(qid)
            if (
                not isinstance(entity_id, str)
                or not entity_id
                or row.get("entity_type") != entity_type
            ):
                raise RuntimeError(f"{entity_type} row has an invalid identity")
            if entity_id in entities:
                raise RuntimeError(f"duplicate local entity id {entity_id!r}")
            if qid in qid_to_entity:
                raise RuntimeError(
                    f"{qid}: multiple local entities "
                    f"{qid_to_entity[qid]!r} and {entity_id!r}"
                )
            entities[entity_id] = {
                "entity_id": entity_id,
                "entity_type": entity_type,
                "qid": qid,
            }
            qid_to_entity[qid] = entity_id

    if len(entities) != 553:
        raise RuntimeError(
            f"expected 553 catalog people/practices, observed {len(entities)}"
        )

    witnesses: dict[str, dict[str, dict]] = defaultdict(dict)
    for work in works:
        witness = normalized_work_witness(work)
        credits = work.get("credits")
        if not isinstance(credits, list):
            raise RuntimeError(f"{witness['work_id']}: credits must be an array")
        for credit in credits:
            if not isinstance(credit, dict):
                raise RuntimeError(
                    f"{witness['work_id']}: credit row must be an object"
                )
            entity_id = credit.get("entity_id")
            if entity_id not in entities:
                continue
            if credit.get("entity_type") != entities[entity_id]["entity_type"]:
                raise RuntimeError(
                    f"{witness['work_id']}/{entity_id}: credit type mismatch"
                )
            witnesses[entity_id][witness["work_id"]] = witness

    seed: list[dict] = []
    for qid in ordered_qids(qid_to_entity):
        entity_id = qid_to_entity[qid]
        row = entities[entity_id]
        work_witnesses = sorted(
            witnesses.get(entity_id, {}).values(),
            key=lambda value: (
                REGION_ORDER.index(value["region"]),
                (
                    PERIOD_ORDER.index(value["period"])
                    if value["period"] in PERIOD_ORDER
                    else len(PERIOD_ORDER)
                ),
                value["work_id"].encode("utf-8"),
            ),
        )
        seed.append(
            {
                "entity_id": row["entity_id"],
                "entity_type": row["entity_type"],
                "qid": qid,
                "work_witnesses": work_witnesses,
            }
        )
    return seed


def discovery_url(qid: str) -> str:
    qid_number(qid)
    query = urllib.parse.urlencode(
        {
            "action": "wbgetclaims",
            "entity": qid,
            "format": "json",
            "formatversion": "2",
            "property": PROPERTY_ID,
        }
    )
    return f"{WIKIDATA_API}?{query}"


def normalize_statement(statement: Any, index: int) -> dict:
    if not isinstance(statement, dict):
        raise RuntimeError(f"P245 statement {index} must be an object")
    mainsnak = statement.get("mainsnak")
    if not isinstance(mainsnak, dict):
        mainsnak = {}
    datavalue = mainsnak.get("datavalue")
    if not isinstance(datavalue, dict):
        datavalue = {}
    value = datavalue.get("value")
    return {
        "datatype": mainsnak.get("datatype"),
        "datavalue_type": datavalue.get("type"),
        "native_field_path": f"/claims/P245/{index}",
        "rank": statement.get("rank"),
        "snaktype": mainsnak.get("snaktype"),
        "statement_id": statement.get("id"),
        "statement_index": index,
        "value": value if isinstance(value, str) else None,
    }


def eligibility(normalized_statements: list[dict]) -> tuple[dict | None, list[str]]:
    reasons: list[str] = []
    current = [
        statement
        for statement in normalized_statements
        if statement["rank"] != "deprecated"
    ]
    if len(current) != 1:
        reasons.append("nondeprecated_statement_count_not_one")
        return None, reasons
    statement = current[0]
    if statement["rank"] not in {"normal", "preferred"}:
        reasons.append("unsupported_rank")
    if statement["snaktype"] != "value":
        reasons.append("non_value_snak")
    if statement["datatype"] != "external-id":
        reasons.append("not_external_id")
    if statement["datavalue_type"] != "string":
        reasons.append("not_string_value")
    if not isinstance(statement["statement_id"], str) or not statement[
        "statement_id"
    ]:
        reasons.append("missing_statement_id")
    if (
        not isinstance(statement["value"], str)
        or ULAN_ID_PATTERN.fullmatch(statement["value"]) is None
    ):
        reasons.append("invalid_ulan_id")
    return (statement if not reasons else None), reasons


def discover_p245(qid: str) -> dict:
    url = discovery_url(qid)
    raw, content_type = request_bytes(url)
    payload = json.loads(raw.decode("utf-8"))
    if not isinstance(payload, dict) or payload.get("error"):
        raise RuntimeError(f"{qid}: wbgetclaims returned an error payload")
    claims = payload.get("claims")
    if not isinstance(claims, dict):
        raise RuntimeError(f"{qid}: wbgetclaims response lacks claims")
    statements = claims.get(PROPERTY_ID, [])
    if not isinstance(statements, list):
        raise RuntimeError(f"{qid}: wbgetclaims P245 must be an array")
    normalized = [
        normalize_statement(statement, index)
        for index, statement in enumerate(statements)
    ]
    eligible_statement, rejection_reasons = eligibility(normalized)
    return {
        "content_type": content_type,
        "eligible": eligible_statement is not None,
        "eligible_statement_id": (
            eligible_statement["statement_id"]
            if eligible_statement is not None
            else None
        ),
        "eligible_statement_index": (
            eligible_statement["statement_index"]
            if eligible_statement is not None
            else None
        ),
        "eligible_ulan_id": (
            eligible_statement["value"]
            if eligible_statement is not None
            else None
        ),
        "qid": qid,
        "rejection_reasons": rejection_reasons,
        "request_url": url,
        "response_sha256": hashlib.sha256(raw).hexdigest(),
        "retrieved_at": utc_now(),
        "statements": normalized,
    }


def discover_all(
    seed: list[dict],
    fetcher: Callable[[str], dict] = discover_p245,
) -> list[dict]:
    qids = [row["qid"] for row in seed]
    receipts: dict[str, dict] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        future_to_qid = {
            executor.submit(fetcher, qid): qid
            for qid in qids
        }
        completed = 0
        for future in concurrent.futures.as_completed(future_to_qid):
            qid = future_to_qid[future]
            receipt = future.result()
            if receipt.get("qid") != qid:
                raise RuntimeError(f"{qid}: discovery receipt QID mismatch")
            receipts[qid] = receipt
            completed += 1
            print(
                f"P245 discovery: {completed}/{len(qids)}",
                flush=True,
            )
    if set(receipts) != set(qids):
        raise RuntimeError("P245 discovery did not return every catalog QID")

    by_ulan: dict[str, list[str]] = defaultdict(list)
    for qid in qids:
        receipt = receipts[qid]
        if receipt["eligible"]:
            by_ulan[receipt["eligible_ulan_id"]].append(qid)
    duplicate_ulan_ids = {
        ulan_id
        for ulan_id, matching_qids in by_ulan.items()
        if len(matching_qids) > 1
    }
    for qid in qids:
        receipt = receipts[qid]
        if receipt["eligible_ulan_id"] in duplicate_ulan_ids:
            receipt["eligible"] = False
            receipt["eligible_statement_id"] = None
            receipt["eligible_statement_index"] = None
            receipt["eligible_ulan_id"] = None
            receipt["rejection_reasons"].append("duplicate_ulan_id")
    return [receipts[qid] for qid in ordered_qids(qids)]


def stable_digest(label: str, value: Any) -> str:
    return canonical_hash(
        {
            "label": label,
            "salt": SELECTION_SALT,
            "value": value,
        }
    )


def best_witness(
    row: dict,
    *,
    region: str | None = None,
    period: str | None = None,
) -> dict | None:
    witnesses = [
        witness
        for witness in row["work_witnesses"]
        if (region is None or witness["region"] == region)
        and (period is None or witness["period"] == period)
    ]
    if not witnesses:
        return None
    return min(
        witnesses,
        key=lambda witness: (
            witness["period"] == "unknown",
            stable_digest(
                "work-witness",
                {
                    "entity_id": row["entity_id"],
                    "qid": row["qid"],
                    "witness": witness,
                },
            ),
        ),
    )


def selection_row(
    row: dict,
    receipt: dict,
    witness: dict,
    priority: str,
    order: int,
) -> dict:
    return {
        "entity_id": row["entity_id"],
        "entity_type": row["entity_type"],
        "qid": row["qid"],
        "selection_order": order,
        "selection_priority": priority,
        "statement_id": receipt["eligible_statement_id"],
        "statement_index": receipt["eligible_statement_index"],
        "ulan_id": receipt["eligible_ulan_id"],
        "work_witness": witness,
    }


def stable_selection(
    seed: list[dict],
    discovery: list[dict],
    limit: int = SELECTION_LIMIT,
) -> list[dict]:
    if limit != SELECTION_LIMIT:
        raise RuntimeError(f"selection limit must remain exactly {SELECTION_LIMIT}")
    seed_by_qid = {row["qid"]: row for row in seed}
    discovery_by_qid = {row["qid"]: row for row in discovery}
    if set(seed_by_qid) != set(discovery_by_qid):
        raise RuntimeError("seed and discovery QID sets differ")
    candidates = [
        seed_by_qid[qid]
        for qid in ordered_qids(seed_by_qid)
        if discovery_by_qid[qid]["eligible"]
        and seed_by_qid[qid]["work_witnesses"]
    ]

    selected: list[dict] = []
    selected_qids: set[str] = set()

    def add_best(
        options: list[tuple[dict, dict]],
        priority: str,
    ) -> None:
        options = [
            option
            for option in options
            if option[0]["qid"] not in selected_qids
        ]
        if not options:
            return
        row, witness = min(
            options,
            key=lambda option: stable_digest(
                priority,
                {
                    "entity_id": option[0]["entity_id"],
                    "qid": option[0]["qid"],
                    "ulan_id": discovery_by_qid[option[0]["qid"]][
                        "eligible_ulan_id"
                    ],
                    "witness": option[1],
                },
            ),
        )
        selected_qids.add(row["qid"])
        selected.append(
            selection_row(
                row,
                discovery_by_qid[row["qid"]],
                witness,
                priority,
                len(selected),
            )
        )

    for region in REGION_ORDER:
        add_best(
            [
                (row, witness)
                for row in candidates
                if (witness := best_witness(row, region=region)) is not None
            ],
            f"region:{region}",
        )

    represented_periods = {
        row["work_witness"]["period"]
        for row in selected
        if row["work_witness"]["period"] != "unknown"
    }
    for period in PERIOD_ORDER:
        if period in represented_periods:
            continue
        before = len(selected)
        add_best(
            [
                (row, witness)
                for row in candidates
                if (witness := best_witness(row, period=period)) is not None
            ],
            f"period:{period}",
        )
        if len(selected) > before:
            represented_periods.add(period)

    available_practices = [
        row
        for row in candidates
        if row["entity_type"] == "practice"
    ]
    required_practices = min(2, len(available_practices))
    while (
        sum(row["entity_type"] == "practice" for row in selected)
        < required_practices
    ):
        before = len(selected)
        add_best(
            [
                (row, witness)
                for row in available_practices
                if (witness := best_witness(row)) is not None
            ],
            "entity_type:practice",
        )
        if len(selected) == before:
            raise RuntimeError("unable to satisfy the practice selection floor")

    while len(selected) < limit:
        before = len(selected)
        add_best(
            [
                (row, witness)
                for row in candidates
                if (witness := best_witness(row)) is not None
            ],
            "global_stable_hash",
        )
        if len(selected) == before:
            raise RuntimeError(
                f"fewer than {limit} eligible P245 rows have work witnesses"
            )
    if len(selected) != limit or len(selected_qids) != limit:
        raise RuntimeError("stable selection did not produce 24 unique rows")
    return selected


def pinned_eligible_statement(wrapper: dict) -> dict:
    record = wrapper.get("record")
    if not isinstance(record, dict):
        raise RuntimeError("pinned P245 wrapper lacks a record")
    claims = record.get("claims")
    if not isinstance(claims, dict):
        raise RuntimeError("pinned P245 record lacks claims")
    statements = claims.get(PROPERTY_ID, [])
    if not isinstance(statements, list):
        raise RuntimeError("pinned P245 claims must be an array")
    normalized = [
        normalize_statement(statement, index)
        for index, statement in enumerate(statements)
    ]
    eligible_statement, reasons = eligibility(normalized)
    if eligible_statement is None:
        raise RuntimeError(
            f"pinned P245 record is no longer eligible: {reasons!r}"
        )
    return eligible_statement


def fetch_selected_entities(
    selected: list[dict],
    fetcher: Callable[[str, set[str]], dict] = fetch_pinned_entity,
) -> dict[str, dict]:
    entities: dict[str, dict] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        future_to_row = {
            executor.submit(fetcher, row["qid"], {PROPERTY_ID}): row
            for row in selected
        }
        completed = 0
        for future in concurrent.futures.as_completed(future_to_row):
            row = future_to_row[future]
            wrapper = future.result()
            statement = pinned_eligible_statement(wrapper)
            if (
                wrapper.get("record", {}).get("id") != row["qid"]
                or statement["value"] != row["ulan_id"]
                or statement["statement_id"] != row["statement_id"]
                or statement["statement_index"] != row["statement_index"]
                or statement["native_field_path"]
                != f"/claims/P245/{row['statement_index']}"
            ):
                raise RuntimeError(
                    f"{row['qid']}: pinned P245 differs from discovery receipt"
                )
            entities[row["qid"]] = wrapper
            completed += 1
            print(
                f"P245 pinning: {completed}/{len(selected)}",
                flush=True,
            )
    if set(entities) != {row["qid"] for row in selected}:
        raise RuntimeError("pinned P245 entity set differs from selection")
    return {
        qid: entities[qid]
        for qid in ordered_qids(entities)
    }


def public_crosswalk_records(selected: list[dict]) -> list[dict]:
    """Project the selected evidence into the closed public crosswalk shape."""
    records = [
        {
            "entity_id": row["entity_id"],
            "entity_type": row["entity_type"],
            "wikidata_qid": row["qid"],
            "ulan_subject_id": row["ulan_id"],
        }
        for row in selected
    ]
    records.sort(key=lambda row: int(row["ulan_subject_id"]))
    if len(records) != SELECTION_LIMIT:
        raise RuntimeError("public crosswalk must contain exactly 24 records")
    for field in ("entity_id", "wikidata_qid", "ulan_subject_id"):
        values = [row[field] for row in records]
        if len(set(values)) != SELECTION_LIMIT:
            raise RuntimeError(f"public crosswalk has duplicate {field}")
    return records


def build_snapshot(
    accessed: str,
    *,
    discovery_fetcher: Callable[[str], dict] = discover_p245,
    pinned_fetcher: Callable[[str, set[str]], dict] = fetch_pinned_entity,
) -> dict:
    try:
        parsed_accessed = date.fromisoformat(accessed)
    except ValueError as error:
        raise RuntimeError("--accessed must use YYYY-MM-DD") from error
    if parsed_accessed.isoformat() != accessed:
        raise RuntimeError("--accessed must use YYYY-MM-DD")

    _, base_catalog_sha256, base_work_snapshot_id = catalog_inputs()
    seed = derive_entity_seed()
    discovery = discover_all(seed, discovery_fetcher)
    selected = stable_selection(seed, discovery)
    entities = fetch_selected_entities(selected, pinned_fetcher)
    records = public_crosswalk_records(selected)
    eligible_count = sum(row["eligible"] for row in discovery)

    snapshot_without_id = {
        "accessed": accessed,
        "adapter_id": ADAPTER_ID,
        "adapter_version": ADAPTER_VERSION,
        "base_catalog_sha256": base_catalog_sha256,
        "base_work_snapshot_id": base_work_snapshot_id,
        "claim_evidence_allowed": False,
        "endpoint": WIKIDATA_API,
        "entities": entities,
        "license": "CC0-1.0",
        "records": records,
        "selection": {
            "discovery": discovery,
            "eligible_count": eligible_count,
            "method": "bounded_p245_crosswalk_stable_hash",
            "priorities": [
                "work_regions",
                "known_work_periods",
                "at_least_two_practices_if_available",
                "global_stable_hash",
            ],
            "property_id": PROPERTY_ID,
            "rank_policy": "exactly_one_non_deprecated_external_id",
            "seed": seed,
            "seed_sha256": canonical_hash(seed),
            "selected": selected,
            "selected_order": "priority_then_stable_hash",
            "selection_limit": SELECTION_LIMIT,
        },
        "source_id": "wikidata",
    }
    digest = canonical_hash(snapshot_without_id)
    return {
        **snapshot_without_id,
        "snapshot_id": (
            f"wikidata-ulan-crosswalk-{accessed}-{digest[:12]}"
        ),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--accessed",
        default=date.today().isoformat(),
        help="Snapshot access date (YYYY-MM-DD).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Explicit output file. Default derives an immutable filename.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow replacement of an existing output file.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    snapshot = build_snapshot(args.accessed)
    output = args.output
    if output is None:
        output = SNAPSHOT_DIR / f"{snapshot['snapshot_id']}.json"
    elif not output.is_absolute():
        output = (Path.cwd() / output).resolve()
    if output.exists() and not args.force:
        raise SystemExit(
            f"refusing to replace existing snapshot without --force: {output}"
        )
    atomic_write_json(output, snapshot)
    print(
        f"Wrote {output.relative_to(ROOT) if output.is_relative_to(ROOT) else output}: "
        f"{len(snapshot['selection']['seed'])} catalog entities, "
        f"{snapshot['selection']['eligible_count']} eligible P245 rows, "
        f"{len(snapshot['selection']['selected'])} selected, "
        f"{len(snapshot['entities'])} pinned records",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
