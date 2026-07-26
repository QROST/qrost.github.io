#!/usr/bin/env python3
"""Build deterministic Architecture Lineages data and cache tokens."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
HTML = ROOT / "index.html"
LOADER = ROOT / "assets" / "js" / "data-loader.js"
MANIFEST = DATA / "manifest.json"

FILE_KEYS = {
    "source-registry.json": "sources",
    "people.json": "people",
    "practices.json": "practices",
    "places.json": "places",
    "works.json": "works",
    "claims.json": "claims",
    "relations.json": "relations",
}


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


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
            {"discovered_entities": 0, "verified_entities": 0, "works": 0},
        )
        row["discovered_entities"] += 1
        if item["verification_status"] == "verified":
            row["verified_entities"] += 1
        if item["entity_type"] == "work":
            row["works"] += 1

    period_rows: dict[str, dict[str, int]] = {}
    for work in payloads["works.json"]:
        period = work["period"]
        row = period_rows.setdefault(period, {"discovered": 0, "verified": 0})
        row["discovered"] += 1
        if work["verification_status"] == "verified":
            row["verified"] += 1

    sources = {source["id"]: source for source in payloads["source-registry.json"]}
    evidence_by_family: Counter[str] = Counter()
    for claim in payloads["claims.json"]:
        for evidence in claim["evidence"]:
            source = sources.get(evidence["source_id"])
            if source:
                evidence_by_family[source["source_family"]] += 1

    data_as_of = load_json(DATA / "source-registry.json")["data_as_of"]
    return {
        "schema_id": "architecture-lineages",
        "schema_version": "1.0.0",
        "hash_algorithm": "sha256",
        "data_version": version,
        "data_as_of": data_as_of,
        "counts": {
            "sources": len(payloads["source-registry.json"]),
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
            "regions": dict(sorted(region_rows.items())),
            "periods": dict(sorted(period_rows.items())),
            "verification": dict(sorted(verification.items())),
            "evidence_by_source_family": dict(sorted(evidence_by_family.items())),
        },
        "files": {
            path.relative_to(DATA).as_posix(): {
                "sha256": sha256(path),
                "count": record_count(path),
            }
            for path in paths
        },
    }


def refresh_loader_version(version: str) -> None:
    if not LOADER.exists():
        return
    text = LOADER.read_text(encoding="utf-8")
    pattern = r"(const DATA_VERSION = ')[0-9a-f]{64}(';)"
    updated, count = re.subn(pattern, rf"\g<1>{version}\g<2>", text)
    if count != 1:
        raise SystemExit(
            f"build: expected exactly one DATA_VERSION constant in {LOADER}, found {count}"
        )
    if updated != text:
        LOADER.write_text(updated, encoding="utf-8")


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
    HTML.write_text(stamped, encoding="utf-8")


def main() -> int:
    paths = input_paths()
    version = data_version(paths)
    write_json(MANIFEST, derive_manifest(paths, version))
    refresh_loader_version(version)
    refresh_html_tokens()
    subprocess.run(
        [sys.executable, str(ROOT / "tools" / "validate.py")],
        cwd=ROOT,
        check=True,
    )
    print(
        f"Build OK: {len(paths)} input file(s), data_version={version[:12]}, "
        f"manifest={MANIFEST.relative_to(ROOT)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
