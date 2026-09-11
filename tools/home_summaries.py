"""The two manifest-backed homepage summaries and their README projections."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path


def counts(root: Path, module: str, keys: tuple[str, ...]) -> dict[str, int]:
    manifest = root / "demos" / module / "assets/data/manifest.json"
    values = json.loads(manifest.read_text(encoding="utf-8"))["counts"]
    for key in keys:
        if type(values.get(key)) is not int or values[key] < 0:
            raise ValueError(f"home summaries: {module} counts.{key} must be a nonnegative integer")
    return values


def summaries(root: Path) -> list[tuple[str, str, str, str, str]]:
    architecture = counts(root, "architecture-history", (
        "works", "people", "practices", "places", "verified_entities_and_relations",
    ))
    auto = counts(root, "china-auto", (
        "cities", "core_cities", "specialist_cities", "organizations", "facilities", "media",
    ))
    works, people = f"{architecture['works']:,}", f"{architecture['people']:,}"
    practices, places = f"{architecture['practices']:,}", f"{architecture['places']:,}"
    verified = f"{architecture['verified_entities_and_relations']:,}"
    architecture_en = (
        f"A source-first bilingual browser for {works} revision-pinned works, {people} people, "
        f"{practices} practices and {places} places — searchable map, field-level evidence, raw relation "
        f"review and a 9 × 8 coverage ledger, with {verified} verified entity/relationship records."
    )
    architecture_zh = (
        f"来源优先的双语浏览器：{works} 件固定修订作品、{people} 位人物、{practices} 家事务所与 {places} 个地点；"
        f"可搜索地图、字段级证据、原始关系复核及 9 × 8 覆盖账本，已核验 {verified} 条实体/关系记录。"
    )
    cities, core, specialist = (f"{auto[key]:,}" for key in ("cities", "core_cities", "specialist_cities"))
    organizations, facilities, media = (f"{auto[key]:,}" for key in ("organizations", "facilities", "media"))
    auto_en = (
        f"{cities} Chinese auto cities ({core} core + {specialist} specialist), {organizations} organizations "
        f"and {facilities} facility records — HQ, plants, batteries, software, media, review-video KOLs and "
        "universities as separate roles. Every org has explicit founded, ownership, listing, headcount, "
        "sales and plant-availability states. Pinyin / initials search, China map, cluster graph, sourced "
        "2025 local output. Dark mode · EN/中文."
    )
    auto_zh = (
        f"{cities} 座汽车城市（{core} 核心 + {specialist} 专业）、{organizations} 家机构与 {facilities} 条设施记录，"
        "用角色标签分开总部、工厂、电池、软件、媒体、评测KOL和院校。每家机构均明确展示成立、所有制、上市、"
        "员工、销量与工厂可得性状态。支持拼音/首字母/简写搜索，中国地图、产业集群图、带来源的 2025 年地方产量拼合。深色模式 · 中英切换。"
    )
    auto_readme = (
        f"China auto city atlas: {cities} cities ({core} core + {specialist} specialist), {organizations} "
        f"organizations, {facilities} facility records, and {media} auto media titles (including national "
        "review-video KOLs) grouped by beat; every org has a headquarters city, explicit "
        "founded/ownership/listing/headcount/sales/plant states, pinyin/initials search, HQ vs plant vs "
        "battery/software roles, clusters and sourced 2025 local output figures."
    )
    return [
        ("architecture-history", "cardArchitectureDesc", architecture_en, architecture_zh,
         "建筑谱系 · Architecture Lineages. " + architecture_en),
        ("china-auto", "cardAutoDesc", auto_en, auto_zh, auto_readme),
    ]


def replace_once(pattern: str, replacement: str, text: str, label: str, flags: int = 0) -> str:
    projected, matched = re.subn(pattern, lambda _: replacement, text, flags=flags)
    if matched != 1:
        raise ValueError(f"home summaries: expected one {label}, found {matched}")
    return projected


def project(root: Path) -> dict[str, str]:
    projected = {name: (root / name).read_text(encoding="utf-8")
                 for name in ("index.html", "assets/js/home-i18n.js", "README.md")}
    for module, key, english, chinese, readme in summaries(root):
        pattern = rf'(<p\b[^>]*\bdata-i18n="{key}"[^>]*>).*?(</p>)'
        matches = list(re.finditer(pattern, projected["index.html"], re.DOTALL))
        if len(matches) != 1:
            raise ValueError(f"home summaries: expected one HTML {key}, found {len(matches)}")
        replacement = matches[0][1] + "\n                            " + html.escape(english, quote=False) + "\n                        " + matches[0][2]
        projected["index.html"] = replace_once(pattern, replacement, projected["index.html"], f"HTML {key}", re.DOTALL)
        quote = lambda value: json.dumps(value, ensure_ascii=False)
        replacement = f"    {key}: {{\n      en: {quote(english)},\n      zh: {quote(chinese)},\n    }},"
        projected["assets/js/home-i18n.js"] = replace_once(
            rf"^    {key}: \{{\n.*?^    \}},", replacement,
            projected["assets/js/home-i18n.js"], f"i18n {key}", re.MULTILINE | re.DOTALL,
        )
        projected["README.md"] = replace_once(
            rf"^- `demos/{re.escape(module)}/` — [^\n]*$", f"- `demos/{module}/` — {readme}",
            projected["README.md"], f"README {module}", re.MULTILINE,
        )
    return projected
