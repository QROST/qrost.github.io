#!/usr/bin/env python3
"""Validate industrial software survey JSON against schema.json."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.json"

REQUIRED_PRODUCT = {
    "id", "name_zh", "name_en", "vendor_id", "category_l1", "category_l2",
    "origin", "kernel", "maturity", "localization_depth",
    "strengths_zh", "strengths_en", "limitations_zh", "limitations_en",
    "industries", "pricing", "confidence", "sources",
}
REQUIRED_KERNEL = {
    "id", "name_zh", "name_en", "owner", "origin", "license_model",
    "capabilities_zh", "capabilities_en",
    "strengths_zh", "strengths_en", "limitations_zh", "limitations_en",
    "used_by_product_ids", "used_by_international", "chinese_products_using",
    "substitution_status_zh", "substitution_status_en",
    "domestic_alternatives", "confidence", "sources",
}
VALID_ORIGIN = {"domestic", "joint_venture", "international", "open_source"}
VALID_KERNEL_ORIGIN = {"domestic", "international", "open_source"}
VALID_KERNEL_LICENSE = {"commercial", "oem", "open_source", "proprietary_inhouse"}
VALID_MATURITY = {"experimental", "mid", "high", "mission_critical"}
VALID_LOC = {"none", "pilot", "partial", "core"}
VALID_PRICING = {"free", "low", "mid", "high", "quote"}
VALID_L1 = {"研发设计", "生产制造", "经营管理", "运维服务", "基础平台"}
VALID_PRODUCT_TYPE = {
    "mcad", "2d_cad", "dcc_mesh", "cae_solver", "cam", "eda", "plm",
    "bim", "bim_coordination", "reality_capture", "gis", "iiot_platform",
    "scada", "mes", "dcs", "eam", "erp", "slicer", "cim", "mbse",
    "cad_interop", "other",
}
VALID_TAGS = {
    "digital_twin", "xinchuang", "am_slicing", "cad_interop",
    "open_source_stack", "semiconductor", "aerospace", "automotive",
    "cloud_native", "low_code", "clash_detection", "federated_bim",
    "point_cloud", "model_checking", "4d_simulation", "open_bim",
}
VALID_EVIDENCE = {"audited", "case_study", "vendor_claim", "media"}
MILESTONE_REQUIRED = {
    "id", "date", "vendor_id", "category_l2",
    "headline_zh", "headline_en",
    "before_gap_zh", "before_gap_en",
    "achievement_zh", "achievement_en",
    "still_missing_zh", "still_missing_en",
    "evidence_level", "sources", "confidence",
}
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")


def load_json(path: Path) -> object:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def err(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)


def validate_source(src: dict, ctx: str) -> list[str]:
    issues = []
    if not isinstance(src, dict):
        return [f"{ctx}: source must be object"]
    if not src.get("url"):
        issues.append(f"{ctx}: source missing url")
    elif not str(src["url"]).startswith(("http://", "https://")):
        issues.append(f"{ctx}: source url must be http(s)")
    acc = src.get("accessed")
    if acc and not DATE_RE.match(str(acc)):
        issues.append(f"{ctx}: invalid accessed date {acc!r}")
    return issues


def validate_product(p: dict, ctx: str, kernel_ids: set[str] | None = None) -> list[str]:
    issues = []
    if not isinstance(p, dict):
        return [f"{ctx}: not an object"]
    missing = REQUIRED_PRODUCT - set(p.keys())
    if missing:
        issues.append(f"{ctx}: missing fields {sorted(missing)}")
    pid = p.get("id", "")
    if pid and not ID_RE.match(pid):
        issues.append(f"{ctx}: invalid id {pid!r}")
    kid = p.get("kernel_id")
    if kid is not None:
        if not ID_RE.match(kid):
            issues.append(f"{ctx}: invalid kernel_id {kid!r}")
        elif kernel_ids is not None and kid not in kernel_ids:
            issues.append(f"{ctx}: unknown kernel_id {kid!r}")
    for field, valid in [
        ("origin", VALID_ORIGIN), ("maturity", VALID_MATURITY),
        ("localization_depth", VALID_LOC), ("pricing", VALID_PRICING),
        ("category_l1", VALID_L1),
    ]:
        if p.get(field) and p[field] not in valid:
            issues.append(f"{ctx}: invalid {field}={p[field]!r}")
    conf = p.get("confidence")
    if conf is not None and not (0 <= float(conf) <= 1):
        issues.append(f"{ctx}: confidence out of range")
    sources = p.get("sources") or []
    if not sources:
        issues.append(f"{ctx}: sources required")
    else:
        for i, s in enumerate(sources):
            issues.extend(validate_source(s, f"{ctx}.sources[{i}]"))
    if conf is not None and float(conf) > 0.3 and not sources:
        issues.append(f"{ctx}: confidence>0.3 requires sources")
    for arr in ("strengths_zh", "strengths_en", "limitations_zh", "limitations_en", "industries"):
        if arr in p and (not isinstance(p[arr], list) or len(p[arr]) < 1):
            issues.append(f"{ctx}: {arr} must be non-empty array")
    lv = p.get("last_verified")
    if lv and not DATE_RE.match(str(lv)):
        issues.append(f"{ctx}: invalid last_verified")
    pt = p.get("product_type")
    if pt is not None and pt not in VALID_PRODUCT_TYPE:
        issues.append(f"{ctx}: invalid product_type={pt!r}")
    tags = p.get("tags")
    if tags is not None:
        if not isinstance(tags, list):
            issues.append(f"{ctx}: tags must be array")
        else:
            seen_tags: set[str] = set()
            for i, tag in enumerate(tags):
                if tag not in VALID_TAGS:
                    issues.append(f"{ctx}: invalid tags[{i}]={tag!r}")
                if tag in seen_tags:
                    issues.append(f"{ctx}: duplicate tag {tag!r}")
                seen_tags.add(tag)
    return issues


def validate_kernel(k: dict, ctx: str, product_ids: set[str], kernel_ids: set[str]) -> list[str]:
    issues = []
    if not isinstance(k, dict):
        return [f"{ctx}: not an object"]
    missing = REQUIRED_KERNEL - set(k.keys())
    if missing:
        issues.append(f"{ctx}: missing fields {sorted(missing)}")
    kid = k.get("id", "")
    if kid and not ID_RE.match(kid):
        issues.append(f"{ctx}: invalid id {kid!r}")
    if k.get("origin") and k["origin"] not in VALID_KERNEL_ORIGIN:
        issues.append(f"{ctx}: invalid origin={k['origin']!r}")
    if k.get("license_model") and k["license_model"] not in VALID_KERNEL_LICENSE:
        issues.append(f"{ctx}: invalid license_model={k['license_model']!r}")
    conf = k.get("confidence")
    if conf is not None and not (0 <= float(conf) <= 1):
        issues.append(f"{ctx}: confidence out of range")
    for arr in (
        "capabilities_zh", "capabilities_en", "strengths_zh", "strengths_en",
        "limitations_zh", "limitations_en",
    ):
        if arr in k and (not isinstance(k[arr], list) or len(k[arr]) < 1):
            issues.append(f"{ctx}: {arr} must be non-empty array")
    for alt in k.get("domestic_alternatives") or []:
        if alt not in kernel_ids:
            issues.append(f"{ctx}: unknown domestic_alternatives entry {alt!r}")
    for pid in k.get("used_by_product_ids") or []:
        if pid not in product_ids:
            issues.append(f"{ctx}: used_by_product_ids references unknown product {pid!r}")
    sources = k.get("sources") or []
    if not sources:
        issues.append(f"{ctx}: sources required")
    else:
        for i, s in enumerate(sources):
            issues.extend(validate_source(s, f"{ctx}.sources[{i}]"))
    yr = k.get("first_release_year")
    if yr is not None and not isinstance(yr, int):
        issues.append(f"{ctx}: first_release_year must be int or null")
    return issues


def validate_products_file(path: Path, kernel_ids: set[str] | None = None) -> list[str]:
    data = load_json(path)
    products = data.get("products") if isinstance(data, dict) else data
    if not isinstance(products, list):
        return [f"{path}: expected products array"]
    issues = []
    seen = set()
    for i, p in enumerate(products):
        ctx = f"{path.name}[{i}] id={p.get('id', '?')}"
        issues.extend(validate_product(p, ctx, kernel_ids))
        pid = p.get("id")
        if pid in seen:
            issues.append(f"duplicate id {pid}")
        seen.add(pid)
    return issues


def warn_duplicate_product_names(paths: list[Path]) -> list[str]:
    """Warn when name_zh or name_en collides across different vendor_id."""
    by_zh: dict[str, list[tuple[str, str, str]]] = {}
    by_en: dict[str, list[tuple[str, str, str]]] = {}
    for path in paths:
        data = load_json(path)
        products = data.get("products") if isinstance(data, dict) else data
        if not isinstance(products, list):
            continue
        for p in products:
            pid = p.get("id", "?")
            vid = p.get("vendor_id", "?")
            zh = (p.get("name_zh") or "").strip()
            en = (p.get("name_en") or "").strip().lower()
            if zh:
                by_zh.setdefault(zh, []).append((pid, vid, path.name))
            if en:
                by_en.setdefault(en, []).append((pid, vid, path.name))
    warnings: list[str] = []
    for label, groups in (("name_zh", by_zh), ("name_en", by_en)):
        for name, entries in groups.items():
            if len(entries) < 2:
                continue
            vendors = {e[1] for e in entries}
            if len(vendors) > 1 or len(entries) > 1:
                ids = ", ".join(f"{e[0]}({e[1]})" for e in entries)
                warnings.append(
                    f"duplicate {label} {name!r} across products: {ids} — add vendor prefix"
                )
    return warnings


def validate_milestone(m: dict, ctx: str) -> list[str]:
    issues = []
    if not isinstance(m, dict):
        return [f"{ctx}: not an object"]
    missing = MILESTONE_REQUIRED - set(m.keys())
    if missing:
        issues.append(f"{ctx}: missing fields {sorted(missing)}")
    mid = m.get("id", "")
    if mid and not ID_RE.match(mid):
        issues.append(f"{ctx}: invalid id {mid!r}")
    if m.get("date") and not DATE_RE.match(str(m["date"])):
        issues.append(f"{ctx}: invalid date {m.get('date')!r}")
    if m.get("evidence_level") and m["evidence_level"] not in VALID_EVIDENCE:
        issues.append(f"{ctx}: invalid evidence_level={m['evidence_level']!r}")
    conf = m.get("confidence")
    if conf is not None and not (0 <= float(conf) <= 1):
        issues.append(f"{ctx}: confidence out of range")
    for i, s in enumerate(m.get("sources") or []):
        issues.extend(validate_source(s, f"{ctx}.sources[{i}]"))
    if not m.get("sources"):
        issues.append(f"{ctx}: sources required")
    return issues


def validate_breakthroughs(path: Path) -> list[str]:
    data = load_json(path)
    milestones = data.get("milestones", [])
    if not isinstance(milestones, list):
        return [f"{path}: expected milestones array"]
    issues = []
    seen = set()
    for i, m in enumerate(milestones):
        ctx = f"breakthroughs[{i}] id={m.get('id', '?')}"
        issues.extend(validate_milestone(m, ctx))
        mid = m.get("id")
        if mid in seen:
            issues.append(f"duplicate milestone id {mid}")
        seen.add(mid)
    if len(milestones) < 15:
        issues.append(f"breakthroughs: expected >=15 milestones, got {len(milestones)}")
    return issues


def validate_vendors(path: Path) -> list[str]:
    data = load_json(path)
    vendors = data.get("vendors", data) if isinstance(data, dict) else data
    if not isinstance(vendors, list):
        return [f"{path}: expected vendors array"]
    issues = []
    seen = set()
    for i, v in enumerate(vendors):
        if not v.get("id"):
            issues.append(f"vendors[{i}]: missing id")
        if v.get("id") in seen:
            issues.append(f"duplicate vendor id {v['id']}")
        seen.add(v.get("id"))
    return issues


def validate_kernels(path: Path, product_ids: set[str]) -> tuple[list[str], set[str]]:
    data = load_json(path)
    kernels = data.get("kernels", data) if isinstance(data, dict) else data
    if not isinstance(kernels, list):
        return [f"{path}: expected kernels array"], set()
    kernel_ids = {k.get("id") for k in kernels if k.get("id")}
    issues = []
    seen = set()
    for i, k in enumerate(kernels):
        ctx = f"kernels[{i}] id={k.get('id', '?')}"
        issues.extend(validate_kernel(k, ctx, product_ids, kernel_ids))
        kid = k.get("id")
        if kid in seen:
            issues.append(f"duplicate kernel id {kid}")
        seen.add(kid)
    return issues, kernel_ids


def collect_product_ids(paths: list[Path]) -> set[str]:
    ids: set[str] = set()
    for path in paths:
        data = load_json(path)
        products = data.get("products") if isinstance(data, dict) else data
        if isinstance(products, list):
            for p in products:
                if p.get("id"):
                    ids.add(p["id"])
    return ids


def validate_benchmark_pairs(product_ids: set[str]) -> list[str]:
    """Fail when benchmark-pairs.json references product ids absent from the catalog."""
    pairs_path = ROOT / "assets" / "data" / "comparisons" / "benchmark-pairs.json"
    if not pairs_path.exists():
        return []
    data = load_json(pairs_path)
    pairs = data.get("pairs", []) if isinstance(data, dict) else data
    if not isinstance(pairs, list):
        return [f"{pairs_path.name}: expected pairs array"]
    issues: list[str] = []
    for i, pair in enumerate(pairs):
        if not isinstance(pair, dict):
            issues.append(f"benchmark-pairs[{i}]: not an object")
            continue
        for role in ("domestic_id", "international_id"):
            pid = pair.get(role)
            if not pid:
                issues.append(f"benchmark-pairs[{i}]: missing {role}")
            elif pid not in product_ids:
                issues.append(
                    f"benchmark-pairs[{i}]: orphan {role}={pid!r} — "
                    "add to tmp/research/ and run build.py --force-merge"
                )
    return issues


def main() -> int:
    issues: list[str] = []
    if not SCHEMA_PATH.exists():
        err("schema.json missing")
        return 1

    cat_dir = ROOT / "assets" / "data" / "categories"
    research_dir = ROOT / "tmp" / "research"

    paths: list[Path] = []
    if cat_dir.exists() and any(cat_dir.glob("*.json")):
        paths.extend(sorted(cat_dir.glob("*.json")))
    elif research_dir.exists():
        paths.extend(sorted(research_dir.glob("*.json")))

    if not paths:
        print("No category or research JSON files found (OK for empty scaffold).")
        return 0

    product_ids = collect_product_ids(paths)
    kernel_ids: set[str] = set()
    kernels_path = ROOT / "assets" / "data" / "kernels.json"
    if kernels_path.exists():
        k_issues, kernel_ids = validate_kernels(kernels_path, product_ids)
        issues.extend(k_issues)

    for path in paths:
        issues.extend(validate_products_file(path, kernel_ids or None))

    name_dup_warnings = warn_duplicate_product_names(paths)
    for w in name_dup_warnings:
        print(f"WARN: {w}", file=sys.stderr)

    vendors_path = ROOT / "assets" / "data" / "vendors.json"
    if vendors_path.exists():
        issues.extend(validate_vendors(vendors_path))

    breakthroughs_path = ROOT / "assets" / "data" / "breakthroughs.json"
    if breakthroughs_path.exists():
        issues.extend(validate_breakthroughs(breakthroughs_path))

    issues.extend(validate_benchmark_pairs(product_ids))

    if issues:
        for i in issues:
            err(i)
        print(f"\nValidation FAILED: {len(issues)} issue(s)", file=sys.stderr)
        return 1

    total = sum(
        len(load_json(p).get("products", load_json(p) if isinstance(load_json(p), list) else []))
        if isinstance(load_json(p), dict) else len(load_json(p))
        for p in paths
    )
    kcount = len(kernel_ids) if kernel_ids else 0
    print(f"Validation OK: {len(paths)} file(s), ~{total} products, {kcount} kernels checked")
    if name_dup_warnings:
        print(f"  ({len(name_dup_warnings)} duplicate-name warning(s) — see stderr)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
