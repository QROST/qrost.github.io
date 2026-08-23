#!/usr/bin/env python3
"""Apply an editorial biographical-research pack to the SQLite authority store.

Reads a content-addressed research pack (editorial-research-YYYY-MM-DD-*.json,
source ``editorial-biographical-research``) and inserts one candidate
``worked_for`` relation per pack entry, with a claim whose evidence rows cite
the biography pages verbatim. Entries whose pair already has a relation
(from any source) are skipped, so the tool is idempotent.

Usage:
    python3 tools/apply_career_research.py <pack.json> [--dry-run]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "architecture-history.db"

REVIEWER_ID = "reviewer-agentic-zcode"
RELATION_CONFIDENCE = 0.5


def canonical_hash(value) -> str:
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True,
                   separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def person_id(qid: str) -> str:
    return f"person-wd-{qid.lower()}"


def practice_id(qid: str) -> str:
    return f"practice-wd-{qid.lower()}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pack", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    pack = json.loads(args.pack.read_text(encoding="utf-8"))
    snapshot_id = pack["snapshot_id"]
    entries_canonical = json.dumps(
        pack["entries"], ensure_ascii=False, sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    expected_id = (
        f"editorial-research-{pack['accessed']}-"
        f"{hashlib.sha256(entries_canonical).hexdigest()[:12]}"
    )
    if snapshot_id != expected_id:
        raise RuntimeError(
            f"snapshot id does not bind the entries hash: {snapshot_id!r}"
        )

    conn = sqlite3.connect(DB_PATH)
    existing_pairs = {
        (row[0], row[1], row[2])
        for row in conn.execute(
            "SELECT from_id, to_id, relation_type FROM relations"
        )
    }
    existing_people = {
        row[0]
        for row in conn.execute(
            "SELECT id FROM entities WHERE source_table='people'"
        )
    }
    existing_practices = {
        row[0]
        for row in conn.execute(
            "SELECT id FROM entities WHERE source_table='practices'"
        )
    }

    inserted = skipped_pair = missing_endpoint = 0
    for entry in pack["entries"]:
        employee = person_id(entry["employee_qid"])
        if entry["relation_type"] == "worked_at_practice":
            employer = practice_id(entry["employer_qid"])
            employer_pool = existing_practices
            relation_slug = "worked-at-practice"
        else:
            employer = person_id(entry["employer_qid"])
            employer_pool = existing_people
            relation_slug = "worked_for" if False else "worked-for"
        pair = (employee, employer, entry["relation_type"])
        reverse = (employer, employee, entry["relation_type"])
        if pair in existing_pairs or reverse in existing_pairs:
            skipped_pair += 1
            continue
        if employee not in existing_people or employer not in employer_pool:
            missing_endpoint += 1
            print(
                f"  SKIP (endpoint not in store): {employee} -> {employer}",
                file=sys.stderr,
            )
            continue

        slug_a = entry["employee_qid"].lower()
        slug_b = entry["employer_qid"].lower()
        relation_id = f"relation-res-{relation_slug}-{slug_a}-{slug_b}"
        claim_id = f"claim-{relation_id}"

        names = {}
        for eid in (employee, employer):
            row = conn.execute(
                "SELECT payload FROM entities WHERE id = ?", (eid,)
            ).fetchone()
            payload = json.loads(row[0])
            names[eid] = payload.get("name_en") or eid

        evidence_rows = []
        for index, citation in enumerate(entry["citations"]):
            evidence_rows.append({
                "accessed": pack["accessed"],
                "contributors": [],
                "extraction_method": "human_excerpt",
                "language": "en",
                "locator": f"{slug_a}/worked_for/{slug_b}#{index}",
                "native_field_path": f"/entries/{index}",
                "native_predicate": entry["relation_type"],
                "native_record_id": f"{entry['employee_qid']}/{entry['employer_qid']}",
                "qualifiers": [],
                "rank": None,
                "references": [],
                "snapshot_id": snapshot_id,
                "source_id": "editorial-biographical-research",
                "source_record_sha256": canonical_hash(entry),
                "support": "explicit",
                "url": citation["url"],
            })

        first_quote = entry["citations"][0]["quote_en"]
        context = {
            "date_end": None,
            "date_start": None,
            "institution_id": None,
            "note_en": (
                f"Biographical employment edge: {names[employee]} worked in "
                f"the office of {names[employer]}. Source quote: "
                f"\"{first_quote}\" ({entry['citations'][0]['title']})."
            ),
            "note_zh": (
                f"履历任职边：{names[employee]} 曾在 {names[employer]} 门下任职。"
                f"来源引文：\"{first_quote}\"（{entry['citations'][0]['title']}）。"
            ),
            "practice_id": None,
            "work_id": None,
        }

        relation_payload = {
            "claim_id": claim_id,
            "confidence": RELATION_CONFIDENCE,
            "context": context,
            "from_id": employee,
            "id": relation_id,
            "last_verified": pack["accessed"],
            "rejection_reasons": [
                "Biographical quote establishes employment but not exact "
                "tenure, role, or deputy rank."
            ],
            "relation_type": entry["relation_type"],
            "to_id": employer,
            "verification_status": "candidate",
        }
        claim_payload = {
            "confidence": RELATION_CONFIDENCE,
            "evidence": evidence_rows,
            "id": claim_id,
            "object": {"entity_id": employer},
            "predicate": entry["relation_type"],
            "qualifiers": {"from_id": employee},
            "reviewed_at": pack["accessed"],
            "reviewed_by": REVIEWER_ID,
            "subject_id": relation_id,
            "verification_status": "candidate",
        }

        if not args.dry_run:
            conn.execute(
                "INSERT INTO relations (id, from_id, to_id, relation_type,"
                " verification_status, confidence, claim_id, last_verified,"
                " context, rejection_reasons, payload)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    relation_id, employee, employer, entry["relation_type"],
                    "candidate", RELATION_CONFIDENCE, claim_id,
                    pack["accessed"], json.dumps(context, ensure_ascii=False),
                    json.dumps(relation_payload["rejection_reasons"],
                               ensure_ascii=False),
                    json.dumps(relation_payload, ensure_ascii=False,
                               sort_keys=True),
                ),
            )
            conn.execute(
                "INSERT INTO claims (id, subject_id, predicate,"
                " verification_status, confidence, reviewed_by, reviewed_at,"
                " object, qualifiers, payload)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    claim_id, relation_id, entry["relation_type"], "candidate",
                    RELATION_CONFIDENCE, REVIEWER_ID, pack["accessed"],
                    json.dumps(claim_payload["object"], ensure_ascii=False),
                    json.dumps(claim_payload["qualifiers"],
                               ensure_ascii=False),
                    json.dumps(claim_payload, ensure_ascii=False,
                               sort_keys=True),
                ),
            )
        existing_pairs.add(pair)
        inserted += 1
        print(f"  + {names[employee]} -> {names[employer]}")

    if not args.dry_run:
        conn.commit()
    conn.close()
    print(
        f"\nAPPLIED: {inserted} inserted, {skipped_pair} already present,"
        f" {missing_endpoint} skipped for missing endpoints."
    )
    print("Next: run `python3 tools/db.py export`.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
