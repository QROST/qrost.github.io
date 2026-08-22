#!/usr/bin/env python3
"""Categorical public identity for all V1 orgs. No invented sales/headcount."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "data" / "org-enrichment.json"

SOE = dict(ownership="soe")
PRIV = dict(ownership="private")
FOR = dict(ownership="foreign")
JV = dict(ownership="jv")
PUB = dict(ownership="public", segment=["education"])


def en(**kw):
    row = dict(last_verified="2026-08")
    row.update(kw)
    return row


def L(listed, exchange=None, ticker=None):
    d = {"listed": listed, "exchange": exchange or "none", "ticker": ticker}
    if not listed:
        d["exchange"] = "none"
        d["ticker"] = None
    return d


BASE = {
    "baic": en(**SOE, segment=["mass", "commercial"], powertrain=["ice", "bev", "phev"], export_role="some"),
    "beijing-benz": en(**JV, segment=["premium", "luxury"], powertrain=["ice", "phev", "bev"], export_role="some"),
    "xiaomi-auto": en(**PRIV, listing=L(True, "HKEX", "1810"), segment=["mass", "premium"], powertrain=["bev"], export_role="none"),
    "li-auto": en(**PRIV, listing=L(True, "NASDAQ", "LI"), segment=["premium"], powertrain=["reev", "bev"], export_role="none"),
    "baidu": en(**PRIV, listing=L(True, "NASDAQ", "BIDU"), segment=["software"], powertrain=[], export_role="unknown"),
    "horizon-robotics": en(**PRIV, listing=L(True, "HKEX", "9660"), segment=["software"], export_role="some"),
    "saic": en(**SOE, listing=L(True, "SSE", "600104"), segment=["mass", "premium", "commercial"], powertrain=["ice", "bev", "phev"], export_role="major"),
    "tesla-china": en(**FOR, listing=L(True, "NASDAQ", "TSLA"), segment=["premium"], powertrain=["bev"], export_role="major"),
    "byd": en(**PRIV, listing=L(True, "SZSE", "002594"), segment=["mass", "premium"], powertrain=["bev", "phev", "ice"], export_role="major"),
    "gac": en(**SOE, listing=L(True, "SSE", "601238"), segment=["mass", "premium"], powertrain=["ice", "bev", "phev"], export_role="some"),
    "gac-honda": en(**JV, segment=["mass"], powertrain=["ice", "hev", "bev"], export_role="some"),
    "gac-toyota": en(**JV, segment=["mass"], powertrain=["ice", "hev", "phev"], export_role="some"),
    "dongfeng-nissan": en(**JV, segment=["mass"], powertrain=["ice", "bev"], export_role="some"),
    "xpeng": en(**PRIV, listing=L(True, "NYSE", "XPEV"), segment=["mass", "premium"], powertrain=["bev"], export_role="some"),
    "weiride": en(**PRIV, listing=L(True, "NASDAQ", "WRD"), segment=["software"], export_role="some"),
    "pony-ai": en(**PRIV, listing=L(True, "NASDAQ", "PONY"), segment=["software"], export_role="some"),
    "changan": en(**SOE, listing=L(True, "SZSE", "000625"), segment=["mass", "premium"], powertrain=["ice", "bev", "phev", "reev"], export_role="some"),
    "seres": en(**PRIV, listing=L(True, "SSE", "601127"), segment=["premium"], powertrain=["bev", "reev"], export_role="none"),
    "qianli": en(**PRIV, segment=["software"], export_role="unknown"),
    "jac": en(**SOE, listing=L(True, "SSE", "600418"), segment=["mass", "commercial"], powertrain=["ice", "bev"], export_role="some"),
    "nio": en(**PRIV, listing=L(True, "NYSE", "NIO"), segment=["premium"], powertrain=["bev"], export_role="some"),
    "vw-anhui": en(**JV, segment=["mass"], powertrain=["bev"], export_role="unknown"),
    "gotion": en(**PRIV, listing=L(True, "SZSE", "002074"), segment=["battery"], export_role="some"),
    "chery": en(**SOE, segment=["mass", "premium"], powertrain=["ice", "bev", "phev"], export_role="major"),
    "geely": en(**PRIV, listing=L(True, "HKEX", "0175"), segment=["mass", "premium"], powertrain=["ice", "hev", "phev", "bev"], export_role="major"),
    "faw": en(**SOE, segment=["mass", "premium", "luxury", "commercial"], powertrain=["ice", "bev", "phev"], export_role="some"),
    "hongqi": en(**SOE, segment=["premium", "luxury"], powertrain=["ice", "bev", "phev"], export_role="some"),
    "jiefang": en(**SOE, listing=L(True, "SZSE", "000800"), segment=["truck", "commercial"], powertrain=["ice", "bev"], export_role="some"),
    "bestune": en(**SOE, segment=["mass"], powertrain=["ice", "bev"], export_role="none"),
    "faw-vw": en(**JV, segment=["mass", "premium"], powertrain=["ice", "phev", "bev"], export_role="some"),
    "audi-faw-nev": en(**JV, segment=["premium", "luxury"], powertrain=["bev"], export_role="unknown"),
    "yutong": en(**PRIV, listing=L(True, "SSE", "600066"), segment=["bus"], powertrain=["ice", "bev"], export_role="major"),
    "zhengzhou-nissan": en(**JV, segment=["commercial"], powertrain=["ice"], export_role="some"),
    "sgmw": en(**JV, segment=["mass", "commercial"], powertrain=["ice", "bev"], export_role="major"),
    "dongfeng-liuzhou": en(**SOE, segment=["commercial", "truck"], powertrain=["ice", "bev"], export_role="some"),
    "guangxi-auto": en(**SOE, segment=["parts", "commercial"], export_role="unknown"),
    "dongfeng": en(**SOE, listing=L(True, "HKEX", "0489"), segment=["mass", "premium", "commercial"], powertrain=["ice", "bev", "phev"], export_role="some"),
    "voyah": en(**SOE, segment=["premium"], powertrain=["bev", "phev"], export_role="some"),
    "mengshi": en(**SOE, segment=["luxury", "commercial"], powertrain=["ice", "bev"], export_role="none"),
    "aeolus": en(**SOE, segment=["mass"], powertrain=["ice", "bev"], export_role="none"),
    "faw-toyota": en(**JV, segment=["mass", "premium"], powertrain=["ice", "hev"], export_role="some"),
    "gwm": en(**PRIV, listing=L(True, "HKEX", "2333"), segment=["mass", "premium"], powertrain=["ice", "phev", "hev", "bev"], export_role="major"),
    "volvo-cars-chengdu": en(**PRIV, segment=["premium", "luxury"], powertrain=["ice", "phev", "bev"], export_role="major"),
    "catl": en(**PRIV, listing=L(True, "SZSE", "300750"), segment=["battery"], export_role="major"),
    "svolt": en(**PRIV, segment=["battery"], export_role="some"),
    "calb": en(**PRIV, listing=L(True, "HKEX", "3931"), segment=["battery"], export_role="some"),
    "desay-sv": en(**PRIV, listing=L(True, "SZSE", "002920"), segment=["parts"], export_role="some"),
    "holosonics": en(**PRIV, listing=L(True, "SZSE", "002906"), segment=["parts"], export_role="some"),
    "eve-energy": en(**PRIV, listing=L(True, "SZSE", "300014"), segment=["battery"], export_role="major"),
    "joyson": en(**PRIV, listing=L(True, "SSE", "600699"), segment=["parts"], export_role="major"),
    "tuopu": en(**PRIV, listing=L(True, "SSE", "601689"), segment=["parts"], export_role="major"),
    "minth": en(**PRIV, listing=L(True, "HKEX", "0425"), segment=["parts"], export_role="major"),
    "huaxiang": en(**PRIV, segment=["parts"], export_role="some"),
    "sinotruk": en(**SOE, listing=L(True, "HKEX", "3808"), segment=["truck", "commercial"], powertrain=["ice", "bev"], export_role="major"),
    "king-long": en(**SOE, listing=L(True, "SSE", "600686"), segment=["bus"], powertrain=["ice", "bev"], export_role="major"),
    "golden-dragon": en(**SOE, segment=["bus"], powertrain=["ice", "bev"], export_role="major"),
    "catarc": en(**SOE, segment=["testing"], export_role="none"),
    "caeri": en(**SOE, listing=L(True, "SSE", "601965"), segment=["testing"], export_role="none"),
    "tsinghua": en(**PUB, education_tags=["985", "211", "double_first_class"]),
    "bit": en(**PUB, education_tags=["985", "211", "double_first_class"]),
    "tongji": en(**PUB, education_tags=["985", "211", "double_first_class"]),
    "sjtu": en(**PUB, education_tags=["985", "211", "double_first_class"]),
    "jlu": en(**PUB, education_tags=["985", "211", "double_first_class"]),
    "whut": en(**PUB, education_tags=["211", "double_first_class"]),
    "hfut": en(**PUB, education_tags=["211", "double_first_class"]),
    "changan-univ": en(**PUB, education_tags=["211", "double_first_class"]),
    "hnu": en(**PUB, education_tags=["985", "211", "double_first_class"]),
    "scut": en(**PUB, education_tags=["985", "211", "double_first_class"]),
    "cqu": en(**PUB, education_tags=["985", "211", "double_first_class"]),
    "cqut": en(**PUB, education_tags=[]),
    "autohome": en(**PRIV, listing=L(True, "NYSE", "ATHM"), segment=["media"], export_role="none"),
    "gasgoo": en(**PRIV, segment=["media"], export_role="none"),
    "garage42": en(**PRIV, segment=["media"], export_role="none"),
    "xchuxing": en(**PRIV, segment=["media"], export_role="none"),
    "pcauto": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "yiche": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "dongchedi": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "xcar": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "youjia": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "cheshi": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "sohu-auto": en(**PRIV, listing=L(True, "NASDAQ", "SOHU"), segment=["media"], export_role="none"),
    "sina-auto": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "ifeng-auto": en(**PRIV, listing=L(True, "NYSE", "FENG"), segment=["media"], export_role="none"),
    "tencent-auto": en(**PRIV, listing=L(True, "HKEX", "0700"), segment=["media"], export_role="none"),
    "netease-auto": en(**PRIV, listing=L(True, "NASDAQ", "NTES"), segment=["media"], export_role="none"),
    "d1ev": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "chedongxi": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "diandong": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "china-auto-news": en(**SOE, listing=L(False), segment=["media"], export_role="none"),
    "auto-business-review": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "auto-fan": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "nbd-auto": en(**SOE, listing=L(False), segment=["media"], export_role="none"),
    "yicai-auto": en(**SOE, listing=L(False), segment=["media"], export_role="none"),
    "chexun": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "che168": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "people-auto": en(**SOE, listing=L(False), segment=["media"], export_role="none"),
    "xinhua-auto": en(**SOE, listing=L(False), segment=["media"], export_role="none"),
    "cctv-auto": en(**SOE, listing=L(False), segment=["media"], export_role="none"),
    "thepaper-auto": en(**SOE, listing=L(False), segment=["media"], export_role="none"),
    "chinanews-auto": en(**SOE, listing=L(False), segment=["media"], export_role="none"),
    "21jingji-auto": en(**SOE, listing=L(False), segment=["media"], export_role="none"),
    "caixin-auto": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "jiemian-auto": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "eeo-auto": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "cheyun": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "gaogong-ev": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "yanzhi-auto": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "auto-zongheng": en(**SOE, listing=L(False), segment=["media"], export_role="none"),
    "motor-trend-china": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "truck-home": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "chinabuses": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "chinaspv": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "caam": en(**SOE, listing=L(False), segment=["education"], export_role="none"),
    "cada": en(**SOE, listing=L(False), segment=["education"], export_role="none"),
    "sae-china": en(**SOE, listing=L(False), segment=["education"], export_role="none"),
    "china-ev100": en(**SOE, listing=L(False), segment=["education"], export_role="none"),
    "luobo-report": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "laosiji": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "review-38": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "li-laoshu": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "speedsters": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "dajia-cheyan": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "xincheping": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "tichebang": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "yan-chuang": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "che-ruo-chujian": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "doudouche": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "y-car-review": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "dabiaoche": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "cidi-wuyin": en(**PRIV, listing=L(False), segment=["media"], export_role="none"),
    "gac-aion": en(**SOE, segment=["mass"], powertrain=["bev"], export_role="some"),
    "saic-vw": en(**JV, segment=["mass", "premium"], powertrain=["ice", "phev", "bev"], export_role="some"),
    "baic-foton": en(**SOE, listing=L(True, "SSE", "600166"), segment=["truck", "commercial"], powertrain=["ice", "bev"], export_role="some"),
    "dongfeng-cv": en(**SOE, segment=["truck", "commercial"], powertrain=["ice", "bev"], export_role="some"),
    "arcfox": en(**SOE, segment=["premium"], powertrain=["bev"], export_role="none"),
    "beijing-hyundai": en(**JV, segment=["mass"], powertrain=["ice", "hev", "bev"], export_role="some"),
    "saic-gm": en(**JV, segment=["mass", "premium"], powertrain=["ice", "phev"], export_role="some"),
    "im-motors": en(**SOE, segment=["premium"], powertrain=["bev"], export_role="none"),
    "rising-auto": en(**SOE, segment=["mass"], powertrain=["bev"], export_role="none"),
    "roewe": en(**SOE, segment=["mass"], powertrain=["ice", "bev", "phev"], export_role="some"),
    "mg": en(**SOE, segment=["mass"], powertrain=["ice", "bev", "phev"], export_role="major"),
    "denza": en(**JV, segment=["premium"], powertrain=["bev", "phev"], export_role="some"),
    "yangwang": en(**PRIV, segment=["luxury"], powertrain=["bev"], export_role="none"),
    "fangchengbao": en(**PRIV, segment=["premium"], powertrain=["phev", "bev"], export_role="none"),
    "huawei-car": en(**PRIV, listing=L(False), segment=["software"], export_role="some"),
    "gac-trumpchi": en(**SOE, segment=["mass"], powertrain=["ice", "phev", "hev"], export_role="some"),
    "hyptec": en(**SOE, segment=["premium"], powertrain=["bev"], export_role="none"),
    "avatr": en(**JV, segment=["premium"], powertrain=["bev"], export_role="none"),
    "deepal": en(**SOE, segment=["mass"], powertrain=["bev", "reev"], export_role="some"),
    "aito": en(**PRIV, segment=["premium"], powertrain=["bev", "reev"], export_role="none"),
    "dongfeng-honda": en(**JV, segment=["mass"], powertrain=["ice", "hev", "bev"], export_role="some"),
    "lotus": en(**PRIV, listing=L(True, "NASDAQ", "LOT"), segment=["luxury"], powertrain=["bev"], export_role="some"),
    "lynk-co": en(**PRIV, segment=["premium"], powertrain=["ice", "hev", "phev", "bev"], export_role="major"),
    "zeekr": en(**PRIV, listing=L(True, "NYSE", "ZK"), segment=["premium"], powertrain=["bev"], export_role="some"),
    "geely-galaxy": en(**PRIV, segment=["mass"], powertrain=["bev", "phev"], export_role="none"),
    "wuling": en(**JV, segment=["mass"], powertrain=["ice", "bev"], export_role="major"),
    "baojun": en(**JV, segment=["mass"], powertrain=["ice", "bev"], export_role="none"),
    "haval": en(**PRIV, segment=["mass"], powertrain=["ice", "hev", "phev"], export_role="major"),
    "tank": en(**PRIV, segment=["premium"], powertrain=["ice", "phev"], export_role="major"),
    "ora": en(**PRIV, segment=["mass"], powertrain=["bev"], export_role="some"),
    "wey": en(**PRIV, segment=["premium"], powertrain=["ice", "phev", "hev"], export_role="some"),
    "exeed": en(**SOE, segment=["premium"], powertrain=["ice", "phev"], export_role="major"),
    "jetour": en(**SOE, segment=["mass"], powertrain=["ice", "phev"], export_role="major"),
    "icar": en(**SOE, segment=["mass"], powertrain=["bev"], export_role="some"),
    "leapmotor": en(**PRIV, listing=L(True, "HKEX", "9863"), segment=["mass"], powertrain=["bev"], export_role="some"),
    "neta": en(**PRIV, segment=["mass"], powertrain=["bev"], export_role="some"),
    "bmw-brilliance": en(**JV, segment=["premium", "luxury"], powertrain=["ice", "phev", "bev"], export_role="some"),
    "saic-maxus": en(**SOE, segment=["commercial"], powertrain=["ice", "bev"], export_role="major"),
}


def main() -> None:
    orgs = json.loads((ROOT / "assets" / "data" / "organizations.json").read_text(encoding="utf-8"))["organizations"]
    missing = [o["id"] for o in orgs if o["id"] not in BASE]
    extra = [k for k in BASE if k not in {o["id"] for o in orgs}]
    if missing:
        raise SystemExit(f"baseline missing: {missing}")
    if extra:
        raise SystemExit(f"baseline extra: {extra}")
    existing = {}
    if OUT.exists():
        blob = json.loads(OUT.read_text(encoding="utf-8"))
        existing = blob.get("enrichment") if isinstance(blob.get("enrichment"), dict) else {}
    merged = {}
    for eid, row in BASE.items():
        prev = existing.get(eid) or {}
        out = dict(row)
        for k, v in prev.items():
            if k not in out:
                out[k] = v
            elif k in ("employees", "vehicle_sales") and v:
                out[k] = v
        merged[eid] = out
    OUT.write_text(json.dumps({"enrichment": merged}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} n={len(merged)}")


if __name__ == "__main__":
    main()
