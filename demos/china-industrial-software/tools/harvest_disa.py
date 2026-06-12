#!/usr/bin/env python3
"""Harvest DISA (中国工业技术软件化产业联盟) style vendor seeds for research agents.

Outputs tmp/disa-vendor-seeds.json — a starter list for manual curation.
No live scrape by default; curated seeds from public DISA member lists & annual reports.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tmp" / "disa-vendor-seeds.json"

# Curated seed vendors (DISA ecosystem + listed industrial software firms)
SEEDS = [
    {"id": "empyrean", "name_zh": "华大九天", "name_en": "Empyrean", "categories": ["EDA"]},
    {"id": "primarius", "name_zh": "概伦电子", "name_en": "Primarius", "categories": ["EDA"]},
    {"id": "semitron", "name_zh": "广立微", "name_en": "Semitron", "categories": ["EDA"]},
    {"id": "x-epic", "name_zh": "芯华章", "name_en": "X-Epic", "categories": ["EDA"]},
    {"id": "zwcad", "name_zh": "中望软件", "name_en": "ZWSOFT", "categories": ["CAD"]},
    {"id": "gstarcad", "name_zh": "浩辰软件", "name_en": "Gstarsoft", "categories": ["CAD"]},
    {"id": "hoteam", "name_zh": "华天软件", "name_en": "Hoteam", "categories": ["CAD", "PLM"]},
    {"id": "caxa", "name_zh": "数码大方", "name_en": "CAXA", "categories": ["CAD", "PLM"]},
    {"id": "ansys-cn", "name_zh": "安世亚太", "name_en": "PERA Global", "categories": ["CAE"]},
    {"id": "suochen", "name_zh": "索辰科技", "name_en": "Suochen Tech", "categories": ["CAE"]},
    {"id": "supcon", "name_zh": "中控技术", "name_en": "SUPCON", "categories": ["DCS", "MES"]},
    {"id": "hollysys", "name_zh": "和利时", "name_en": "Hollysys", "categories": ["DCS"]},
    {"id": "nari", "name_zh": "南瑞集团", "name_en": "NARI", "categories": ["DCS", "SCADA"]},
    {"id": "baosight", "name_zh": "宝信软件", "name_en": "Baosight", "categories": ["MES", "Platform"]},
    {"id": "yonyou", "name_zh": "用友网络", "name_en": "Yonyou", "categories": ["ERP", "PLM"]},
    {"id": "kingdee", "name_zh": "金蝶国际", "name_en": "Kingdee", "categories": ["ERP"]},
    {"id": "digiwin", "name_zh": "鼎捷软件", "name_en": "Digiwin", "categories": ["ERP", "MES"]},
    {"id": "glodon", "name_zh": "广联达", "name_en": "Glodon", "categories": ["BIM"]},
    {"id": "supermap", "name_zh": "超图软件", "name_en": "SuperMap", "categories": ["GIS"]},
    {"id": "huawei-cloud", "name_zh": "华为云", "name_en": "Huawei Cloud", "categories": ["Platform"]},
    {"id": "synopsys", "name_zh": "新思科技", "name_en": "Synopsys", "categories": ["EDA"]},
    {"id": "cadence", "name_zh": "楷登电子", "name_en": "Cadence", "categories": ["EDA"]},
    {"id": "siemens", "name_zh": "西门子", "name_en": "Siemens", "categories": ["CAD", "CAE", "PLM", "DCS", "MES"]},
    {"id": "dassault", "name_zh": "达索系统", "name_en": "Dassault Systèmes", "categories": ["CAD", "PLM"]},
    {"id": "autodesk", "name_zh": "欧特克", "name_en": "Autodesk", "categories": ["CAD", "BIM"]},
    {"id": "sap", "name_zh": "思爱普", "name_en": "SAP", "categories": ["ERP"]},
]


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "DISA-style curated seed list (manual; not live-scraped)",
        "last_updated": "2026-06",
        "vendors": SEEDS,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(SEEDS)} vendor seeds → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
