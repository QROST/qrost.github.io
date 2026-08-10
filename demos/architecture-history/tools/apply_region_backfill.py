#!/usr/bin/env python3
"""Apply region/country_codes backfill to the SQLite authority store.

Reads a JSON array of region assignments (produced by a Wikidata P27/P19
lookup pass) and updates the affected people entities in the local SQLite
store. Each assignment carries:

    {"id": "person-wd-q151759", "region": "europe",
     "country_codes": ["DE"], "basis": "P27=Q183 Germany"}

The script updates both the ``region`` index column and the ``payload`` JSON
(rewriting its ``region`` and ``country_codes`` fields) so the change survives
a subsequent ``db.py export``. Entries already carrying the target region are
skipped (idempotent). Entries with region "unknown" in the mapping are left
untouched (no evidence found).

After running, export with::

    python3 tools/db.py export

Usage::

    python3 tools/apply_region_backfill.py /tmp/region-backfill.json [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "architecture-history.db"

VALID_REGIONS = {
    "east_asia", "south_asia", "southeast_asia", "central_west_asia",
    "africa", "europe", "north_america", "latin_america_caribbean",
    "oceania", "transregional",
}


def load_assignments(path: Path) -> list[dict]:
    data = json.load(path.open(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit(f"{path}: expected a JSON array, got {type(data).__name__}")
    return data


def apply(
    conn: sqlite3.Connection,
    assignments: list[dict],
    dry_run: bool = False,
) -> dict[str, int]:
    """Apply region backfill. Returns a summary counter.

    When a region backfill populates a previously-empty region/country_codes on
    a *verified* entity, the entity is demoted to ``candidate``: the new
    geographic values are Wikidata-evidenced but have not passed the
    field-claim agentic review that validate.py requires for verified status
    (verified entities need exact verified claims for every non-empty field).
    The region data is still correct and valuable; demotion is the honest
    signal that the field-level evidence trail needs rebuilding. A subsequent
    agentic_review_person.py run can re-verify once field_region /
    field_country_codes claims exist.
    """
    stats = {"applied": 0, "demoted_verified": 0, "skipped_same": 0,
             "skipped_unknown": 0, "not_found": 0, "invalid": 0}
    for entry in assignments:
        entity_id = entry.get("id")
        region = entry.get("region")
        codes = entry.get("country_codes", [])
        if not entity_id or not isinstance(entity_id, str):
            stats["invalid"] += 1
            continue
        if region == "unknown" or region is None:
            stats["skipped_unknown"] += 1
            continue
        if region not in VALID_REGIONS:
            print(f"  INVALID region {region!r} for {entity_id}", file=sys.stderr)
            stats["invalid"] += 1
            continue
        if not isinstance(codes, list):
            codes = []
        codes = sorted({c.upper() for c in codes if isinstance(c, str) and len(c) == 2})

        row = conn.execute(
            "SELECT region, payload FROM entities WHERE id = ?", (entity_id,)
        ).fetchone()
        if row is None:
            print(f"  NOT FOUND in store: {entity_id}", file=sys.stderr)
            stats["not_found"] += 1
            continue

        payload = json.loads(row["payload"])
        current_region = payload.get("region")
        current_codes = sorted(payload.get("country_codes", []))
        if current_region == region and current_codes == codes:
            stats["skipped_same"] += 1
            continue

        # Demote verified entities whose region/country_codes field is being
        # populated for the first time (was unknown/empty → now has a value).
        # Entities already carrying a non-unknown region are not demoted by a
        # region *correction* (that is a separate review action).
        was_empty = (current_region in (None, "unknown") and not current_codes)
        if was_empty and payload.get("verification_status") == "verified":
            payload["verification_status"] = "candidate"
            payload["confidence"] = min(payload.get("confidence", 0.5), 0.5)
            payload["last_verified"] = None
            stats["demoted_verified"] += 1

        payload["region"] = region
        payload["country_codes"] = codes
        new_payload = json.dumps(payload, ensure_ascii=False, sort_keys=True)

        if dry_run:
            demote = " (demote verified→candidate)" if was_empty and stats["demoted_verified"] else ""
            print(f"  WOULD UPDATE {entity_id}: {current_region}/{current_codes} -> {region}/{codes}{demote}")
        else:
            conn.execute(
                "UPDATE entities SET region = ?, payload = ? WHERE id = ?",
                (region, new_payload, entity_id),
            )
        stats["applied"] += 1
    if not dry_run:
        conn.commit()
    return stats


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("assignments", type=Path, help="JSON file with region assignments")
    parser.add_argument("--dry-run", action="store_true", help="show changes without writing")
    args = parser.parse_args(argv)

    if not DB_PATH.exists():
        raise SystemExit(f"SQLite store not found at {DB_PATH}. Run `python3 tools/db.py import` first.")
    if not args.assignments.exists():
        raise SystemExit(f"Assignments file not found: {args.assignments}")

    assignments = load_assignments(args.assignments)
    print(f"Loaded {len(assignments)} region assignments from {args.assignments}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        stats = apply(conn, assignments, dry_run=args.dry_run)
    finally:
        conn.close()

    mode = "DRY RUN" if args.dry_run else "APPLIED"
    print(f"\n{mode}: {stats['applied']} updated ({stats['demoted_verified']} verified→candidate), "
          f"{stats['skipped_same']} already correct, "
          f"{stats['skipped_unknown']} no-evidence (left unknown), "
          f"{stats['not_found']} not in store, {stats['invalid']} invalid.")
    if not args.dry_run and stats["applied"] > 0:
        print("\nNext: run `python3 tools/db.py export` to project the store to public JSON.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
