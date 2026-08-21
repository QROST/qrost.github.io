#!/usr/bin/env python3
"""Merge tmp/research/*.json shards into assets/data/org-enrichment.json."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
TMP = ROOT / "tmp" / "research"
OUT = DATA / "org-enrichment.json"


def load_map(path: Path) -> dict:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw.get("enrichment"), dict):
        return raw["enrichment"]
    if isinstance(raw.get("records"), list):
        out = {}
        for row in raw["records"]:
            eid = row.get("id") or row.get("org_id")
            if eid:
                out[eid] = {k: v for k, v in row.items() if k not in ("id", "org_id")}
        return out
    if all(isinstance(v, dict) for v in raw.values()):
        return raw
    raise ValueError(f"{path}: expected enrichment map or records[]")


def deep_merge(a: dict, b: dict) -> dict:
    out = dict(a)
    for k, v in b.items():
        if v is None:
            continue
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def main() -> int:
    merged: dict = {}
    baseline = DATA / "org-enrichment.json"
    if baseline.exists():
        merged = load_map(baseline)
    if TMP.exists():
        for path in sorted(TMP.glob("*.json")):
            shard = load_map(path)
            for eid, row in shard.items():
                merged[eid] = deep_merge(merged.get(eid) or {}, row)
            print(f"  merge {path.name}: {len(shard)} rows")
    OUT.write_text(
        json.dumps({"enrichment": merged}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT.relative_to(ROOT)} ({len(merged)} orgs)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
