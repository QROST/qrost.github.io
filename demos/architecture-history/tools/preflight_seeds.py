#!/usr/bin/env python3
"""Pre-flight validation of ALL hydration seeds against live Wikidata.

The fetcher fails hard (after long fetching) on: redirect/merge entities,
missing English labels, missing expected P17, person seeds that are not
Q5 humans or lack P106. This script checks every seed up front so fixes
happen before the expensive fetch run.

Usage: python3 tools/preflight_seeds.py [--threads 4]
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEEDS_PATH = ROOT / "tools" / "wikidata-hydration-seeds.json"
ENTITY_DATA = "https://www.wikidata.org/wiki/Special:EntityData"


def fetch_entity(qid: str) -> dict:
    last_exc = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                f"{ENTITY_DATA}/{qid}.json",
                headers={"User-Agent": "qrost-architecture-history/1.0"},
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            time.sleep(1.5 * (attempt + 1))
    raise last_exc  # type: ignore[misc]


def check_seed(seed: dict, kind: str) -> list[str]:
    qid = seed["qid"]
    problems: list[str] = []
    try:
        payload = fetch_entity(qid)
    except Exception as exc:  # noqa: BLE001
        return [f"FETCH-ERROR {kind} {qid}: {exc}"]
    entities = payload.get("entities", {})
    keys = list(entities.keys())
    if keys != [qid]:
        problems.append(
            f"REDIRECT {kind} {qid} -> {keys}"
        )
        return problems
    record = entities[qid]
    label = record.get("labels", {}).get("en", {}).get("value")
    if not label:
        problems.append(f"NO-EN-LABEL {kind} {qid}")
    claims = record.get("claims", {})
    if kind == "work":
        p17 = {
            st["mainsnak"]["datavalue"]["value"]["id"]
            for st in claims.get("P17", [])
            if st.get("mainsnak", {}).get("snaktype") == "value"
        }
        if seed["expected_country_qid"] not in p17:
            problems.append(
                f"P17-MISMATCH {kind} {qid}: expected {seed['expected_country_qid']}, got {sorted(p17)}"
            )
    else:
        p31 = {
            st["mainsnak"]["datavalue"]["value"]["id"]
            for st in claims.get("P31", [])
            if st.get("mainsnak", {}).get("snaktype") == "value"
        }
        if "Q5" not in p31:
            problems.append(f"NOT-HUMAN {kind} {qid}: P31={sorted(p31)}")
        p106 = [
            st for st in claims.get("P106", [])
            if st.get("mainsnak", {}).get("snaktype") == "value"
        ]
        if not p106:
            problems.append(f"NO-P106 {kind} {qid}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--threads", type=int, default=4)
    args = parser.parse_args()

    seeds = json.loads(SEEDS_PATH.read_text(encoding="utf-8"))
    jobs = [("work", s) for s in seeds["seeds"]] + [
        ("person", s) for s in seeds.get("person_seeds", [])
    ]
    print(f"checking {len(jobs)} seeds with {args.threads} threads...")

    problems: list[str] = []
    done = 0
    with ThreadPoolExecutor(max_workers=args.threads) as pool:
        for result in pool.map(
            lambda job: check_seed(job[1], job[0]), jobs, chunksize=8
        ):
            done += 1
            problems.extend(result)
            if done % 200 == 0:
                print(f"  ...{done}/{len(jobs)}", flush=True)

    out = ROOT / "tmp" / "research" / "cells" / "preflight-problems.json"
    out.write_text(json.dumps(problems, ensure_ascii=False, indent=1))
    print(f"problems: {len(problems)} -> {out}")
    for p in problems[:60]:
        print(" ", p)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
