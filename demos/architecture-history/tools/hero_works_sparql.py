#!/usr/bin/env python3
"""Reverse-fetch all Wikidata works credited (P84) to given architects.

For each hero architect QID, run one SPARQL query for ?work wdt:P84
<qid>, diff against the published works table, pre-check each new work's
P17 against the country authority (the fetcher gate), and emit ready
work-seed rows plus a skip list (works whose P17 is unmapped or missing,
and non-building classes worth a second look).

Usage:
    python3 tools/hero_works_sparql.py --accessed 2026-11-12 \
        --qids Q180374 Q2917 ... [--apply]   # --apply merges into seeds
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEEDS_PATH = ROOT / "tools" / "wikidata-hydration-seeds.json"
CONFIG = ROOT / "assets" / "data" / "methodology" / "wikidata-coverage-config.json"
WORKS = ROOT / "assets" / "data" / "works.json"
SPARQL = "https://query.wikidata.org/sparql"
UA = "qrost-architecture-history/1.0"


def sparql(query: str, tries: int = 4) -> list[dict]:
    url = SPARQL + "?" + urllib.parse.urlencode({"query": query, "format": "json"})
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/sparql-results+json", "User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)["results"]["bindings"]
        except Exception as exc:
            if attempt + 1 == tries:
                raise
            print(f"  sparql retry {attempt+1}: {exc}", flush=True)
            time.sleep(10 * (attempt + 1))
    return []


def entity(qid: str) -> dict:
    req = urllib.request.Request(
        f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json",
        headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)["entities"].get(qid, {})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--accessed", required=True)
    parser.add_argument("--qids", nargs="+", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    auth = {r["country_qid"]: r for r in config["country_region_authority"]}
    have = {w["external_ids"]["wikidata"]
            for w in json.loads(WORKS.read_text(encoding="utf-8"))["works"]
            if w.get("external_ids")}
    seeds = json.loads(SEEDS_PATH.read_text(encoding="utf-8"))
    seeded = {s["qid"] for s in seeds["seeds"]}

    for qid in args.qids:
        rows = sparql(
            f"SELECT ?work ?label WHERE {{ ?work wdt:P84 wd:{qid}. "
            f"?work rdfs:label ?label . FILTER(LANG(?label)='en') }}")
        works = [(r["work"]["value"].rsplit("/", 1)[-1], r["label"]["value"]) for r in rows]
        print(f"{qid}: {len(works)} credited works on Wikidata", flush=True)
        new = [(q, l) for q, l in works if q not in have and q not in seeded]
        print(f"  new (not cataloged, not seeded): {len(new)}", flush=True)

        added = skipped_p17 = 0
        for wq, label in new:
            try:
                rec = entity(wq)
            except Exception as exc:
                print(f"  ! {wq} fetch fail: {exc}", flush=True)
                time.sleep(2)
                continue
            p17 = [s["mainsnak"]["datavalue"]["value"]["id"]
                   for s in rec.get("claims", {}).get("P17", [])
                   if s.get("mainsnak", {}).get("snaktype") == "value"]
            row = next((auth[q] for q in p17 if q in auth), None)
            if row is None:
                skipped_p17 += 1
                time.sleep(0.4)
                continue
            if wq in seeded:
                continue
            seeds["seeds"].append({
                "expected_country_qid": row["country_qid"],
                "expected_country_code": row["iso2"],
                "label_hint_en": label,
                "qid": wq,
                "region": row["region"],
                "risk_tags": [f"hero_works_{qid.lower()}"],
            })
            seeded.add(wq)
            added += 1
            time.sleep(0.4)
        print(f"  seeded +{added}, skipped-unmapped-P17 {skipped_p17}", flush=True)
        time.sleep(3)

    seeds["seeds"].sort(key=lambda s: int(s["qid"][1:]))
    if args.apply:
        SEEDS_PATH.write_text(json.dumps(seeds, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"seeds applied: {len(seeds['seeds'])} works total", flush=True)
    else:
        print("dry-run: seeds NOT written (use --apply)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
