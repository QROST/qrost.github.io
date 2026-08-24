#!/usr/bin/env python3
"""Syntax-check every tracked or pending public-repository Python and JavaScript file."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def files(pattern: str) -> list[str]:
    completed = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "--", pattern],
        cwd=ROOT, text=True, stdout=subprocess.PIPE, check=True,
    )
    return sorted(line for line in completed.stdout.splitlines() if line)


def main() -> int:
    failures: list[tuple[str, str]] = []
    python_files = files("*.py")
    javascript_files = sorted(set(files("*.js") + files("*.mjs")))
    with tempfile.TemporaryDirectory(prefix="qrost-pycache-") as cache:
        env = os.environ.copy()
        env["PYTHONPYCACHEPREFIX"] = cache
        for relative in python_files:
            result = subprocess.run(
                [sys.executable, "-m", "py_compile", relative],
                cwd=ROOT, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            )
            if result.returncode:
                failures.append((relative, result.stdout.strip()))
    for relative in javascript_files:
        try:
            result = subprocess.run(
                ["node", "--check", relative],
                cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            )
        except FileNotFoundError:
            print("syntax: FAILED (Node.js executable not found)", file=sys.stderr)
            return 1
        if result.returncode:
            failures.append((relative, result.stdout.strip()))
    if failures:
        print(f"syntax: FAILED ({len(failures)} files)", file=sys.stderr)
        for relative, output in failures:
            print(f"\n[{relative}]\n{output}", file=sys.stderr)
        return 1
    print(f"syntax: OK ({len(python_files)} Python + {len(javascript_files)} JavaScript files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
