#!/usr/bin/env python3
"""Bucket assignments for the sharded public claims table.

The public claims table is split into ``SHARD_COUNT`` files under
``assets/data/claims/`` so the browser can fetch one small shard when a reader
opens an entity or relation instead of the whole table. A claim belongs to the
shard that ``bucket(subject_id)`` names; every subject's claims therefore sit
in exactly one shard, on disk and in the browser.

build.py partitions the merged claims with this module; validate.py re-partitions
the expected merge the same way and compares each shard, so both a hand-edited
shard and a misplaced claim fail the gate. data-loader.js must implement the
identical FNV-1a bucket function (UTF-8 bytes, 32-bit, mod SHARD_COUNT).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterator

SHARD_COUNT = 32
FNV_OFFSET = 0x811C9DC5
FNV_PRIME = 0x01000193


def bucket(subject_id: str) -> int:
    """FNV-1a (32-bit) over the UTF-8 bytes of ``subject_id``, mod SHARD_COUNT."""
    value = FNV_OFFSET
    for byte in subject_id.encode("utf-8"):
        value ^= byte
        value = (value * FNV_PRIME) & 0xFFFFFFFF
    return value % SHARD_COUNT


def shard_filename(index: int) -> str:
    return f"shard-{index:02d}.json"


def shard_relative_path(index: int) -> str:
    return f"claims/{shard_filename(index)}"


def shard_dir(data_dir: Path) -> Path:
    return data_dir / "claims"


def shard_paths(data_dir: Path) -> list[Path]:
    return [shard_dir(data_dir) / shard_filename(i) for i in range(SHARD_COUNT)]


def split(claims: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Partition claims into per-shard lists, preserving the incoming order."""
    shards: list[list[dict[str, Any]]] = [[] for _ in range(SHARD_COUNT)]
    for claim in claims:
        shards[bucket(claim["subject_id"])].append(claim)
    return shards


def write_shards(data_dir: Path, claims: list[dict[str, Any]]) -> None:
    """Write the shard files for ``claims``, replacing any previous shards."""
    target = shard_dir(data_dir)
    target.mkdir(parents=True, exist_ok=True)
    for stale in target.glob("shard-*.json"):
        stale.unlink()
    for index, rows in enumerate(split(claims)):
        (target / shard_filename(index)).write_text(
            json.dumps({"claims": rows}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def read_shards(data_dir: Path) -> list[dict[str, Any]]:
    """Return every claim across all shard files, in shard order."""
    rows: list[dict[str, Any]] = []
    for path in shard_paths(data_dir):
        rows.extend(json.loads(path.read_text(encoding="utf-8"))["claims"])
    return rows


def iter_public_claim_ids(data_dir: Path) -> Iterator[tuple[str, str]]:
    for path in shard_paths(data_dir):
        payload = json.loads(path.read_text(encoding="utf-8"))
        for claim in payload["claims"]:
            yield path.name, claim["id"]
