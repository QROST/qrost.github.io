#!/usr/bin/env python3
"""Export listings needing built-year / POI research → data/research/audit-2026-06-worklist.json"""
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "housing.db"
OUT = ROOT / "data" / "research" / "audit-2026-06-worklist.json"

METRO_HINT = (
    "北京", "上海", "广州", "深圳", "杭州", "南京", "武汉", "成都", "重庆", "天津",
    "苏州", "西安", "郑州", "长沙", "宁波", "青岛", "无锡", "合肥", "福州", "厦门",
    "大连", "沈阳", "哈尔滨", "长春", "昆明", "东莞", "佛山", "惠州", "南通", "宜昌",
    "镇江", "廊坊", "鄂州", "茂名", "肇庆", "增城", "余杭", "鼓楼", "黄岛", "武清",
    "句容", "南沙", "奉化", "启东", "乳山", "安吉", "上街", "惠东", "点军", "伍家岗",
    "华容", "三河",
)


def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    rows = [dict(r) for r in con.execute(
        "SELECT id, prov, city, dist, loc, lat, lng, built_year FROM listings ORDER BY id")]
    pois = defaultdict(dict)
    for r in con.execute("SELECT listing_id, category, name, dist_km, source FROM poi"):
        pois[r["listing_id"]][r["category"]] = {
            "name": r["name"], "distKm": r["dist_km"], "source": r["source"],
        }

    def wants_metro(r):
        blob = f"{r['prov']}{r['city']}{r['dist']}"
        return any(k in blob for k in METRO_HINT)

    built = [r for r in rows if not r["built_year"]]
    poi = []
    for r in rows:
        p = pois.get(r["id"], {})
        issues = []
        h = p.get("hospital", {})
        if h.get("distKm") is not None and h["distKm"] < 0.5:
            issues.append(f"hospital<{h['distKm']}km:{h.get('name')}")
        for c in ("train",):
            v = p.get(c, {})
            if v.get("distKm") is not None and v["distKm"] < 0.2:
                issues.append(f"{c}<{v['distKm']}km")
        if wants_metro(r) and not (p.get("metro") or {}).get("name"):
            issues.append("missing_metro")
        if issues:
            poi.append({**r, "issues": issues, "pois": p})

    OUT.write_text(json.dumps({"built": built, "poi": poi}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} — built:{len(built)} poi:{len(poi)}")


if __name__ == "__main__":
    main()
