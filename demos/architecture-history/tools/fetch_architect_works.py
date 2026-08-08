#!/usr/bin/env python3
"""Discover architect-attributed works and append hydration seeds.

Runs a bounded SPARQL query per architect QID (P84) intersected with the
configured exact P31 allowlist, then appends unseen work QIDs to
wikidata-hydration-seeds.json with country/region metadata.
"""

from __future__ import annotations

import argparse
import copy
from pathlib import Path
from typing import Any, Callable

from fetch_wikidata_coverage import (
    CONFIG_PATH,
    SPARQL_ENDPOINT,
    SPARQL_MIN_INTERVAL_SECONDS,
    USER_AGENT,
    allowlist_type_values,
)
from fetch_wikidata_pilot import atomic_write_json, load_json, ordered_qids, qid_number
from promote_coverage_to_seeds import seed_sort_key


ROOT = Path(__file__).resolve().parent.parent
SEEDS_PATH = ROOT / "tools" / "wikidata-hydration-seeds.json"
DEFAULT_SOFT_CAP = 201

ARCHITECT_SLUGS: dict[str, str] = {
    "Q180374": "gehry",
    "Q104898": "foster",
    "Q214317": "nouvel",
    "Q190148": "piano",
    "Q47780": "hadid",
    "Q232364": "koolhaas",
    "Q154538": "libeskind",
    "Q46868": "pei",
    "Q208220": "ando",
    "Q526725": "ban",
    "Q168482": "calatrava",
    "Q451141": "holl",
    "Q317135": "isozaki",
    "Q253350": "sejima",
    "Q369645": "nishizawa",
    "Q333585": "toyo_ito",
}


def architect_slug(architect_qid: str) -> str:
    slug = ARCHITECT_SLUGS.get(architect_qid)
    if slug:
        return slug
    return architect_qid.lower()


def country_authority_index(config: dict[str, Any]) -> dict[str, dict[str, str]]:
    index: dict[str, dict[str, str]] = {}
    for row in config["country_region_authority"]:
        index[row["country_qid"]] = {
            "expected_country_code": row["iso2"],
            "expected_country_qid": row["country_qid"],
            "region": row["region"],
        }
    return index


def build_architect_sparql(*, architect_qid: str, config: dict[str, Any]) -> str:
    type_values = allowlist_type_values(config)
    qid_number(architect_qid)
    return f"""SELECT ?work ?country ?label WHERE {{
  VALUES ?type {{ {type_values} }}
  ?work wdt:P31 ?type .
  ?work wdt:P84 wd:{architect_qid} .
  ?work wdt:P17 ?country .
  ?work rdfs:label ?label .
  FILTER(LANG(?label) = "en")
}}
"""


