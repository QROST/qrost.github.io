"""Canonical controlled vocabularies — single source of truth for the whole demo.

build.py emits these to assets/data/enums.json (with zh/en labels + palette hexes)
so the frontend filters, the pixel-cat palette, and the persona rules all agree on
the same tokens. normalize.py maps messy shelter strings onto these tokens.
"""
from __future__ import annotations

# Solid pigment tokens. `hex` feeds the procedural pixel-cat palette (pixelcat.js).
COLORS: dict[str, dict] = {
    "black":     {"zh": "黑色",   "en": "Black",        "hex": "#2b2b30"},
    "white":     {"zh": "白色",   "en": "White",        "hex": "#f3efe7"},
    "gray":      {"zh": "灰色",   "en": "Gray",         "hex": "#8d909b"},
    "blue":      {"zh": "蓝灰",   "en": "Blue (gray)",  "hex": "#7d8a9c"},
    "brown":     {"zh": "棕色",   "en": "Brown",        "hex": "#6b4a34"},
    "chocolate": {"zh": "巧克力",  "en": "Chocolate",    "hex": "#4a2f24"},
    "orange":    {"zh": "橙色",   "en": "Orange/Ginger", "hex": "#d98036"},
    "cream":     {"zh": "奶油色",  "en": "Cream",        "hex": "#e8d3a8"},
    "tan":       {"zh": "浅黄褐",  "en": "Tan/Buff",     "hex": "#c9a86b"},
    "lilac":     {"zh": "丁香灰",  "en": "Lilac",        "hex": "#b9adb0"},
}

# Coat markings / distribution. Distinct from color.
PATTERNS: dict[str, dict] = {
    "solid":    {"zh": "纯色",     "en": "Solid"},
    "tabby":    {"zh": "虎斑",     "en": "Tabby"},
    "bicolor":  {"zh": "双色",     "en": "Bicolor"},
    "tuxedo":   {"zh": "燕尾服",   "en": "Tuxedo"},
    "calico":   {"zh": "三花/玳瑁白", "en": "Calico"},
    "tortie":   {"zh": "玳瑁",     "en": "Tortoiseshell"},
    "pointed":  {"zh": "重点色",   "en": "Pointed"},
    "smoke":    {"zh": "烟色",     "en": "Smoke/Shaded"},
}

COAT: dict[str, dict] = {
    "short":    {"zh": "短毛",   "en": "Short hair"},
    "medium":   {"zh": "中长毛", "en": "Medium hair"},
    "long":     {"zh": "长毛",   "en": "Long hair"},
    "hairless": {"zh": "无毛",   "en": "Hairless"},
}

AGE_BUCKET: dict[str, dict] = {
    "kitten": {"zh": "幼猫 (<1岁)",  "en": "Kitten (<1y)"},
    "young":  {"zh": "青年 (1–2岁)", "en": "Young (1–2y)"},
    "adult":  {"zh": "成年 (3–7岁)", "en": "Adult (3–7y)"},
    "senior": {"zh": "老年 (8岁+)",  "en": "Senior (8y+)"},
}

SEX: dict[str, dict] = {
    "male":    {"zh": "公",   "en": "Male"},
    "female":  {"zh": "母",   "en": "Female"},
    "unknown": {"zh": "未知", "en": "Unknown"},
}

STATUS: dict[str, dict] = {
    "adoptable":  {"zh": "可领养",   "en": "Adoptable"},
    "in_shelter": {"zh": "在收容所", "en": "In shelter"},
    "adopted":    {"zh": "已领养",   "en": "Adopted"},
    "removed":    {"zh": "已下架",   "en": "Removed"},
}

SIZE: dict[str, dict] = {
    "small":  {"zh": "小型", "en": "Small"},
    "medium": {"zh": "中型", "en": "Medium"},
    "large":  {"zh": "大型", "en": "Large"},
}

GOOD_WITH: dict[str, dict] = {
    "children": {"zh": "适合有小孩", "en": "Good with kids"},
    "dogs":     {"zh": "亲狗",       "en": "Good with dogs"},
    "cats":     {"zh": "亲猫",       "en": "Good with cats"},
}

# World regions (map shading + shard buckets). `live` flipped by build.py from the
# enabled adapters' coverage so the map honestly shows which regions have data.
REGIONS: dict[str, dict] = {
    "north_america": {"zh": "北美",   "en": "North America"},
    "south_america": {"zh": "南美",   "en": "South America"},
    "europe":        {"zh": "欧洲",   "en": "Europe"},
    "africa":        {"zh": "非洲",   "en": "Africa"},
    "asia":          {"zh": "亚洲",   "en": "Asia"},
    "middle_east":   {"zh": "中东",   "en": "Middle East"},
    "oceania":       {"zh": "大洋洲", "en": "Oceania"},
}

# ISO-2 country -> region (extend as adapters are added).
COUNTRY_REGION: dict[str, str] = {
    "US": "north_america", "CA": "north_america", "MX": "north_america",
    "GB": "europe", "IE": "europe", "DE": "europe", "FR": "europe", "ES": "europe",
    "IT": "europe", "NL": "europe", "SE": "europe", "PL": "europe",
    "AU": "oceania", "NZ": "oceania",
    "JP": "asia", "CN": "asia", "KR": "asia", "SG": "asia", "IN": "asia",
    "BR": "south_america", "AR": "south_america",
    "ZA": "africa", "AE": "middle_east", "IL": "middle_east",
}


def region_for_country(country: str | None) -> str:
    return COUNTRY_REGION.get((country or "").upper(), "north_america")


def all_enums() -> dict:
    """Bundle for assets/data/enums.json."""
    return {
        "colors": COLORS, "patterns": PATTERNS, "coat": COAT,
        "age_bucket": AGE_BUCKET, "sex": SEX, "status": STATUS,
        "size": SIZE, "good_with": GOOD_WITH, "regions": REGIONS,
    }
