#!/usr/bin/env python3
"""Local SQLite authority store for Architecture Lineages — the source of truth.

The SQLite store at ``data/architecture-history.db`` is the editable authority
for the entity graph (people / practices / places / works / claims /
relations). It is gitignored (rebuilt locally from a catalog shard or, on a
clean clone, from the published JSON). Edits happen here; ``export`` projects
the store back to a catalog shard, and ``build.py`` (unchanged) turns the
shard into the 8 public JSON tables served by GitHub Pages.

Data flow (single direction)::

    SQLite store  ──db.py export──▶  catalog shard  ──build.py──▶  8 public JSON

Usage::

    python3 tools/db.py import          # load catalog shard / projected JSON into the store
    python3 tools/db.py export          # store → shard → public JSON (runs build.py)
    python3 tools/db.py export --no-build  # store → shard only (fast iteration)
    python3 tools/db.py verify          # count-check every table vs the published JSON
    python3 tools/db.py query NAME      # run a canned analysis query
    python3 tools/db.py queries         # list canned queries
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(
    os.environ.get(
        "ARCH_HISTORY_ROOT",
        str(Path(__file__).resolve().parent.parent),
    )
).resolve()
DATA = ROOT / "assets" / "data"
CATALOG_DIR = DATA / "catalog"
DB_PATH = ROOT / "data" / "architecture-history.db"

SCHEMA_VERSION = "2"

# Top-level shard metadata keys preserved through import→export roundtrip.
# These are required by validate.py:3110-3136 (shard provenance checks) and
# must survive a SQLite roundtrip so the exported shard still satisfies the
# "generated_from -> known snapshot" / "source_id -> known source" contracts.
SHARD_META_KEYS = (
    "generated_from",
    "generator",
    "source_id",
    "transformer_id",
    "transformer_version",
)


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def catalog_payload() -> tuple[dict[str, list[dict]], dict[str, str]]:
    """Return ``(six_entity_lists, shard_metadata)`` from the catalog shard.

    The six lists (people/practices/places/works/claims/relations) are the
    editable graph. ``shard_metadata`` carries the top-level provenance keys
    (generated_from / generator / source_id / transformer_id /
    transformer_version) that validate.py requires on every full shard; they
    are preserved through the SQLite roundtrip so ``db.py export`` can emit a
    shard that still passes provenance checks.
    """
    shard_path = CATALOG_DIR / "wikidata-hydration.json"
    if shard_path.exists():
        shard = load_json(shard_path)
        arrays = {
            key: shard.get(key, [])
            for key in ("people", "practices", "places", "works", "claims", "relations")
        }
        meta = {key: shard[key] for key in SHARD_META_KEYS if key in shard}
        return arrays, meta
    # Fallback: project from the published JSON tables (smaller, but authoritative
    # for the public surface). Used when the catalog shard is absent (e.g. on a
    # clean clone that has not rerun fetch+import). Provenance metadata is
    # unavailable in this path; export callers must supply it explicitly.
    payload: dict[str, list[dict]] = {}
    for key, filename in (
        ("people", "people.json"),
        ("practices", "practices.json"),
        ("places", "places.json"),
        ("works", "works.json"),
        ("claims", "claims.json"),
        ("relations", "relations.json"),
    ):
        path = DATA / filename
        payload[key] = load_json(path)[key] if path.exists() else []
    return payload, {}


SCHEMA = """
CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    verification_status TEXT,
    confidence REAL,
    region TEXT,
    period TEXT,
    name_en TEXT,
    name_zh TEXT,
    name_native TEXT,
    last_verified TEXT,
    source_table TEXT NOT NULL,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS relations (
    id TEXT PRIMARY KEY,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    verification_status TEXT,
    confidence REAL,
    claim_id TEXT,
    last_verified TEXT,
    context TEXT NOT NULL,
    rejection_reasons TEXT NOT NULL,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    predicate TEXT,
    verification_status TEXT,
    confidence REAL,
    reviewed_by TEXT,
    reviewed_at TEXT,
    object TEXT,
    qualifiers TEXT,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS claim_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id TEXT NOT NULL,
    ord INTEGER NOT NULL,
    source_id TEXT,
    locator TEXT,
    snapshot_id TEXT,
    source_record_sha256 TEXT,
    extraction_method TEXT,
    support TEXT,
    rank TEXT,
    url TEXT,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS work_credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_id TEXT NOT NULL,
    ord INTEGER NOT NULL,
    claim_id TEXT,
    entity_id TEXT,
    entity_type TEXT,
    role TEXT,
    credit_status TEXT,
    phase TEXT
);
CREATE TABLE IF NOT EXISTS source_snapshots (
    path TEXT PRIMARY KEY,
    sha256 TEXT,
    size_bytes INTEGER,
    registered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(verification_status);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_region ON entities(region);
CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_id);
CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_id);
CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_relations_status ON relations(verification_status);
CREATE INDEX IF NOT EXISTS idx_claims_subject ON claims(subject_id);
CREATE INDEX IF NOT EXISTS idx_claims_predicate ON claims(predicate);
CREATE INDEX IF NOT EXISTS idx_evidence_claim ON claim_evidence(claim_id);
CREATE INDEX IF NOT EXISTS idx_credits_work ON work_credits(work_id);
CREATE INDEX IF NOT EXISTS idx_credits_entity ON work_credits(entity_id);
"""


def connect(db_path: Path = DB_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


def _existing_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}


def _migrate_schema(conn: sqlite3.Connection) -> None:
    """Add columns introduced after schema v1 to a pre-existing store.

    SQLite's ``ALTER TABLE ADD COLUMN`` is a safe, non-destructive operation.
    Guarded by column-existence checks so it is idempotent on fresh stores
    (where CREATE TABLE already has the columns) and on already-migrated ones.
    """
    if not conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='relations'"
    ).fetchone():
        return  # fresh store; CREATE TABLE in SCHEMA already has all columns
    rel_cols = _existing_columns(conn, "relations")
    if "payload" not in rel_cols:
        conn.execute("ALTER TABLE relations ADD COLUMN payload TEXT NOT NULL DEFAULT '{}'")
    credit_cols = _existing_columns(conn, "work_credits")
    if "ord" not in credit_cols:
        # Existing rows get ord=0; a full re-import repopulates correct ordering.
        conn.execute("ALTER TABLE work_credits ADD COLUMN ord INTEGER NOT NULL DEFAULT 0")


def init_schema(conn: sqlite3.Connection) -> None:
    _migrate_schema(conn)
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT OR REPLACE INTO schema_meta(key, value) VALUES (?, ?)",
        ("schema_version", SCHEMA_VERSION),
    )
    conn.commit()


def _scalar(entity: dict, key: str) -> Any:
    value = entity.get(key)
    return value if isinstance(value, (str, int, float)) or value is None else None


def load_entities(conn: sqlite3.Connection, payload: dict[str, list[dict]]) -> int:
    conn.execute("DELETE FROM entities")
    rows = []
    # entities come from four lists; places lacks the catalog shard entry and is
    # loaded from the projected JSON either way (catalog_payload handles both).
    for source_table in ("people", "practices", "places", "works"):
        for entity in payload.get(source_table, []):
            rows.append(
                (
                    entity["id"],
                    entity.get("entity_type", source_table.rstrip("s")),
                    entity.get("verification_status"),
                    _scalar(entity, "confidence"),
                    entity.get("region"),
                    entity.get("period"),
                    entity.get("name_en"),
                    entity.get("name_zh"),
                    entity.get("name_native"),
                    entity.get("last_verified"),
                    source_table,
                    json.dumps(entity, ensure_ascii=False, sort_keys=True),
                )
            )
    conn.executemany(
        """INSERT INTO entities
           (id, entity_type, verification_status, confidence, region, period,
            name_en, name_zh, name_native, last_verified, source_table, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()
    return len(rows)


def load_relations(conn: sqlite3.Connection, relations: list[dict]) -> int:
    conn.execute("DELETE FROM relations")
    rows = []
    for relation in relations:
        rows.append(
            (
                relation["id"],
                relation["from_id"],
                relation["to_id"],
                relation["relation_type"],
                relation.get("verification_status"),
                _scalar(relation, "confidence"),
                relation.get("claim_id"),
                relation.get("last_verified"),
                json.dumps(relation.get("context", {}), ensure_ascii=False, sort_keys=True),
                json.dumps(relation.get("rejection_reasons", []), ensure_ascii=False, sort_keys=True),
                json.dumps(relation, ensure_ascii=False, sort_keys=True),
            )
        )
    conn.executemany(
        """INSERT INTO relations
           (id, from_id, to_id, relation_type, verification_status, confidence,
            claim_id, last_verified, context, rejection_reasons, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()
    return len(rows)


def load_claims(conn: sqlite3.Connection, claims: list[dict]) -> int:
    conn.execute("DELETE FROM claims")
    conn.execute("DELETE FROM claim_evidence")
    claim_rows = []
    evidence_rows = []
    for claim in claims:
        obj = claim.get("object")
        quals = claim.get("qualifiers")
        claim_rows.append(
            (
                claim["id"],
                claim.get("subject_id"),
                claim.get("predicate"),
                claim.get("verification_status"),
                _scalar(claim, "confidence"),
                claim.get("reviewed_by"),
                claim.get("reviewed_at"),
                json.dumps(obj, ensure_ascii=False, sort_keys=True) if obj is not None else None,
                json.dumps(quals, ensure_ascii=False, sort_keys=True) if quals is not None else None,
                json.dumps(claim, ensure_ascii=False, sort_keys=True),
            )
        )
        for ord_, evidence in enumerate(claim.get("evidence", [])):
            evidence_rows.append(
                (
                    claim["id"],
                    ord_,
                    evidence.get("source_id"),
                    evidence.get("locator"),
                    evidence.get("snapshot_id"),
                    evidence.get("source_record_sha256"),
                    evidence.get("extraction_method"),
                    evidence.get("support"),
                    evidence.get("rank"),
                    evidence.get("url"),
                    json.dumps(evidence, ensure_ascii=False, sort_keys=True),
                )
            )
    conn.executemany(
        """INSERT INTO claims
           (id, subject_id, predicate, verification_status, confidence,
            reviewed_by, reviewed_at, object, qualifiers, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        claim_rows,
    )
    if evidence_rows:
        conn.executemany(
            """INSERT INTO claim_evidence
               (claim_id, ord, source_id, locator, snapshot_id,
                source_record_sha256, extraction_method, support, rank, url, payload)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            evidence_rows,
        )
    conn.commit()
    return len(claim_rows)


def load_work_credits(conn: sqlite3.Connection, works: list[dict]) -> int:
    conn.execute("DELETE FROM work_credits")
    rows = []
    for work in works:
        for ord_, credit in enumerate(work.get("credits", []) or []):
            rows.append(
                (
                    work["id"],
                    ord_,
                    credit.get("claim_id"),
                    credit.get("entity_id"),
                    credit.get("entity_type"),
                    credit.get("role"),
                    credit.get("credit_status"),
                    credit.get("phase"),
                )
            )
    conn.executemany(
        """INSERT INTO work_credits
           (work_id, ord, claim_id, entity_id, entity_type, role, credit_status, phase)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()
    return len(rows)


def register_source_snapshots(conn: sqlite3.Connection) -> int:
    """Record local snapshot files (path + sha256 + size) for audit."""
    import hashlib
    from datetime import datetime, timezone

    conn.execute("DELETE FROM source_snapshots")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = []
    snapshots_dir = DATA / "source-snapshots"
    if snapshots_dir.exists():
        for path in sorted(snapshots_dir.glob("*.json")):
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            rows.append(
                (
                    path.relative_to(ROOT).as_posix(),
                    digest,
                    path.stat().st_size,
                    now,
                )
            )
    catalog_shard = CATALOG_DIR / "wikidata-hydration.json"
    if catalog_shard.exists():
        digest = hashlib.sha256(catalog_shard.read_bytes()).hexdigest()
        rows.append(
            (
                catalog_shard.relative_to(ROOT).as_posix(),
                digest,
                catalog_shard.stat().st_size,
                now,
            )
        )
    if rows:
        conn.executemany(
            "INSERT OR REPLACE INTO source_snapshots(path, sha256, size_bytes, registered_at) VALUES (?, ?, ?, ?)",
            rows,
        )
    conn.commit()
    return len(rows)


def _store_shard_meta(conn: sqlite3.Connection, meta: dict[str, str]) -> None:
    """Persist shard provenance so ``db.py export`` can rebuild a valid shard.

    Mirrors the top-level keys a Wikidata-hydration shard carries
    (generated_from / source_id / transformer_*); validate.py requires these
    on every full catalog shard.
    """
    for key, value in meta.items():
        conn.execute(
            "INSERT OR REPLACE INTO schema_meta(key, value) VALUES (?, ?)",
            (f"source_{key}", value),
        )
    conn.commit()


def cmd_import(conn: sqlite3.Connection) -> int:
    payload, shard_meta = catalog_payload()
    init_schema(conn)
    n_entities = load_entities(conn, payload)
    n_relations = load_relations(conn, payload["relations"])
    n_claims = load_claims(conn, payload["claims"])
    n_credits = load_work_credits(conn, payload["works"])
    n_snapshots = register_source_snapshots(conn)
    _store_shard_meta(conn, shard_meta)
    print(
        f"Imported: {n_entities} entities, {n_relations} relations, "
        f"{n_claims} claims, {n_credits} work credits, {n_snapshots} local snapshots."
    )
    if shard_meta:
        print(
            f"Shard meta: {shard_meta.get('source_id', '?')} "
            f"via {shard_meta.get('transformer_id', '?')} "
            f"v{shard_meta.get('transformer_version', '?')}"
        )
    print(f"Store: {DB_PATH.relative_to(ROOT)}")
    return 0


# --- export path: SQLite → catalog shard → public JSON ----------------------

SHARD_PATH = CATALOG_DIR / "wikidata-hydration.json"
ENTITY_SOURCE_TABLES = ("people", "practices", "places", "works")


def atomic_write_bytes(path: Path, content: bytes) -> None:
    """Write ``content`` to ``path`` atomically (temp + replace)."""
    import tempfile

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


def write_json(path: Path, payload: Any) -> None:
    """Dump ``payload`` in the canonical shard format (matches importer)."""
    atomic_write_bytes(
        path,
        (
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
            + "\n"
        ).encode("utf-8"),
    )


def _load_shard_meta(conn: sqlite3.Connection) -> dict[str, str]:
    """Read the persisted shard provenance keys back from schema_meta."""
    meta: dict[str, str] = {}
    for row in conn.execute("SELECT key, value FROM schema_meta"):
        key = row["key"]
        if key.startswith("source_") and key not in ("source_",):
            meta[key[len("source_"):]] = row["value"]
    return meta


def _collect_entities(conn: sqlite3.Connection, source_table: str) -> list[dict]:
    """Rebuild one entity array from the entities table, ordered by id.

    Entities are stored with their complete original dict in the payload
    column (see load_entities), so this is a lossless projection. Ordering
    by id matches the importer's output convention so the exported shard is
    byte-stable.
    """
    rows = conn.execute(
        "SELECT payload FROM entities WHERE source_table = ? ORDER BY id",
        (source_table,),
    ).fetchall()
    return [json.loads(row["payload"]) for row in rows]


def _collect_claims(conn: sqlite3.Connection) -> list[dict]:
    """Rebuild the claims array from the claims table, ordered by id."""
    rows = conn.execute("SELECT payload FROM claims ORDER BY id").fetchall()
    return [json.loads(row["payload"]) for row in rows]


def _collect_relations(conn: sqlite3.Connection) -> list[dict]:
    """Rebuild the relations array from the relations payload column."""
    rows = conn.execute("SELECT payload FROM relations ORDER BY id").fetchall()
    return [json.loads(row["payload"]) for row in rows]


def build_shard_payload(conn: sqlite3.Connection) -> dict:
    """Assemble the full catalog-shard dict from the SQLite store.

    The six entity/relation arrays come from the payload columns (lossless);
    the five top-level provenance keys (generated_from / source_id /
    transformer_id / transformer_version / generator) come from schema_meta.
    """
    shard: dict[str, Any] = {}
    for source_table in ENTITY_SOURCE_TABLES:
        shard[source_table] = _collect_entities(conn, source_table)
    shard["claims"] = _collect_claims(conn)
    shard["relations"] = _collect_relations(conn)
    meta = _load_shard_meta(conn)
    for key in SHARD_META_KEYS:
        if key in meta:
            shard[key] = meta[key]
    return shard


def export_catalog_shard(conn: sqlite3.Connection, path: Path = SHARD_PATH) -> int:
    """Write the SQLite store back to a catalog shard file (lossless)."""
    shard = build_shard_payload(conn)
    write_json(path, shard)
    counts = {key: len(shard[key]) for key in ENTITY_SOURCE_TABLES}
    counts["claims"] = len(shard["claims"])
    counts["relations"] = len(shard["relations"])
    return sum(counts.values())


def cmd_export(conn: sqlite3.Connection, shard_path: Path, run_build: bool) -> int:
    """Export the SQLite store to the catalog shard, then optionally build.

    With ``run_build=True`` (default), after writing the shard it invokes
    ``tools/build.py`` which regenerates the 8 public JSON tables + manifest
    + loader constants + html tokens and runs the full validate/test gate.
    """
    n = export_catalog_shard(conn, shard_path)
    rel = shard_path.relative_to(ROOT) if shard_path.is_relative_to(ROOT) else shard_path
    print(f"Exported {n} records to shard: {rel}")
    if run_build:
        import subprocess

        print("Running build.py (shard → public JSON + manifest + validate gate)...")
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools" / "build.py")],
            cwd=ROOT,
        )
        if result.returncode != 0:
            print(f"build.py failed (exit {result.returncode})", file=sys.stderr)
            return result.returncode
    return 0


def _json_counts() -> dict[str, int]:
    """Return entity counts from the source-of-truth JSON for verification."""
    counts: dict[str, int] = {}
    for key, filename in (
        ("people", "people.json"),
        ("practices", "practices.json"),
        ("places", "places.json"),
        ("works", "works.json"),
        ("claims", "claims.json"),
        ("relations", "relations.json"),
    ):
        path = DATA / filename
        counts[key] = len(load_json(path)[key]) if path.exists() else 0
    return counts


def cmd_verify(conn: sqlite3.Connection) -> int:
    json_counts = _json_counts()
    failures = 0
    print(f"{'table':<14} {'sqlite':>8} {'json':>8}  status")
    for source_table in ("people", "practices", "places", "works"):
        sqlite_count = conn.execute(
            "SELECT COUNT(*) FROM entities WHERE source_table = ?",
            (source_table,),
        ).fetchone()[0]
        json_count = json_counts[source_table]
        ok = sqlite_count == json_count
        failures += 0 if ok else 1
        print(
            f"{source_table:<14} {sqlite_count:>8} {json_count:>8}  "
            f"{'OK' if ok else 'MISMATCH'}"
        )
    for table in ("claims", "relations"):
        sqlite_count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        json_count = json_counts[table]
        ok = sqlite_count == json_count
        failures += 0 if ok else 1
        print(
            f"{table:<14} {sqlite_count:>8} {json_count:>8}  "
            f"{'OK' if ok else 'MISMATCH'}"
        )

    # spot-check: verified people in sqlite vs json
    sqlite_verified = conn.execute(
        "SELECT COUNT(*) FROM entities WHERE entity_type='person' AND verification_status='verified'"
    ).fetchone()[0]
    people = load_json(DATA / "people.json")["people"]
    json_verified = sum(1 for p in people if p.get("verification_status") == "verified")
    ok = sqlite_verified == json_verified
    failures += 0 if ok else 1
    print(
        f"{'(verified ppl)':<14} {sqlite_verified:>8} {json_verified:>8}  "
        f"{'OK' if ok else 'MISMATCH'}"
    )
    print(f"\n{'ALL OK' if failures == 0 else str(failures) + ' MISMATCH(es)'}")
    return 1 if failures else 0


CANNED_QUERIES: dict[str, str] = {
    "verification_summary": """Counts by entity_type x verification_status""",
    "relation_endpoints_verified": """Relations whose BOTH endpoints are verified entities (candidates for agentic relation upgrade)""",
    "relation_status_by_type": """Relation count grouped by relation_type x verification_status""",
    "empty_credit_works": """Works with zero credits (source attribution gap)""",
    "empty_credit_works_by_region": """Empty-credit works grouped by region""",
    "verified_person_relations": """Relations touching at least one verified person""",
    "person_degree": """Top people by relation degree (most connected in the graph)""",
}


def _render(rows: Iterable[sqlite3.Row], headers: list[str]) -> None:
    print(" | ".join(headers))
    print(" | ".join("-" * len(h) for h in headers))
    count = 0
    for row in rows:
        count += 1
        print(" | ".join(str(row[h] if h in row.keys() else row[i]) for i, h in enumerate(headers)))
    print(f"\n({count} row(s))")


def cmd_query(conn: sqlite3.Connection, name: str) -> int:
    name = name.strip().lower()
    if name in ("list", "queries", "help", ""):
        print("Canned queries:")
        for key, desc in CANNED_QUERIES.items():
            print(f"  {key:<32} {desc}")
        return 0
    if name not in CANNED_QUERIES:
        print(f"unknown query: {name!r}. Use 'queries' to list.", file=sys.stderr)
        return 2

    if name == "verification_summary":
        rows = conn.execute(
            """SELECT entity_type, verification_status, COUNT(*) AS n
               FROM entities GROUP BY entity_type, verification_status
               ORDER BY entity_type, verification_status"""
        ).fetchall()
        _render(rows, ["entity_type", "verification_status", "n"])
    elif name == "relation_endpoints_verified":
        rows = conn.execute(
            """SELECT r.id, r.relation_type, r.from_id, r.to_id,
                      r.verification_status, r.confidence
               FROM relations r
               JOIN entities f ON f.id = r.from_id AND f.verification_status = 'verified'
               JOIN entities t ON t.id = r.to_id AND t.verification_status = 'verified'
               ORDER BY r.relation_type, r.id"""
        ).fetchall()
        _render(rows, ["id", "relation_type", "from_id", "to_id", "verification_status", "confidence"])
    elif name == "relation_status_by_type":
        rows = conn.execute(
            """SELECT relation_type, verification_status, COUNT(*) AS n
               FROM relations GROUP BY relation_type, verification_status
               ORDER BY relation_type, verification_status"""
        ).fetchall()
        _render(rows, ["relation_type", "verification_status", "n"])
    elif name == "empty_credit_works":
        rows = conn.execute(
            """SELECT w.id, w.name_en, w.region, w.period
               FROM entities w
               LEFT JOIN work_credits c ON c.work_id = w.id
               WHERE w.source_table = 'works' AND c.work_id IS NULL
               ORDER BY w.region, w.period, w.id"""
        ).fetchall()
        _render(rows, ["id", "name_en", "region", "period"])
    elif name == "empty_credit_works_by_region":
        rows = conn.execute(
            """SELECT w.region, COUNT(*) AS n
               FROM entities w
               LEFT JOIN work_credits c ON c.work_id = w.id
               WHERE w.source_table = 'works' AND c.work_id IS NULL
               GROUP BY w.region ORDER BY n DESC"""
        ).fetchall()
        _render(rows, ["region", "n"])
    elif name == "verified_person_relations":
        rows = conn.execute(
            """SELECT COUNT(DISTINCT r.id) AS n
               FROM relations r
               JOIN entities f ON f.id = r.from_id AND f.entity_type='person' AND f.verification_status='verified'
               JOIN entities t ON t.id = r.to_id AND t.entity_type='person' AND t.verification_status='verified'
               WHERE r.relation_type IN ('student_of_recorded','documented_influence')"""
        ).fetchone()
        print(f"person-to-person relations with both endpoints verified: {rows['n']}")
    elif name == "person_degree":
        rows = conn.execute(
            """SELECT endpoint, name_en, COUNT(*) AS degree FROM (
                   SELECT r.from_id AS endpoint, r.id AS rid FROM relations r
                   WHERE r.relation_type IN ('student_of_recorded','documented_influence')
                   UNION
                   SELECT r.to_id AS endpoint, r.id AS rid FROM relations r
                   WHERE r.relation_type IN ('student_of_recorded','documented_influence')
               ) d
               JOIN entities e ON e.id = d.endpoint
               WHERE e.entity_type='person'
               GROUP BY endpoint ORDER BY degree DESC LIMIT 20"""
        ).fetchall()
        _render(rows, ["endpoint", "name_en", "degree"])
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("import", help="load catalog shard / projected JSON into the store")
    ex = sub.add_parser(
        "export",
        help="write the SQLite store back to the catalog shard (+ optional build)",
    )
    ex.add_argument(
        "--shard",
        type=Path,
        default=SHARD_PATH,
        help=f"shard output path (default: {SHARD_PATH.relative_to(ROOT)})",
    )
    ex.add_argument(
        "--no-build",
        action="store_true",
        help="only write the shard; skip regenerating public JSON via build.py",
    )
    sub.add_parser("verify", help="count-check every table vs the published JSON")
    q = sub.add_parser("query", help="run a canned analysis query")
    q.add_argument("name", nargs="?", default="", help="query name (or 'queries')")
    args = parser.parse_args(argv)

    conn = connect()
    try:
        if args.cmd == "import":
            return cmd_import(conn)
        if args.cmd == "export":
            return cmd_export(conn, args.shard, run_build=not args.no_build)
        if args.cmd == "verify":
            return cmd_verify(conn)
        if args.cmd == "query":
            return cmd_query(conn, args.name)
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
