#!/usr/bin/env python3
"""Remove wrong-direction student_of_recorded edges after a fresh import.

Wikidata carries mutual P1066 (student of) claims on a handful of items —
fellow Beaux-Arts atelier members coded as each other's students, plus a
few genuine direction errors. Both directions get imported; keep only the
canonically correct direction per pair (curated 2026-11-11):

    keep Larche -> Guadet            (Guadet was the professor)
    delete Viti <-> Raphael          (contemporaries, no teacher relation)
    delete Audoul <-> Ménil/Pottier/Langlois/de Hoÿm/Dufétel  (fellow students)

Run after import_wikidata_pilot.py / db.py import, before db.py export.
Idempotent: pairs already absent are skipped.
"""

from __future__ import annotations

import sqlite3

KEEP_DIRECTION = {
    # (teacher, student): the surviving edge direction
    ("person-wd-q3189515", "person-wd-q110017516"),  # Guadet -> Larche
}
DELETE_PAIRS = [
    ("person-wd-q106519752", "person-wd-q50805176"),  # Ménil <-> Audoul
    ("person-wd-q50805176", "person-wd-q106519752"),
    ("person-wd-q16253269", "person-wd-q50805176"),   # Pottier <-> Audoul
    ("person-wd-q50805176", "person-wd-q16253269"),
    ("person-wd-q2965393", "person-wd-q50805176"),    # Langlois <-> Audoul
    ("person-wd-q50805176", "person-wd-q2965393"),
    ("person-wd-q3263481", "person-wd-q50805176"),    # de Hoÿm <-> Audoul
    ("person-wd-q50805176", "person-wd-q3263481"),
    ("person-wd-q50805176", "person-wd-q63248583"),   # Audoul <-> Dufétel
    ("person-wd-q63248583", "person-wd-q50805176"),
    ("person-wd-q1709100", "person-wd-q5597"),        # Viti <-> Raphael
    ("person-wd-q5597", "person-wd-q1709100"),
    ("person-wd-q3189515", "person-wd-q110017516"),   # Guadet -> Larche (wrong way)
]


def main() -> int:
    conn = sqlite3.connect("data/architecture-history.db")
    cur = conn.cursor()
    rids = []
    for f, t in DELETE_PAIRS:
        rid = f"relation-wd-student-recorded-{f[10:]}-{t[11:]}"
        if cur.execute("SELECT 1 FROM relations WHERE id=?", (rid,)).fetchone():
            rids.append(rid)
    for rid in rids:
        cid = f"claim-{rid}"
        cur.execute("DELETE FROM claim_evidence WHERE claim_id=?", (cid,))
        cur.execute("DELETE FROM claims WHERE id=?", (cid,))
        cur.execute("DELETE FROM relations WHERE id=?", (rid,))
    conn.commit()
    print(f"bidi cleanup: removed {len(rids)} wrong-direction student edges")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
