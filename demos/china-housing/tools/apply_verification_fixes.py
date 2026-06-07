#!/usr/bin/env python3
"""Apply colleague verification JSON → housing.db (area, rent). Idempotent."""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "housing.db"
RESEARCH = ROOT / "data" / "research"


def load_findings(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        return data.get("findings", [])
    return data if isinstance(data, list) else []


def apply_area(con: sqlite3.Connection, findings: list[dict]) -> int:
    n = 0
    for f in findings:
        lid, area = f.get("id"), f.get("area")
        if lid is None or area is None:
            continue
        conf = (f.get("confidence") or "high").lower()
        if conf not in ("high", "med"):
            continue
        con.execute("UPDATE listings SET area=? WHERE id=?", (float(area), int(lid)))
        n += 1
    return n


def apply_rent(con: sqlite3.Connection, findings: list[dict]) -> int:
    n = 0
    for f in findings:
        lid = f.get("id")
        if lid is None:
            continue
        conf = (f.get("confidence") or "").lower()
        rent = f.get("rent")
        if conf in ("high", "med") and rent is not None:
            con.execute("UPDATE listings SET rent=? WHERE id=?", (int(rent), int(lid)))
            n += 1
        elif conf == "none" or rent == 0:
            con.execute("UPDATE listings SET rent=0 WHERE id=?", (int(lid),))
            n += 1
    return n


def main() -> None:
    con = sqlite3.connect(DB)
    area_n = apply_area(con, load_findings(RESEARCH / "colleague-area-fix.json"))
    rent_n = apply_rent(con, load_findings(RESEARCH / "colleague-rent-fix.json"))
    con.commit()
    print(f"✓ area updates: {area_n}")
    print(f"✓ rent updates: {rent_n}")


if __name__ == "__main__":
    main()
