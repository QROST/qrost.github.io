#!/usr/bin/env python3
"""Merge gap-batch-*-findings.json → housing.db (rent + hospital POI via research-merge)."""
from __future__ import annotations

import glob
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "housing.db"
RESEARCH = ROOT / "data" / "research"

sys.path.insert(0, str(ROOT / "tools"))
from enrich import merge_research  # noqa: E402
from apply_verification_fixes import apply_rent  # noqa: E402
from manage import connect  # noqa: E402


def load_all_gap_findings() -> list[dict]:
    out: list[dict] = []
    patterns = ("gap-batch-*-findings.json", "rent-gap-round2-*-findings.json")
    paths: list[Path] = []
    for pat in patterns:
        paths.extend(RESEARCH.glob(pat))
    for path in sorted(set(paths)):
        data = json.loads(path.read_text(encoding="utf-8"))
        items = data.get("findings", data) if isinstance(data, dict) else data
        if isinstance(items, list):
            out.extend(items)
    return out


def main() -> None:
    findings = load_all_gap_findings()
    if not findings:
        print("no gap-batch-*-findings.json files found")
        return

    rent_findings = []
    poi_findings = []
    for f in findings:
        lid = f.get("id")
        if lid is None:
            continue
        conf = (f.get("confidence") or "").lower()
        rent = f.get("rent")
        if conf in ("high", "med") and rent is not None and int(rent) > 0:
            rent_findings.append({"id": lid, "rent": int(rent), "confidence": conf})

        hname = f.get("hospital_name")
        if hname:
            srcs = list(f.get("sources") or [])
            for key in ("hospital_source", "rent_source", "source"):
                v = f.get(key)
                if v and v not in srcs:
                    srcs.insert(0, v)
            poi_findings.append({
                "id": lid,
                "hospital_name": hname,
                "sources": srcs,
                "notes": f.get("notes") or f.get("note"),
            })

    con = connect()
    rent_n = apply_rent(con, rent_findings)
    con.commit()
    print(f"✓ rent updates: {rent_n} (from {len(rent_findings)} findings)")

    if poi_findings:
        rep = merge_research(con, poi_findings, print)
        print(f"✓ research-merge: {rep}")
    con.close()

    # summary gaps
    con2 = sqlite3.connect(DB)
    rent_gap = con2.execute("SELECT COUNT(*) FROM listings WHERE rent IS NULL OR rent=0").fetchone()[0]
    hosp_gap = con2.execute(
        "SELECT COUNT(*) FROM listings l WHERE NOT EXISTS "
        "(SELECT 1 FROM poi p WHERE p.listing_id=l.id AND p.category='hospital')"
    ).fetchone()[0]
    print(f"remaining rent gaps: {rent_gap}, hospital gaps: {hosp_gap}")


if __name__ == "__main__":
    main()
