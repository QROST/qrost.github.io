#!/usr/bin/env python3
"""Fetch a bounded Wikidata coverage-matrix discovery snapshot.

Runs the configured 9×8 region/period grid against query.wikidata.org, selects
works by stable hash without popularity signals, and pins selected work entities
to exact revisions. Creator entities are classified for eligible_credits only.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from fetch_wikidata_pilot import (
    atomic_write_json,
    canonical_bytes,
    fetch_pinned_entity,
    item_values,
    load_json,
    ordered_qids,
    qid_number,
)


ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = (
    ROOT
    / "assets"
    / "data"
    / "methodology"
    / "wikidata-coverage-config.json"
)
SNAPSHOT_DIR = ROOT / "assets" / "data" / "source-snapshots"
SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
ADAPTER_ID = "wikidata-hydration-pilot"
ADAPTER_VERSION = "0.1.0"
USER_AGENT = (
    "QROST-Architecture-History/0.1 "
    "(https://qrost.github.io/demos/architecture-history/; "
    "bounded coverage discovery adapter)"
)
PERSON_QID = "Q5"
ARCHITECTURE_FIRM_QID = "Q4387609"
SPARQL_MIN_INTERVAL_SECONDS = 65


def seed_sha256(seed: str) -> str:
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


def cell_id_for(region: str, period_id: str) -> str:
    return f"{region}__{period_id}"


def countries_for_region(
    config: dict,
    region: str,
) -> list[dict[str, str]]:
    countries = [
        row
        for row in config["country_region_authority"]
        if row["region"] == region
    ]
    if not countries:
        raise RuntimeError(f"no country authority rows for region {region!r}")
    return sorted(countries, key=lambda row: qid_number(row["country_qid"]))


def pick_country(seed: str, cell_id: str, countries: list[dict[str, str]]) -> dict[str, str]:
    digest = hashlib.sha256(f"{seed}|{cell_id}".encode("utf-8")).hexdigest()
    index = int(digest, 16) % len(countries)
    return countries[index]


def allowlist_type_values(config: dict) -> str:
    qids = sorted(
        (row["qid"] for row in config["exact_instance_allowlist"]),
        key=qid_number,
    )
    return " ".join(f"wd:{qid}" for qid in qids)


def period_filter_lines(period: dict) -> list[str]:
    lines: list[str] = []
    start = period["year_start_inclusive"]
    end = period["year_end_exclusive"]
    if start is not None:
        lines.append(f"  FILTER(?year >= {start})")
    if end is not None:
        lines.append(f"  FILTER(?year < {end})")
    return lines


def build_cell_sparql(
    *,
    config: dict,
    country_qid: str,
    period: dict,
    query_limit: int,
) -> str:
    """Build a cell SPARQL query using best-rank wdt: dates.

    The statement-level p:/ps:/wikibase:timePrecision pattern returns empty
    result sets on current WDQS for this discovery shape; wdt:P571 with
    optional wdt:P1619 fallback matches the pilot's period channels while
    remaining bounded (exact P31 allowlist, no P279).
    """
    type_values = allowlist_type_values(config)
    period_filters = "\n".join(period_filter_lines(period))
    return f"""SELECT ?work WHERE {{
  VALUES ?type {{ {type_values} }}
  ?work wdt:P31 ?type .
  ?work wdt:P17 wd:{country_qid} .
  OPTIONAL {{ ?work wdt:P571 ?inception . }}
  OPTIONAL {{ ?work wdt:P1619 ?opening . }}
  BIND(COALESCE(?inception, ?opening) AS ?date)
  FILTER(BOUND(?date))
  BIND(YEAR(?date) AS ?year)
{period_filters}
  ?work rdfs:label ?label .
  FILTER(LANG(?label) = "en")
}}
LIMIT {query_limit}
"""


def stable_pick_candidates(
    *,
    seed: str,
    cell_id: str,
    candidates: list[str],
    per_cell: int,
    already_selected: set[str],
) -> list[str]:
    available = [qid for qid in candidates if qid not in already_selected]
    scored = [
        (
            hashlib.sha256(f"{seed}|{cell_id}|{qid}".encode("utf-8")).hexdigest(),
            qid_number(qid),
            qid,
        )
        for qid in available
    ]
    scored.sort()
    return [qid for _, _, qid in scored[:per_cell]]


def unique_candidates(raw_qids: Iterable[str], query_limit: int) -> list[str]:
    seen: set[str] = set()
    candidates: list[str] = []
    for qid in raw_qids:
        if qid in seen:
            continue
        qid_number(qid)
        seen.add(qid)
        candidates.append(qid)
        if len(candidates) >= query_limit:
            break
    return candidates


def request_sparql(
    query: str,
    *,
    timeout: int = 120,
    attempts: int = 6,
    last_request_at: float | None = None,
) -> tuple[list[str], float]:
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
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
            bindings = payload.get("results", {}).get("bindings", [])
            qids: list[str] = []
            for row in bindings:
                work = row.get("work", {}).get("value", "")
                if "/entity/" not in work:
                    continue
                qid = work.rsplit("/", 1)[-1]
                qids.append(qid)
            return qids, time.monotonic()
        except urllib.error.HTTPError as error:
            retryable = error.code in {429, 503} or 500 <= error.code < 600
            if not retryable or attempt + 1 == attempts:
                raise
            retry_after = error.headers.get("Retry-After")
            if error.code == 429:
                delay = SPARQL_MIN_INTERVAL_SECONDS
            elif retry_after and retry_after.isdigit():
                delay = int(retry_after)
            else:
                delay = min(2 ** attempt, 30)
            time.sleep(delay)
        except (TimeoutError, urllib.error.URLError, json.JSONDecodeError):
            if attempt + 1 == attempts:
                raise
            time.sleep(min(2 ** attempt, 30))
    raise RuntimeError("unreachable SPARQL retry state")


def creator_kind(record: dict) -> str | None:
    instance_values = set(item_values(record, "P31"))
    if PERSON_QID in instance_values:
        return "person"
    if ARCHITECTURE_FIRM_QID in instance_values:
        return "practice"
    return None


def classify_creator_qid(
    creator_qid: str,
    *,
    cache: dict[str, str | None],
    fetcher=fetch_pinned_entity,
) -> str | None:
    if creator_qid in cache:
        return cache[creator_qid]
    wrapper = fetcher(creator_qid, {"P31"})
    kind = creator_kind(wrapper["record"])
    cache[creator_qid] = kind
    return kind


def eligible_credits_for_work(
    work_qid: str,
    record: dict,
    *,
    creator_cache: dict[str, str | None],
    fetcher=fetch_pinned_entity,
) -> list[dict[str, str]]:
    credits: list[dict[str, str]] = []
    for creator_qid in item_values(record, "P84"):
        kind = classify_creator_qid(
            creator_qid,
            cache=creator_cache,
            fetcher=fetcher,
        )
        if kind is None:
            continue
        credits.append(
            {
                "work_qid": work_qid,
                "creator_qid": creator_qid,
                "creator_kind": kind,
            }
        )
    credits.sort(key=lambda row: (row["work_qid"], row["creator_qid"]))
    return credits


def iter_cells(config: dict) -> list[tuple[str, dict, dict]]:
    grid = config["coverage_grid"]
    cells: list[tuple[str, dict, dict]] = []
    for region in grid["regions"]:
        countries = countries_for_region(config, region)
        for period in grid["periods"]:
            cell_id = cell_id_for(region, period["id"])
            country = pick_country(config["selection"]["seed"], cell_id, countries)
            cells.append((cell_id, country, period))
    return cells


def coverage_snapshot_id(
    accessed: str,
    *,
    seed: str,
    queries: list[dict],
) -> str:
    payload = {
        "seed": seed,
        "cells": [
            {
                "cell_id": query["cell_id"],
                "selected_work_qids": query["selected_work_qids"],
            }
            for query in sorted(queries, key=lambda row: row["cell_id"])
        ],
    }
    digest = hashlib.sha256(canonical_bytes(payload)).hexdigest()[:12]
    return f"wikidata-coverage-{accessed}-{digest}"


def discover_coverage(
    config: dict,
    *,
    accessed: str,
    max_cells: int | None = None,
    sparql_runner=request_sparql,
    entity_fetcher=fetch_pinned_entity,
) -> dict:
    selection = config["selection"]
    seed = selection["seed"]
    per_cell = selection["per_cell"]
    query_limit = selection["candidate_limit_sentinel"]
    property_allowlist = set(config["property_allowlist"])

    cells = iter_cells(config)
    if max_cells is not None:
        cells = cells[:max_cells]

    queries: list[dict] = []
    already_selected: set[str] = set()
    last_sparql_at: float | None = None

    for cell_id, country, period in cells:
        query = build_cell_sparql(
            config=config,
            country_qid=country["country_qid"],
            period=period,
            query_limit=query_limit,
        )
        raw_qids, last_sparql_at = sparql_runner(
            query,
            last_request_at=last_sparql_at,
        )
        candidates = unique_candidates(raw_qids, query_limit)
        selected = stable_pick_candidates(
            seed=seed,
            cell_id=cell_id,
            candidates=candidates,
            per_cell=per_cell,
            already_selected=already_selected,
        )
        already_selected.update(selected)
        empty_observed = not candidates
        print(
            f"{cell_id}: candidates={len(candidates)} "
            f"selected={len(selected)} empty_observed={empty_observed}",
            flush=True,
        )
        queries.append(
            {
                "cell_id": cell_id,
                "region": country["region"],
                "country_code": country["iso2"],
                "country_qid": country["country_qid"],
                "query": query,
                "query_sha256": hashlib.sha256(query.encode("utf-8")).hexdigest(),
                "candidate_work_qids": candidates,
                "selected_work_qids": selected,
                "eligible_credits": [],
            }
        )

    selected_qids = ordered_qids(
        qid
        for query in queries
        for qid in query["selected_work_qids"]
    )
    entities: dict[str, dict] = {}
    creator_cache: dict[str, str | None] = {}

    def fetch_many(qids: Iterable[str], stage: str) -> None:
        missing = [qid for qid in ordered_qids(qids) if qid not in entities]
        if not missing:
            return
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            future_to_qid = {
                executor.submit(
                    entity_fetcher,
                    qid,
                    property_allowlist,
                ): qid
                for qid in missing
            }
            completed = 0
            for future in concurrent.futures.as_completed(future_to_qid):
                qid = future_to_qid[future]
                entities[qid] = future.result()
                completed += 1
                print(
                    f"{stage}: pinned {qid} ({completed}/{len(missing)})",
                    flush=True,
                )

    fetch_many(selected_qids, "selected works")

    for query in queries:
        credits: list[dict[str, str]] = []
        for work_qid in query["selected_work_qids"]:
            record = entities[work_qid]["record"]
            credits.extend(
                eligible_credits_for_work(
                    work_qid,
                    record,
                    creator_cache=creator_cache,
                    fetcher=entity_fetcher,
                )
            )
        query["eligible_credits"] = credits

    snapshot_without_id = {
        "accessed": accessed,
        "adapter_id": ADAPTER_ID,
        "adapter_version": ADAPTER_VERSION,
        "endpoint": SPARQL_ENDPOINT,
        "entities": {
            qid: entities[qid]
            for qid in ordered_qids(entities)
        },
        "license": "CC0-1.0",
        "queries": queries,
        "seeds": [],
        "selection": {
            "method": "coverage_cell_stable_hash",
            "notes_en": (
                "Coverage discovery over the configured 9×8 region/period grid. "
                "Each cell queries Wikidata with exact-instance allowlist types, "
                "a deterministic country proxy, and stable-hash selection without "
                "popularity signals. Pinned work entities are discovery receipts, "
                "not verified architectural facts."
            ),
            "notes_zh": (
                "按配置的 9×8 地区/时代网格做覆盖发现。每个单元格以精确实例"
                "allowlist 类型、确定性国家代理和稳定哈希选取（不使用流行度信号）"
                "查询 Wikidata。固定版本的作品实体只是发现回执，不是已验证建筑史事实。"
            ),
            "per_cell": per_cell,
            "query_limit": query_limit,
            "seed": seed,
            "seed_sha256": seed_sha256(seed),
        },
        "source_id": "wikidata",
    }
    snapshot_id = coverage_snapshot_id(
        accessed,
        seed=seed,
        queries=queries,
    )
    return {
        **snapshot_without_id,
        "snapshot_id": snapshot_id,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--accessed",
        default=date.today().isoformat(),
        help="Snapshot access date (YYYY-MM-DD).",
    )
    parser.add_argument(
        "--max-cells",
        type=int,
        default=None,
        help="Process only the first N grid cells (for testing).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Explicit output file. Default derives an immutable filename.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow replacement of an existing explicit output file.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_json(CONFIG_PATH)
    snapshot = discover_coverage(
        config,
        accessed=args.accessed,
        max_cells=args.max_cells,
    )
    output = args.output
    if output is None:
        output = SNAPSHOT_DIR / f"{snapshot['snapshot_id']}.json"
    elif not output.is_absolute():
        output = (Path.cwd() / output).resolve()
    if output.exists() and not args.force:
        raise SystemExit(f"refusing to replace existing snapshot without --force: {output}")
    atomic_write_json(output, snapshot)
    print(
        f"Wrote {output.relative_to(ROOT) if output.is_relative_to(ROOT) else output}: "
        f"{len(snapshot['queries'])} cells, "
        f"{sum(len(query['selected_work_qids']) for query in snapshot['queries'])} "
        f"selected works, "
        f"{len(snapshot['entities'])} pinned entities",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
