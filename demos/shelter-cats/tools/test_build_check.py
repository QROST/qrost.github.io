#!/usr/bin/env python3
"""Prove shelter-cats --check is read-only and bound to the SQLite SSOT."""
from __future__ import annotations

import hashlib
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def copy_project(destination: Path) -> None:
    destination.mkdir()
    for rel in ("tools", "data", "assets/data", "assets/js", "assets/css"):
        shutil.copytree(ROOT / rel, destination / rel)
    shutil.copy2(ROOT / "index.html", destination / "index.html")


def snapshot(root: Path) -> dict[str, str]:
    return {
        str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def run_check(root: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return subprocess.run(
        [sys.executable, "tools/build.py", "--check"],
        cwd=root,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )


def assert_unchanged(before: dict[str, str], after: dict[str, str], label: str) -> None:
    if before == after:
        return
    added = sorted(after.keys() - before.keys())
    removed = sorted(before.keys() - after.keys())
    changed = sorted(path for path in before.keys() & after.keys() if before[path] != after[path])
    raise SystemExit(
        f"FAIL: {label} modified the copied project "
        f"(added={added}, removed={removed}, changed={changed})"
    )


with tempfile.TemporaryDirectory(prefix="shelter-build-check-") as tmp:
    work = Path(tmp) / "shelter-cats"
    copy_project(work)

    before = snapshot(work)
    current = run_check(work)
    if current.returncode:
        print(current.stdout, current.stderr, sep="\n")
        raise SystemExit("FAIL: pristine copied build should pass --check")
    assert_unchanged(before, snapshot(work), "passing --check")

    db_path = work / "data" / "shelters.db"
    conn = sqlite3.connect(db_path)
    cat_id = conn.execute("SELECT id FROM cats ORDER BY id LIMIT 1").fetchone()[0]
    conn.execute("UPDATE cats SET name = name || ' DRIFT' WHERE id = ?", (cat_id,))
    conn.commit()
    conn.close()

    drifted = snapshot(work)
    rejected = run_check(work)
    if rejected.returncode == 0:
        raise SystemExit("FAIL: --check accepted a DB cat-name drift without rebuilt public JSON")
    if "differs from the SQLite public projection" not in rejected.stderr:
        print(rejected.stdout, rejected.stderr, sep="\n")
        raise SystemExit("FAIL: DB drift failed for an unexpected reason")
    assert_unchanged(drifted, snapshot(work), "failing --check")

    # Immutable read mode must never ignore committed state that still lives in
    # an open writer's WAL. Fail closed without touching either sidecar.
    wal_work = Path(tmp) / "shelter-cats-wal"
    copy_project(wal_work)
    wal_db = wal_work / "data" / "shelters.db"
    writer = sqlite3.connect(wal_db)
    writer.execute("PRAGMA journal_mode=WAL")
    writer.execute("PRAGMA wal_autocheckpoint=0")
    wal_cat_id = writer.execute("SELECT id FROM cats ORDER BY id LIMIT 1").fetchone()[0]
    writer.execute("UPDATE cats SET name = name || ' WAL_DRIFT' WHERE id = ?", (wal_cat_id,))
    writer.commit()
    wal_path = Path(str(wal_db) + "-wal")
    if not wal_path.exists() or not wal_path.stat().st_size:
        writer.close()
        raise SystemExit("FAIL: test fixture did not retain committed state in a WAL")
    wal_before = snapshot(wal_work)
    wal_rejected = run_check(wal_work)
    if wal_rejected.returncode == 0 or "uncheckpointed SQLite WAL present" not in wal_rejected.stderr:
        writer.close()
        print(wal_rejected.stdout, wal_rejected.stderr, sep="\n")
        raise SystemExit("FAIL: --check ignored committed state in an open WAL")
    assert_unchanged(wal_before, snapshot(wal_work), "WAL fail-closed check")
    writer.close()

    shelter_work = Path(tmp) / "shelter-cats-shelter-drift"
    copy_project(shelter_work)
    shelter_db = shelter_work / "data" / "shelters.db"
    conn = sqlite3.connect(shelter_db)
    shelter_id = conn.execute("SELECT id FROM shelters ORDER BY id LIMIT 1").fetchone()[0]
    conn.execute("UPDATE shelters SET name = name || ' DRIFT' WHERE id = ?", (shelter_id,))
    conn.commit()
    conn.close()
    shelter_before = snapshot(shelter_work)
    shelter_rejected = run_check(shelter_work)
    if shelter_rejected.returncode == 0 or "shelters.json differs" not in shelter_rejected.stderr:
        print(shelter_rejected.stdout, shelter_rejected.stderr, sep="\n")
        raise SystemExit("FAIL: --check accepted a shelter-field drift")
    assert_unchanged(shelter_before, snapshot(shelter_work), "shelter drift check")

    region_work = Path(tmp) / "shelter-cats-region-drift"
    copy_project(region_work)
    region_db = region_work / "data" / "shelters.db"
    conn = sqlite3.connect(region_db)
    region_id = conn.execute("SELECT id FROM shelters ORDER BY id LIMIT 1").fetchone()[0]
    conn.execute("UPDATE shelters SET region = 'test_region' WHERE id = ?", (region_id,))
    conn.commit()
    conn.close()
    region_before = snapshot(region_work)
    region_rejected = run_check(region_work)
    if region_rejected.returncode == 0 or "enums.json differs" not in region_rejected.stderr:
        print(region_rejected.stdout, region_rejected.stderr, sep="\n")
        raise SystemExit("FAIL: --check accepted a region/enums drift")
    assert_unchanged(region_before, snapshot(region_work), "region drift check")

    shard_work = Path(tmp) / "shelter-cats-extra-shard"
    copy_project(shard_work)
    rogue = shard_work / "assets" / "data" / "cats" / "rogue.json"
    rogue.write_text('{"region":"rogue","cats":[]}\n', encoding="utf-8")
    shard_before = snapshot(shard_work)
    shard_rejected = run_check(shard_work)
    if shard_rejected.returncode == 0 or "unexpected stale cat shard" not in shard_rejected.stderr:
        print(shard_rejected.stdout, shard_rejected.stderr, sep="\n")
        raise SystemExit("FAIL: --check accepted an extra stale cat shard")
    assert_unchanged(shard_before, snapshot(shard_work), "extra shard check")

print("OK: --check is read-only and rejects entity, enum, shard, and open-WAL projection drift")
