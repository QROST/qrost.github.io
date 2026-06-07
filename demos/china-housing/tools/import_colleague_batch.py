#!/usr/bin/env python3
"""Normalize colleague CSV → manage.py import-csv format + dedupe report."""
from __future__ import annotations

import csv
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "housing.db"
SRC = ROOT / "data" / "research" / "china_low_cost_housing_best_effort_2026.csv"
OUT = ROOT / "data" / "research" / "colleague-2026-06-import.csv"
META = ROOT / "data" / "research" / "colleague-2026-06-meta.json"

# Existing (city, loc) keys that are the same listing — skip new import.
# Value: existing id if we should skip; None = fuzzy match only.
SKIP_EXACT = {
    ("滁州市", "碧桂园罗马世纪城"): 53,  # colleague 罗马城 vs 罗马世纪城 — different? check
    ("滁州市", "碧桂园如山湖城"): 55,
    ("六安市", "新滨湖恒大文化城"): 58,  # 孔雀城 vs 文化城 — different loc
    ("芜湖市", "银燕山庄"): 59,
    ("南通市", "恒大海上威尼斯"): 161,
    ("惠州市", "富力湾"): 68,
    ("惠州市", "泡泡海家园"): 66,
    ("清远市", "美林湖"): 77,
    ("清远市", "恒大金碧天下"): 78,
    ("阳江市", "恒大御景湾"): 70,
    ("阳江市", "碧桂园"): 71,
    ("郑州市-荥阳市", "新天城甲壳虫公寓"): 32,  # 新田城 vs 新天城 — likely same
    ("镇江市-句容市", "恒大雅苑"): 144,
    ("镇江市-句容市", "碧桂园凤凰城"): None,
    ("滁州市", "碧桂园城市花园"): 145,
    ("昆明市-安宁市", "恒大金碧天下"): 147,
    ("宁波市-奉化区", "恒大御海天下"): 141,
}


def norm_city(prov: str, city: str) -> str:
    c = city.strip()
    if prov in ("北京", "上海", "天津", "重庆") and not c.startswith(("北京", "上海", "天津", "重庆")):
        c = prov + c if c else prov
    # 郑州,荥阳市 → 郑州市-荥阳市
    if c in ("郑州", "郑州市") and "荥阳" not in c:
        pass
    m = re.match(r"^(郑州|镇江|昆明|新乡|洛阳|南阳|鹤壁|马鞍山|六安|合肥|安庆|亳州|芜湖|淮南|日照|烟台|威海|青岛|淄博|泰安|南通|连云港|南京|惠州|清远|阳江|湛江|茂名|杭州|湖州|宁波|攀枝花|石家庄)(市)?$", c)
    if m and prov not in ("重庆",):
        base = m.group(1) + "市"
        return base
    if "-" not in c and "州" not in c and not c.endswith("市") and len(c) <= 4:
        c = c + "市"
    # 滁州 → 滁州市
    if c in ("滁州", "马鞍山", "六安", "芜湖", "淮南", "安庆", "亳州", "日照", "淄博", "泰安", "南通", "连云港", "惠州", "清远", "阳江", "湛江", "茂名", "杭州", "湖州", "宁波", "攀枝花", "石家庄", "鹤壁", "新乡", "洛阳", "南阳", "保山", "曲靖", "临沧", "楚雄", "红河", "招远"):
        c = c + "市"
    if c == "重庆":
        c = "重庆市"
    if c.startswith("郑州") and "荥阳" in c:
        c = "郑州市-荥阳市"
    if c == "荥阳市" or c == "荥阳":
        c = "郑州市-荥阳市"
    if c == "句容市" or c == "句容":
        c = "镇江市-句容市"
    if c == "巢湖市":
        c = "合肥市-巢湖市"
    if c == "安宁市":
        c = "昆明市-安宁市"
    if c == "海阳市" and prov == "山东":
        c = "烟台市-海阳市"
    if c == "龙口市":
        c = "烟台市-龙口市"
    if c == "乳山市":
        c = "威海市-乳山市"
    if c == "荣成市":
        c = "威海市-荣成市"
    if c == "文登区":
        c = "威海市-文登区"
    if c == "肥城市":
        c = "泰安市-肥城市"
    if c == "临淄区":
        c = "淄博市-临淄区"
    if c == "即墨区":
        c = "青岛市-即墨区"
    if c == "奉化区":
        c = "宁波市-奉化区"
    if c == "慈溪市":
        c = "宁波市-慈溪市"
    if c == "长兴县":
        c = "湖州市-长兴县"
    if c == "建德市":
        c = "杭州市-建德市"
    if c == "卫辉市":
        c = "新乡市-卫辉市"
    if c == "中牟县":
        c = "郑州市-中牟县"
    if c == "新密市":
        c = "郑州市-新密市"
    if c == "平山县":
        c = "石家庄市-平山县"
    if c == "个旧市":
        c = "红河州-个旧市"
    if c == "开远市":
        c = "红河州-开远市"
    if c == "楚雄市":
        c = "楚雄州-楚雄市"
    if c == "禄丰市":
        c = "楚雄州-禄丰市"
    if c == "广通镇":
        c = "楚雄州-禄丰市-广通镇"
    if c == "元江县":
        c = "玉溪市-元江县"
    if c == "宣威市":
        c = "曲靖市-宣威市"
    if c == "桐城市":
        c = "安庆市-桐城市"
    if c == "和县":
        c = "马鞍山市-和县"
    if c.startswith("延边"):
        pass
    return c


