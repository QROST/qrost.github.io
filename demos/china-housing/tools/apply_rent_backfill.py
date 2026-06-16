#!/usr/bin/env python3
"""Apply rent-backfill-*-findings.json → housing.db (reuses apply_verification_fixes.apply_rent)."""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "housing.db"

sys.path.insert(0, str(ROOT / "tools"))
from apply_verification_fixes import apply_rent  # noqa: E402


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "research" / "rent-backfill-2026-06.json"
    if not path.is_file():
        sys.exit(f"✗ missing findings file: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    findings = data.get("findings", []) if isinstance(data, dict) else data
    con = sqlite3.connect(DB, timeout=60)
    con.execute("PRAGMA busy_timeout=60000")
    n = apply_rent(con, findings)
    con.commit()
    con.close()
    print(f"✓ rent updates: {n} from {path.name}")


if __name__ == "__main__":
    main()
