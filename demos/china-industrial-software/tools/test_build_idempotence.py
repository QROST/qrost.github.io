#!/usr/bin/env python3
"""Prove that a no-input-change CIS build is byte-idempotent."""
from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def watched_files() -> list[Path]:
    files = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        if any(part in {"node_modules", "tmp", "__pycache__"} for part in relative.parts):
            continue
        if path.suffix in {".pyc", ".log"}:
            continue
        files.append(path)
    return sorted(files)


def tree_digest(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.relative_to(ROOT).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def main() -> int:
    before_paths = watched_files()
    before = tree_digest(before_paths)
    completed = subprocess.run([sys.executable, "-B", str(ROOT / "tools" / "build.py")], cwd=str(ROOT))
    if completed.returncode:
        return completed.returncode
    after_paths = watched_files()
    after = tree_digest(after_paths)
    if [p.relative_to(ROOT) for p in before_paths] != [p.relative_to(ROOT) for p in after_paths] or before != after:
        print("test_build_idempotence: no-op build changed the CIS tree", file=sys.stderr)
        return 1
    print("test_build_idempotence: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