def parse_rent(s: str) -> int:
    s = (s or "").strip()
    m = re.search(r"(\d+)", s.replace(",", ""))
    return int(m.group(1)) if m else 0


def parse_area(s: str, price_wan: float, notes: str) -> float | None:
    s = (s or "").strip()
    if s and s not in ("未提及", "—", "-", "N/A"):
        m = re.search(r"([\d.]+)", s)
        if m:
            return float(m.group(1))
    # derive from 单价 in notes
    m = re.search(r"单价\s*(\d+)\s*元", notes)
    if m:
        unit = float(m.group(1))
        if unit > 0:
            return round(price_wan * 10000 / unit, 1)
    m = re.search(r"(\d+)\s*元/平", notes)
    if m:
        unit = float(m.group(1))
        if unit > 0:
            return round(price_wan * 10000 / unit, 1)
    m = re.search(r"(\d+)左右一平", notes)
    if m:
        unit = float(m.group(1))
        if unit > 0:
            return round(price_wan * 10000 / unit, 1)
    return None


def norm_loc(loc: str, city: str) -> str:
    loc = loc.strip()
    # Disambiguate brand duplicates when same name exists elsewhere
    if loc == "碧桂园凤凰城" and "句容" in city:
        return "碧桂园凤凰城（句容）"
    if loc == "恒大御海天下" and "奉化" in city:
        return loc
    if "十里金滩" in loc and "海悦湾" not in loc:
        return "碧桂园十里金滩"
    if loc == "新天城甲壳虫公寓":
        return "新田城甲壳虫公寓"
    if loc == "汉一小区":
        return "汉一小区"
    if loc == "凤凰城海阳明珠":
        return "凤凰城海阳明珠"
    if loc == "石岛凤凰湖d区":
        return "石岛凤凰湖D区"
    if loc == "乳山银滩":
        return "乳山银滩"
    if loc == "东海旅游度假区":
        return "东海旅游度假区"
    if loc == "恒大威尼斯":
        return "恒大海上威尼斯北区"
    if loc == "绿地长岛":
        return "绿地长岛"
    if loc == "比干庙玲珑湾":
        return "比干庙玲珑湾"
    if loc == "洞林湖碧桂园":
        return "洞林湖碧桂园"
    if loc == "新滨湖孔雀城":
        return "新滨湖孔雀城"
    if loc == "恒大文化城" and "舒城" in city:
        return "新滨湖恒大文化城"
    return loc


