#!/usr/bin/env python3
"""Derive area from colleague CSV 备注 (单价 × 总价) for area=60 placeholders."""
import csv
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "housing.db"
CSV = ROOT / "data" / "research" / "china_low_cost_housing_best_effort_2026.csv"
OUT = ROOT / "data" / "research" / "colleague-area-csv-derived.json"

# loc in CSV → listing loc (after import normalization)
LOC_MAP = {
    "石岛凤凰湖d区": "石岛凤凰湖D区",
    "新滨湖孔雀城": "新滨湖孔雀城",
    "恒大文化城": "新滨湖恒大文化城",
    "新天城甲壳虫公寓": "新田城甲壳虫公寓",
}


def norm_loc(loc: str) -> str:
    return LOC_MAP.get(loc.strip(), loc.strip())


def parse_price_wan(s: str) -> float:
    return float(s.strip())


def unit_from_notes(notes: str) -> float | None:
    for pat in (
        r"单价\s*(\d+)\s*元",
        r"(\d+)\s*元/平",
        r"(\d+)左右一平",
        r"最低\s*(\d+)一平",
        r"(\d+)一平",
        r"(\d+)元一平",
    ):
        m = re.search(pat, notes)
        if m:
            u = float(m.group(1))
            if 200 <= u <= 20000:
                return u
    return None


def area_from_notes(notes: str) -> float | None:
    m = re.search(r"(\d+(?:\.\d+)?)\s*万.{0,20}?(\d+(?:\.\d+)?)\s*平", notes)
    if m:
        pw, ar = float(m.group(1)), float(m.group(2))
        if 20 <= ar <= 300:
            return ar
    m = re.search(r"(\d+(?:\.\d+)?)\s*平", notes)
    if m:
        ar = float(m.group(1))
        if 20 <= ar <= 200:
            return ar
    return None


def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    placeholders = {
        (r["city"], r["loc"]): r["id"]
        for r in con.execute("SELECT id,city,loc FROM listings WHERE id>=164 AND area=60")
    }
    findings = []
    with open(CSV, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            loc = norm_loc(row["小区名"])
            city = row["城市"].strip()
            if not city.endswith("市") and city not in ("重庆",):
                city = city + "市"
            # fuzzy match keys in placeholders
            lid = None
            for (c, l), i in placeholders.items():
                if loc in l or l in loc:
                    if city.replace("市", "") in c.replace("市", "") or c.replace("市", "") in city.replace("市", ""):
                        lid = i
                        break
            if not lid:
                continue
            notes = row.get("备注", "") or ""
            pw = parse_price_wan(row["总价（万元）"])
            area = area_from_notes(notes)
            src_note = "colleague CSV 备注"
            if area is None:
                unit = unit_from_notes(notes)
                if unit:
                    area = round(pw * 10000 / unit, 1)
                    src_note = f"colleague CSV 备注单价{unit:.0f}元/㎡推算"
            if area and area != 60:
                findings.append({
                    "id": lid,
                    "area": area,
                    "source": src_note,
                    "confidence": "med",
                })
    OUT.write_text(json.dumps({"findings": findings}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"derived {len(findings)} area fixes → {OUT.name}")
    for f in findings:
        print(f"  #{f['id']} → {f['area']}㎡ ({f['source']})")


if __name__ == "__main__":
    main()
