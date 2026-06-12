#!/usr/bin/env python3
"""Backfill missing product_type from category_l2 for 1:1 taxonomy buckets."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAT_DIR = ROOT / "assets" / "data" / "categories"

# Mirrors assets/js/app.js L2_CANONICAL_PRODUCT_TYPE
L2_CANONICAL_PRODUCT_TYPE: dict[str, str] = {
    "CAE": "cae_solver",
    "CAM": "cam",
    "CAD互操作": "cad_interop",
    "EDA": "eda",
    "PLM": "plm",
    "BIM": "bim",
    "GIS": "gis",
    "MES": "mes",
    "DCS": "dcs",
    "SCADA": "scada",
    "ERP": "erp",
    "切片软件": "slicer",
    "工业互联网": "iiot_platform",
    "半导体CIM": "cim",
    "MBSE": "mbse",
    "EAM": "eam",
}


def main() -> int:
    updated = 0
    for path in sorted(CAT_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        products = data.get("products", [])
        file_updated = 0
        for p in products:
            if p.get("product_type"):
                continue
            l2 = p.get("category_l2")
            pt = L2_CANONICAL_PRODUCT_TYPE.get(l2 or "")
            if not pt:
                continue
            p["product_type"] = pt
            file_updated += 1
        if file_updated:
            path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            print(f"  {path.name}: +{file_updated} product_type")
            updated += file_updated
    print(f"backfill_product_types: {updated} field(s) set")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
