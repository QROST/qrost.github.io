#!/usr/bin/env python3
"""Merge tmp/research/*.json into assets/data/categories/ and regenerate manifest.json."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "tmp" / "research"
CAT_DIR = ROOT / "assets" / "data" / "categories"
DATA_DIR = ROOT / "assets" / "data"
HTML = ROOT / "index.html"
CATALOG_LOADER = ROOT / "assets" / "js" / "catalog-loader.js"
MIGRATION = ROOT / "tools" / "migrate_breakthrough_contract.py"

TOKEN_RE = re.compile(r"(\?v=)[^\"'\s>]+")
DATA_VERSION_RE = re.compile(r"(const DATA_VERSION\s*=\s*')([^']*)(')")

# Map agent output filenames → category bundle keys
CATEGORY_MAP = {
    "a1-eda": "eda",
    "a2-cad": "cad",
    "a3-cae-cam": "cae",
    "a4-plm-mbse": "plm",
    "a5-dcs-scada": "mes-dcs",
    "a6-mes": "mes-dcs",
    "a7-erp": "erp",
    "a8-bim-gis-platform": "bim-gis",
    "a8-bim-gis": "bim-gis",
    "a8-platform": "platform",
    "eda": "eda",
    "cad": "cad",
    "cae": "cae",
    "cae-cam": "cae",
    "plm": "plm",
    "mes-dcs": "mes-dcs",
    "dcs-scada": "mes-dcs",
    "mes": "mes-dcs",
    "erp": "erp",
    "bim-gis": "bim-gis",
    "platform": "platform",
    "slicers": "slicers",
    "a9-slicers": "slicers",
}


def load_products(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        return data.get("products", [])
    if isinstance(data, list):
        return data
    return []


def category_key(path: Path) -> str:
    stem = path.stem.lower()
    if stem in CATEGORY_MAP:
        return CATEGORY_MAP[stem]
    for prefix, key in CATEGORY_MAP.items():
        if stem.startswith(prefix):
            return key
    return stem


# Research JSON files that are metadata/summaries — never merge as product categories
RESEARCH_SKIP_STEMS = frozenset({
    "vendor-prefix-cleanup-summary",
    "vendor-prefix-restore-summary",
})


def merge_research() -> dict[str, list[dict]]:
    """Union-merge research shards by category; later files overwrite same id."""
    buckets: dict[str, dict[str, dict]] = {}
    if not RESEARCH.exists():
        return {}
    merged_from: dict[str, list[str]] = {}
    for path in sorted(RESEARCH.glob("*.json")):
        if path.stem in RESEARCH_SKIP_STEMS:
            continue
        key = category_key(path)
        buckets.setdefault(key, {})
        merged_from.setdefault(key, []).append(path.name)
        for p in load_products(path):
            buckets[key][p["id"]] = p
    for key, names in sorted(merged_from.items()):
        print(f"  merge {key}: {len(buckets[key])} products from {len(names)} shard(s)")
    return {k: list(v.values()) for k, v in buckets.items()}


def write_categories(buckets: dict[str, list[dict]]) -> None:
    CAT_DIR.mkdir(parents=True, exist_ok=True)
    for key, products in sorted(buckets.items()):
        out = CAT_DIR / f"{key}.json"
        out.write_text(
            json.dumps({"category": key, "products": products}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"  wrote {out.name}: {len(products)} products")


def read_existing_categories() -> dict[str, list[dict]]:
    buckets: dict[str, list[dict]] = {}
    if not CAT_DIR.exists():
        return buckets
    for path in sorted(CAT_DIR.glob("*.json")):
        buckets[path.stem] = load_products(path)
    return buckets


def read_kernel_count() -> int:
    kernels_path = DATA_DIR / "kernels.json"
    if not kernels_path.exists():
        return 0
    data = json.loads(kernels_path.read_text(encoding="utf-8"))
    kernels = data.get("kernels", data) if isinstance(data, dict) else data
    return len(kernels) if isinstance(kernels, list) else 0


def build_manifest(buckets: dict[str, list[dict]]) -> dict:
    counts = {k: len(v) for k, v in buckets.items()}
    total = sum(counts.values())
    l1_counts: Counter = Counter()
    l2_counts: Counter = Counter()
    origin_counts: Counter = Counter()
    kernel_ref_counts: Counter = Counter()
    for prods in buckets.values():
        for p in prods:
            l1_counts[p.get("category_l1", "?")] += 1
            l2_counts[p.get("category_l2", "?")] += 1
            origin_counts[p.get("origin", "?")] += 1
            if p.get("kernel_id"):
                kernel_ref_counts[p["kernel_id"]] += 1
    kernel_total = read_kernel_count()
    return {
        "data_version": "",
        "total_products": total,
        "total_kernels": kernel_total,
        "category_counts": counts,
        "category_l1_counts": dict(l1_counts),
        "category_l2_counts": dict(l2_counts),
        "origin_counts": dict(origin_counts),
        "kernel_ref_counts": dict(kernel_ref_counts),
        "categories": [
            {"id": k, "file": f"categories/{k}.json", "count": counts[k]}
            for k in sorted(counts.keys())
        ],
    }


def run_contract_migration() -> bool:
    completed = subprocess.run([sys.executable, "-B", str(MIGRATION)], cwd=str(ROOT))
    return completed.returncode == 0


def normalized_content(path: Path) -> bytes:
    """Return bytes with existing cache tokens neutralized to avoid hash cycles."""
    if path == HTML:
        text = path.read_text(encoding="utf-8")
        return TOKEN_RE.sub(r"\g<1>__CONTENT_HASH__", text).encode()
    if path == CATALOG_LOADER:
        text = path.read_text(encoding="utf-8")
        return DATA_VERSION_RE.sub(r"\g<1>__CONTENT_HASH__\3", text).encode()
    return path.read_bytes()


def content_token() -> str:
    manifest_path = DATA_DIR / "manifest.json"
    files = sorted(
        path for path in DATA_DIR.rglob("*.json")
        if path != manifest_path
    )
    files += sorted((ROOT / "assets" / "js").glob("*.js"))
    files += sorted((ROOT / "assets" / "css").glob("*.css"))
    if HTML.exists():
        files.append(HTML)
    digest = hashlib.sha256()
    for path in files:
        digest.update(path.relative_to(ROOT).as_posix().encode())
        digest.update(normalized_content(path))
    return digest.hexdigest()[:12]


def stamp_cache_bust(token: str, manifest: dict) -> None:
    html = HTML.read_text(encoding="utf-8")
    stamped_html = TOKEN_RE.sub(rf"\g<1>{token}", html)
    if stamped_html != html:
        HTML.write_text(stamped_html, encoding="utf-8")

    loader = CATALOG_LOADER.read_text(encoding="utf-8")
    stamped_loader = DATA_VERSION_RE.sub(rf"\g<1>{token}\3", loader)
    if stamped_loader != loader:
        CATALOG_LOADER.write_text(stamped_loader, encoding="utf-8")

    manifest["data_version"] = token
    manifest_path = DATA_DIR / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"  cache token: {token}")


def run_validate() -> bool:
    r = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "validate.py")],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    print(r.stdout, end="")
    if r.stderr:
        print(r.stderr, end="", file=sys.stderr)
    return r.returncode == 0


def run_contract_tests() -> bool:
    for name in (
        "test_provenance.py",
        "test_breakthrough_migration.py",
        "test_data_contract.py",
        "test_page_contract.py",
    ):
        completed = subprocess.run(
            [sys.executable, "-B", str(ROOT / "tools" / name)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )
        print(completed.stdout, end="")
        if completed.stderr:
            print(completed.stderr, end="", file=sys.stderr)
        if completed.returncode != 0:
            return False
    return True


def _dir_max_mtime(directory: Path, pattern: str = "*.json") -> float:
    if not directory.exists():
        return 0.0
    files = list(directory.glob(pattern))
    if not files:
        return 0.0
    return max(path.stat().st_mtime for path in files)


def categories_newer_than_research() -> bool:
    """True when category bundles are newer than research inputs (merge would regress fixes)."""
    cat_mtime = _dir_max_mtime(CAT_DIR)
    research_mtime = _dir_max_mtime(RESEARCH)
    return cat_mtime > 0 and research_mtime > 0 and cat_mtime > research_mtime


def should_merge_research(merge_research: bool, force_merge: bool) -> bool:
    """Research merge is opt-in only; default run must not overwrite hand-edited categories/."""
    if not merge_research and not force_merge:
        return False
    if force_merge:
        return True
    if categories_newer_than_research():
        print(
            "build.py: WARNING — categories/ newer than tmp/research/; "
            "merge may overwrite taxonomy fixes (pass --force-merge to override guard)"
        )
        return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Regenerate manifest.json from assets/data/categories/ (default). "
        "Research merge is opt-in via --merge-research.",
    )
    parser.add_argument(
        "--merge-research",
        action="store_true",
        help="Merge tmp/research/*.json into assets/data/categories/ (destructive; opt-in).",
    )
    parser.add_argument(
        "--manifest-only",
        action="store_true",
        help="Explicit alias for default: manifest only, no research merge.",
    )
    parser.add_argument(
        "--force-merge",
        action="store_true",
        help="Merge tmp/research/ even when categories/ is newer (may overwrite taxonomy fixes).",
    )
    args = parser.parse_args()

    if should_merge_research(args.merge_research, args.force_merge):
        print("build.py: merging research → categories")
        merged = merge_research()
        if merged:
            write_categories(merged)
        else:
            print("  no tmp/research/*.json — keeping existing categories/")
    else:
        print("build.py: manifest-only — skipping research merge (use --merge-research to opt in)")

    if not run_contract_migration():
        return 1

    buckets = read_existing_categories()
    manifest = build_manifest(buckets)
    token = content_token()
    stamp_cache_bust(token, manifest)
    print(f"  wrote manifest.json: {manifest['total_products']} products, {manifest.get('total_kernels', 0)} kernels")

    if not run_validate():
        return 1
    if not run_contract_tests():
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
