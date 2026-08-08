#!/usr/bin/env python3
"""Offline reselection from an existing Wikidata coverage snapshot.

Re-runs stable-hash cell selection over stored candidate lists without
issuing new SPARQL queries. Optionally pins newly selected work entities.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import copy
from pathlib import Path
from typing import Any, Iterable, Literal

from fetch_wikidata_coverage import (
    CONFIG_PATH,
    coverage_snapshot_id,
    eligible_credits_for_work,
    stable_pick_candidates,
)
from fetch_wikidata_pilot import (
    atomic_write_json,
    fetch_pinned_entity,
    load_json,
    ordered_qids,
)

ROOT = Path(__file__).resolve().parent.parent
PeriodOrder = Literal["newest_first", "oldest_first"]


def parse_cell_id(cell_id: str) -> tuple[str, str]:
    if "__" not in cell_id:
        raise ValueError(f"invalid coverage cell_id: {cell_id!r}")
    region, period_id = cell_id.split("__", 1)
    if not region or not period_id:
        raise ValueError(f"invalid coverage cell_id: {cell_id!r}")
    return region, period_id


def order_queries_for_selection(
    queries: list[dict[str, Any]],
    config: dict[str, Any],
    *,
    period_order: PeriodOrder,
) -> list[dict[str, Any]]:
    by_cell = {query["cell_id"]: query for query in queries}
    if len(by_cell) != len(queries):
        raise RuntimeError("duplicate cell_id values in coverage snapshot queries")

    grid = config["coverage_grid"]
    period_index = {
        period["id"]: index
        for index, period in enumerate(grid["periods"])
    }
    by_region: dict[str, list[tuple[int, dict[str, Any]]]] = {}
    for query in queries:
        region, period_id = parse_cell_id(query["cell_id"])
        if period_id not in period_index:
            raise RuntimeError(
                f"coverage snapshot period {period_id!r} is outside config grid"
            )
        by_region.setdefault(region, []).append(
            (period_index[period_id], query)
        )

    reverse = period_order == "newest_first"
    ordered: list[dict[str, Any]] = []
    for region in grid["regions"]:
        region_rows = by_region.get(region)
        if not region_rows:
            continue
        region_rows.sort(key=lambda row: row[0], reverse=reverse)
        ordered.extend(query for _, query in region_rows)
    return ordered


def reselect_coverage(
    snapshot: dict[str, Any],
    config: dict[str, Any],
    *,
    per_cell: int,
    period_order: PeriodOrder,
    fetch_entities: bool = False,
    entity_fetcher=fetch_pinned_entity,
) -> dict[str, Any]:
    selection = snapshot.get("selection")
    if not isinstance(selection, dict):
        raise RuntimeError("snapshot is missing selection metadata")
    seed = selection.get("seed")
    if not isinstance(seed, str) or not seed:
        raise RuntimeError("snapshot selection.seed is required")

    updated = copy.deepcopy(snapshot)
    queries = updated["queries"]
    iteration_order = order_queries_for_selection(
        queries,
        config,
        period_order=period_order,
    )

    already_selected: set[str] = set()
    selection_by_cell: dict[str, list[str]] = {}
    for query in iteration_order:
        cell_id = query["cell_id"]
        candidates = query.get("candidate_work_qids", [])
        selected = stable_pick_candidates(
            seed=seed,
            cell_id=cell_id,
            candidates=candidates,
            per_cell=per_cell,
            already_selected=already_selected,
        )
        already_selected.update(selected)
        selection_by_cell[cell_id] = selected

    for query in queries:
        query["selected_work_qids"] = selection_by_cell[query["cell_id"]]

    entities: dict[str, dict] = dict(updated.get("entities", {}))
    property_allowlist = set(config["property_allowlist"])
    creator_cache: dict[str, str | None] = {}

    if fetch_entities:
        selected_qids = ordered_qids(
            qid
            for query in queries
            for qid in query["selected_work_qids"]
        )
        missing = [qid for qid in selected_qids if qid not in entities]
        if missing:
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                future_to_qid = {
                    executor.submit(
                        entity_fetcher,
                        qid,
                        property_allowlist,
                    ): qid
                    for qid in missing
                }
                for future in concurrent.futures.as_completed(future_to_qid):
                    qid = future_to_qid[future]
                    entities[qid] = future.result()

    for query in queries:
        credits: list[dict[str, str]] = []
        for work_qid in query["selected_work_qids"]:
            wrapper = entities.get(work_qid)
            if wrapper is None:
                continue
            credits.extend(
                eligible_credits_for_work(
                    work_qid,
                    wrapper["record"],
                    creator_cache=creator_cache,
                    fetcher=entity_fetcher,
                )
            )
        query["eligible_credits"] = credits

    updated["entities"] = {
        qid: entities[qid]
        for qid in ordered_qids(entities)
    }

    updated_selection = dict(selection)
    updated_selection["per_cell"] = per_cell
    notes_en = updated_selection.get("notes_en") or ""
    marker = f"Offline reselect period_order={period_order}."
    if marker not in notes_en:
        updated_selection["notes_en"] = (
            f"{notes_en} {marker}".strip() if notes_en else marker
        )
    updated["selection"] = updated_selection

    accessed = updated.get("accessed")
    if not isinstance(accessed, str) or not accessed:
        raise RuntimeError("snapshot accessed date is required")
    updated["snapshot_id"] = coverage_snapshot_id(
        accessed,
        seed=seed,
        queries=queries,
    )
    return updated


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--snapshot",
        type=Path,
        required=True,
        help="Input coverage snapshot JSON.",
    )
    parser.add_argument(
        "--per-cell",
        type=int,
        required=True,
        help="Maximum works to select per grid cell.",
    )
    parser.add_argument(
        "--period-order",
        choices=("newest_first", "oldest_first"),
        default="newest_first",
        help="Cell iteration order within each region (default: newest_first).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output coverage snapshot JSON.",
    )
    parser.add_argument(
        "--fetch-entities",
        action="store_true",
        help="Pin missing selected work entities and refresh eligible_credits.",
    )
    return parser.parse_args()


def resolve_path(path: Path) -> Path:
    if path.is_absolute():
        return path
    return (Path.cwd() / path).resolve()


def main() -> int:
    args = parse_args()
    if args.per_cell < 1:
        raise SystemExit("--per-cell must be >= 1")

    snapshot_path = resolve_path(args.snapshot)
    output_path = resolve_path(args.output)
    snapshot = load_json(snapshot_path)
    config = load_json(CONFIG_PATH)

    updated = reselect_coverage(
        snapshot,
        config,
        per_cell=args.per_cell,
        period_order=args.period_order,
        fetch_entities=args.fetch_entities,
    )

    before = sum(len(query["selected_work_qids"]) for query in snapshot["queries"])
    after = sum(len(query["selected_work_qids"]) for query in updated["queries"])
    atomic_write_json(output_path, updated)
    print(
        f"Wrote {output_path}: selected {before} -> {after} works, "
        f"snapshot_id={updated['snapshot_id']}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
