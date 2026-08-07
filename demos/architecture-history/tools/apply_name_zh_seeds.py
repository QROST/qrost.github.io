#!/usr/bin/env python3
"""Apply name-zh seeds to the Wikidata hydration catalog and rebind crosswalk hash."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from fetch_wikidata_pilot import atomic_write_json, load_json, qid_number
from fetch_name_zh_seeds import qid_slug


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
CATALOG_DIR = DATA / "catalog"
CATALOG_PATH = CATALOG_DIR / "wikidata-hydration.json"
SNAPSHOT_DIR = DATA / "source-snapshots"
SEEDS_PATH = ROOT / "tools" / "name-zh-seeds.json"
OVERLAY_KIND = "catalog_overlay_v1"


def canonical_hash(payload: Any) -> str:
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def base_catalog_contract(payloads: list[tuple[Path, dict]]) -> list[dict]:
    return [
        {
            "path": path.relative_to(DATA).as_posix(),
            "payload": payload,
        }
        for path, payload in payloads
        if payload.get("kind") != OVERLAY_KIND
    ]


def ordered_catalog_payloads() -> list[tuple[Path, dict]]:
    return [
        (path, load_json(path))
        for path in sorted(
            CATALOG_DIR.glob("*.json"),
            key=lambda item: item.name.encode("utf-8"),
        )
    ]


def base_catalog_sha256(payloads: list[tuple[Path, dict]]) -> str:
    return canonical_hash(base_catalog_contract(payloads))


def find_crosswalk_path() -> Path:
    paths = sorted(SNAPSHOT_DIR.glob("wikidata-ulan-crosswalk-*.json"))
    if len(paths) != 1:
        raise RuntimeError(
            f"expected exactly one wikidata-ulan-crosswalk snapshot, found {len(paths)}"
        )
    return paths[0]


def load_hydration_snapshot(snapshot_id: str) -> dict:
    path = SNAPSHOT_DIR / f"{snapshot_id}.json"
    if not path.is_file():
        raise RuntimeError(f"hydration snapshot missing: {path}")
    return load_json(path)


def langlink_evidence(
    *,
    qid: str,
    seed: dict,
    wrapper: dict,
    snapshot_id: str,
    accessed: str,
) -> dict:
    locator = (
        f"{qid}/sitelinks/enwiki/langlinks/zh/"
        f"{seed['name_zh'].replace(' ', '_')}"
    )
    return {
        "accessed": accessed,
        "contributors": [],
        "extraction_method": "structured_mapping",
        "language": "zh",
        "locator": locator,
        "native_field_path": "/sitelinks/enwiki/langlinks/zh",
        "native_predicate": None,
        "native_record_id": f"{qid}@{wrapper['lastrevid']}",
        "qualifiers": [],
        "rank": None,
        "references": [],
        "snapshot_id": snapshot_id,
        "source_id": "wikidata",
        "source_record_sha256": wrapper["record_sha256"],
        "support": "explicit",
        "url": wrapper["pinned_url"],
    }


def apply_seeds(
    catalog: dict,
    seeds_by_qid: dict[str, dict],
    snapshot: dict,
) -> tuple[int, int]:
    snapshot_id = snapshot["snapshot_id"]
    accessed = snapshot["accessed"]
    entities = snapshot["entities"]
    claims_by_id = {claim["id"]: claim for claim in catalog["claims"]}
    applied = 0
    still_missing = 0

    for person in catalog["people"]:
        if person.get("name_zh") is not None:
            continue
        qid = person["external_ids"]["wikidata"]
        seed = seeds_by_qid.get(qid)
        if seed is None:
            still_missing += 1
            continue

        wrapper = entities.get(qid)
        if wrapper is None:
            raise RuntimeError(f"snapshot lacks entity {qid}")

        person["name_zh"] = seed["name_zh"]
        person["name_zh_status"] = seed["name_zh_status"]
        claim_id = f"claim-wd-{qid_slug(qid)}-name-zh"
        if claim_id not in claims_by_id:
            evidence = langlink_evidence(
                qid=qid,
                seed=seed,
                wrapper=wrapper,
                snapshot_id=snapshot_id,
                accessed=accessed,
            )
            claim = {
                "confidence": 0.6,
                "evidence": [evidence],
                "id": claim_id,
                "object": {"value": seed["name_zh"]},
                "predicate": "field_name_zh",
                "qualifiers": {},
                "reviewed_at": None,
                "reviewed_by": None,
                "subject_id": person["id"],
                "verification_status": "candidate",
            }
            catalog["claims"].append(claim)
            claims_by_id[claim_id] = claim
            person["claim_ids"].append(claim_id)
        applied += 1

    catalog["claims"].sort(key=lambda row: row["id"])
    for person in catalog["people"]:
        person["claim_ids"] = sorted(person["claim_ids"])
    return applied, still_missing


def rebind_crosswalk(
  crosswalk_path: Path,
  new_base_hash: str,
) -> tuple[str, str, bool]:
    crosswalk = load_json(crosswalk_path)
    old_id = crosswalk["snapshot_id"]
    crosswalk["base_catalog_sha256"] = new_base_hash
    snapshot_without_id = {
        key: value
        for key, value in crosswalk.items()
        if key != "snapshot_id"
    }
    new_digest = canonical_hash(snapshot_without_id)
    new_id = f"wikidata-ulan-crosswalk-{crosswalk['accessed']}-{new_digest[:12]}"
    crosswalk["snapshot_id"] = new_id
    rebound = old_id != new_id
    new_path = crosswalk_path.parent / f"{new_id}.json"
    atomic_write_json(new_path, crosswalk)
    if rebound and new_path != crosswalk_path:
        crosswalk_path.unlink()
    return old_id, new_id, rebound


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--seeds",
        type=Path,
        default=SEEDS_PATH,
        help="Seed JSON produced by fetch_name_zh_seeds.py",
    )
    parser.add_argument(
        "--catalog",
        type=Path,
        default=CATALOG_PATH,
        help="Wikidata hydration catalog shard to patch.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    seed_file = load_json(args.seeds.resolve())
    seeds_by_qid = {row["qid"]: row for row in seed_file["seeds"]}
    catalog = load_json(args.catalog.resolve())
    snapshot_id = catalog["generated_from"]
    snapshot = load_hydration_snapshot(snapshot_id)

    applied, still_missing = apply_seeds(catalog, seeds_by_qid, snapshot)
    atomic_write_json(args.catalog.resolve(), catalog)

    payloads = ordered_catalog_payloads()
    new_base_hash = base_catalog_sha256(payloads)
    crosswalk_path = find_crosswalk_path()
    old_id, new_id, rebound = rebind_crosswalk(crosswalk_path, new_base_hash)

    report = {
        "seed_count": len(seed_file["seeds"]),
        "applied": applied,
        "still_missing": still_missing,
        "base_catalog_sha256": new_base_hash,
        "crosswalk_rebound": rebound,
        "crosswalk_snapshot_id_old": old_id,
        "crosswalk_snapshot_id_new": new_id,
    }
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
