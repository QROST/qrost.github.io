#!/usr/bin/env python3
"""Prove that a no-input-change cache-stamp build is byte-idempotent."""
from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WATCH = (ROOT / "index.html", ROOT / "assets/data/manifest.json")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    before = {path: digest(path) for path in WATCH}
    completed = subprocess.run([sys.executable, str(ROOT / "tools/build.py")], check=False)
    if completed.returncode:
        return completed.returncode
    after = {path: digest(path) for path in WATCH}
    changed = [path.relative_to(ROOT).as_posix() for path in WATCH if before[path] != after[path]]
    if changed:
        print("test_build_idempotence: changed on no-op build: " + ", ".join(changed), file=sys.stderr)
        return 1
    print("test_build_idempotence: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
