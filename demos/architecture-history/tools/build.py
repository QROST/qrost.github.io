#!/usr/bin/env python3
"""Build deterministic Architecture Lineages data and cache tokens."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Optional


ROOT = Path(
    os.environ.get(
        "ARCH_HISTORY_ROOT",
        str(Path(__file__).resolve().parent.parent),
    )
).resolve()
DATA = ROOT / "assets" / "data"
CATALOG = DATA / "catalog"
HTML = ROOT / "index.html"
LOADER = ROOT / "assets" / "js" / "data-loader.js"
MANIFEST = DATA / "manifest.json"
COVERAGE_CONFIG = DATA / "methodology" / "wikidata-coverage-config.json"

FILE_KEYS = {
    "source-registry.json": "sources",
    "reviewers.json": "reviewers",
    "people.json": "people",
    "practices.json": "practices",
    "places.json": "places",
    "works.json": "works",
    "claims.json": "claims",
    "relations.json": "relations",
}

CATALOG_KEYS = ("people", "practices", "places", "works", "claims", "relations")
ENTITY_KEYS = ("people", "practices", "places", "works")
OVERLAY_KIND = "catalog_overlay_v1"


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload) -> None:
    atomic_write_bytes(
        path,
        (
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
            + "\n"
        ).encode("utf-8"),
    )


def canonical_hash(payload) -> str:
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def ordered_catalog_payloads() -> list[tuple[Path, dict]]:
    if not CATALOG.exists():
        return []
    return [
        (path, load_json(path))
        for path in sorted(
            CATALOG.glob("*.json"),
            key=lambda item: item.name.encode("utf-8"),
        )
    ]


def base_catalog_contract(
    payloads: list[tuple[Path, dict]],
) -> list[dict]:
    return [
        {
            "path": path.relative_to(DATA).as_posix(),
            "payload": payload,
        }
        for path, payload in payloads
        if payload.get("kind") != OVERLAY_KIND
    ]


def base_catalog_sha256(
    payloads: Optional[list[tuple[Path, dict]]] = None,
) -> str:
    if payloads is None:
        payloads = ordered_catalog_payloads()
    return canonical_hash(base_catalog_contract(payloads))


def atomic_write_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = path.stat().st_mode & 0o777 if path.exists() else 0o644
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
        os.chmod(temp_path, mode)
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def merge_catalog_shards() -> None:
    """Regenerate the public graph from full shards, then fail-closed overlays."""
    merged = {key: [] for key in CATALOG_KEYS}
    payloads = ordered_catalog_payloads()
    full_shards = [
        (path, payload)
        for path, payload in payloads
        if payload.get("kind") != OVERLAY_KIND
    ]
    overlays = [
        (path, payload)
        for path, payload in payloads
        if payload.get("kind") == OVERLAY_KIND
    ]
    for _, payload in full_shards:
        for key in CATALOG_KEYS:
            merged[key].extend(payload[key])

    base_hash = base_catalog_sha256(payloads)
    entity_by_id: dict[str, dict] = {}
    entity_type_by_id: dict[str, str] = {}
    for key in ENTITY_KEYS:
        for entity in merged[key]:
            entity_id = entity["id"]
            if entity_id in entity_by_id:
                raise ValueError(
                    f"catalog overlay base contains duplicate entity {entity_id!r}"
                )
            entity_by_id[entity_id] = entity
            entity_type_by_id[entity_id] = entity["entity_type"]

    base_claim_ids = {claim["id"] for claim in merged["claims"]}
    patched_entities: set[str] = set()
    overlay_ids: set[str] = set()
    for path, overlay in sorted(
        overlays,
        key=lambda row: row[1].get("overlay_id", "").encode("utf-8"),
    ):
        overlay_id = overlay.get("overlay_id")
        if not isinstance(overlay_id, str) or not overlay_id:
            raise ValueError(f"{path.name}: catalog overlay requires overlay_id")
        if overlay_id in overlay_ids:
            raise ValueError(f"catalog overlay duplicate id {overlay_id!r}")
        overlay_ids.add(overlay_id)
        if overlay.get("base_catalog_sha256") != base_hash:
            raise ValueError(
                f"{path.name}: catalog overlay base hash does not match full shards"
            )
        claims = overlay.get("claims")
        patches = overlay.get("entity_patches")
        if not isinstance(claims, list) or not isinstance(patches, list):
            raise ValueError(
                f"{path.name}: catalog overlay claims and entity_patches are required"
            )
        claim_by_id = {claim["id"]: claim for claim in claims}
        if len(claim_by_id) != len(claims):
            raise ValueError(f"{path.name}: catalog overlay has duplicate claim IDs")
        if base_claim_ids & set(claim_by_id):
            raise ValueError(f"{path.name}: catalog overlay reuses a base claim ID")
        listed_claim_ids: set[str] = set()
        for patch in patches:
            entity_id = patch["entity_id"]
            if entity_id in patched_entities:
                raise ValueError(
                    f"{path.name}: entity {entity_id!r} is patched more than once"
                )
            entity = entity_by_id.get(entity_id)
            if entity is None:
                raise ValueError(
                    f"{path.name}: overlay target {entity_id!r} does not exist"
                )
            if entity_type_by_id[entity_id] != patch["entity_type"]:
                raise ValueError(
                    f"{path.name}: overlay target {entity_id!r} has wrong type"
                )
            for namespace, expected in patch["assert_external_ids"].items():
                if entity["external_ids"].get(namespace) != expected:
                    raise ValueError(
                        f"{path.name}: {entity_id!r} external ID assertion failed"
                    )
            for namespace, value in patch["add_external_ids"].items():
                if namespace in entity["external_ids"]:
                    raise ValueError(
                        f"{path.name}: {entity_id!r} cannot replace external ID "
                        f"{namespace!r}"
                    )
                entity["external_ids"][namespace] = value
            for claim_id in patch["add_claim_ids"]:
                claim = claim_by_id.get(claim_id)
                if claim is None or claim["subject_id"] != entity_id:
                    raise ValueError(
                        f"{path.name}: overlay claim {claim_id!r} does not match "
                        f"target {entity_id!r}"
                    )
                if claim_id in listed_claim_ids:
                    raise ValueError(
                        f"{path.name}: overlay claim {claim_id!r} is listed twice"
                    )
                listed_claim_ids.add(claim_id)
                entity["claim_ids"].append(claim_id)
            patched_entities.add(entity_id)
        if listed_claim_ids != set(claim_by_id):
            raise ValueError(
                f"{path.name}: every overlay claim must be attached exactly once"
            )
        merged["claims"].extend(claims)
        base_claim_ids.update(claim_by_id)

    for filename, key in FILE_KEYS.items():
        if filename in {"source-registry.json", "reviewers.json"}:
            continue
        write_json(DATA / filename, {key: merged[key]})


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def input_paths() -> list[Path]:
    return sorted(
        (
            path
            for path in DATA.rglob("*.json")
            if path != MANIFEST
        ),
        key=lambda path: path.relative_to(DATA).as_posix().encode("utf-8"),
    )


def data_version(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.relative_to(DATA).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
    return digest.hexdigest()


def record_count(path: Path) -> int:
    rel = path.relative_to(DATA).as_posix()
    if rel in FILE_KEYS:
        payload = load_json(path)
        return len(payload[FILE_KEYS[rel]])
    payload = load_json(path)
    if isinstance(payload, list):
        return len(payload)
    if isinstance(payload, dict):
        arrays = [value for value in payload.values() if isinstance(value, list)]
        if len(arrays) == 1:
            return len(arrays[0])
    return 1


def derive_manifest(paths: list[Path], version: str) -> dict:
    payloads = {
        filename: load_json(DATA / filename)[key]
        for filename, key in FILE_KEYS.items()
    }
    entities = (
        payloads["people.json"]
        + payloads["practices.json"]
        + payloads["places.json"]
        + payloads["works.json"]
    )
    published_graph = entities + payloads["relations.json"]
    verification = Counter(item["verification_status"] for item in published_graph)

    region_rows: dict[str, dict[str, int]] = {}
    for item in entities:
        region = item.get("region", "unknown")
        row = region_rows.setdefault(
            region,
            {"entities": 0, "verified_entities": 0, "works": 0},
        )
        row["entities"] += 1
        if item["verification_status"] == "verified":
            row["verified_entities"] += 1
        if item["entity_type"] == "work":
            row["works"] += 1

    period_rows: dict[str, dict[str, int]] = {}
    for work in payloads["works.json"]:
        period = work["period"]
        row = period_rows.setdefault(period, {"works": 0, "verified_works": 0})
        row["works"] += 1
        if work["verification_status"] == "verified":
            row["verified_works"] += 1

    sources = {source["id"]: source for source in payloads["source-registry.json"]}
    evidence_by_family: Counter[str] = Counter()
    for claim in payloads["claims.json"]:
        for evidence in claim["evidence"]:
            source = sources.get(evidence["source_id"])
            if source:
                evidence_by_family[source["source_family"]] += 1

    coverage_config = load_json(COVERAGE_CONFIG)
    coverage_cells_total = coverage_config["coverage_grid"]["cell_count"]
    coverage_cells_run = 0
    selection_methods: set[str] = set()
    if (DATA / "source-snapshots").exists():
        for path in sorted((DATA / "source-snapshots").glob("*.json")):
            snapshot = load_json(path)
            selection_methods.add(snapshot["selection"]["method"])
            if snapshot["selection"]["method"] == "coverage_cell_stable_hash":
                coverage_cells_run += len(snapshot["queries"])
    fixture_regions: Counter[str] = Counter(
        work["region"]
        for work in payloads["works.json"]
    )
    fixture_periods: Counter[str] = Counter(
        work["period"]
        for work in payloads["works.json"]
    )
    work_type_mapping: Counter[str] = Counter(
        work["work_type_mapping_status"]
        for work in payloads["works.json"]
    )

    data_as_of = load_json(DATA / "source-registry.json")["data_as_of"]
    return {
        "schema_id": "architecture-lineages",
        "schema_version": "1.5.0",
        "hash_algorithm": "sha256",
        "data_version": version,
        "data_as_of": data_as_of,
        "counts": {
            "sources": len(payloads["source-registry.json"]),
            "reviewers": len(payloads["reviewers.json"]),
            "people": len(payloads["people.json"]),
            "practices": len(payloads["practices.json"]),
            "places": len(payloads["places.json"]),
            "works": len(payloads["works.json"]),
            "claims": len(payloads["claims.json"]),
            "relations": len(payloads["relations.json"]),
            "verified_entities_and_relations": verification["verified"],
            "candidate_entities_and_relations": verification["candidate"],
            "contested_entities_and_relations": verification["contested"],
            "declined_entities_and_relations": verification["declined"],
        },
        "coverage": {
            "status": "not_run" if coverage_cells_run == 0 else "partial",
            "cells_total": coverage_cells_total,
            "cells_run": coverage_cells_run,
            "selection_methods": sorted(selection_methods),
            "fixture_distribution": {
                "periods": dict(sorted(fixture_periods.items())),
                "regions": dict(sorted(fixture_regions.items())),
            },
        },
        "catalog_profile": {
            "regions": dict(sorted(region_rows.items())),
            "periods": dict(sorted(period_rows.items())),
            "verification": dict(sorted(verification.items())),
            "evidence_by_source_family": dict(sorted(evidence_by_family.items())),
            "work_type_mapping": dict(sorted(work_type_mapping.items())),
        },
        "files": {
            path.relative_to(DATA).as_posix(): {
                "sha256": sha256(path),
                "count": record_count(path),
            }
            for path in paths
        },
    }


def refresh_loader_constants(
    version: str,
    manifest_sha256: str,
    schema_version: str,
) -> None:
    if not LOADER.exists():
        return
    text = LOADER.read_text(encoding="utf-8")
    updated = text
    replacements = (
        ("DATA_VERSION", version),
        ("MANIFEST_SHA256", manifest_sha256),
    )
    for name, value in replacements:
        pattern = rf"(const {name} = ')[0-9a-f]{{64}}(';)"
        updated, count = re.subn(pattern, rf"\g<1>{value}\g<2>", updated)
        if count != 1:
            raise SystemExit(
                f"build: expected exactly one {name} constant in {LOADER}, found {count}"
            )
    updated, count = re.subn(
        r"(const SCHEMA_VERSION = ')[^']+(';)",
        rf"\g<1>{schema_version}\g<2>",
        updated,
    )
    if count != 1:
        raise SystemExit(
            "build: expected exactly one SCHEMA_VERSION constant "
            f"in {LOADER}, found {count}"
        )
    if updated != text:
        atomic_write_bytes(LOADER, updated.encode("utf-8"))


def refresh_html_tokens() -> None:
    if not HTML.exists():
        return
    html = HTML.read_text(encoding="utf-8")
    pattern = re.compile(
        r'(?P<prefix>(?:src|href)=")(?P<path>assets/(?:js|css)/[^"?]+)'
        r'(?:\?v=[^"]*)?(?P<suffix>")'
    )
    matches = list(pattern.finditer(html))
    if not matches:
        raise SystemExit("build: index.html has no local CSS/JS asset tags to stamp")
    seen: set[str] = set()

    def replace(match: re.Match[str]) -> str:
        relative = match.group("path")
        asset = ROOT / relative
        if not asset.is_file():
            raise SystemExit(f"build: referenced local asset is missing: {relative}")
        seen.add(relative)
        version = hashlib.sha1(asset.read_bytes()).hexdigest()[:10]
        return (
            f"{match.group('prefix')}{relative}?v={version}{match.group('suffix')}"
        )

    stamped = pattern.sub(replace, html)
    if len(seen) != len(matches):
        raise SystemExit("build: duplicate local CSS/JS asset tags are not allowed")
    atomic_write_bytes(HTML, stamped.encode("utf-8"))


def mutable_outputs() -> list[Path]:
    paths = [
        DATA / filename
        for filename in FILE_KEYS
        if filename not in {"source-registry.json", "reviewers.json"}
    ]
    paths.append(MANIFEST)
    if LOADER.exists():
        paths.append(LOADER)
    if HTML.exists():
        paths.append(HTML)
    return paths


def restore_outputs(before: dict[Path, Optional[bytes]]) -> None:
    for path, content in before.items():
        if content is None:
            if path.exists():
                path.unlink()
        else:
            atomic_write_bytes(path, content)


def main() -> int:
    outputs = mutable_outputs()
    before = {
        path: path.read_bytes() if path.exists() else None
        for path in outputs
    }
    try:
        merge_catalog_shards()
        paths = input_paths()
        version = data_version(paths)
        manifest = derive_manifest(paths, version)
        write_json(MANIFEST, manifest)
        refresh_loader_constants(
            version,
            sha256(MANIFEST),
            manifest["schema_version"],
        )
        refresh_html_tokens()
        subprocess.run(
            [sys.executable, str(ROOT / "tools" / "validate.py")],
            cwd=ROOT,
            check=True,
        )
        subprocess.run(
            [sys.executable, str(ROOT / "tools" / "test_page_contract.py")],
            cwd=ROOT,
            check=True,
        )
        subprocess.run(
            [sys.executable, str(ROOT / "tools" / "test_wikidata_pilot.py")],
            cwd=ROOT,
            check=True,
        )
        subprocess.run(
            [sys.executable, str(ROOT / "tools" / "test_getty_ulan_pilot.py")],
            cwd=ROOT,
            check=True,
        )
    except BaseException:
        restore_outputs(before)
        raise
    print(
        f"Build OK: {len(paths)} input file(s), data_version={version[:12]}, "
        f"manifest={MANIFEST.relative_to(ROOT)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
