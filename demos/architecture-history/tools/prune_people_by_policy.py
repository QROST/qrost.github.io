#!/usr/bin/env python3
"""Prune catalog people using architecture occupation, credits, and relations."""

from __future__ import annotations

import argparse
import copy
from pathlib import Path

from fetch_wikidata_pilot import atomic_write_json, load_json
from people_policy import prune_catalog_people


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CATALOG = ROOT / "assets" / "data" / "catalog" / "wikidata-hydration.json"
SNAPSHOT_DIR = ROOT / "assets" / "data" / "source-snapshots"


def snapshot_path_for_catalog(catalog: dict, explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit.resolve()
    generated_from = catalog.get("generated_from")
    if not isinstance(generated_from, str) or not generated_from:
        raise RuntimeError("catalog is missing generated_from snapshot id")
    path = SNAPSHOT_DIR / f"{generated_from}.json"
    if not path.exists():
        raise RuntimeError(f"snapshot not found for generated_from={generated_from!r}: {path}")
    return path


def entity_records_from_snapshot(snapshot: dict) -> dict[str, dict]:
    entities = snapshot.get("entities", {})
    records: dict[str, dict] = {}
    for qid, wrapper in entities.items():
        if not isinstance(qid, str) or not isinstance(wrapper, dict):
            continue
        record = wrapper.get("record")
        if isinstance(record, dict):
            records[qid] = record
    return records


def person_seed_qids_from_snapshot(snapshot: dict) -> set[str]:
    return {
        seed["qid"]
        for seed in snapshot.get("person_seeds", [])
        if isinstance(seed, dict) and isinstance(seed.get("qid"), str)
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--catalog",
        type=Path,
        default=DEFAULT_CATALOG,
        help="Catalog shard JSON to prune in place.",
    )
    parser.add_argument(
        "--snapshot",
        type=Path,
        default=None,
        help="Optional hydration snapshot override for P106 checks.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print stats without writing the catalog.",
    )
    parser.add_argument(
        "--sample-limit",
        type=int,
        default=20,
        help="Number of dropped Wikidata QIDs to print.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    catalog_path = args.catalog.resolve()
    catalog = load_json(catalog_path)
    snapshot_path = snapshot_path_for_catalog(catalog, args.snapshot)
    snapshot = load_json(snapshot_path)
    records = entity_records_from_snapshot(snapshot)

    pruned, stats = prune_catalog_people(
        catalog,
        records,
        sample_limit=args.sample_limit,
        seeded_qids=person_seed_qids_from_snapshot(snapshot),
    )

    print(
        "people policy prune: "
        f"before={stats['before']} "
        f"before_relations={stats['before_relations']} "
        f"after={stats['after']} "
        f"after_relations={stats['after_relations']} "
        f"dropped_people={stats['dropped_people']} "
        f"seed_people={stats['seed_people']} "
        f"relation_kept={stats['relation_kept']} "
        f"dropped_relations={stats['dropped_relations']} "
        f"dropped_claims={stats['dropped_claims']}",
        flush=True,
    )
    if stats["sample_dropped_qids"]:
        print(
            "sample dropped qids: " + ", ".join(stats["sample_dropped_qids"]),
            flush=True,
        )

    if args.dry_run:
        return 0

    atomic_write_json(catalog_path, pruned)
    rel = catalog_path.relative_to(ROOT) if catalog_path.is_relative_to(ROOT) else catalog_path
    print(f"Wrote pruned catalog: {rel}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
