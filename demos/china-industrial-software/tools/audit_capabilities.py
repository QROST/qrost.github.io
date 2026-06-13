#!/usr/bin/env python3
"""Capability-matrix auditor for the China Industrial Software survey.

The live capability matrix is computed in assets/js/matrix.js. Each product MAY
carry an explicit, curated override:

    "capabilities": { "full": [...], "partial": [...], "none": [...] }

which takes precedence over the JS heuristic. This script validates those
overrides against the canonical taxonomy and reports coverage so authors can
see what is still un-curated. It never mutates product data.

Usage:
    python3 tools/audit_capabilities.py            # human report
    python3 tools/audit_capabilities.py --json     # machine-readable summary
"""
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT_DIR = os.path.join(ROOT, "assets", "data", "categories")

# Canonical taxonomy — KEEP IN SYNC with CAPABILITIES in assets/js/matrix.js.
# (key, domain)
TAXONOMY = [
    ("drafting_2d", "Design & Modeling"),
    ("solid_modeling_3d", "Design & Modeling"),
    ("surface_modeling", "Design & Modeling"),
    ("assembly_design", "Design & Modeling"),
    ("parametric_design", "Design & Modeling"),
    ("visual_programming", "Design & Modeling"),
    ("cad_repair_interop", "Design & Modeling"),
    ("fea_structure", "Simulation & Analysis"),
    ("cfd_fluid", "Simulation & Analysis"),
    ("electromagnetics", "Simulation & Analysis"),
    ("multi_physics", "Simulation & Analysis"),
    ("material_injection", "Simulation & Analysis"),
    ("code_compliance", "Simulation & Analysis"),
    ("opt_light_acoustics", "Simulation & Analysis"),
    ("analog_ic_design", "EDA & Semiconductor"),
    ("digital_ic_synthesis", "EDA & Semiconductor"),
    ("formal_verification", "EDA & Semiconductor"),
    ("physical_prototyping", "EDA & Semiconductor"),
    ("tcad_device_sim", "EDA & Semiconductor"),
    ("fab_automation_eap", "EDA & Semiconductor"),
    ("yield_yms", "EDA & Semiconductor"),
    ("bom_mgmt", "Lifecycle & Mgmt"),
    ("lifecycle_mgmt", "Lifecycle & Mgmt"),
    ("requirements_trace", "Lifecycle & Mgmt"),
    ("mbse_sys", "Lifecycle & Mgmt"),
    ("finance_ledger", "Lifecycle & Mgmt"),
    ("cam_milling_cnc", "Manufacturing & Control"),
    ("scheduling_ops", "Manufacturing & Control"),
    ("process_control", "Manufacturing & Control"),
    ("data_acquisition", "Manufacturing & Control"),
    ("bim_clash", "BIM / GIS / AM"),
    ("gis_spatial", "BIM / GIS / AM"),
    ("slicing_algorithm", "BIM / GIS / AM"),
    ("am_layout", "BIM / GIS / AM"),
    ("cloud_native", "Architecture & Delivery"),
    ("collaboration", "Architecture & Delivery"),
    ("ext_api", "Architecture & Delivery"),
    ("xinchuang_compat", "Architecture & Delivery"),
]
VALID_KEYS = {k for k, _ in TAXONOMY}


def load_products():
    items = []
    for fp in sorted(glob.glob(os.path.join(CAT_DIR, "*.json"))):
        data = json.load(open(fp, encoding="utf-8"))
        for p in data.get("products", []):
            items.append((os.path.basename(fp), p))
    return items


def main():
    as_json = "--json" in sys.argv
    products = load_products()
    errors = []
    no_override = []
    explicit_count = {k: 0 for k in VALID_KEYS}
    per_file = {}

    for fname, p in products:
        pid = p.get("id", "?")
        per_file.setdefault(fname, {"total": 0, "curated": 0})
        per_file[fname]["total"] += 1
        caps = p.get("capabilities")
        if not caps:
            no_override.append((fname, pid))
            continue
        per_file[fname]["curated"] += 1
        seen = {}
        for bucket in ("full", "partial", "none"):
            for k in caps.get(bucket, []) or []:
                if k not in VALID_KEYS:
                    errors.append(f"{fname}:{pid}: unknown capability key '{k}' in '{bucket}'")
                if k in seen:
                    errors.append(f"{fname}:{pid}: key '{k}' in both '{seen[k]}' and '{bucket}'")
                seen[k] = bucket
                if bucket in ("full", "partial") and k in explicit_count:
                    explicit_count[k] += 1

    if as_json:
        print(json.dumps({
            "products": len(products),
            "curated": sum(v["curated"] for v in per_file.values()),
            "errors": errors,
            "per_file": per_file,
            "per_capability_explicit": explicit_count,
        }, ensure_ascii=False, indent=2))
        return 1 if errors else 0

    print(f"Capability audit — {len(products)} products, {len(VALID_KEYS)} capabilities\n")
    print("Per-file curation coverage:")
    for fname in sorted(per_file):
        v = per_file[fname]
        print(f"  {fname:24} {v['curated']:3}/{v['total']:3} curated")
    print(f"\nExplicit (full+partial) product counts per capability:")
    for k, dom in TAXONOMY:
        print(f"  {k:22} {explicit_count[k]:3}   [{dom}]")
    zero = [k for k, _ in TAXONOMY if explicit_count[k] == 0]
    if zero:
        print(f"\n⚠ capabilities with ZERO explicit products: {', '.join(zero)}")
    if errors:
        print(f"\n✗ {len(errors)} VALIDATION ERRORS:")
        for e in errors:
            print(f"  {e}")
        return 1
    print(f"\n✓ no validation errors. {len(no_override)} products still rely on heuristic fallback.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
