#!/usr/bin/env python3
"""Build an editorial-biographical-research pack from career-facts JSON.

Reads flat fact arrays ({employee, employer, relation_type, quote, url,
title}) from tmp/research/wave*-career-facts.json, resolves both endpoints
against the published people/practices tables (name -> Wikidata QID), and
emits a content-addressed editorial-research pack matching
tools/schema.json editorialResearchSnapshot. Facts whose endpoints are
not both in the catalog are archived to a skipped list — never invented.

Usage:
    python3 tools/build_career_pack.py --accessed YYYY-MM-DD \
        --facts tmp/research/wave6a-career-facts.json [...] \
        [--wave-name "Wave-6"] [--notes-en ...] [--notes-zh ...]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
SNAPSHOTS = ROOT / "assets" / "data" / "source-snapshots"


def normalize(value: str | None) -> str | None:
    if not value:
        return None
    text = unicodedata.normalize("NFD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^0-9a-zA-Z\u4e00-\u9fff]+", " ", text.lower())
    return " ".join(text.split()) or None


def build_name_index(rows: list[dict]) -> dict[str, dict]:
    index: dict[str, dict] = {}
    for row in rows:
        qid = (row.get("external_ids") or {}).get("wikidata")
        if not qid:
            continue
        entry = {"qid": qid, "name_en": row.get("name_en")}
        for field in ("name_en", "name_zh"):
            key = normalize(row.get(field))
            if key:
                index.setdefault(key, entry)
        for alias in row.get("aliases_en") or []:
            key = normalize(alias)
            if key:
                index.setdefault(key, entry)
    return index


def match_with_suffix_tolerance(
    name: str | None, index: dict[str, dict]
) -> dict | None:
    """Exact normalized match first; then containment for CJK corporate
    suffix drift (e.g. 北京市建筑设计研究院 vs ...研究院有限公司)."""
    key = normalize(name)
    if not key:
        return None
    if key in index:
        return index[key]
    if len(key) >= 6:
        for cand_key, entry in index.items():
            if len(cand_key) >= 6 and (
                key in cand_key or cand_key in key
            ):
                return entry
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--accessed", required=True)
    parser.add_argument("--facts", nargs="+", required=True)
    parser.add_argument("--wave-name", default="Wave research")
    parser.add_argument("--notes-en", default="")
    parser.add_argument("--notes-zh", default="")
    args = parser.parse_args()

    people = json.loads((DATA / "people.json").read_text(encoding="utf-8"))["people"]
    practices = json.loads((DATA / "practices.json").read_text(encoding="utf-8"))["practices"]
    people_ix = build_name_index(people)
    practice_ix = build_name_index(practices)

    facts: list[dict] = []
    for path in args.facts:
        p = Path(path)
        if p.exists():
            facts.extend(json.loads(p.read_text(encoding="utf-8")))

    entries: list[dict] = []
    skipped: list[dict] = []
    seen_pairs: set[tuple[str, str, str]] = set()
    for fact in facts:
        employee = people_ix.get(normalize(fact.get("employee")))
        rel = fact.get("relation_type")
        if rel == "worked_for":
            employer = people_ix.get(normalize(fact.get("employer"))) or match_with_suffix_tolerance(fact.get("employer"), people_ix)
        elif rel == "worked_at_practice":
            employer = practice_ix.get(normalize(fact.get("employer"))) or match_with_suffix_tolerance(fact.get("employer"), practice_ix)
        else:
            skipped.append({**fact, "reason": f"unknown relation_type {rel!r}"})
            continue
        if employee is None or employer is None:
            skipped.append({
                **fact,
                "reason": ("employee" if employee is None else "employer")
                + " not in catalog",
            })
            continue
        pair = (employee["qid"], employer["qid"], rel)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        entries.append({
            "employee_qid": employee["qid"],
            "employer_qid": employer["qid"],
            "relation_type": rel,
            "citations": [{
                "url": fact.get("url"),
                "title": fact.get("title"),
                "quote_en": fact.get("quote"),
            }],
        })

    canonical = json.dumps(entries, ensure_ascii=False, sort_keys=True,
                           separators=(",", ":")).encode("utf-8")
    digest = hashlib.sha256(canonical).hexdigest()[:12]
    pack = {
        "snapshot_id": f"editorial-research-{args.accessed}-{digest}",
        "source_id": "editorial-biographical-research",
        "adapter_id": "editorial-biographical-research-pack",
        "adapter_version": "0.1.0",
        "accessed": args.accessed,
        "license": "CC0-1.0 (pack metadata)",
        "selection": {
            "method": "pinned_editorial_research",
            "notes_en": args.notes_en or f"{args.wave_name}: documented office employment under named architects or at named practices (verbatim-quoted citations).",
            "notes_zh": args.notes_zh or f"{args.wave_name}：在有署名建筑师门下或事务所任职的成文事实（逐字引文）。",
            "per_cell": None,
            "query_limit": None,
        },
        "queries": [],
        "entries": entries,
    }
    out = SNAPSHOTS / f"{pack['snapshot_id']}.json"
    out.write_text(json.dumps(pack, ensure_ascii=False, indent=1) + "\n",
                   encoding="utf-8")
    skip_out = ROOT / "tmp" / "research" / "wave6-skipped-facts.json"
    skip_out.parent.mkdir(parents=True, exist_ok=True)
    skip_out.write_text(json.dumps(skipped, ensure_ascii=False, indent=1),
                        encoding="utf-8")
    print(f"pack: {out.name}")
    print(f"entries: {len(entries)} (of {len(facts)} facts; {len(skipped)} skipped, {len(facts) - len(skipped) - len(entries)} dupes)")
    print(f"skipped archive: {skip_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
