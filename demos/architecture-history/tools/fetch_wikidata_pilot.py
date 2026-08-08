#!/usr/bin/env python3
"""Fetch a bounded, exact-revision Wikidata hydration snapshot.

This adapter deliberately does not run discovery queries. It hydrates the
versioned, cross-regional fixture list in wikidata-hydration-seeds.json so the
mapping and provenance contract can be tested before any coverage census.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import tempfile
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parent.parent
SEEDS_PATH = ROOT / "tools" / "wikidata-hydration-seeds.json"
CONFIG_PATH = (
    ROOT
    / "assets"
    / "data"
    / "methodology"
    / "wikidata-coverage-config.json"
)
SNAPSHOT_DIR = ROOT / "assets" / "data" / "source-snapshots"
ENTITY_DATA_BASE = "https://www.wikidata.org/wiki/Special:EntityData"
ADAPTER_ID = "wikidata-hydration-pilot"
ADAPTER_VERSION = "0.1.0"
USER_AGENT = (
    "QROST-Architecture-History/0.1 "
    "(https://qrost.github.io/demos/architecture-history/; "
    "bounded revision-pinned research adapter)"
)
LANGUAGES = ("zh-hans", "zh", "en")
PERSON_QID = "Q5"
ARCHITECTURE_FIRM_QID = "Q4387609"
CREDIT_PROPERTIES = ("P84",)
LINEAGE_REVIEW_PROPERTIES = ("P1066", "P802", "P737", "P108", "P112", "P463")
LINEAGE_CLOSURE_MAX_HOPS = 3


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def canonical_hash(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def qid_number(qid: str) -> int:
    if not qid.startswith("Q") or not qid[1:].isdigit() or qid[1] == "0":
        raise ValueError(f"invalid Wikidata QID: {qid!r}")
    return int(qid[1:])


def atomic_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = (
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
        + "\n"
    ).encode("utf-8")
    handle = tempfile.NamedTemporaryFile(
        dir=path.parent,
        prefix=f".{path.name}.",
        delete=False,
    )
    temp_path = Path(handle.name)
    try:
        with handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_path, 0o644)
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def request_bytes(
    url: str,
    *,
    timeout: int = 45,
    attempts: int = 5,
) -> tuple[bytes, str]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read()
                content_type = response.headers.get(
                    "Content-Type",
                    "application/octet-stream",
                )
                if not content_type.lower().startswith("application/json"):
                    raise RuntimeError(
                        f"{url}: expected JSON content type, got {content_type!r}"
                    )
                return raw, content_type
        except urllib.error.HTTPError as error:
            retryable = error.code == 429 or 500 <= error.code < 600
            if not retryable or attempt + 1 == attempts:
                raise
            retry_after = error.headers.get("Retry-After")
            delay = (
                int(retry_after)
                if retry_after and retry_after.isdigit()
                else 2 ** attempt
            )
            time.sleep(min(delay, 30))
        except (TimeoutError, urllib.error.URLError):
            if attempt + 1 == attempts:
                raise
            time.sleep(min(2 ** attempt, 20))
    raise RuntimeError("unreachable request retry state")


def entity_from_payload(payload: dict, requested_qid: str) -> dict:
    entities = payload.get("entities")
    if not isinstance(entities, dict):
        raise RuntimeError(f"{requested_qid}: response has no entities object")
    if set(entities) != {requested_qid}:
        raise RuntimeError(
            f"{requested_qid}: redirect, merge, or unexpected entity keys "
            f"{sorted(entities)!r}"
        )
    entity = entities[requested_qid]
    if entity.get("missing"):
        raise RuntimeError(f"{requested_qid}: entity is missing")
    if entity.get("id") != requested_qid:
        raise RuntimeError(f"{requested_qid}: returned entity id mismatch")
    return entity


def item_values(record: dict, property_id: str) -> list[str]:
    values: list[str] = []
    for statement in record.get("claims", {}).get(property_id, []):
        if statement.get("rank") == "deprecated":
            continue
        snak = statement.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        value = snak.get("datavalue", {}).get("value")
        if isinstance(value, dict) and isinstance(value.get("id"), str):
            values.append(value["id"])
    return values


def string_values(record: dict, property_id: str) -> list[str]:
    values: list[str] = []
    for statement in record.get("claims", {}).get(property_id, []):
        if statement.get("rank") == "deprecated":
            continue
        snak = statement.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        value = snak.get("datavalue", {}).get("value")
        if isinstance(value, str):
            values.append(value)
    return values


def string_values_with_deprecated_fallback(record: dict, property_id: str) -> list[str]:
    """Like string_values, but falls back to deprecated-rank statements.

    Used for ISO country codes: Wikidata occasionally marks a country's only
    P297 (alpha-2) statement as deprecated for editorial reasons (e.g. the
    Kingdom vs. country-of-the-Netherlands distinction), while the value
    itself remains the correct ISO 3166-1 code. Rejecting the seed on that
    basis would block legitimate works; the seed's expected_country_code is
    already authoritative for this demo.
    """
    preferred = string_values(record, property_id)
    if preferred:
        return preferred
    values: list[str] = []
    for statement in record.get("claims", {}).get(property_id, []):
        snak = statement.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        value = snak.get("datavalue", {}).get("value")
        if isinstance(value, str):
            values.append(value)
    return values


def minimize_language_map(value: Any) -> dict:
    if not isinstance(value, dict):
        return {}
    return {
        language: value[language]
        for language in LANGUAGES
        if language in value
    }


def minimize_entity(entity: dict, property_allowlist: set[str]) -> dict:
    claims = {
        property_id: entity.get("claims", {}).get(property_id, [])
        for property_id in sorted(property_allowlist)
        if entity.get("claims", {}).get(property_id)
    }
    return {
        "aliases": minimize_language_map(entity.get("aliases")),
        "claims": claims,
        "descriptions": minimize_language_map(entity.get("descriptions")),
        "id": entity["id"],
        "labels": minimize_language_map(entity.get("labels")),
        "lastrevid": entity["lastrevid"],
        "modified": entity.get("modified"),
    }


def fetch_pinned_entity(
    qid: str,
    property_allowlist: set[str],
) -> dict:
    qid_number(qid)
    latest_url = f"{ENTITY_DATA_BASE}/{qid}.json"
    latest_raw, _ = request_bytes(latest_url)
    latest_payload = json.loads(latest_raw.decode("utf-8"))
    latest = entity_from_payload(latest_payload, qid)
    revision = latest.get("lastrevid")
    if not isinstance(revision, int) or revision < 1:
        raise RuntimeError(f"{qid}: latest response has no valid lastrevid")

    pinned_url = f"{latest_url}?revision={revision}"
    pinned_raw, content_type = request_bytes(pinned_url)
    pinned_payload = json.loads(pinned_raw.decode("utf-8"))
    pinned = entity_from_payload(pinned_payload, qid)
    if pinned.get("lastrevid") != revision:
        raise RuntimeError(
            f"{qid}: pinned response revision {pinned.get('lastrevid')!r} "
            f"does not match requested {revision}"
        )

    record = minimize_entity(pinned, property_allowlist)
    return {
        "content_type": content_type,
        "lastrevid": revision,
        "pinned_url": pinned_url,
        "record": record,
        "record_sha256": canonical_hash(record),
        "retrieved_at": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def validate_inputs(seeds_payload: dict, config: dict) -> list[dict]:
    seeds = seeds_payload.get("seeds")
    if not isinstance(seeds, list) or not seeds:
        raise RuntimeError("hydration seed file must contain a non-empty seeds array")
    qids = [seed.get("qid") for seed in seeds]
    for qid in qids:
        qid_number(qid)
    if len(qids) != len(set(qids)):
        raise RuntimeError("hydration seed QIDs must be unique")

    grid = config.get("coverage_grid", {})
    regions = grid.get("regions", [])
    periods = grid.get("periods", [])
    if grid.get("cell_count") != len(regions) * len(periods):
        raise RuntimeError("coverage grid cell_count does not match its Cartesian grid")
    if len(regions) != 9 or len(periods) != 8:
        raise RuntimeError("coverage grid must remain 9 regions by 8 periods")
    allowed_regions = set(regions)
    country_authority = {
        row["country_qid"]: row
        for row in config.get("country_region_authority", [])
    }
    if len(country_authority) != len(config.get("country_region_authority", [])):
        raise RuntimeError("country_region_authority QIDs must be unique")
    for seed in seeds:
        if seed.get("region") not in allowed_regions:
            raise RuntimeError(
                f"{seed.get('qid')}: seed region is outside the coverage grid"
            )
        qid_number(seed.get("expected_country_qid"))
        authority = country_authority.get(seed["expected_country_qid"])
        expected = {
            "country_qid": seed["expected_country_qid"],
            "iso2": seed["expected_country_code"],
            "region": seed["region"],
        }
        if authority != expected:
            raise RuntimeError(
                f"{seed['qid']}: seed geography does not match country authority"
            )
    return seeds


def ordered_qids(values: Iterable[str]) -> list[str]:
    return sorted(set(values), key=qid_number)


def lineage_target_qids(record: dict) -> set[str]:
    targets: set[str] = set()
    for property_id in LINEAGE_REVIEW_PROPERTIES:
        targets.update(item_values(record, property_id))
    return targets


def is_lineage_source_record(record: dict) -> bool:
    instances = set(item_values(record, "P31"))
    if PERSON_QID not in instances and ARCHITECTURE_FIRM_QID not in instances:
        return False
    claims = record.get("claims", {})
    return any(claims.get(property_id) for property_id in LINEAGE_REVIEW_PROPERTIES)


def collect_lineage_fetch_targets(
    entities: dict[str, dict],
    source_qids: Iterable[str],
) -> set[str]:
    targets: set[str] = set()
    for qid in source_qids:
        wrapper = entities.get(qid)
        if wrapper is None:
            continue
        record = wrapper["record"]
        if not is_lineage_source_record(record):
            continue
        for target_qid in lineage_target_qids(record):
            if target_qid not in entities:
                targets.add(target_qid)
    return targets


def hydrate_snapshot(
    seeds_payload: dict,
    config: dict,
    accessed: str,
) -> dict:
    seeds = validate_inputs(seeds_payload, config)
    property_allowlist = set(config["property_allowlist"])
    required_properties = {
        "P17",
        "P31",
        "P84",
        "P108",
        "P112",
        "P297",
        "P463",
        "P106",
        "P737",
        "P802",
        "P1066",
    }
    missing_properties = required_properties - property_allowlist
    if missing_properties:
        raise RuntimeError(
            f"coverage config lacks required properties: {sorted(missing_properties)!r}"
        )

    entities: dict[str, dict] = {}

    def fetch_many(qids: Iterable[str], stage: str) -> None:
        missing = [qid for qid in ordered_qids(qids) if qid not in entities]
        if not missing:
            return
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            future_to_qid = {
                executor.submit(
                    fetch_pinned_entity,
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

    seed_qids = [seed["qid"] for seed in seeds]
    fetch_many(seed_qids, "seed works")

    for seed in seeds:
        record = entities[seed["qid"]]["record"]
        english_label = record.get("labels", {}).get("en", {}).get("value")
        if not english_label:
            raise RuntimeError(f"{seed['qid']}: seed work lacks an English label")
        countries = set(item_values(record, "P17"))
        if seed["expected_country_qid"] not in countries:
            raise RuntimeError(
                f"{seed['qid']}: expected P17 {seed['expected_country_qid']} "
                f"is absent; observed {sorted(countries)!r}"
            )

    related_qids: set[str] = set()
    creator_qids: set[str] = set()
    for qid in seed_qids:
        record = entities[qid]["record"]
        creator_qids.update(
            value
            for property_id in CREDIT_PROPERTIES
            for value in item_values(record, property_id)
        )
        related_qids.update(item_values(record, "P17"))
    fetch_many(related_qids | creator_qids, "work links")

    for seed in seeds:
        country_record = entities[seed["expected_country_qid"]]["record"]
        iso_codes = set(string_values_with_deprecated_fallback(country_record, "P297"))
        if seed["expected_country_code"] not in iso_codes:
            raise RuntimeError(
                f"{seed['expected_country_qid']}: expected ISO 3166-1 alpha-2 "
                f"{seed['expected_country_code']!r} is absent from P297; "
                f"observed {sorted(iso_codes)!r}"
            )

    lineage_seed_qids = [
        qid
        for qid in creator_qids
        if PERSON_QID in set(item_values(entities[qid]["record"], "P31"))
    ]
    pending_sources = set(lineage_seed_qids)
    for hop in range(LINEAGE_CLOSURE_MAX_HOPS + 1):
        lineage_qids = collect_lineage_fetch_targets(entities, pending_sources)
        if not lineage_qids:
            break
        fetch_many(lineage_qids, f"lineage review links (hop {hop})")
        pending_sources = lineage_qids

    aggregate = hashlib.sha256()
    for qid in ordered_qids(entities):
        aggregate.update(qid.encode("ascii"))
        aggregate.update(b"\0")
        aggregate.update(entities[qid]["record_sha256"].encode("ascii"))
    snapshot_id = f"wikidata-hydration-{accessed}-{aggregate.hexdigest()[:12]}"

    return {
        "accessed": accessed,
        "adapter_id": ADAPTER_ID,
        "adapter_version": ADAPTER_VERSION,
        "endpoint": ENTITY_DATA_BASE,
        "entities": {
            qid: entities[qid]
            for qid in ordered_qids(entities)
        },
        "license": "CC0-1.0",
        "queries": [],
        "seeds": seeds,
        "selection": {
            "method": "pinned_hydration_fixtures",
            "notes_en": (
                "Nineteen source-derived cross-regional fixtures hydrate exact "
                "Wikidata revisions. They test mapping risks and are neither a "
                "coverage census nor verified architectural facts."
            ),
            "notes_zh": (
                "十九个跨区域、来源派生的水合样本固定到精确 Wikidata revision；"
                "它们用于检验映射风险，不是覆盖普查，也不是已验证建筑史事实。"
            ),
            "per_cell": None,
            "query_limit": None,
            "seed": f"wikidata-hydration-seeds-v{seeds_payload['seed_version']}",
            "seed_sha256": canonical_hash(seeds),
        },
        "snapshot_id": snapshot_id,
        "source_id": "wikidata",
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--accessed",
        default=date.today().isoformat(),
        help="Snapshot access date (YYYY-MM-DD).",
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
    seeds_payload = load_json(SEEDS_PATH)
    config = load_json(CONFIG_PATH)
    snapshot = hydrate_snapshot(seeds_payload, config, args.accessed)
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
        f"{len(snapshot['seeds'])} seed works, "
        f"{len(snapshot['entities'])} pinned entities",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