def parse_sparql_rows(bindings: list[dict[str, Any]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for binding in bindings:
        work_uri = binding.get("work", {}).get("value", "")
        country_uri = binding.get("country", {}).get("value", "")
        label = binding.get("label", {}).get("value", "")
        if "/entity/" not in work_uri or "/entity/" not in country_uri:
            continue
        work_qid = work_uri.rsplit("/", 1)[-1]
        country_qid = country_uri.rsplit("/", 1)[-1]
        rows.append(
            {
                "work_qid": work_qid,
                "country_qid": country_qid,
                "label_en": label.strip() if isinstance(label, str) else work_qid,
            }
        )
    return rows


def request_sparql_bindings(
    query: str,
    *,
    last_request_at: float | None = None,
) -> tuple[list[dict[str, Any]], float]:
    import json
    import time
    import urllib.error
    import urllib.parse
    import urllib.request

    if last_request_at is not None:
        elapsed = time.monotonic() - last_request_at
        if elapsed < SPARQL_MIN_INTERVAL_SECONDS:
            time.sleep(SPARQL_MIN_INTERVAL_SECONDS - elapsed)

    data = urllib.parse.urlencode({"query": query}).encode("utf-8")
    request = urllib.request.Request(
        SPARQL_ENDPOINT,
        data=data,
        headers={
            "Accept": "application/sparql-results+json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.loads(response.read().decode("utf-8"))
    bindings = payload.get("results", {}).get("bindings", [])
    return bindings, time.monotonic()


def request_architect_rows(
    query: str,
    *,
    last_request_at: float | None = None,
) -> tuple[list[dict[str, str]], float]:
    bindings, last_at = request_sparql_bindings(
        query,
        last_request_at=last_request_at,
    )
    return parse_sparql_rows(bindings), last_at


def expand_architect_works(
    architect_qid: str,
    seeds_payload: dict[str, Any],
    config: dict[str, Any],
    *,
    soft_cap: int = DEFAULT_SOFT_CAP,
    sparql_runner: Callable[..., tuple[list[dict[str, str]], float]] | None = None,
    last_request_at: float | None = None,
) -> tuple[dict[str, Any], dict[str, int]]:
    if soft_cap < 1:
        raise ValueError("soft_cap must be >= 1")

    existing_qids = {
        seed["qid"]
        for seed in seeds_payload.get("seeds", [])
        if isinstance(seed, dict) and isinstance(seed.get("qid"), str)
    }
    authority = country_authority_index(config)
    slug = architect_slug(architect_qid)
    query = build_architect_sparql(architect_qid=architect_qid, config=config)
    runner = sparql_runner or request_architect_rows
    rows, _ = runner(query, last_request_at=last_request_at)

    hits = len(rows)
    added = 0
    skipped_existing = 0
    skipped_unknown_country = 0
    capped = 0
    new_seeds: list[dict[str, Any]] = []
    seen_works: set[str] = set()

    for row in rows:
        work_qid = row["work_qid"]
        if work_qid in seen_works:
            continue
        seen_works.add(work_qid)

        if work_qid in existing_qids:
            skipped_existing += 1
            continue

        country_meta = authority.get(row["country_qid"])
        if country_meta is None:
            skipped_unknown_country += 1
            continue
        if added >= soft_cap:
            capped += 1
            continue

        new_seeds.append(
            {
                "expected_country_code": country_meta["expected_country_code"],
                "expected_country_qid": country_meta["expected_country_qid"],
                "label_hint_en": row["label_en"] or work_qid,
                "qid": work_qid,
                "region": country_meta["region"],
                "risk_tags": ["architect_expansion", f"architect_{slug}"],
            }
        )
        existing_qids.add(work_qid)
        added += 1

    updated = copy.deepcopy(seeds_payload)
    combined = list(updated.get("seeds", [])) + new_seeds
    combined.sort(key=seed_sort_key)
    updated["seeds"] = combined
    stats = {
        "hits": hits,
        "added": added,
        "skipped_existing": skipped_existing,
        "skipped_unknown_country": skipped_unknown_country,
        "capped": capped,
    }
    return updated, stats


def parse_architect_qids(raw_values: list[str]) -> list[str]:
    qids: list[str] = []
    for raw in raw_values:
        for part in raw.split(","):
            value = part.strip()
            if not value:
                continue
            qid_number(value)
            qids.append(value)
    return ordered_qids(qids)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Append architect-attributed work QIDs to hydration seeds.",
    )
    parser.add_argument(
        "--architect",
        action="append",
        dest="architects",
        metavar="QID",
        help="Architect Wikidata QID (repeatable or comma-separated).",
    )
    parser.add_argument(
        "--roster",
        action="store_true",
        help="Use the built-in contemporary masters roster.",
    )
    parser.add_argument(
        "--soft-cap",
        type=int,
        default=DEFAULT_SOFT_CAP,
        help=f"Maximum new seeds per architect (default: {DEFAULT_SOFT_CAP}).",
    )
    parser.add_argument(
        "--seeds",
        type=Path,
        default=SEEDS_PATH,
        help="Hydration seeds JSON path.",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=CONFIG_PATH,
        help="Wikidata coverage config path.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print stats without writing seeds.",
    )
    args = parser.parse_args()

    architect_qids: list[str] = []
    if args.roster:
        architect_qids.extend(ordered_qids(ARCHITECT_SLUGS))
    if args.architects:
        architect_qids.extend(parse_architect_qids(args.architects))
    architect_qids = ordered_qids(architect_qids)
    if not architect_qids:
        raise SystemExit("provide --architect QID and/or --roster")

    config = load_json(args.config)
    seeds_payload = load_json(args.seeds)
    updated = seeds_payload
    last_request_at: float | None = None

    for architect_qid in architect_qids:
        updated, stats = expand_architect_works(
            architect_qid,
            updated,
            config,
            soft_cap=args.soft_cap,
            last_request_at=last_request_at,
        )
        print(
            f"{architect_qid} ({architect_slug(architect_qid)}): "
            f"hits={stats['hits']} "
            f"added={stats['added']} "
            f"existing={stats['skipped_existing']} "
            f"unknown_country={stats['skipped_unknown_country']} "
            f"capped={stats['capped']}",
            flush=True,
        )

    if args.dry_run:
        return

    atomic_write_json(args.seeds, updated)


if __name__ == "__main__":
    main()
