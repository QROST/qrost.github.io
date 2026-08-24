#!/usr/bin/env python3
"""Regression checks for the deterministic 2026 breakthrough migration."""
from __future__ import annotations

import copy
import hashlib
import json
import re
from pathlib import Path

from migrate_breakthrough_contract import migrate_milestone

ROOT = Path(__file__).resolve().parent.parent
BREAKTHROUGHS = ROOT / "assets" / "data" / "breakthroughs.json"
LEDGER = ROOT / "tools" / "breakthrough-contract-migration.json"


def main() -> int:
    data = json.loads(BREAKTHROUGHS.read_text(encoding="utf-8"))
    milestones = data["milestones"]
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))

    assert len(milestones) == 269, len(milestones)
    assert len({m["id"] for m in milestones}) == len(milestones)
    assert all(re.fullmatch(r"[a-z0-9][a-z0-9-]*", m["id"]) for m in milestones)
    assert all(re.fullmatch(r"\d{4}-\d{2}(-\d{2})?", m["date"]) for m in milestones)
    assert not any(m.get("evidence_level") == "reported" for m in milestones)
    assert not any("source_research" in m for m in milestones)

    assert ledger["counts"]["id_mappings"] == 244
    assert ledger["counts"]["date_mappings"] == 124
    assert ledger["counts"]["evidence_mappings"] == 252
    assert ledger["counts"]["inline_sources_scoped"] == 961
    assert ledger["counts"]["source_urls_scoped"] == 139
    assert ledger["counts"]["total_external_links_scoped"] == 1100
    assert ledger["counts"]["policy_candidates"] == 96
    assert len(ledger["policy_candidate_ids"]) == 96
    assert len(ledger["id_map"]) == 244
    assert len(ledger["date_map"]) == 124
    assert len(ledger["evidence_map"]) == 252
    assert ledger["breakthroughs_sha256"] == hashlib.sha256(BREAKTHROUGHS.read_bytes()).hexdigest()

    by_id = {m["id"]: m for m in milestones}
    for row in ledger["date_map"]:
        milestone = by_id[row["id"]]
        assert milestone["date"] == row["new_date"]
        assert milestone["date_precision"] == "year"
        assert milestone["date"].endswith("-01")
    for row in ledger["evidence_map"]:
        milestone = by_id[row["id"]]
        assert milestone["evidence_level"] == "candidate"
        assert float(milestone["confidence"]) <= 0.5

    # The transform itself must be stable after its first application.
    sample = {
        "id": "sample-product-fea_structure-2020",
        "date": "2020",
        "evidence_level": "reported",
        "confidence": 0.88,
        "source_research": "composer-2.5",
        "sources": [{"url": "https://example.org/report", "title": "Example"}],
    }
    migrate_milestone(sample)
    once = copy.deepcopy(sample)
    migrate_milestone(sample)
    assert sample == once
    assert sample["id"] == "sample-product-fea-structure-2020"
    assert sample["date"] == "2020-01"
    assert sample["date_precision"] == "year"
    assert sample["evidence_level"] == "candidate"
    assert sample["confidence"] == 0.5

    print("test_breakthrough_migration: OK (244 ids, 124 dates, 252 candidate downgrades)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