def fuzzy_key(prov, city, dist, loc):
    loc2 = re.sub(r"\s+", "", loc)
    loc2 = re.sub(r"[（(].*[）)]", "", loc2)
    return (prov, city, dist, loc2[:8])


def load_existing(con):
    rows = con.execute("SELECT id, prov, city, dist, loc, priceWan, area, rent FROM listings").fetchall()
    by_key = {}
    for r in rows:
        for k in (fuzzy_key(r["prov"], r["city"], r["dist"], r["loc"]),
                  (r["prov"], r["city"], r["loc"])):
            by_key.setdefault(k, []).append(dict(r))
    return by_key, [dict(r) for r in rows]


def is_dup(existing_by_key, prov, city, dist, loc, price_wan):
    for k in (fuzzy_key(prov, city, dist, loc), (prov, city, loc)):
        hits = existing_by_key.get(k, [])
        for h in hits:
            # same listing if loc substring match
            if loc in h["loc"] or h["loc"] in loc:
                return h, "loc-match"
            if re.sub(r"\W", "", loc)[:6] == re.sub(r"\W", "", h["loc"])[:6]:
                return h, "fuzzy-loc"
    sk = (city, loc)
    if sk in SKIP_EXACT and SKIP_EXACT[sk]:
        return {"id": SKIP_EXACT[sk]}, "skip-map"
    return None, None


def main():
    import json

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    existing_by_key, all_rows = load_existing(con)

    imported = []
    skipped = []
    need_area = []

    with open(SRC, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for i, row in enumerate(reader, start=2):
            prov = row["省份"].strip()
            city = norm_city(prov, row["城市"].strip())
            dist = row["区/镇"].strip()
            loc = norm_loc(row["小区名"].strip(), city)
            price_wan = float(row["总价（万元）"])
            notes = row.get("备注", "") or ""
            rent = parse_rent(row.get("月租（元/月）", ""))
            area = parse_area(row.get("面积（㎡）", ""), price_wan, notes)
            updated = "2026-06"
            if row.get("更新月份（2026-06）"):
                um = row["更新月份（2026-06）"].strip()
                if re.match(r"^\d{4}-\d{2}$", um):
                    updated = um

            dup, why = is_dup(existing_by_key, prov, city, dist, loc, price_wan)
            if dup:
                skipped.append({"line": i, "loc": loc, "city": city, "why": why, "existing_id": dup["id"],
                                "new_price": price_wan, "old_price": dup.get("priceWan")})
                continue

            if area is None:
                need_area.append({"line": i, "loc": loc, "city": city, "price_wan": price_wan, "notes": notes[:80]})
                # fallback: use median area from notes mentioning 平
                area = 60.0  # conservative default; flagged in meta

            rec = {
                "prov": prov, "city": city, "dist": dist, "loc": loc,
                "priceWan": price_wan, "area": area, "rent": rent, "updated": updated,
                "_line": i, "_notes": notes[:200],
                "_built_hint": row.get("建成年代", ""),
                "_built_src": row.get("建成年代来源", ""),
            }
            imported.append(rec)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["prov", "city", "dist", "loc", "priceWan", "area", "rent", "updated"])
        w.writeheader()
        for r in imported:
            w.writerow({k: r[k] for k in w.fieldnames})

    meta = {"source": str(SRC), "imported": len(imported), "skipped": len(skipped),
            "need_area_defaulted": need_area, "skipped_detail": skipped}
    META.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"import rows: {len(imported)} → {OUT.relative_to(ROOT)}")
    print(f"skipped duplicates: {len(skipped)}")
    print(f"area defaulted to 60: {len(need_area)}")
    for s in skipped[:15]:
        print(f"  skip L{s['line']} {s['city']} {s['loc']} → #{s['existing_id']} ({s['why']})")
    if len(skipped) > 15:
        print(f"  … +{len(skipped)-15} more")


if __name__ == "__main__":
    main()
