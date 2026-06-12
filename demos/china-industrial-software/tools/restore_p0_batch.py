#!/usr/bin/env python3
"""One-shot restore of P0 catalog batch (2026-06-12 regression). Idempotent by product id."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAT = ROOT / "assets" / "data" / "categories"

P0: dict[str, list[dict]] = {
    "cad": [
        {
            "id": "autodesk-alias",
            "name_zh": "Alias",
            "name_en": "Alias",
            "vendor_id": "autodesk",
            "category_l1": "研发设计",
            "category_l2": "CAD",
            "product_type": "other",
            "origin": "international",
            "kernel": "自主·Alias NURBS/Bézier CAID 内核",
            "maturity": "mission_critical",
            "localization_depth": "core",
            "strengths_zh": [
                "汽车 CAS→Class-A 一体化 CAID 事实标准",
                "SUBD + NURBS + Dynamo 参数化同平台",
                "与 VRED 深度互联，中国上汽/东风/江淮等 OEM 公开案例",
            ],
            "strengths_en": [
                "De-facto automotive CAID from CAS to Class-A",
                "Integrated SUBD, NURBS, and Dynamo parametrics",
                "Deep VRED link; public China OEM cases (SAIC, Dongfeng, JAC)",
            ],
            "limitations_zh": [
                "非机械参数化 MCAD，工程特征树/PMI 弱",
                "许可成本极高，无国产直接对标",
                "Mac 版已停更",
            ],
            "limitations_en": [
                "Not parametric MCAD; weak feature tree and PMI",
                "Very high license cost; no direct domestic equivalent",
                "Mac version discontinued",
            ],
            "industries": ["汽车", "工业设计", "船舶", "消费电子"],
            "pricing": "high",
            "tags": ["automotive"],
            "confidence": 0.93,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://www.autodesk.com/products/alias-products/overview",
                    "title": "Autodesk Alias",
                    "accessed": "2026-06",
                },
                {
                    "url": "https://www.autodesk.com.cn/customer-stories/saic",
                    "title": "Autodesk SAIC case study",
                    "accessed": "2026-06",
                },
                {
                    "url": "https://www.autodesk.com.cn/customer-stories/dongfeng-motor",
                    "title": "Autodesk Dongfeng case study",
                    "accessed": "2026-06",
                },
            ],
            "international_benchmarks": ["icem-surf", "rhino"],
            "listed_ticker": "ADSK",
        },
        {
            "id": "icem-surf",
            "name_zh": "CATIA ICEM Surf",
            "name_en": "CATIA ICEM Surf",
            "vendor_id": "dassault",
            "category_l1": "研发设计",
            "category_l2": "CAD",
            "product_type": "other",
            "origin": "international",
            "kernel": "ICEM 显式 A 级曲面（CATIA 生态）",
            "kernel_id": "catia-cgm",
            "maturity": "mission_critical",
            "localization_depth": "partial",
            "strengths_zh": [
                "30+ 年 A 级曲面行业标杆",
                "显式直接编辑与扫描重建",
                "汽车外板高品质曲面与法规分析工具",
            ],
            "strengths_en": [
                "30+ years Class-A surfacing benchmark",
                "Explicit direct edit and scan reconstruction",
                "High-quality auto body surfaces and compliance tools",
            ],
            "limitations_zh": [
                "与 IDX/ISD 产品线重叠，许可复杂",
                "学习曲线陡，国内培训生态小于 Alias",
            ],
            "limitations_en": [
                "Overlapping IDX/ISD portfolio and licensing",
                "Steep learning curve; smaller China training pool than Alias",
            ],
            "industries": ["汽车", "航空航天", "消费电子"],
            "pricing": "high",
            "tags": ["automotive", "aerospace"],
            "confidence": 0.91,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://www.3ds.com/products/catia/icem-surf",
                    "title": "ICEM Surf",
                    "accessed": "2026-06",
                },
                {
                    "url": "https://www.3ds.com/zh-hans/products/catia/icem-surf",
                    "title": "ICEM Surf 中文",
                    "accessed": "2026-06",
                },
            ],
            "international_benchmarks": ["autodesk-alias", "catia"],
        },
        {
            "id": "crown-styling",
            "name_zh": "皇冠 CrownStyling 工业造型",
            "name_en": "CrownStyling",
            "vendor_id": "hoteam",
            "category_l1": "研发设计",
            "category_l2": "CAD",
            "product_type": "other",
            "origin": "domestic",
            "kernel": "CrownCAD DGM + 造型曲面算法",
            "kernel_id": "crowncad-dgm",
            "maturity": "experimental",
            "localization_depth": "pilot",
            "strengths_zh": [
                "国产云原生工业造型软件（2026 发布）",
                "NURBS/SubD/逆向/曲面质量分析/渲染一体",
                "与 CrownCAD、SView 浏览编辑协同",
            ],
            "strengths_en": [
                "Domestic cloud-native industrial styling (2026 launch)",
                "Integrated NURBS/SubD/RE/quality analysis/rendering",
                "Synergy with CrownCAD and SView",
            ],
            "limitations_zh": [
                "OEM 量产公开案例仍少",
                "A 级曲面工程交接与 Alias/ICEM 差距待验证",
            ],
            "limitations_en": [
                "Few public OEM production case studies",
                "Class-A engineering handoff vs Alias/ICEM unproven",
            ],
            "industries": ["汽车", "工业设计", "消费电子"],
            "pricing": "mid",
            "tags": ["automotive", "cloud_native", "xinchuang"],
            "confidence": 0.78,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://m.chinaz.com/2026/0429/1749656.shtml",
                    "title": "CrownStyling launch",
                    "accessed": "2026-06",
                },
                {
                    "url": "https://www.hoteamsoft.com/yuncad",
                    "title": "CrownCAD",
                    "accessed": "2026-06",
                },
            ],
            "international_benchmarks": ["autodesk-alias", "rhino"],
        },
        {
            "id": "autodesk-vred",
            "name_zh": "Autodesk VRED",
            "name_en": "Autodesk VRED",
            "vendor_id": "autodesk",
            "category_l1": "研发设计",
            "category_l2": "CAD",
            "product_type": "other",
            "origin": "international",
            "kernel": "GPU 光线追踪可视化引擎",
            "maturity": "high",
            "localization_depth": "partial",
            "strengths_zh": [
                "汽车数字样机/VR 评审标杆",
                "与 Alias 实时曲面联动（2026）",
                "上汽/华人运通等中国 OEM 案例",
            ],
            "strengths_en": [
                "Automotive digital prototype and VR review benchmark",
                "Live Alias surface link (2026)",
                "China OEM cases (SAIC, Human Horizons)",
            ],
            "limitations_zh": [
                "非曲面创作工具，依赖上游 CAID/CAD",
                "高端 GPU 与许可成本",
            ],
            "limitations_en": [
                "Not a surfacing authoring tool; depends on upstream CAID",
                "High-end GPU and license cost",
            ],
            "industries": ["汽车", "工业设计"],
            "pricing": "high",
            "tags": ["automotive"],
            "confidence": 0.90,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://www.autodesk.com.cn/products/vred/overview",
                    "title": "VRED 中国",
                    "accessed": "2026-06",
                },
                {
                    "url": "https://www.autodesk.com.cn/customer-stories/humanhorizons",
                    "title": "HiPhi Z case",
                    "accessed": "2026-06",
                },
            ],
            "international_benchmarks": ["autodesk-alias", "keyshot"],
        },
        {
            "id": "keyshot",
            "name_zh": "KeyShot",
            "name_en": "KeyShot",
            "vendor_id": "luxion",
            "category_l1": "研发设计",
            "category_l2": "CAD",
            "product_type": "other",
            "origin": "international",
            "kernel": "自主·实时渲染",
            "maturity": "high",
            "localization_depth": "partial",
            "strengths_zh": [
                "工业产品实时渲染",
                "SolidWorks/Rhino 插件生态",
                "CMF 评审效率高",
            ],
            "strengths_en": [
                "Real-time industrial product rendering",
                "SolidWorks/Rhino plugin ecosystem",
                "Fast CMF design review",
            ],
            "limitations_zh": [
                "非 CAD 建模工具",
                "云协作弱于新兴平台",
            ],
            "limitations_en": [
                "Not a CAD modeler",
                "Weaker cloud collab vs newer platforms",
            ],
            "industries": ["消费电子", "家电", "汽车造型"],
            "pricing": "mid",
            "confidence": 0.9,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://www.keyshot.com/",
                    "title": "KeyShot",
                    "accessed": "2026-06",
                }
            ],
            "international_benchmarks": ["autodesk-vred"],
        },
        {
            "id": "geomagic-design-x",
            "name_zh": "Geomagic Design X",
            "name_en": "Geomagic Design X",
            "vendor_id": "hexagon",
            "category_l1": "研发设计",
            "category_l2": "CAD",
            "product_type": "cad_interop",
            "origin": "international",
            "kernel": "扫描网格→参数化 CAD 混合内核",
            "maturity": "high",
            "localization_depth": "partial",
            "strengths_zh": [
                "行业领先扫描逆向工程",
                "引导式 NURBS 曲面与 Auto-Surface",
                "LiveTransfer 至主流 CAD",
            ],
            "strengths_en": [
                "Industry-leading scan reverse engineering",
                "Guided NURBS and Auto-Surface",
                "LiveTransfer to major CAD systems",
            ],
            "limitations_zh": [
                "Class-A 需大量手工修面",
                "许可分层（Go/Plus/Pro）功能切割",
            ],
            "limitations_en": [
                "Class-A needs extensive manual surfacing",
                "Tiered licensing splits features",
            ],
            "industries": ["汽车", "航空航天", "模具"],
            "pricing": "high",
            "tags": ["automotive"],
            "confidence": 0.89,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://hexagon.com/products/geomagic-design-x",
                    "title": "Geomagic Design X",
                    "accessed": "2026-06",
                }
            ],
            "international_benchmarks": ["autodesk-powershape", "icem-surf"],
        },
    ],
    "cae": [
        {
            "id": "jdsoft-surfmill",
            "name_zh": "精雕 SurfMill",
            "name_en": "JDSoft SurfMill",
            "vendor_id": "jingdiao",
            "category_l1": "生产制造",
            "category_l2": "CAM",
            "product_type": "cam",
            "origin": "domestic",
            "kernel": "自主",
            "maturity": "mission_critical",
            "localization_depth": "core",
            "strengths_zh": [
                "模具/电极五轴编程国产龙头",
                "与精雕数控机床深度绑定",
                "华南模具产业带高渗透",
            ],
            "strengths_en": [
                "Domestic mold/electrode 5-axis CAM leader",
                "Tight Jingdiao machine integration",
                "High penetration in South China mold belt",
            ],
            "limitations_zh": [
                "通用铣削品牌认知低于 Mastercam",
                "国际市场拓展有限",
            ],
            "limitations_en": [
                "Lower general milling mindshare vs Mastercam",
                "Limited international export",
            ],
            "industries": ["模具", "精密加工", "电子结构件"],
            "pricing": "mid",
            "confidence": 0.9,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://www.jingdiao.com/",
                    "title": "北京精雕",
                    "accessed": "2026-06",
                }
            ],
            "international_benchmarks": ["powermill", "hypermill"],
        },
        {
            "id": "autodesk-moldflow",
            "name_zh": "Autodesk Moldflow",
            "name_en": "Autodesk Moldflow",
            "vendor_id": "autodesk",
            "category_l1": "研发设计",
            "category_l2": "CAE",
            "product_type": "cae_solver",
            "origin": "international",
            "kernel": "自主·注塑模流",
            "maturity": "mission_critical",
            "localization_depth": "core",
            "strengths_zh": [
                "注塑模流分析行业标准",
                "与 PowerShape/PowerMill 制造链衔接",
                "华东注塑模具产业必备",
            ],
            "strengths_en": [
                "Injection moldflow analysis industry standard",
                "PowerShape/PowerMill manufacturing chain",
                "Essential in East China mold belt",
            ],
            "limitations_zh": [
                "许可成本高",
                "国产模流软件在材料模型上仍在追赶",
            ],
            "limitations_en": [
                "High license cost",
                "Domestic moldflow catching up on material models",
            ],
            "industries": ["模具", "汽车", "消费电子"],
            "pricing": "high",
            "tags": ["automotive"],
            "confidence": 0.91,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://www.autodesk.com/products/moldflow/overview",
                    "title": "Autodesk Moldflow",
                    "accessed": "2026-06",
                }
            ],
            "international_benchmarks": ["jiyuan-simulation"],
        },
        {
            "id": "ansys-ls-dyna",
            "name_zh": "Ansys LS-DYNA",
            "name_en": "Ansys LS-DYNA",
            "vendor_id": "ansys",
            "category_l1": "研发设计",
            "category_l2": "CAE",
            "product_type": "cae_solver",
            "origin": "international",
            "kernel": "自主",
            "maturity": "mission_critical",
            "localization_depth": "core",
            "strengths_zh": [
                "汽车碰撞显式动力学行业标准",
                "安全法规验证与材料失效",
                "主机厂碰撞部门必备",
            ],
            "strengths_en": [
                "Automotive crash explicit dynamics standard",
                "Safety regulation and material failure",
                "OEM crash department staple",
            ],
            "limitations_zh": [
                "求解器许可昂贵",
                "国产显式求解仍在追赶",
            ],
            "limitations_en": [
                "Expensive solver licensing",
                "Domestic explicit solvers still catching up",
            ],
            "industries": ["汽车", "航空航天", "国防"],
            "pricing": "high",
            "confidence": 0.93,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://www.ansys.com/products/structures/ansys-ls-dyna",
                    "title": "Ansys LS-DYNA",
                    "accessed": "2026-06",
                }
            ],
            "international_benchmarks": ["altair-radioss", "abaqus"],
        },
        {
            "id": "altair-hypermesh",
            "name_zh": "Altair HyperMesh",
            "name_en": "Altair HyperMesh",
            "vendor_id": "altair",
            "category_l1": "研发设计",
            "category_l2": "CAE",
            "product_type": "cae_solver",
            "origin": "international",
            "kernel": "自主",
            "maturity": "mission_critical",
            "localization_depth": "core",
            "strengths_zh": [
                "汽车/航空网格前处理事实标准",
                "与 OptiStruct/Radioss 一体",
                "批处理与模板化强",
            ],
            "strengths_en": [
                "Auto/aero meshing de-facto standard",
                "Integrated with OptiStruct/Radioss",
                "Strong batch templating",
            ],
            "limitations_zh": [
                "独立前处理许可成本",
                "云原生弱于新一代 CAE",
            ],
            "limitations_en": [
                "Standalone prep license cost",
                "Weaker cloud-native vs new CAE",
            ],
            "industries": ["汽车", "航空航天", "重工"],
            "pricing": "high",
            "confidence": 0.91,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://altair.com/hypermesh",
                    "title": "Altair HyperMesh",
                    "accessed": "2026-06",
                }
            ],
            "international_benchmarks": ["ansys-mechanical", "altair-optistruct"],
        },
    ],
    "plm": [
        {
            "id": "hoteam-sview",
            "name_zh": "华天 SView",
            "name_en": "Hoteam SView",
            "vendor_id": "hoteam",
            "category_l1": "研发设计",
            "category_l2": "PLM",
            "product_type": "plm",
            "origin": "domestic",
            "kernel": "自主·轻量化",
            "maturity": "high",
            "localization_depth": "partial",
            "strengths_zh": [
                "3D 轻量化协同评审",
                "与 CrownCAD/华天 PLM 一体",
                "IPO 辅导中生态扩张",
            ],
            "strengths_en": [
                "Lightweight 3D collaboration",
                "CrownCAD/Hoteam PLM synergy",
                "Ecosystem expansion pre-IPO",
            ],
            "limitations_zh": [
                "高端 CAD 编辑弱于国际 PLM+CAD",
                "大模型性能仍在优化",
            ],
            "limitations_en": [
                "Weaker CAD editing vs intl PLM+CAD",
                "Large model perf still tuning",
            ],
            "industries": ["机械", "装备", "汽车"],
            "pricing": "mid",
            "confidence": 0.86,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://www.sview3d.com/",
                    "title": "SView",
                    "accessed": "2026-06",
                }
            ],
            "international_benchmarks": ["teamcenter", "autodesk-vault"],
        }
    ],
    "bim-gis": [
        {
            "id": "glodon-bimface",
            "name_zh": "BIMFACE",
            "name_en": "BIMFACE",
            "vendor_id": "glodon",
            "category_l1": "研发设计",
            "category_l2": "BIM",
            "product_type": "bim_coordination",
            "origin": "domestic",
            "kernel": "自主·轻量化引擎",
            "maturity": "high",
            "localization_depth": "partial",
            "strengths_zh": [
                "国产 BIM 轻量化协同与模型集成",
                "Web API 与碰撞检测能力",
                "2 亿+三角面片级大模型浏览",
            ],
            "strengths_en": [
                "Domestic BIM lightweight collaboration and federation",
                "Web API and clash detection",
                "200M+ triangle large-model viewing",
            ],
            "limitations_zh": [
                "桌面联邦工作流弱于 Navisworks",
                "国际 EPC 标准仍以 Autodesk 云 CDE 为主",
            ],
            "limitations_en": [
                "Weaker desktop federation vs Navisworks",
                "International EPC still favors Autodesk cloud CDE",
            ],
            "industries": ["建筑", "基建", "施工"],
            "pricing": "mid",
            "tags": ["federated_bim", "clash_detection", "cloud_native"],
            "confidence": 0.88,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://bimface.com/",
                    "title": "Glodon BIMFACE",
                    "accessed": "2026-06",
                }
            ],
            "international_benchmarks": ["autodesk-navisworks", "autodesk-acc"],
            "listed_ticker": "002410.SZ",
        },
        {
            "id": "autodesk-navisworks",
            "name_zh": "Navisworks",
            "name_en": "Navisworks",
            "vendor_id": "autodesk",
            "category_l1": "研发设计",
            "category_l2": "BIM",
            "product_type": "bim_coordination",
            "origin": "international",
            "kernel": "自主·NWD/NWC 联邦",
            "maturity": "mission_critical",
            "localization_depth": "core",
            "strengths_zh": [
                "多专业 BIM 联邦与碰撞检测事实标准",
                "NWD/NWC 交付与 4D 模拟",
                "大型基建/EPC 在华项目标配",
            ],
            "strengths_en": [
                "De-facto multi-discipline BIM federation and clash",
                "NWD/NWC delivery and 4D simulation",
                "Staple for mega-projects and EPC in China",
            ],
            "limitations_zh": [
                "云协同弱于 ACC/BIMFACE",
                "订阅与数据驻留成本",
            ],
            "limitations_en": [
                "Weaker cloud collab vs ACC/BIMFACE",
                "Subscription and data residency cost",
            ],
            "industries": ["建筑", "基建", "能源"],
            "pricing": "high",
            "tags": ["clash_detection", "federated_bim", "4d_simulation"],
            "confidence": 0.92,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://www.autodesk.com/products/navisworks",
                    "title": "Autodesk Navisworks",
                    "accessed": "2026-06",
                }
            ],
            "international_benchmarks": ["glodon-bimface", "solibri-model-checker"],
        },
        {
            "id": "bentley-itwin",
            "name_zh": "Bentley iTwin Platform",
            "name_en": "Bentley iTwin Platform",
            "vendor_id": "bentley",
            "category_l1": "研发设计",
            "category_l2": "BIM",
            "product_type": "bim_coordination",
            "origin": "international",
            "kernel": "iModel·联邦",
            "maturity": "high",
            "localization_depth": "partial",
            "strengths_zh": [
                "基建数字孪生联邦",
                "与 MicroStation/SYNCHRO 数据链",
                "大型交通能源项目在华应用",
            ],
            "strengths_en": [
                "Infrastructure digital twin federation",
                "MicroStation/SYNCHRO data chain",
                "Large transport/energy projects in China",
            ],
            "limitations_zh": [
                "实施复杂度高",
                "房建渗透低于 Autodesk 云 CDE",
            ],
            "limitations_en": [
                "Complex implementation",
                "Lower building penetration vs Autodesk cloud CDE",
            ],
            "industries": ["交通", "能源", "市政基建"],
            "pricing": "high",
            "tags": ["federated_bim", "digital_twin"],
            "confidence": 0.88,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://www.bentley.com/software/itwin-platform/",
                    "title": "Bentley iTwin",
                    "accessed": "2026-06",
                }
            ],
            "international_benchmarks": ["glodon-bimface", "autodesk-navisworks"],
        },
        {
            "id": "autodesk-acc",
            "name_zh": "Autodesk Construction Cloud",
            "name_en": "Autodesk Construction Cloud",
            "vendor_id": "autodesk",
            "category_l1": "研发设计",
            "category_l2": "BIM",
            "product_type": "bim_coordination",
            "origin": "international",
            "kernel": "云原生·CDE",
            "maturity": "high",
            "localization_depth": "partial",
            "strengths_zh": [
                "云通用数据环境（CDE）与模型协同",
                "外资 EPC 在华项目交付标准",
                "与 Revit/Navisworks 数据链一体",
            ],
            "strengths_en": [
                "Cloud CDE and model coordination",
                "Foreign EPC delivery standard in China",
                "Integrated Revit/Navisworks data chain",
            ],
            "limitations_zh": [
                "国内数据驻留与访问需评估",
                "国产化替代政策压力",
            ],
            "limitations_en": [
                "China data residency and access need review",
                "Localization substitution pressure",
            ],
            "industries": ["建筑", "基建", "施工"],
            "pricing": "high",
            "tags": ["cloud_native", "federated_bim"],
            "confidence": 0.89,
            "last_verified": "2026-06",
            "sources": [
                {
                    "url": "https://construction.autodesk.com/",
                    "title": "Autodesk Construction Cloud",
                    "accessed": "2026-06",
                }
            ],
            "international_benchmarks": ["glodon-bimface", "bentley-itwin"],
        },
    ],
}

NAME_FIXES: dict[str, dict[str, str]] = {
    "revit": {"name_zh": "Revit", "name_en": "Revit"},
    "inventor": {"name_zh": "Inventor", "name_en": "Inventor"},
}


def merge_category(cat_key: str, additions: list[dict]) -> int:
    path = CAT / f"{cat_key}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    products: list[dict] = data["products"]
    by_id = {p["id"]: p for p in products}
    added = 0
    for p in additions:
        if p["id"] not in by_id:
            products.append(p)
            by_id[p["id"]] = p
            added += 1
    for pid, names in NAME_FIXES.items():
        if pid in by_id:
            by_id[pid].update(names)
    path.write_text(
        json.dumps({"category": cat_key, "products": products}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return added


def main() -> None:
    total_added = 0
    for cat_key, batch in P0.items():
        n = merge_category(cat_key, batch)
        print(f"  {cat_key}.json: +{n} products")
        total_added += n
    print(f"restore_p0_batch: {total_added} new products inserted")


if __name__ == "__main__":
    main()
