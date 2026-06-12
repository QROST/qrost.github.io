#!/usr/bin/env python3
"""Strip vendor/company prefixes from product name_zh and name_en.

Vendor is shown in a separate column via vendors.json; product names should
carry only the product-line brand (same convention as Autodesk → Inventor).
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
CATEGORIES = DATA / "categories"

# Vendor id → extra prefix aliases (short forms, Chinese trade names)
EXTRA_ALIASES: dict[str, list[str]] = {
    "siemens-digital": ["Siemens", "西门子", "西门子数字化工业", "Siemens Digital Industries"],
    "siemens-process": ["Siemens", "西门子", "西门子过程自动化", "Siemens Process Automation"],
    "siemens-eda": ["Siemens", "西门子", "Mentor", "Mentor Graphics"],
    "dassault": ["Dassault", "Dassault Systèmes", "Dassault Systemes", "达索", "达索系统", "3DS"],
    "autodesk": ["Autodesk", "欧特克"],
    "ansys": ["Ansys", "ANSYS", "安世亚太/Ansys", "安世亚太"],
    "ptc": ["PTC"],
    "sap": ["SAP", "思爱普"],
    "oracle": ["Oracle", "甲骨文"],
    "synopsys": ["Synopsys", "新思科技"],
    "cadence": ["Cadence", "楷登电子"],
    "hexagon": ["Hexagon", "海克斯康", "MSC"],
    "altair": ["Altair"],
    "yonyou": ["Yonyou", "用友", "用友网络"],
    "kingdee": ["Kingdee", "金蝶", "金蝶国际", "金蝶云"],
    "glodon": ["Glodon", "广联达"],
    "huawei": ["Huawei", "华为"],
    "empyrean": ["Empyrean", "华大九天"],
    "primarius": ["Primarius", "概伦电子", "概伦"],
    "zwcad": ["ZWSOFT", "中望", "中望软件"],
    "gstarcad": ["Gstarsoft", "GstarCAD", "浩辰", "浩辰软件"],
    "hoteam": ["Hoteam", "华天", "华天软件"],
    "caxa": ["CAXA", "数码大方"],
    "supcon": ["SUPCON", "中控", "中控技术"],
    "hollysys": ["Hollysys", "和利时"],
    "baosight": ["Baosight", "宝信", "宝信软件"],
    "supermap": ["SuperMap", "超图", "超图软件"],
    "emerson": ["Emerson", "艾默生"],
    "honeywell": ["Honeywell", "霍尼韦尔"],
    "rockwell": ["Rockwell", "Rockwell Automation", "罗克韦尔", "罗克韦尔自动化"],
    "schneider": ["Schneider", "Schneider Electric", "施耐德", "施耐德电气"],
    "abb": ["ABB"],
    "yokogawa": ["Yokogawa", "横河", "横河电机"],
    "aveva": ["AVEVA"],
    "ge-vernova": ["GE Vernova", "GE"],
    "ge": ["GE Digital", "GE"],
    "ibm": ["IBM"],
    "microsoft": ["Microsoft", "微软"],
    "infor": ["Infor"],
    "bentley": ["Bentley", "Bentley Systems"],
    "trimble": ["Trimble", "天宝"],
    "esri": ["Esri", "易智瑞", "易智瑞/Esri"],
    "mathworks": ["MathWorks"],
    "wolfram": ["Wolfram Research", "Wolfram"],
    "pera": ["PERA Global", "安世亚太", "PERA"],
    "nemetschek": ["Nemetschek", "Nemetschek Group"],
    "materialise": ["Materialise"],
    "mcneel": ["McNeel"],
    "poisson": ["Poisson Software", "泊松", "泊松软件"],
    "newdim": ["Newdim Digital", "新迪", "新迪数字"],
    "sipm": ["SIPM Software", "思普", "思普软件"],
    "digiwin": ["Digiwin", "鼎捷", "鼎捷软件"],
    "inspur": ["Inspur", "浪潮"],
    "midea": ["Meicloud", "美云智数"],
    "rootcloud": ["Rootcloud", "树根互联"],
    "haier": ["Haier COSMOPlat", "海尔卡奥斯", "COSMOPlat"],
    "casicloud": ["CASIC Cloud", "航天云网"],
    "bonc": ["BONC", "东方国信"],
    "langkun": ["Luculent", "朗坤", "朗坤智慧"],
    "wellintech": ["Wellintech", "北京亚控", "亚控"],
    "semitech": ["Semitech", "赛美特"],
    "suochen": ["Suochen Tech", "索辰", "索辰科技"],
    "shifeng": ["SimRight", "十沣", "十沣科技"],
    "tongyuan": ["Tongyuan", "同元", "同元软控"],
    "bjsasc": ["BJSASC", "神舟航天软件"],
    "luxion": ["Luxion", "Luxion（KeyShot）", "Luxion (KeyShot)"],
    "leica-geosystems": ["Leica Geosystems", "徕卡", "徕卡测量系统"],
    "jingdiao": ["Jingdiao", "JDSoft", "北京精雕", "精雕"],
    "applied-materials": ["Applied Materials", "应用材料"],
    "pdf-solutions": ["PDF Solutions"],
    "avl": ["AVL"],
    "functionbay": ["FunctionBay"],
    "sftc": ["SFTC"],
    "anwise": ["Anwise Technology", "安怀信", "安怀信科技"],
    "open-cascade": ["Open Cascade SAS", "Open Cascade"],
    "techsoft3d": ["Tech Soft 3D"],
    "coretechnologie": ["CoreTechnologie", "CT"],
    "elysium": ["Elysium"],
    "datakit": ["Datakit"],
    "iti-transcendata": ["ITI TranscenData", "ITI"],
    "aws": ["Amazon Web Services", "AWS", "亚马逊云科技"],
    "shapr3d": ["Shapr3D"],
    "cabr": ["China Academy of Building Research", "CABR", "中国建筑科学研究院"],
    "bimcollab": ["BIMcollab", "BIMcollab (Kubus)"],
    "bambu-lab": ["Bambu Lab", "拓竹", "拓竹科技"],
    "creality": ["Creality", "创想三维"],
    "flashforge": ["Flashforge", "闪铸", "闪铸科技"],
    "cbd-tech": ["CBD-Tech", "CBD 科技"],
    "elegoo": ["ELEGOO", "智能派科技"],
    "anycubic": ["Anycubic", "纵维立方"],
    "heygears": ["HeyGears", "黑格", "黑格科技"],
    "ankermake": ["AnkerMake", "安克创新 AnkerMake"],
    "ultimaker": ["UltiMaker"],
    "prusa": ["Prusa Research"],
    "raise3d": ["Raise3D"],
    "mango3d": ["Mango3D"],
    "simplify3d": ["Simplify3D"],
    "gibbs": ["GibbsCAM", "GibbsCAM (3D Systems)"],
    "sprutcam": ["SprutCAM Tech"],
    "ironcad": ["IronCAD"],
    "vectorworks": ["Vectorworks"],
    "ascon": ["ASCON Group", "ASCON 阿斯康", "ASCON"],
    "topsystems": ["Top Systems"],
    "autodessys": ["AutoDesSys"],
    "plex": ["Plex"],
    "morewis": ["Morewis", "摩尔元数"],
    "pcitc": ["PCITC", "石化盈科"],
    "sinopec": ["Sinopec", "中国石化"],
    "nrec": ["NREC", "国电南自"],
    "sciyon": ["SCIYON", "科远", "科远智慧"],
    "sie": ["SIE", "赛意", "赛意信息"],
    "goodsgather": ["GoodsGather", "谷器数据"],
    "ygsoft": ["YGSOFT", "远光", "远光软件"],
    "dcits": ["DCITS", "神州数码"],
    "boke": ["Boke", "博科", "博科软件"],
    "unigroup": ["Unigroup Cloud", "紫光云"],
    "huayun": ["HuaCloud", "华云中盛"],
    "rainfe": ["Rainfe", "瑞风协同"],
    "emqx": ["EMQ Technologies", "映云科技"],
    "haitian": ["Haitian International", "海天国际", "海天"],
    "blacklake": ["BlackLake", "黑湖", "黑湖科技"],
    "nari": ["NARI", "南瑞", "南瑞集团"],
    "bochu": ["Bochu", "柏楚", "柏楚电子"],
    "keysight": ["Keysight"],
    "altium": ["Altium"],
    "silvaco": ["Silvaco"],
    "ceva": ["CEVA"],
    "xpeedic": ["Xpeedic", "芯和半导体"],
    "xchip": ["Phlexing", "行芯科技"],
    "univista": ["UniVista", "合见工软"],
    "quanzhi": ["ALLSemi", "全芯智造"],
    "huafeng": ["Huafeng EDA"],
    "weihong": ["Weihong", "维宏"],
    "huazhong": ["Huazhong CNC"],
    "gsk": ["GSK CNC"],
    "mastercam": ["Mastercam"],
    "openmind": ["OPEN MIND", "Open Mind"],
    "cimatron": ["Cimatron"],
    "jiyuan": ["JiYuan"],
    "tianhe": ["Tianhe"],
    "pengye": ["Pengye"],
    "bricsys": ["Bricsys", "BricsCAD"],
    "luban": ["Luban", "鲁班"],
    "pinming": ["Pinming", "品茗"],
    "graphisoft": ["Graphisoft"],
    "feidu": ["FeiDu", "飞渡"],
    "south": ["South", "南方测绘"],
    "sunway": ["Sunway", "三维天地"],
    "cscec": ["CSCEC", "中建"],
    "mapbox": ["Mapbox"],
    "sysware": ["Sysware", "索为"],
    "avic": ["AVIC", "神舟软件"],
    "aras": ["Aras"],
    "huawang": ["Huawang", "华望"],
    "semitron": ["Semitron", "广立微"],
    "guowei": ["SMIT", "国微芯"],
    "s2c": ["S2C", "思尔芯"],
    "fangxing": ["FangXing", "九同方"],
    "jlc": ["JLC", "立创"],
    "hongxin": ["Hongxin", "鸿芯微纳"],
    "x-epic": ["X-Epic", "芯华章"],
}

# Vendor id where company name IS the product brand — do not strip name_en
VENDOR_IS_BRAND = {
    "comsol", "simplify3d", "ultimaker", "prusa", "raise3d", "mango3d",
    "ironcad", "vectorworks", "shapr3d", "ankermake", "materialise",
    "mcneel", "avl", "functionbay", "sftc", "altium", "aveva", "plex",
    "softfever", "openmodelica", "speckle", "emqx",
}

# Globally unique product brands — vendor prefix may be stripped safely
KEEP_STRIPPED_IDS = {
    "siemens-nx", "catia", "revit", "solidworks", "autocad", "inventor", "alias",
    "autodesk-alias",
    "teamcenter", "windchill", "microstation", "archicad", "creo-parametric",
    "solid-edge", "onshape", "fusion-360", "rhino", "grasshopper", "dynamo",
    "houdini", "marionette", "pyrevit", "featurescript", "geometry-nodes",
    "designscript", "driveworks", "sketchup", "freecad",
    "thingworx", "ptc-vuforia", "ptc-kepware", "kepware", "netuite", "delmia",
    "opcenter", "deltav", "experion", "centum", "kingview", "rootcloud",
    "bambu-studio", "creality-print", "flashprint", "comsol", "meicloud",
}

# Canonical names (keep vendor/company prefix when generic or ambiguous)
MANUAL: dict[str, dict[str, str]] = {
    "zwcad": {"name_zh": "ZWCAD"},
    "gstarcad": {"name_zh": "GstarCAD"},
    "zw3d": {"name_zh": "ZW3D"},
    "hoteam-cad": {"name_zh": "华天三维 CAD", "name_en": "Hoteam CAD"},
    "zwsoft-bim": {"name_zh": "中望 BIM", "name_en": "ZWSOFT BIM"},
    "glodon-bim": {"name_zh": "广联达 BIM 算量", "name_en": "Glodon BIM"},
    "luban-bim": {"name_zh": "鲁班工程管理", "name_en": "Luban BIM"},
    "feidu-dt": {"name_zh": "飞渡数字孪生", "name_en": "Feidu Digital Twin"},
    "southsurvey-gis": {"name_zh": "南方数码 GIS", "name_en": "South Survey GIS"},
    "cscec-digital": {"name_zh": "中建数字建造", "name_en": "CSCEC Digital Construction"},
    "mapbox-cn": {"name_zh": "Mapbox GL", "name_en": "Mapbox GL"},
    "caxa-3d": {"name_zh": "CAXA 3D实体设计", "name_en": "CAXA 3D Solid Design"},
    "weihong-nc": {"name_zh": "维宏数控", "name_en": "Weihong NC"},
    "empyrean-digital": {"name_zh": "华大九天数字后端", "name_en": "Empyrean Digital Implementation"},
    "primarius-device": {"name_zh": "概伦器件建模", "name_en": "Primarius Device Modeling"},
    "primarius-extraction": {"name_zh": "概伦 RC提取", "name_en": "Primarius RC Extraction"},
    "x-epic-verification": {"name_zh": "芯华章验证平台", "name_en": "X-Epic Verification"},
    "s2c-prototyping": {"name_zh": "思尔芯原型验证", "name_en": "S2C Prototyping"},
    "fangxing-simulation": {"name_zh": "九同方电磁仿真", "name_en": "FangXing EM Simulation"},
    "hongxin-eda": {"name_zh": "鸿芯微纳布局布线", "name_en": "Hongxin Nano Place & Route"},
    "quanzhi-fab-software": {"name_zh": "全芯智造制造分析", "name_en": "ALLSemi Fab Analytics"},
    "applied-e3": {"name_zh": "Applied E3", "name_en": "Applied Materials E3"},
    "mentor-pads": {"name_zh": "Siemens PADS", "name_en": "Siemens PADS"},
    "pera-sim": {"name_zh": "PERA SIM", "name_en": "PERA SIM"},
    "comsol": {"name_zh": "COMSOL Multiphysics", "name_en": "COMSOL Multiphysics"},
    "rootcloud": {"name_zh": "根云", "name_en": "RootCloud"},
    "sipm-plm": {"name_zh": "SIPM/PLM"},
    "kingdee-cosmic": {"name_zh": "金蝶云·苍穹", "name_en": "Kingdee Cosmic"},
    "kingdee-plm": {"name_zh": "金蝶 PLM", "name_en": "Kingdee PLM"},
    "yonyou-bip": {"name_zh": "用友 BIP", "name_en": "Yonyou BIP"},
    "avic-plm": {"name_zh": "AVIDM"},
    "casicloud-indics": {"name_zh": "INDICS", "name_en": "INDICS"},
    "yonyou-iip": {"name_zh": "精智工业互联网", "name_en": "Industrial Internet"},
    "blacklake-mes": {"name_zh": "黑湖智造 MES", "name_en": "BlackLake MES"},
    "trimble-connect": {"name_zh": "Trimble Connect", "name_en": "Trimble Connect"},
    "goodsgather-mes": {"name_zh": "谷器 MES", "name_en": "GoodsGather MES"},
    "hoteam-plm": {"name_zh": "华天 PLM", "name_en": "Hoteam PLM"},
    "hollysys-dcs": {"name_zh": "和利时 DCS", "name_en": "Hollysys DCS"},
    "sciyon-dcs": {"name_zh": "科远 DCS", "name_en": "SCIYON DCS"},
    "nari-dcs": {"name_zh": "南瑞 DCS/电网自动化", "name_en": "NARI Power Automation"},
    "supcon-supos": {"name_zh": "中控 SUPOS", "name_en": "SUPCON SUPOS"},
    "baosight-mes": {"name_zh": "宝信 MES", "name_en": "Baosight MES"},
    "boke-erp": {"name_zh": "博科 ERP", "name_en": "Boke ERP"},
    "ygsoft-erp": {"name_zh": "远光 ERP", "name_en": "YGSOFT ERP"},
    "dcits-erp": {"name_zh": "神州数码 ERP", "name_en": "DCITS ERP"},
    "alibaba-industrial-brain": {"name_zh": "阿里云工业大脑", "name_en": "Alibaba Industrial Brain"},
    "baidu-industrial": {"name_zh": "百度智能云工业", "name_en": "Baidu AI Cloud Industrial"},
    "unigroup-cloud": {"name_zh": "紫光云工业", "name_en": "Unigroup Industrial Cloud"},
    "sap-btp": {"name_en": "SAP BTP"},
    "newdim-tiangong-cad": {"name_en": "Tiangong CAD"},
    "poisson-geoshape-cad": {"name_en": "Geoshape 3D CAD"},
    "suochen-abyss": {"name_en": "Abyss"},
    "anwise-simvver": {"name_en": "Sim V&Ver"},
    "shifeng-simulation": {"name_zh": "SimRight", "name_en": "CAE Cloud"},
    "thingworx": {"name_zh": "ThingWorx", "name_en": "ThingWorx"},
    "ptc-vuforia": {"name_zh": "Vuforia", "name_en": "Vuforia"},
    "ptc-kepware": {"name_zh": "Kepware", "name_en": "Kepware"},
    "meicloud": {"name_zh": "美云智数", "name_en": "Meicloud"},
    "bambu-studio": {"name_zh": "Bambu Studio"},
    "creality-print": {"name_zh": "Creality Print"},
    "flashprint": {"name_zh": "FlashPrint"},
    "anycubic-photon-workshop": {"name_zh": "Photon Workshop", "name_en": "Photon Workshop"},
    "heygears-hps": {"name_zh": "HPS 切片", "name_en": "HPS Slicing"},
}

TOO_GENERIC = {
    "CAD", "CAM", "CAE", "PLM", "ERP", "MES", "DCS", "BIM", "BIP", "GIS", "SCADA",
    "HMI", "MOM", "APS", "EDA", "EAM", "IIOT", "CLOUD", "BTP", "SIM", "CONNECT",
    "STUDIO", "PRINT", "PLATFORM", "DIGITAL", "MANUFACTURING", "AUTOMATION", "GL",
    "NC", "PADS", "INDUSTRIAL", "COSMIC", "VERIFICATION", "PROTOTYPING",
}

GENERIC_ZH_PHRASES = (
    "三维 CAD", "3D实体设计", "数字建造", "工程管理", "器件建模", "数字后端",
    "验证平台", "原型验证", "电磁仿真", "布局布线", "制造分析", "RC提取",
    "数控", "工业", "智造 MES", "云·苍穹", "科技数字孪生", "BIM 算量",
)


def load_vendors() -> dict[str, dict]:
    data = json.loads((DATA / "vendors.json").read_text(encoding="utf-8"))
    return {v["id"]: v for v in data["vendors"]}


def build_prefixes(vendor_id: str, vendor: dict | None) -> list[str]:
    prefixes: set[str] = set()
    if vendor:
        for key in ("name_zh", "name_en"):
            val = vendor.get(key, "")
            if not val:
                continue
            prefixes.add(val.strip())
            for part in re.split(r"[/（(]", val):
                part = part.strip().rstrip("）)")
                if part and len(part) >= 2:
                    prefixes.add(part)
    for alias in EXTRA_ALIASES.get(vendor_id, []):
        prefixes.add(alias)
    return sorted(prefixes, key=len, reverse=True)


def is_meaningful(name: str) -> bool:
    """Return True if stripped name is distinctive enough to stand alone."""
    if not name or not name.strip():
        return False
    s = name.strip()
    if len(s) <= 1:
        return False
    if s.upper() in TOO_GENERIC:
        return False
    if s in GENERIC_ZH_PHRASES:
        return False
    # Short zh without Latin brand identity
    if re.search(r"[\u4e00-\u9fff]", s) and len(s) <= 4:
        if not re.search(r"[A-Za-z0-9]{2,}", s):
            return False
    return True


def strip_prefix(name: str, prefixes: list[str], lang: str) -> tuple[str, bool]:
    if not name:
        return name, False
    original = name
    flags = re.IGNORECASE if lang == "en" else 0
    for prefix in prefixes:
        if not prefix or len(prefix) < 2:
            continue
        patterns = [
            re.compile(r"^" + re.escape(prefix) + r"[\s·\-–—/|:：]+", flags),
            re.compile(r"^" + re.escape(prefix) + r"(?=[\u4e00-\u9fffA-Z0-9（(])"),
            re.compile(r"^" + re.escape(prefix) + r"\s+", flags),
        ]
        for pat in patterns:
            candidate = pat.sub("", original).strip()
            if candidate != original and is_meaningful(candidate):
                return candidate, True
    return original, False


def latin_brand_from_en(name_en: str, prefixes: list[str]) -> str | None:
    stripped, ok = strip_prefix(name_en, prefixes, "en")
    if ok and is_meaningful(stripped):
        return stripped
    return None


def process_product(product: dict, vendor_map: dict) -> dict | None:
    pid = product["id"]
    if pid in KEEP_STRIPPED_IDS:
        return None
    if pid in MANUAL:
        overrides = MANUAL[pid]
        changed = {}
        for field in ("name_zh", "name_en"):
            if field in overrides and product.get(field) != overrides[field]:
                changed[field] = (product.get(field), overrides[field])
                product[field] = overrides[field]
        return changed if changed else None

    vid = product.get("vendor_id", "")
    vendor = vendor_map.get(vid)
    prefixes = build_prefixes(vid, vendor)

    old_zh = product.get("name_zh", "")
    old_en = product.get("name_en", "")
    new_zh, ch_zh = strip_prefix(old_zh, prefixes, "zh")
    new_en, ch_en = (old_en, False) if vid in VENDOR_IS_BRAND else strip_prefix(old_en, prefixes, "en")

    # If zh strip yields generic/empty, borrow Latin product brand from en
    if ch_zh and not is_meaningful(new_zh):
        ch_zh = False
        new_zh = old_zh
    if not ch_zh and old_zh:
        brand = latin_brand_from_en(old_en, prefixes)
        if brand and brand != old_zh:
            new_zh, ch_zh = brand, True
        elif m := re.search(r"[（(]([A-Za-z0-9][A-Za-z0-9 .&/-]+)[）)]", old_zh):
            new_zh, ch_zh = m.group(1).strip(), True

    if ch_zh:
        product["name_zh"] = new_zh
    if ch_en:
        product["name_en"] = new_en

    if ch_zh or ch_en:
        return {
            "name_zh": (old_zh, new_zh) if ch_zh else None,
            "name_en": (old_en, new_en) if ch_en else None,
        }
    return None


def sync_kernels(product_names: dict[str, tuple[str, str]]) -> int:
    """Update kernels.json used_by_* strings when they match old prefixed names."""
    path = DATA / "kernels.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    old_to_new: dict[str, str] = {}
    for _pid, (zh, en) in product_names.items():
        pass
    # Build reverse map from any old name fragment
    name_map: dict[str, str] = {}
    for cat_file in CATEGORIES.glob("*.json"):
        cat = json.loads(cat_file.read_text(encoding="utf-8"))
        for p in cat["products"]:
            pass

    updated = 0
    # Re-scan: collect all products before/after from changelog
    kernels_path = path
    kernels = json.loads(kernels_path.read_text(encoding="utf-8"))
    # Build from changelog passed in
    return updated


def main() -> int:
    vendor_map = load_vendors()
    changelog: list[dict] = []
    vendor_counts: Counter = Counter()
    old_names: dict[str, dict[str, str]] = {}

    for cat_file in sorted(CATEGORIES.glob("*.json")):
        data = json.loads(cat_file.read_text(encoding="utf-8"))
        file_changed = False
        for product in data.get("products", []):
            pid = product["id"]
            before = (product.get("name_zh"), product.get("name_en"))
            result = process_product(product, vendor_map)
            if result:
                file_changed = True
                vendor_counts[product.get("vendor_id", "?")] += 1
                entry = {"id": pid, "vendor_id": product.get("vendor_id"), "file": cat_file.name}
                if result.get("name_zh"):
                    entry["name_zh"] = f"{result['name_zh'][0]} → {result['name_zh'][1]}"
                if result.get("name_en"):
                    entry["name_en"] = f"{result['name_en'][0]} → {result['name_en'][1]}"
                changelog.append(entry)
                old_names[pid] = {"zh": before[0], "en": before[1],
                                  "new_zh": product.get("name_zh"), "new_en": product.get("name_en")}
        if file_changed:
            cat_file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Sync kernels.json
    kernels_path = DATA / "kernels.json"
    kernels_data = json.loads(kernels_path.read_text(encoding="utf-8"))
    kernel_updates = 0
    for kernel in kernels_data.get("kernels", []):
        for field in ("used_by_international", "used_by_domestic", "chinese_products_using"):
            arr = kernel.get(field, [])
            if not isinstance(arr, list):
                continue
            new_arr = []
            for item in arr:
                if isinstance(item, str):
                    replaced = item
                    for info in old_names.values():
                        for old_key in ("zh", "en"):
                            old = info.get(old_key, "")
                            new = info.get(f"new_{old_key.replace('zh','zh').replace('en','en')}", "")
                            # map old zh/en to new
                        if item == info.get("zh"):
                            replaced = info.get("new_zh", item)
                            kernel_updates += 1
                        elif item == info.get("en"):
                            replaced = info.get("new_en", item)
                            kernel_updates += 1
                    new_arr.append(replaced)
                else:
                    new_arr.append(item)
            kernel[field] = new_arr

    if kernel_updates:
        kernels_path.write_text(json.dumps(kernels_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    summary = {
        "total_updated": len(changelog),
        "by_vendor": dict(vendor_counts.most_common()),
        "changes": changelog,
        "kernel_string_updates": kernel_updates,
    }
    out = ROOT / "tmp" / "research" / "vendor-prefix-cleanup-summary.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Updated {len(changelog)} products across {len(vendor_counts)} vendors")
    print(f"Kernel string updates: {kernel_updates}")
    for vid, cnt in vendor_counts.most_common(15):
        vname = vendor_map.get(vid, {}).get("name_en", vid)
        print(f"  {vid} ({vname}): {cnt}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
