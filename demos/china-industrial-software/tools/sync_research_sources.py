#!/usr/bin/env python3
"""Apply P0 products, prefix-restore names, and brand fixes to tmp/research/ shards."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "tmp" / "research"

# Research shard targets (primary agent files per category)
SHARD_TARGETS = {
    "cad": RESEARCH / "a2-cad.json",
    "cae": RESEARCH / "a3-cae-cam.json",
    "plm": RESEARCH / "a4-plm-mbse.json",
    "bim-gis": RESEARCH / "a8-bim-gis.json",
}

SKIP_STEMS = frozenset({
    "vendor-prefix-cleanup-summary",
    "vendor-prefix-restore-summary",
})

NAME_FIXES: dict[str, dict[str, str]] = {
    "revit": {"name_zh": "Revit", "name_en": "Revit"},
    "inventor": {"name_zh": "Inventor", "name_en": "Inventor"},
}


def _parse_target(raw: str | None) -> str | None:
    if not raw:
        return None
    if " → " in raw:
        return raw.split(" → ", 1)[1].strip()
    return raw.strip()


def load_products(path: Path) -> tuple[dict, list[dict]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        return data, data.setdefault("products", [])
    if isinstance(data, list):
        return {"products": data}, data
    return {"products": []}, []


def save_shard(path: Path, wrapper: dict, products: list[dict]) -> None:
    if "products" in wrapper:
        wrapper["products"] = products
        out = wrapper
    else:
        out = products
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def upsert_products(path: Path, additions: list[dict]) -> int:
    wrapper, products = load_products(path)
    by_id = {p["id"]: p for p in products}
    added = 0
    for p in additions:
        if p["id"] not in by_id:
            products.append(p)
            by_id[p["id"]] = p
            added += 1
    save_shard(path, wrapper, products)
    return added


def apply_prefix_restore() -> int:
    summary_path = RESEARCH / "vendor-prefix-restore-summary.json"
    if not summary_path.exists():
        return 0
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    updated = 0
    for path in sorted(RESEARCH.glob("*.json")):
        if path.stem in SKIP_STEMS:
            continue
        wrapper, products = load_products(path)
        dirty = False
        for p in products:
            pid = p.get("id")
            for ch in summary["changes"]:
                if ch["id"] != pid:
                    continue
                want_zh = _parse_target(ch.get("name_zh"))
                want_en = _parse_target(ch.get("name_en"))
                if want_zh and p.get("name_zh") != want_zh:
                    p["name_zh"] = want_zh
                    dirty = True
                    updated += 1
                if want_en and p.get("name_en") != want_en:
                    p["name_en"] = want_en
                    dirty = True
                    updated += 1
        if dirty:
            save_shard(path, wrapper, products)
    return updated


def apply_name_fixes() -> int:
    updated = 0
    for path in sorted(RESEARCH.glob("*.json")):
        if path.stem in SKIP_STEMS:
            continue
        wrapper, products = load_products(path)
        dirty = False
        for p in products:
            fixes = NAME_FIXES.get(p.get("id", ""))
            if not fixes:
                continue
            for key, val in fixes.items():
                if p.get(key) != val:
                    p[key] = val
                    dirty = True
                    updated += 1
        if dirty:
            save_shard(path, wrapper, products)
    return updated


def sync_p0_batch() -> int:
    # Import P0 definitions from sibling module (single source of truth)
    sys.path.insert(0, str(ROOT / "tools"))
    from restore_p0_batch import P0  # noqa: WPS433

    added = 0
    for cat_key, batch in P0.items():
        target = SHARD_TARGETS.get(cat_key)
        if not target:
            print(f"  skip P0 {cat_key}: no shard target", file=sys.stderr)
            continue
        n = upsert_products(target, batch)
        print(f"  {target.name}: +{n} P0 products")
        added += n
    return added


def main() -> int:
    print("sync_research_sources: P0 batch → research shards")
    p0_added = sync_p0_batch()
    print("sync_research_sources: prefix-restore names")
    prefix_n = apply_prefix_restore()
    print(f"  {prefix_n} name field(s) updated")
    print("sync_research_sources: unique-brand name fixes (Revit, Inventor)")
    fix_n = apply_name_fixes()
    print(f"  {fix_n} name field(s) updated")
    print(f"sync_research_sources: done (+{p0_added} products)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
