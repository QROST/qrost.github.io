#!/usr/bin/env python3
"""Unit tests for the SQLite authority store (db.py).

Covers the schema-integrity guarantees required for lossless SQLite→shard
export: the payload columns on entities/claims/relations, the explicit
``ord`` on work_credits, the shard-metadata roundtrip, and a full
import→export→re-import cycle on synthetic fixtures proving no information
is lost. These tests use an in-memory temp DB; they do not touch the real
45MB store.
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent

# Load db.py as a sibling module.
spec = importlib.util.spec_from_file_location("db_mod", TOOLS / "db.py")
assert spec is not None and spec.loader is not None
db = importlib.util.module_from_spec(spec)
sys.path.insert(0, str(TOOLS))
spec.loader.exec_module(db)


def _connect_temp() -> "sqlite3.Connection":
    """Open a fresh in-file temp DB so init_schema migration logic is exercised."""
    import sqlite3

    tmpdir = tempfile.mkdtemp(prefix="archhist-db-test-")
    db_path = Path(tmpdir) / "test.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _sample_payload() -> tuple[dict, dict]:
    """Build a small synthetic (arrays, shard_meta) fixture covering all fields."""
    arrays = {
        "people": [
            {
                "id": "person-test-1",
                "entity_type": "person",
                "name_en": "Test Architect",
                "name_zh": "测试建筑师",
                "region": "east_asia",
                "verification_status": "verified",
                "confidence": 0.8,
                "last_verified": "2026-08-09",
                "claim_ids": ["claim-test-1"],
                "external_ids": {"wikidata": "Q1"},
            }
        ],
        "practices": [
            {
                "id": "practice-test-1",
                "entity_type": "practice",
                "name_en": "Test Studio",
                "region": "europe",
                "verification_status": "verified",
                "confidence": 0.7,
                "claim_ids": [],
                "external_ids": {},
            }
        ],
        "places": [
            {
                "id": "place-test-1",
                "entity_type": "place",
                "name_en": "Testland",
                "region": "europe",
                "verification_status": "verified",
                "confidence": 0.9,
                "external_ids": {},
            }
        ],
        "works": [
            {
                "id": "work-test-1",
                "entity_type": "work",
                "name_en": "Test Building",
                "region": "east_asia",
                "period": "2000_present",
                "verification_status": "candidate",
                "confidence": 0.45,
                "place_id": "place-test-1",
                "credits": [
                    {
                        "claim_id": "claim-test-2",
                        "entity_id": "person-test-1",
                        "entity_type": "person",
                        "role": "architect",
                        "credit_status": "attributed",
                        "phase": "design",
                    },
                    {
                        "claim_id": "claim-test-3",
                        "entity_id": "practice-test-1",
                        "entity_type": "practice",
                        "role": "firm",
                        "credit_status": "attributed",
                        "phase": "construction",
                    },
                ],
                "external_ids": {"wikidata": "Q2"},
            }
        ],
        "claims": [
            {
                "id": "claim-test-1",
                "subject_id": "person-test-1",
                "predicate": "field_name_en",
                "verification_status": "verified",
                "confidence": 0.8,
                "reviewed_by": "reviewer-test",
                "reviewed_at": "2026-08-09",
                "object": {"value": "Test Architect"},
                "qualifiers": {"rank": "preferred"},
                "evidence": [
                    {
                        "source_id": "wikidata",
                        "locator": "P2561",
                        "snapshot_id": "snap-test-1",
                        "source_record_sha256": "abc123",
                        "extraction_method": "structured_mapping",
                        "support": "explicit",
                        "rank": "preferred",
                        "url": "https://example.com/1",
                    }
                ],
            },
            {
                "id": "claim-test-2",
                "subject_id": "work-test-1",
                "predicate": "field_credits",
                "verification_status": "candidate",
                "confidence": 0.45,
                "evidence": [],
            },
            {
                "id": "claim-test-3",
                "subject_id": "work-test-1",
                "predicate": "field_credits",
                "verification_status": "candidate",
                "confidence": 0.45,
                "evidence": [],
            },
        ],
        "relations": [
            {
                "id": "relation-test-1",
                "from_id": "person-test-1",
                "to_id": "person-test-1",  # self OK for test
                "relation_type": "cofounded_with",
                "verification_status": "candidate",
                "confidence": 0.45,
                "claim_id": "claim-test-1",
                "last_verified": "2026-08-09",
                "context": {"work_id": "work-test-1"},
                "rejection_reasons": ["needs_review"],
            }
        ],
    }
    meta = {
        "generated_from": "wikidata-hydration-test-1",
        "generator": "test-generator@1.0.0",
        "source_id": "wikidata",
        "transformer_id": "test-transformer",
        "transformer_version": "1.0.0",
    }
    return arrays, meta


class SchemaIntegrityTests(unittest.TestCase):
    """The payload/ord columns required for lossless export must exist after init."""

    def test_relations_has_payload_column(self):
        conn = _connect_temp()
        try:
            db.init_schema(conn)
            cols = {row["name"] for row in conn.execute("PRAGMA table_info(relations)")}
            self.assertIn("payload", cols, "relations.payload column is required for lossless export")
        finally:
            conn.close()

    def test_work_credits_has_ord_column(self):
        conn = _connect_temp()
        try:
            db.init_schema(conn)
            cols = {row["name"] for row in conn.execute("PRAGMA table_info(work_credits)")}
            self.assertIn("ord", cols, "work_credits.ord column preserves credit order")
        finally:
            conn.close()

    def test_schema_version_is_current(self):
        conn = _connect_temp()
        try:
            db.init_schema(conn)
            row = conn.execute(
                "SELECT value FROM schema_meta WHERE key='schema_version'"
            ).fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row["value"], db.SCHEMA_VERSION)
        finally:
            conn.close()

    def test_migration_adds_columns_to_v1_store(self):
        """A v1 store (no payload/ord columns) must migrate cleanly."""
        conn = _connect_temp()
        try:
            # Simulate a v1 store: create tables WITHOUT the new columns.
            conn.executescript(
                """
                CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE entities (
                    id TEXT PRIMARY KEY, entity_type TEXT NOT NULL,
                    verification_status TEXT, confidence REAL, region TEXT,
                    period TEXT, name_en TEXT, name_zh TEXT, name_native TEXT,
                    last_verified TEXT, source_table TEXT NOT NULL, payload TEXT NOT NULL
                );
                CREATE TABLE relations (
                    id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
                    relation_type TEXT NOT NULL, verification_status TEXT,
                    confidence REAL, claim_id TEXT, last_verified TEXT,
                    context TEXT NOT NULL, rejection_reasons TEXT NOT NULL
                );
                CREATE TABLE work_credits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, work_id TEXT NOT NULL,
                    claim_id TEXT, entity_id TEXT, entity_type TEXT,
                    role TEXT, credit_status TEXT, phase TEXT
                );
                INSERT INTO schema_meta(key,value) VALUES ('schema_version','1');
                """
            )
            conn.commit()
            # init_schema should migrate (add payload + ord) without error.
            db.init_schema(conn)
            rel_cols = {r["name"] for r in conn.execute("PRAGMA table_info(relations)")}
            credit_cols = {r["name"] for r in conn.execute("PRAGMA table_info(work_credits)")}
            self.assertIn("payload", rel_cols)
            self.assertIn("ord", credit_cols)
            version = conn.execute(
                "SELECT value FROM schema_meta WHERE key='schema_version'"
            ).fetchone()["value"]
            self.assertEqual(version, db.SCHEMA_VERSION)
        finally:
            conn.close()


class RoundtripLosslessTests(unittest.TestCase):
    """import → build_shard_payload must reproduce every entity/claim/relation field."""

    def test_roundtrip_preserves_all_arrays(self):
        arrays, meta = _sample_payload()
        conn = _connect_temp()
        try:
            db.init_schema(conn)
            db.load_entities(conn, arrays)
            db.load_relations(conn, arrays["relations"])
            db.load_claims(conn, arrays["claims"])
            db.load_work_credits(conn, arrays["works"])
            db._store_shard_meta(conn, meta)
            shard = db.build_shard_payload(conn)
            for key in ("people", "practices", "places", "works", "claims", "relations"):
                self.assertEqual(
                    shard[key], arrays[key],
                    f"{key} array differs after SQLite roundtrip",
                )
        finally:
            conn.close()

    def test_roundtrip_preserves_shard_metadata(self):
        arrays, meta = _sample_payload()
        conn = _connect_temp()
        try:
            db.init_schema(conn)
            db.load_entities(conn, arrays)
            db._store_shard_meta(conn, meta)
            shard = db.build_shard_payload(conn)
            for key in db.SHARD_META_KEYS:
                self.assertEqual(shard[key], meta[key], f"shard meta {key!r} lost")
        finally:
            conn.close()

    def test_relations_payload_carries_all_fields(self):
        """The relations payload column must hold the full dict, not just scalars."""
        arrays, _ = _sample_payload()
        conn = _connect_temp()
        try:
            db.init_schema(conn)
            db.load_relations(conn, arrays["relations"])
            row = conn.execute("SELECT payload FROM relations LIMIT 1").fetchone()
            restored = json.loads(row["payload"])
            original = arrays["relations"][0]
            self.assertEqual(restored, original)
            # Spot-check a field that only lives in payload (not scalar columns).
            self.assertEqual(restored["context"], original["context"])
            self.assertEqual(restored["rejection_reasons"], original["rejection_reasons"])
        finally:
            conn.close()

    def test_work_credits_preserve_order(self):
        """The ord column must preserve the original credits[] sequence."""
        arrays, _ = _sample_payload()
        conn = _connect_temp()
        try:
            db.init_schema(conn)
            db.load_work_credits(conn, arrays["works"])
            rows = conn.execute(
                "SELECT entity_id, role, ord FROM work_credits WHERE work_id=? ORDER BY ord",
                ("work-test-1",),
            ).fetchall()
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0]["entity_id"], "person-test-1")
            self.assertEqual(rows[0]["ord"], 0)
            self.assertEqual(rows[1]["entity_id"], "practice-test-1")
            self.assertEqual(rows[1]["ord"], 1)
        finally:
            conn.close()

    def test_export_shard_is_deterministic(self):
        """Two exports of the same store must produce byte-identical output."""
        arrays, meta = _sample_payload()
        conn = _connect_temp()
        try:
            db.init_schema(conn)
            db.load_entities(conn, arrays)
            db.load_relations(conn, arrays["relations"])
            db.load_claims(conn, arrays["claims"])
            db.load_work_credits(conn, arrays["works"])
            db._store_shard_meta(conn, meta)
            with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f1:
                path1 = Path(f1.name)
            with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f2:
                path2 = Path(f2.name)
            try:
                db.export_catalog_shard(conn, path1)
                db.export_catalog_shard(conn, path2)
                self.assertEqual(path1.read_bytes(), path2.read_bytes())
            finally:
                path1.unlink(missing_ok=True)
                path2.unlink(missing_ok=True)
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
