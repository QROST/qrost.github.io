#!/usr/bin/env python3
"""Fetch the bounded Getty ULAN identity-only pilot.

The input is a committed, reviewed Wikidata-to-ULAN crosswalk.  This adapter
does not retain Getty labels, names, descriptions, dates, or relationships.
Raw responses are discarded after their SHA-256 retrieval receipts are made.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_DIR = ROOT / "assets" / "data" / "source-snapshots"
ADAPTER_ID = "getty-ulan-identity-pilot"
ADAPTER_VERSION = "0.1.0"
SOURCE_ID = "getty-ulan"
RECORD_COUNT = 24
MAX_WORKERS = 4
CANONICAL_URI_PREFIX = "http://vocab.getty.edu/ulan/"
REPRESENTATION_URI_PREFIX = "https://vocab.getty.edu/ulan/"
ULAN_ID_PATTERN = re.compile(r"^[1-9][0-9]*$")
QID_PATTERN = re.compile(r"^Q[1-9][0-9]*$")
WIKIDATA_PATTERNS = (
    re.compile(r"^https?://www\.wikidata\.org/entity/(Q[1-9][0-9]*)$"),
    re.compile(r"^https?://(?:www\.)?wikidata\.org/wiki/(Q[1-9][0-9]*)$"),
)
URI_PATTERN = re.compile(r"^https?://[^\s]+$")
CONTRIBUTOR_URI_PATTERN = re.compile(
    r"^http://vocab\.getty\.edu/ulan/contrib/[1-9]\d*$"
)
SOURCE_URI_PATTERN = re.compile(
    r"^http://vocab\.getty\.edu/ulan/source/[1-9]\d*$"
)
GETTY_ATTRIBUTION = (
    "Contains information from the J. Paul Getty Trust, Getty Research "
    "Institute, Union List of Artist Names (ULAN), made available under "
    "the ODC Attribution License."
)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def canonical_hash(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def atomic_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = tempfile.NamedTemporaryFile(
        dir=path.parent, prefix=f".{path.name}.", delete=False
    )
    temporary_path = Path(temporary.name)
    try:
        with temporary:
            temporary.write(
                (json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
                .encode("utf-8")
            )
            temporary.flush()
            os.fsync(temporary.fileno())
        os.chmod(temporary_path, 0o644)
        os.replace(temporary_path, path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def require_committed_snapshot(path: Path) -> None:
    """Reject an untracked or modified crosswalk; selection must be reviewable."""
    try:
        git_root = Path(
            subprocess.check_output(
                ["git", "rev-parse", "--show-toplevel"],
                cwd=ROOT,
                text=True,
            ).strip()
        ).resolve()
        relative = path.resolve().relative_to(git_root)
    except (subprocess.CalledProcessError, ValueError) as error:
        raise RuntimeError("crosswalk must be inside the project repository") from error
    for command in (
        ["git", "ls-files", "--error-unmatch", "--", str(relative)],
        ["git", "cat-file", "-e", f"HEAD:{relative.as_posix()}"],
        ["git", "diff", "--quiet", "HEAD", "--", str(relative)],
        ["git", "diff", "--cached", "--quiet", "HEAD", "--", str(relative)],
    ):
        completed = subprocess.run(
            command,
            cwd=git_root,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if completed.returncode:
            raise RuntimeError(
                "crosswalk must be committed and clean before Getty retrieval: "
                f"{relative}"
            )


def canonical_ulan_uri(subject_id: str) -> str:
    if not isinstance(subject_id, str) or not ULAN_ID_PATTERN.fullmatch(subject_id):
        raise RuntimeError(f"invalid ULAN subject id: {subject_id!r}")
    return f"{CANONICAL_URI_PREFIX}{subject_id}"


def normalized_crosswalk_records(payload: Any) -> tuple[str, str, list[dict]]:
    """Return a canonical, exact 24-row crosswalk contract.

    A crosswalk intentionally contains only the project entity binding and the
    selected ULAN identifier.  It is not a Getty snapshot and cannot carry
    fetched display text or relationships.
    """
    if not isinstance(payload, dict):
        raise RuntimeError("crosswalk root must be an object")
    snapshot_id = payload.get("snapshot_id")
    base_catalog_sha256 = payload.get("base_catalog_sha256")
    rows = payload.get("records")
    if not isinstance(snapshot_id, str) or not snapshot_id:
        raise RuntimeError("crosswalk snapshot_id is required")
    if not isinstance(base_catalog_sha256, str) or not re.fullmatch(
        r"[0-9a-f]{64}", base_catalog_sha256
    ):
        raise RuntimeError("crosswalk base_catalog_sha256 must be a SHA-256")
    if not isinstance(rows, list) or len(rows) != RECORD_COUNT:
        raise RuntimeError(f"crosswalk must contain exactly {RECORD_COUNT} records")

    expected_keys = {"entity_id", "entity_type", "ulan_subject_id", "wikidata_qid"}
    normalized: list[dict] = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict) or set(row) != expected_keys:
            raise RuntimeError(f"crosswalk record {index}: invalid closed shape")
        entity_id = row["entity_id"]
        entity_type = row["entity_type"]
        qid = row["wikidata_qid"]
        subject_id = row["ulan_subject_id"]
        if not isinstance(entity_id, str) or not entity_id:
            raise RuntimeError(f"crosswalk record {index}: entity_id is required")
        if entity_type not in {"person", "practice"}:
            raise RuntimeError(f"crosswalk record {index}: invalid entity_type")
        if not isinstance(qid, str) or not QID_PATTERN.fullmatch(qid):
            raise RuntimeError(f"crosswalk record {index}: invalid Wikidata QID")
        canonical_ulan_uri(subject_id)
        normalized.append(
            {
                "entity_id": entity_id,
                "entity_type": entity_type,
                "ulan_subject_id": subject_id,
                "wikidata_qid": qid,
            }
        )
    keys = ("entity_id", "wikidata_qid", "ulan_subject_id")
    for key in keys:
        values = [row[key] for row in normalized]
        if len(values) != len(set(values)):
            raise RuntimeError(f"crosswalk {key} values must be unique")
    normalized.sort(key=lambda row: int(row["ulan_subject_id"]))
    if rows != normalized:
        raise RuntimeError("crosswalk records must use numeric ULAN-id order")
    return snapshot_id, base_catalog_sha256, normalized


def uri_values(value: Any) -> set[str]:
    """Find URI values recursively without retaining any surrounding text."""
    if isinstance(value, str):
        return {value} if URI_PATTERN.fullmatch(value) else set()
    if isinstance(value, list):
        return set().union(*(uri_values(item) for item in value)) if value else set()
    if isinstance(value, dict):
        return set().union(*(uri_values(item) for item in value.values())) if value else set()
    return set()


def key_ends_in(key: Any, suffix: str) -> bool:
    return isinstance(key, str) and (key == suffix or key.endswith(f"#{suffix}") or key.endswith(f"/{suffix}"))


def identifies_values(value: Any) -> list[Any]:
    """Return only values below an ``identifies`` predicate, recursively."""
    found: list[Any] = []
    if isinstance(value, list):
        for item in value:
            found.extend(identifies_values(item))
    elif isinstance(value, dict):
        for key, item in value.items():
            if key_ends_in(key, "identifies"):
                found.append(item)
            found.extend(identifies_values(item))
    return found


def attribution_uris(identifies: Any, kind: str) -> list[str]:
    values: set[str] = set()
    if isinstance(identifies, list):
        for item in identifies:
            values.update(attribution_uris(item, kind))
    elif isinstance(identifies, dict):
        for key, item in identifies.items():
            if key_ends_in(key, kind):
                values.update(uri_values(item))
            values.update(attribution_uris(item, kind))
    return sorted(values)


def graph_nodes(payload: Any) -> list[dict]:
    if isinstance(payload, dict) and isinstance(payload.get("@graph"), list):
        return [node for node in payload["@graph"] if isinstance(node, dict)]
    if isinstance(payload, dict):
        return [payload]
    raise RuntimeError("Getty response must be a JSON object")


def node_id(node: dict) -> Any:
    return node.get("@id", node.get("id"))


def node_types(node: dict) -> set[str]:
    raw = node.get("@type", node.get("type", []))
    if isinstance(raw, str):
        raw = [raw]
    return {
        value.rsplit("#", 1)[-1].rsplit("/", 1)[-1]
        for value in raw
        if isinstance(value, str)
    }


def project_response(row: dict, raw: bytes, content_type: str, representation_url: str) -> dict:
    subject_id = row["ulan_subject_id"]
    canonical_uri = canonical_ulan_uri(subject_id)
    expected_representation_url = f"{REPRESENTATION_URI_PREFIX}{subject_id}"
    if representation_url != expected_representation_url:
        raise RuntimeError(
            f"{subject_id}: refused redirected representation {representation_url!r}"
        )
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RuntimeError(f"{subject_id}: invalid JSON-LD response") from error
    nodes = graph_nodes(payload)
    subject_nodes = [node for node in nodes if node_id(node) == canonical_uri]
    if len(subject_nodes) != 1:
        raise RuntimeError(f"{subject_id}: canonical ULAN subject is missing or ambiguous")
    observed_types = node_types(subject_nodes[0])
    expected_type = "Person" if row["entity_type"] == "person" else "Group"
    incompatible_type = "Group" if expected_type == "Person" else "Person"
    if expected_type not in observed_types or incompatible_type in observed_types:
        raise RuntimeError(
            f"{subject_id}: expected exact ULAN type {expected_type!r}, "
            f"observed {sorted(observed_types)!r}"
        )

    subject = subject_nodes[0]
    equivalent_uris = sorted(uri_values(subject.get("equivalent", [])))
    equivalent_qid_values: list[str] = []
    for uri in equivalent_uris:
        for pattern in WIKIDATA_PATTERNS:
            match = pattern.fullmatch(uri)
            if match:
                equivalent_qid_values.append(match.group(1))
                break
    equivalent_qids = sorted(
        set(equivalent_qid_values),
        key=lambda qid: int(qid[1:]),
    )
    if equivalent_qid_values.count(row["wikidata_qid"]) != 1:
        raise RuntimeError(
            f"{subject_id}: selected QID {row['wikidata_qid']} is not exactly once "
            "in Getty identifies values"
        )
    identified_uris = {
        uri
        for item in identifies_values(payload)
        for uri in uri_values(item)
    }
    contributor_uris = sorted(
        uri
        for uri in identified_uris
        if CONTRIBUTOR_URI_PATTERN.fullmatch(uri)
    )
    source_uris = sorted(
        uri
        for uri in identified_uris
        if SOURCE_URI_PATTERN.fullmatch(uri)
    )
    return {
        "canonical_uri": canonical_uri,
        "contributor_uris": contributor_uris,
        "entity_id": row["entity_id"],
        "entity_type": row["entity_type"],
        "equivalent_qids": equivalent_qids,
        "native_record_id": f"ulan:{subject_id}",
        "raw_response_sha256": hashlib.sha256(raw).hexdigest(),
        "raw_retained": False,
        "representation_url": representation_url,
        "retrieved_at": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_uris": source_uris,
        "subject_id": subject_id,
        "type": expected_type,
        "wikidata_qid": row["wikidata_qid"],
        "content_type": content_type,
    }


def fetch_one(row: dict) -> dict:
    subject_id = row["ulan_subject_id"]
    url = f"{REPRESENTATION_URI_PREFIX}{subject_id}"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/ld+json",
            "User-Agent": "QROST-Architecture-History/0.1 (identity-only pilot)",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            raw = response.read()
            content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
            representation_url = response.geturl()
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
        raise RuntimeError(f"{subject_id}: Getty retrieval failed") from error
    if content_type not in {"application/ld+json", "application/json"}:
        raise RuntimeError(f"{subject_id}: expected JSON-LD, got {content_type!r}")
    return project_response(row, raw, content_type, representation_url)


def build_snapshot(crosswalk: Any, accessed: str) -> dict:
    crosswalk_snapshot_id, base_catalog_sha256, rows = normalized_crosswalk_records(crosswalk)
    records: dict[str, dict] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_one, row): row["ulan_subject_id"] for row in rows}
        for future in concurrent.futures.as_completed(futures):
            subject_id = futures[future]
            projection = future.result()
            records[subject_id] = {
                "projection": projection,
                "projection_sha256": canonical_hash(projection),
            }
            print(f"Getty ULAN: fetched {subject_id} ({len(records)}/{RECORD_COUNT})", flush=True)
    records = {subject_id: records[subject_id] for subject_id in sorted(records, key=int)}
    selection_sha256 = canonical_hash(rows)
    preimage = {
        "accessed": accessed,
        "adapter_id": ADAPTER_ID,
        "adapter_version": ADAPTER_VERSION,
        "attribution": GETTY_ATTRIBUTION,
        "base_catalog_sha256": base_catalog_sha256,
        "claim_evidence_allowed": True,
        "crosswalk_snapshot_id": crosswalk_snapshot_id,
        "license": "ODC-By-1.0",
        "license_url": "https://opendatacommons.org/licenses/by/1-0/",
        "raw_retained": False,
        "records": records,
        "selection": {
            "method": "wikidata_p245_exact_getty_identity",
            "record_count": RECORD_COUNT,
            "seed_sha256": selection_sha256,
        },
        "source_id": SOURCE_ID,
    }
    projection_sha256 = canonical_hash(preimage)
    snapshot_id = f"getty-ulan-identity-{accessed}-{projection_sha256[:12]}"
    return {
        **preimage,
        "projection_sha256": projection_sha256,
        "snapshot_id": snapshot_id,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("crosswalk", type=Path, help="Committed 24-row Wikidata ULAN crosswalk snapshot.")
    parser.add_argument("--accessed", default=date.today().isoformat(), help="Access date (YYYY-MM-DD).")
    parser.add_argument("--output", type=Path, help="Explicit output file; default is immutable snapshot filename.")
    parser.add_argument("--force", action="store_true", help="Allow replacing an explicit output path.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args.accessed):
        raise SystemExit("--accessed must be YYYY-MM-DD")
    crosswalk_path = args.crosswalk.resolve()
    require_committed_snapshot(crosswalk_path)
    snapshot = build_snapshot(load_json(crosswalk_path), args.accessed)
    output = args.output or SNAPSHOT_DIR / f"{snapshot['snapshot_id']}.json"
    if not output.is_absolute():
        output = (Path.cwd() / output).resolve()
    if output.exists() and not args.force:
        raise SystemExit(f"refusing to replace existing snapshot without --force: {output}")
    atomic_write_json(output, snapshot)
    display = output.relative_to(ROOT) if output.is_relative_to(ROOT) else output
    print(f"Wrote {display}: {len(snapshot['records'])} identity-only ULAN records", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
