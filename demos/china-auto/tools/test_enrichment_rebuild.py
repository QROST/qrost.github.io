#!/usr/bin/env python3
"""Prove a missing enrichment output rebuilds byte-for-byte deterministically."""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "assets" / "data" / "org-enrichment.json"


def main() -> int:
    expected = OUTPUT.read_bytes()
    with tempfile.TemporaryDirectory(prefix="china-auto-enrichment-") as tmp:
        clean = Path(tmp) / "china-auto"
        shutil.copytree(ROOT, clean)
        rebuilt = clean / "assets" / "data" / "org-enrichment.json"
        rebuilt.unlink()

        for script in ("enrich_baseline.py", "enrich_official_2025.py"):
            result = subprocess.run(
                [sys.executable, "-B", str(clean / "tools" / script)],
                cwd=clean,
                text=True,
                capture_output=True,
                check=False,
            )
            if result.returncode != 0:
                sys.stderr.write(result.stdout)
                sys.stderr.write(result.stderr)
                return result.returncode

        if rebuilt.read_bytes() != expected:
            print(
                "test_enrichment_rebuild: rebuilt org-enrichment.json differs byte-for-byte",
                file=sys.stderr,
            )
            return 1

    print("test_enrichment_rebuild: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
