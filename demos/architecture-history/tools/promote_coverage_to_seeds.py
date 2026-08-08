#!/usr/bin/env python3
"""Promote selected coverage works into the Wikidata hydration seed catalog.

Reads an offline coverage snapshot, appends unseen work QIDs from configured
period waves, and writes a new seed file for fetch_wikidata_pilot hydration.
"""

from __future__ import annotations

import argparse
import copy
from pathlib import Path
from typing import Any

from expand_coverage_selection import parse_cell_id
from fetch_wikidata_pilot import atomic_write_json, load_json, ordered_qids, qid_number


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PERIODS = ("2000_present", "1980_1999", "1946_1979")


def label_hint_for_work(
    work_qid: str,
    *,
    entities: dict[str, Any],
) -> str:
    wrapper = entities.get(work_qid)
    if wrapper is None:
        return work_qid
    labels = wrapper.get("record", {}).get("labels", {})
    english = labels.get("en", {}).get("value")
    if isinstance(english, str) and english.strip():
        return english.strip()
    return work_qid


def seed_sort_key(seed: dict[str, Any]) -> tuple[int, str]:
    return (qid_number(seed["qid"]), seed["qid"])


def promote_coverage_to_seeds(
    coverage: dict[str, Any],
    seeds_payload: dict[str, Any],
    *,
    period_ids: tuple[str, ...],
    limit: int | None = None,
) -> tuple[dict[str, Any], dict[str, int]]:
    period_set = set(period_ids)
    if not period_set:
        raise RuntimeError("at least one period id is required")

    existing_qids = {
        seed["qid"]
        for seed in seeds_payload.get("seeds", [])
        if isinstance(seed, dict) and isinstance(seed.get("qid"), str)
    }
    entities = coverage.get("entities", {})
    if not isinstance(entities, dict):
        entities = {}

    considered = 0
    added = 0
    skipped_existing = 0
    new_seeds: list[dict[str, Any]] = []

    for query in coverage.get("queries", []):
        cell_id = query.get("cell_id")
        if not isinstance(cell_id, str):
            continue
        _, period_id = parse_cell_id(cell_id)
        if period_id not in period_set:
            continue

        region = query.get("region")
        country_code = query.get("country_code")
        country_qid = query.get("country_qid")
        if not isinstance(region, str) or not isinstance(country_code, str):
            raise RuntimeError(f"{cell_id}: query is missing region/country_code")
        if not isinstance(country_qid, str):
            raise RuntimeError(f"{cell_id}: query is missing country_qid")

        for work_qid in query.get("selected_work_qids", []):
            considered += 1
            if limit is not None and added >= limit:
                break
            if work_qid in existing_qids:
                skipped_existing += 1
                continue

            new_seeds.append(
                {
                    "expected_country_code": country_code,
                    "expected_country_qid": country_qid,
                    "label_hint_en": label_hint_for_work(
                        work_qid,
                        entities=entities,
                    ),
                    "qid": work_qid,
                    "region": region,
                    "risk_tags": ["coverage_promotion"],
                }
            )
            existing_qids.add(work_qid)
            added += 1

        if limit is not None and added >= limit:
            break

    updated = copy.deepcopy(seeds_payload)
    combined = list(updated.get("seeds", [])) + new_seeds
    combined.sort(key=seed_sort_key)
    updated["seeds"] = combined
    stats = {
        "considered": considered,
        "added": added,
        "skipped_existing": skipped_existing,
    }
    return updated, stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--coverage",
        type=Path,
        required=True,
        help="Coverage snapshot JSON with selected_work_qids.",
    )
    parser.add_argument(
        "--seeds",
        type=Path,
        required=True,
        help="Existing hydration seeds JSON.",
    )
    parser.add_argument(
        "--periods",
        default=",".join(DEFAULT_PERIODS),
        help=(
            "Comma-separated period ids to promote "
            f"(default: {','.join(DEFAULT_PERIODS)})."
        ),
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output seeds JSON path.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional cap on newly added seeds.",
    )
    return parser.parse_args()


def resolve_path(path: Path) -> Path:
    if path.is_absolute():
        return path
    return (Path.cwd() / path).resolve()


def main() -> int:
    args = parse_args()
    coverage = load_json(resolve_path(args.coverage))
    seeds_payload = load_json(resolve_path(args.seeds))
    period_ids = tuple(
        part.strip()
        for part in args.periods.split(",")
        if part.strip()
    )

    updated, stats = promote_coverage_to_seeds(
        coverage,
        seeds_payload,
        period_ids=period_ids,
        limit=args.limit,
    )
    output_path = resolve_path(args.output)
    atomic_write_json(output_path, updated)
    print(
        "promotion: "
        f"considered={stats['considered']} "
        f"added={stats['added']} "
        f"skipped_existing={stats['skipped_existing']} "
        f"total_seeds={len(updated['seeds'])}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
