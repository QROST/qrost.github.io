#!/usr/bin/env python3
"""Fetch a bounded, revision-pinned Wikidata work-type authority sidecar."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import re
from datetime import date
from pathlib import Path
from typing import Any, Callable

from fetch_wikidata_pilot import (
    ADAPTER_ID,
    ADAPTER_VERSION,
    ENTITY_DATA_BASE,
    atomic_write_json,
    canonical_hash,
    fetch_pinned_entity,
    load_json,
    ordered_qids,
    qid_number,
)


ROOT = Path(__file__).resolve().parent.parent
SEEDS_PATH = ROOT / "tools" / "wikidata-work-type-authority-seeds.json"
SNAPSHOT_DIR = ROOT / "assets" / "data" / "source-snapshots"
WORK_TYPES = {
    "building",
    "building_complex",
    "infrastructure",
    "landscape",
    "monument",
}
SEED_VERSION_PATTERN = re.compile(r"^\d+\.\d+\.\d+$")
AUTHORITY_PROPERTIES = {"P279"}


def validate_inputs(payload: Any) -> dict:
    if not isinstance(payload, dict) or set(payload) != {
        "authorities",
        "base_work_snapshot_id",
        "seed_version",
    }:
        raise RuntimeError("type-authority seed file has an invalid root shape")
    if not isinstance(payload["seed_version"], str) or not SEED_VERSION_PATTERN.fullmatch(
        payload["seed_version"]
    ):
        raise RuntimeError("type-authority seed_version must be semantic")
    base_snapshot_id = payload["base_work_snapshot_id"]
    if not isinstance(base_snapshot_id, str) or not base_snapshot_id.startswith(
        "wikidata-hydration-"
    ):
        raise RuntimeError("type-authority base_work_snapshot_id is invalid")
    authorities = payload["authorities"]
    if not isinstance(authorities, list) or not authorities:
        raise RuntimeError("type-authority seeds must be a non-empty array")
    qids: list[str] = []
    normalized_authorities: list[dict] = []
    for row in authorities:
        if not isinstance(row, dict) or set(row) != {
            "label_hint_en",
            "qid",
            "risk_tags",
            "work_type",
        }:
            raise RuntimeError("type-authority seed has an invalid shape")
        qid_number(row["qid"])
        qids.append(row["qid"])
        if not isinstance(row["label_hint_en"], str) or not row[
            "label_hint_en"
        ].strip():
            raise RuntimeError(f"{row['qid']}: label_hint_en is required")
        if row["work_type"] not in WORK_TYPES:
            raise RuntimeError(f"{row['qid']}: unsupported work_type")
        risk_tags = row["risk_tags"]
        if (
            not isinstance(risk_tags, list)
            or not risk_tags
            or len(risk_tags) != len(set(risk_tags))
            or not all(
                isinstance(tag, str)
                and re.fullmatch(r"[a-z][a-z0-9_]*", tag)
                for tag in risk_tags
            )
        ):
            raise RuntimeError(f"{row['qid']}: risk_tags are invalid")
        normalized_authorities.append(
            {
                "label_hint_en": row["label_hint_en"],
                "qid": row["qid"],
                "risk_tags": sorted(risk_tags),
                "work_type": row["work_type"],
            }
        )
    if len(qids) != len(set(qids)):
        raise RuntimeError("type-authority QIDs must be unique")
    normalized = {
        "authorities": sorted(
            normalized_authorities,
            key=lambda row: qid_number(row["qid"]),
        ),
        "base_work_snapshot_id": base_snapshot_id,
        "seed_version": payload["seed_version"],
    }
    if payload != normalized:
        raise RuntimeError(
            "type-authority seed payload must use numeric QID order and "
            "sorted risk tags"
        )
    return normalized


def hydrate_authority_snapshot(
    payload: dict,
    accessed: str,
    *,
    fetcher: Callable[[str, set[str]], dict] = fetch_pinned_entity,
) -> dict:
    seed_contract = validate_inputs(payload)
    authorities = seed_contract["authorities"]
    base_snapshot_path = (
        SNAPSHOT_DIR / f"{seed_contract['base_work_snapshot_id']}.json"
    )
    if not base_snapshot_path.is_file():
        raise RuntimeError(
            "type-authority base work snapshot is not committed: "
            f"{seed_contract['base_work_snapshot_id']}"
        )
    base_snapshot = load_json(base_snapshot_path)
    if (
        base_snapshot.get("snapshot_id")
        != seed_contract["base_work_snapshot_id"]
        or base_snapshot.get("selection", {}).get("method")
        != "pinned_hydration_fixtures"
    ):
        raise RuntimeError("type-authority base work snapshot is incompatible")

    authority_by_qid = {row["qid"]: row for row in authorities}
    qids = ordered_qids(authority_by_qid)
    entities: dict[str, dict] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        future_to_qid = {
            executor.submit(fetcher, qid, AUTHORITY_PROPERTIES): qid
            for qid in qids
        }
        completed = 0
        for future in concurrent.futures.as_completed(future_to_qid):
            qid = future_to_qid[future]
            wrapper = future.result()
            english_label = (
                wrapper.get("record", {})
                .get("labels", {})
                .get("en", {})
                .get("value")
            )
            expected_label = authority_by_qid[qid]["label_hint_en"]
            if english_label != expected_label:
                raise RuntimeError(
                    f"{qid}: English label drifted from {expected_label!r} "
                    f"to {english_label!r}"
                )
            entities[qid] = wrapper
            completed += 1
            print(
                f"type authorities: pinned {qid} ({completed}/{len(qids)})",
                flush=True,
            )

    seed_sha256 = canonical_hash(seed_contract)
    aggregate = hashlib.sha256()
    for value in (
        ADAPTER_ID,
        ADAPTER_VERSION,
        seed_contract["base_work_snapshot_id"],
        seed_sha256,
    ):
        aggregate.update(value.encode("utf-8"))
        aggregate.update(b"\0")
    for qid in qids:
        aggregate.update(qid.encode("ascii"))
        aggregate.update(b"\0")
        aggregate.update(str(entities[qid]["lastrevid"]).encode("ascii"))
        aggregate.update(b"\0")
        aggregate.update(entities[qid]["record_sha256"].encode("ascii"))
        aggregate.update(b"\0")
    snapshot_id = (
        f"wikidata-work-type-authority-{accessed}-"
        f"{aggregate.hexdigest()[:12]}"
    )
    return {
        "accessed": accessed,
        "adapter_id": ADAPTER_ID,
        "adapter_version": ADAPTER_VERSION,
        "base_work_snapshot_id": seed_contract["base_work_snapshot_id"],
        "endpoint": ENTITY_DATA_BASE,
        "entities": {qid: entities[qid] for qid in qids},
        "license": "CC0-1.0",
        "queries": [],
        "seeds": [],
        "selection": {
            "authority_qids": qids,
            "authority_seed": seed_contract,
            "method": "exact_instance_allowlist_authority",
            "notes_en": (
                "Revision-pinned class records document a bounded direct-P31 "
                "work-type mapping review. P279 is retained as context and is "
                "never traversed to classify works."
            ),
            "notes_zh": (
                "固定 revision 的类别记录用于记录一组有边界的 direct-P31 "
                "建筑类型映射复核；P279 仅保留为语境，绝不用于遍历推断作品类型。"
            ),
            "per_cell": None,
            "query_limit": None,
            "seed": (
                "wikidata-work-type-authority-seeds-v"
                f"{seed_contract['seed_version']}"
            ),
            "seed_sha256": seed_sha256,
        },
        "snapshot_id": snapshot_id,
        "source_id": "wikidata",
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
        help="Allow replacement of an existing explicit output file.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload = load_json(SEEDS_PATH)
    snapshot = hydrate_authority_snapshot(payload, args.accessed)
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
    display = output.relative_to(ROOT) if output.is_relative_to(ROOT) else output
    print(
        f"Wrote {display}: {len(snapshot['entities'])} pinned type authorities",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
