#!/usr/bin/env python3
"""Fail-closed same-snapshot repair for curated person-seed boundaries.

Dry-run by default. ``--apply`` updates only the ignored SQLite authority. It
never writes the catalog shard or public JSON; follow with ``db.py export`` so
the normal one-way projection and full validation chain remain authoritative.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

from import_wikidata_pilot import (
    CONFIG_PATH,
    CatalogBuilder,
    load_json,
    load_type_authority_snapshots,
)


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
CATALOG = DATA / "catalog" / "wikidata-hydration.json"
DB = ROOT / "data" / "architecture-history.db"
BACKUP_DIR = ROOT / "tmp" / "architecture-boundary-backups"
ENTITY_TABLES = ("people", "practices", "places", "works")


def canonical_hash(payload: Any) -> str:
    return hashlib.sha256(
        json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def db_payload(conn: sqlite3.Connection) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for table in ENTITY_TABLES:
        rows = conn.execute(
            "SELECT payload FROM entities WHERE source_table = ? ORDER BY id",
            (table,),
        ).fetchall()
        payload[table] = [json.loads(row[0]) for row in rows]
    for table in ("claims", "relations"):
        rows = conn.execute(
            f"SELECT payload FROM {table} ORDER BY id"
        ).fetchall()
        payload[table] = [json.loads(row[0]) for row in rows]
    return payload


def assert_current_authority(
    conn: sqlite3.Connection,
    current: dict[str, Any],
) -> tuple[dict[str, Any], Path]:
    generated_from = current.get("generated_from")
    if not isinstance(generated_from, str) or not generated_from:
        raise RuntimeError("catalog lacks generated_from")
    snapshot_path = DATA / "source-snapshots" / f"{generated_from}.json"
    if not snapshot_path.is_file():
        raise RuntimeError(f"pinned snapshot is missing: {snapshot_path}")
    snapshot = load_json(snapshot_path)
    if snapshot.get("snapshot_id") != generated_from:
        raise RuntimeError("catalog and pinned snapshot IDs differ")
    meta = dict(
        conn.execute(
            "SELECT key, value FROM schema_meta WHERE key LIKE 'source_%'"
        ).fetchall()
    )
    expected_meta = {
        "source_generated_from": generated_from,
        "source_source_id": current.get("source_id"),
        "source_transformer_id": current.get("transformer_id"),
        "source_transformer_version": current.get("transformer_version"),
    }
    if any(meta.get(key) != value for key, value in expected_meta.items()):
        raise RuntimeError("SQLite schema_meta does not match catalog provenance")

    stored = db_payload(conn)
    for table in (*ENTITY_TABLES, "claims", "relations"):
        public = load_json(DATA / f"{table}.json")[table]
        if canonical_hash(stored[table]) != canonical_hash(current[table]):
            raise RuntimeError(f"SQLite payload differs from catalog: {table}")
        if canonical_hash(current[table]) != canonical_hash(public):
            raise RuntimeError(f"catalog differs from public projection: {table}")
    return snapshot, snapshot_path


def build_proposal(
    current: dict[str, Any],
    fresh: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    for table in ("people", "practices", "places", "works"):
        current_ids = {row["id"] for row in current[table]}
        fresh_ids = {row["id"] for row in fresh[table]}
        if current_ids != fresh_ids:
            raise RuntimeError(
                f"same-snapshot entity identity drift in {table}: "
                f"drop={len(current_ids - fresh_ids)}, add={len(fresh_ids - current_ids)}"
            )

    fresh_people = {row["id"]: row for row in fresh["people"]}
    proposed = dict(current)
    proposed["people"] = []
    role_changes: list[tuple[str, list[str], list[str]]] = []
    for person in current["people"]:
        updated = dict(person)
        expected_roles = fresh_people[person["id"]]["roles"]
        if person["roles"] != expected_roles:
            if (
                person.get("verification_status") != "candidate"
                or person["roles"] != ["historian"]
                or expected_roles != ["unknown"]
            ):
                raise RuntimeError(
                    f"unexpected role migration for {person['id']}: "
                    f"{person['roles']!r} -> {expected_roles!r}"
                )
            updated["roles"] = expected_roles
            role_changes.append(
                (person["id"], person["roles"], expected_roles)
            )
        proposed["people"].append(updated)

    fresh_wd_relations = {
        row["id"] for row in fresh["relations"]
    }
    current_wd_relations = {
        row["id"]
        for row in current["relations"]
        if row["id"].startswith("relation-wd-")
    }
    if fresh_wd_relations - current_wd_relations:
        raise RuntimeError("repair would add unreviewed Wikidata relations")
    dropped_relation_ids = current_wd_relations - fresh_wd_relations
    dropped_relations = [
        row
        for row in current["relations"]
        if row["id"] in dropped_relation_ids
    ]
    if any(row.get("verification_status") != "candidate" for row in dropped_relations):
        raise RuntimeError("repair would drop a non-candidate relation")
    proposed["relations"] = [
        row
        for row in current["relations"]
        if row["id"] not in dropped_relation_ids
    ]

    dropped_claim_ids = {
        row.get("claim_id") for row in dropped_relations
    }
    dropped_claim_ids.discard(None)
    proposed["claims"] = [
        row
        for row in current["claims"]
        if row["id"] not in dropped_claim_ids
        and row.get("subject_id") not in dropped_relation_ids
    ]
    observed_dropped_claims = {
        row["id"] for row in current["claims"]
    } - {row["id"] for row in proposed["claims"]}
    if observed_dropped_claims != dropped_claim_ids:
        raise RuntimeError("relation/claim pruning is not one-to-one")

    valid_subjects = {
        row["id"]
        for table in ENTITY_TABLES
        for row in proposed[table]
    } | {row["id"] for row in proposed["relations"]}
    orphan_claims = [
        row["id"]
        for row in proposed["claims"]
        if row.get("subject_id") not in valid_subjects
    ]
    if orphan_claims:
        raise RuntimeError(f"proposal has orphan claims: {orphan_claims[:5]!r}")

    before_graph = [
        *current["people"],
        *current["practices"],
        *current["places"],
        *current["works"],
        *current["relations"],
    ]
    after_graph = [
        *proposed["people"],
        *proposed["practices"],
        *proposed["places"],
        *proposed["works"],
        *proposed["relations"],
    ]
    before_status = Counter(row["verification_status"] for row in before_graph)
    after_status = Counter(row["verification_status"] for row in after_graph)
    if before_status["verified"] != after_status["verified"]:
        raise RuntimeError("repair would change the verified graph count")

    return proposed, {
        "role_changes": role_changes,
        "dropped_relations": dropped_relations,
        "dropped_claim_ids": sorted(dropped_claim_ids),
        "before_status": dict(before_status),
        "after_status": dict(after_status),
    }


def shadow_drift(conn: sqlite3.Connection) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for row in conn.execute(
        "SELECT id, verification_status, confidence, payload FROM entities"
    ):
        payload = json.loads(row["payload"])
        if row["verification_status"] != payload.get("verification_status"):
            counts["verification_status"] += 1
        if row["confidence"] != payload.get("confidence"):
            counts["confidence"] += 1
    return dict(counts)


def apply_to_sqlite(
    proposed: dict[str, Any],
    report: dict[str, Any],
) -> tuple[Path, str]:
    wal = Path(str(DB) + "-wal")
    if wal.exists() and wal.stat().st_size:
        raise RuntimeError("refusing byte-copy backup while a non-empty WAL exists")
    before_sha = file_sha256(DB)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    backup = BACKUP_DIR / f"architecture-history-{stamp}-{before_sha[:12]}.db"
    if backup.exists():
        raise RuntimeError(f"backup already exists: {backup}")
    shutil.copy2(DB, backup)
    if file_sha256(backup) != before_sha:
        raise RuntimeError("byte-for-byte SQLite backup verification failed")

    people = {row["id"]: row for row in proposed["people"]}
    dropped_relation_ids = {
        row["id"] for row in report["dropped_relations"]
    }
    dropped_claim_ids = set(report["dropped_claim_ids"])
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("BEGIN IMMEDIATE")
        for person_id, _, _ in report["role_changes"]:
            person = people[person_id]
            conn.execute(
                "UPDATE entities SET payload = ? WHERE id = ?",
                (
                    json.dumps(person, ensure_ascii=False, sort_keys=True),
                    person_id,
                ),
            )
        for row in conn.execute(
            "SELECT id, payload FROM entities"
        ).fetchall():
            payload = json.loads(row["payload"])
            conn.execute(
                "UPDATE entities SET verification_status = ?, confidence = ? "
                "WHERE id = ?",
                (
                    payload.get("verification_status"),
                    payload.get("confidence"),
                    row["id"],
                ),
            )
        for claim_id in sorted(dropped_claim_ids):
            conn.execute(
                "DELETE FROM claim_evidence WHERE claim_id = ?",
                (claim_id,),
            )
            conn.execute("DELETE FROM claims WHERE id = ?", (claim_id,))
        for relation_id in sorted(dropped_relation_ids):
            conn.execute("DELETE FROM relations WHERE id = ?", (relation_id,))
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()
    return backup, before_sha


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Back up and update the ignored SQLite authority.",
    )
    args = parser.parse_args()

    current = load_json(CATALOG)
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    try:
        integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"SQLite integrity_check failed: {integrity}")
        snapshot, snapshot_path = assert_current_authority(conn, current)
        drift = shadow_drift(conn)
    finally:
        conn.close()

    config = load_json(CONFIG_PATH)
    fresh = CatalogBuilder(
        snapshot,
        config,
        load_type_authority_snapshots(config),
    ).build()
    if fresh.get("generated_from") != current.get("generated_from"):
        raise RuntimeError("fresh importer output changed snapshot identity")
    proposed, report = build_proposal(current, fresh)

    print(f"authority snapshot: {snapshot_path.name}")
    print(f"snapshot id: {snapshot['snapshot_id']}")
    print("payload authority: SQLite == catalog == public arrays")
    print(f"SQLite shadow drift to fail closed: {drift}")
    print(
        "data delta: "
        f"people {len(current['people'])}->{len(proposed['people'])}, "
        f"relations {len(current['relations'])}->{len(proposed['relations'])}, "
        f"claims {len(current['claims'])}->{len(proposed['claims'])}"
    )
    print(
        "role delta: "
        f"{len(report['role_changes'])} candidate people historian->unknown"
    )
    print(
        "dropped candidate relations: "
        + ", ".join(row["id"] for row in report["dropped_relations"])
    )
    print(
        "verification counts: "
        f"before={report['before_status']} after={report['after_status']}"
    )
    print(f"proposed payload sha256: {canonical_hash(proposed)}")

    if not args.apply:
        print("DRY RUN: SQLite was not changed")
        return 0

    backup, before_sha = apply_to_sqlite(proposed, report)
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    try:
        stored = db_payload(conn)
        for table in (*ENTITY_TABLES, "claims", "relations"):
            if canonical_hash(stored[table]) != canonical_hash(proposed[table]):
                raise RuntimeError(f"post-apply SQLite payload mismatch: {table}")
        if shadow_drift(conn):
            raise RuntimeError("post-apply SQLite shadow columns still drift")
        integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"post-apply integrity_check failed: {integrity}")
    finally:
        conn.close()
    print(f"backup: {backup.relative_to(ROOT)}")
    print(f"backup sha256: {before_sha}")
    print(f"updated SQLite sha256: {file_sha256(DB)}")
    print("APPLIED: run tools/db.py export to project through the normal gate")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
