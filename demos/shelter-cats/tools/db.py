"""SQLite source-of-truth: schema, upsert, and the delist sweep.

The DB is the durable store. fetch upserts what's currently live; cats that vanish
from a refreshed shelter's feed are marked 'removed' (or 'adopted') but KEPT — the
demo's premise is that cached data survives delisting ("被领养走也没关系，缓存还在").
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

CAT_COLS = [
    "id", "source", "source_id", "shelter_id", "name", "age_text", "age_bucket",
    "birth_estimate", "sex", "spayed_neutered", "breed_primary", "breed_secondary",
    "breed_mixed", "colors", "pattern", "coat_length", "size", "attributes",
    "good_with", "personality_tags", "description", "photo_url", "adoption_url",
    "status", "published_at", "avatar_sprite",
]
SHELTER_COLS = [
    "id", "source", "name", "country", "region", "city", "state", "address",
    "postcode", "lat", "lng", "website", "url", "email", "phone",
]
# mutable cat fields refreshed on every sighting (NOT first_seen / thumb_path / avatar_sprite)
CAT_MUTABLE = [c for c in CAT_COLS if c not in ("id", "source", "source_id", "shelter_id", "avatar_sprite")]


def connect(db_path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS shelters (
          id TEXT PRIMARY KEY, source TEXT, name TEXT, country TEXT, region TEXT,
          city TEXT, state TEXT, address TEXT, postcode TEXT, lat REAL, lng REAL,
          website TEXT, url TEXT, email TEXT, phone TEXT, last_seen TEXT
        );
        CREATE TABLE IF NOT EXISTS cats (
          id TEXT PRIMARY KEY, source TEXT, source_id TEXT, shelter_id TEXT,
          name TEXT, age_text TEXT, age_bucket TEXT, birth_estimate TEXT,
          sex TEXT, spayed_neutered INTEGER, breed_primary TEXT, breed_secondary TEXT,
          breed_mixed INTEGER, colors TEXT, pattern TEXT, coat_length TEXT, size TEXT,
          attributes TEXT, good_with TEXT, personality_tags TEXT, description TEXT,
          photo_url TEXT, thumb_path TEXT, adoption_url TEXT, status TEXT,
          published_at TEXT, avatar_sprite TEXT,
          first_seen TEXT, last_seen TEXT, last_status_change TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_cats_shelter ON cats(shelter_id);
        CREATE INDEX IF NOT EXISTS idx_cats_status ON cats(status);
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
        """
    )
    conn.commit()


def upsert_shelter(conn: sqlite3.Connection, row: dict, run_ts: str) -> None:
    vals = {k: row.get(k) for k in SHELTER_COLS}
    vals["last_seen"] = run_ts
    cols = SHELTER_COLS + ["last_seen"]
    placeholders = ",".join("?" for _ in cols)
    updates = ",".join(f"{c}=excluded.{c}" for c in cols if c != "id")
    conn.execute(
        f"INSERT INTO shelters ({','.join(cols)}) VALUES ({placeholders}) "
        f"ON CONFLICT(id) DO UPDATE SET {updates}",
        [vals[c] for c in cols],
    )


def upsert_cat(conn: sqlite3.Connection, row: dict, run_ts: str) -> str:
    existing = conn.execute("SELECT status FROM cats WHERE id=?", (row["id"],)).fetchone()
    if existing is None:
        cols = CAT_COLS + ["thumb_path", "first_seen", "last_seen", "last_status_change"]
        data = {k: row.get(k) for k in CAT_COLS}
        data["thumb_path"] = None
        data["first_seen"] = run_ts
        data["last_seen"] = run_ts
        data["last_status_change"] = run_ts
        placeholders = ",".join("?" for _ in cols)
        conn.execute(f"INSERT INTO cats ({','.join(cols)}) VALUES ({placeholders})",
                     [data[c] for c in cols])
        return "new"
    # existing: refresh mutable fields, keep first_seen/thumb_path/avatar_sprite
    sets = ",".join(f"{c}=?" for c in CAT_MUTABLE) + ", last_seen=?"
    params = [row.get(c) for c in CAT_MUTABLE] + [run_ts]
    if existing["status"] != row.get("status"):
        sets += ", last_status_change=?"
        params.append(run_ts)
    params.append(row["id"])
    conn.execute(f"UPDATE cats SET {sets} WHERE id=?", params)
    return "updated"


def delist(conn: sqlite3.Connection, source: str, shelter_ids: list[str],
           run_ts: str, removed_status: str = "removed") -> int:
    """Mark cats in the refreshed scope that were NOT seen this run as removed/adopted.
    Rows + thumbnails are retained."""
    if not shelter_ids:
        return 0
    qs = ",".join("?" for _ in shelter_ids)
    cur = conn.execute(
        f"UPDATE cats SET status=?, last_status_change=? "
        f"WHERE source=? AND shelter_id IN ({qs}) "
        f"AND (last_seen IS NULL OR last_seen < ?) AND status NOT IN ('removed','adopted')",
        [removed_status, run_ts, source, *shelter_ids, run_ts],
    )
    return cur.rowcount


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                 (key, value))


def get_meta(conn: sqlite3.Connection, key: str, default=None):
    r = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return r["value"] if r else default
