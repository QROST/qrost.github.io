#!/usr/bin/env python3
"""Post-build sanity checks. Non-zero exit on hard errors; warnings are informational.

Checks: manifest present + versioned; every shard cat references a real shelter;
every thumb_path file exists on disk; enums cover the tokens the data actually uses.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def main() -> int:
    errors, warns = [], []
    man_p = DATA / "manifest.json"
    if not man_p.exists():
        print("FAIL: manifest.json missing — run tools/build.py")
        return 1
    man = load(man_p)
    if not man.get("data_version"):
        errors.append("manifest.data_version empty (cache-bust not stamped)")

    shelters = {s["id"] for s in load(DATA / "shelters.json")["shelters"]}
    enums = load(DATA / "enums.json")
    color_tokens = set(enums["colors"]); pattern_tokens = set(enums["patterns"])
    coat_tokens = set(enums["coat"])

    total = 0
    for shard in man["shards"]:
        cats = load(DATA / shard["file"])["cats"]
        total += len(cats)
        for c in cats:
            if c.get("shelter_id") not in shelters:
                errors.append(f"{c['id']}: orphan shelter_id {c.get('shelter_id')}")
            tp = c.get("thumb_path")
            if tp and not (ROOT / tp).exists():
                errors.append(f"{c['id']}: thumb_path missing on disk: {tp}")
            for col in c.get("colors", []):
                if col not in color_tokens:
                    warns.append(f"{c['id']}: unknown color token '{col}'")
            if c.get("pattern") and c["pattern"] not in pattern_tokens:
                warns.append(f"{c['id']}: unknown pattern '{c['pattern']}'")
            if c.get("coat_length") and c["coat_length"] not in coat_tokens:
                warns.append(f"{c['id']}: unknown coat '{c['coat_length']}'")

    if total != man["total_cats"]:
        errors.append(f"shard cat total {total} != manifest.total_cats {man['total_cats']}")

    for w in warns[:20]:
        print(f"  warn: {w}")
    if len(warns) > 20:
        print(f"  ... +{len(warns) - 20} more warnings")
    for e in errors:
        print(f"  ERROR: {e}")
    print(f"validate: {total} cats, {len(shelters)} shelters, "
          f"{len(errors)} error(s), {len(warns)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
