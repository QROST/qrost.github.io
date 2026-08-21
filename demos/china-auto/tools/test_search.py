#!/usr/bin/env python3
"""Search-key smoke tests for china-auto (pinyin / initials / aliases)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from search_index import matches

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"


def load(name: str, key: str) -> list:
    return json.loads((DATA / name).read_text(encoding="utf-8"))[key]


def by_id(rows: list, eid: str) -> dict:
    for r in rows:
        if r["id"] == eid:
            return r
    raise KeyError(eid)


def expect(entity: dict, query: str, ok: bool = True) -> None:
    hit = matches(entity.get("search_keys") or [], query)
    if hit != ok:
        raise AssertionError(
            f"{entity['id']!r} query {query!r} expected {ok} got {hit}; keys={entity.get('search_keys')}"
        )


def main() -> int:
    cities = load("cities.json", "cities")
    orgs = load("organizations.json", "organizations")
    beijing = by_id(cities, "beijing")
    shanghai = by_id(cities, "shanghai")
    xian = by_id(cities, "xian")
    byd = by_id(orgs, "byd")
    faw = by_id(orgs, "faw")
    changan = by_id(orgs, "changan")
    gwm = by_id(orgs, "gwm")
    leap = by_id(orgs, "leapmotor")
    aito = by_id(orgs, "aito")

    expect(beijing, "bj")
    expect(beijing, "beijing")
    expect(beijing, "北京")
    expect(shanghai, "sh")
    expect(shanghai, "shanghai")
    expect(xian, "xa")
    expect(xian, "xian")
    expect(byd, "byd")
    expect(byd, "比亚迪")
    expect(byd, "biyadi")
    expect(faw, "一汽")
    expect(faw, "faw")
    expect(changan, "长安")
    expect(changan, "changan")
    expect(changan, "caqc")
    expect(gwm, "gwm")
    expect(gwm, "长城")
    expect(leap, "零跑")
    expect(leap, "leapmotor")
    expect(aito, "问界")
    expect(aito, "aito")
    print("test_search: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
