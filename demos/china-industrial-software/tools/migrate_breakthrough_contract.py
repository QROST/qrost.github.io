#!/usr/bin/env python3
"""Deterministically migrate the 2026 breakthrough import to current contracts.

Commit ``3be98d9`` added 252 timeline records directly to the public JSON.  The
original research shards were not tracked, so this checked-in migration is the
single reproducible repair path.  It preserves entity/FK meaning while:

* normalizing milestone ids and year-precision dates;
* downgrading the unreviewed ``reported`` bucket to visible candidates;
* removing the internal agent marker as evidence authority; and
* attaching publisher metadata only when the exact URL already appears in the
  separately reviewed authority registry; and
* attaching a limited support scope to every inline source.

The mapping ledger is append-preserving so a no-input-change rerun is byte
idempotent while still retaining the original-to-public id/date mapping.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from provenance import normalize_source, normalize_source_url

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
BREAKTHROUGHS = DATA / "breakthroughs.json"
KERNELS = DATA / "kernels.json"
CATEGORIES = DATA / "categories"
LEDGER = Path(__file__).resolve().parent / "breakthrough-contract-migration.json"
POLICIES = DATA / "policies.json"
MARKET_STATS = DATA / "market-stats.json"

LEGACY_RESEARCH_MARKER = "composer-2.5"
YEAR_RE = re.compile(r"^\d{4}$")


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_if_changed(path: Path, data: object) -> bool:
    rendered = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    current = path.read_text(encoding="utf-8") if path.exists() else ""
    if current == rendered:
        return False
    path.write_text(rendered, encoding="utf-8")
    return True


def normalize_record_sources(record: dict, support_scope: str) -> int:
    sources = record.get("sources")
    if not isinstance(sources, list):
        return 0
    record["sources"] = [
        normalize_source(source, support_scope) if isinstance(source, dict) else source
        for source in sources
    ]
    return len(sources)


def normalize_source_url_record(record: dict, support_scope: str) -> int:
    if not isinstance(record.get("source_url"), str):
        return 0
    normalized = normalize_source_url(record, support_scope)
    record.clear()
    record.update(normalized)
    return 1


def normalize_nested_provenance(value: object, support_scope: str) -> tuple[int, int]:
    """Normalize nested ``sources`` arrays and ``source_url`` shorthands."""
    inline_count = 0
    shorthand_count = 0
    if isinstance(value, dict):
        shorthand_count += normalize_source_url_record(value, support_scope)
        sources = value.get("sources")
        if isinstance(sources, list):
            value["sources"] = [
                normalize_source(source, support_scope) if isinstance(source, dict) else source
                for source in sources
            ]
            inline_count += len(sources)
        for key, child in value.items():
            if key == "sources":
                continue
            nested_inline, nested_shorthand = normalize_nested_provenance(child, support_scope)
            inline_count += nested_inline
            shorthand_count += nested_shorthand
    elif isinstance(value, list):
        for child in value:
            nested_inline, nested_shorthand = normalize_nested_provenance(child, support_scope)
            inline_count += nested_inline
            shorthand_count += nested_shorthand
    return inline_count, shorthand_count


def normalize_milestone_source_contract(milestone: dict) -> None:
    scope = "candidate_lead" if milestone.get("evidence_level") == "candidate" else "claim_evidence"
    normalize_record_sources(milestone, scope)


def migrate_milestone(milestone: dict) -> tuple[dict | None, dict | None, dict | None]:
    """Migrate one legacy timeline record and return ledger rows, if changed."""
    is_legacy = (
        milestone.get("source_research") == LEGACY_RESEARCH_MARKER
        or milestone.get("evidence_level") == "reported"
    )
    id_row = None
    date_row = None
    evidence_row = None

    if is_legacy:
        old_id = str(milestone["id"])
        new_id = old_id.replace("_", "-")
        if new_id != old_id:
            milestone["id"] = new_id
            id_row = {"old_id": old_id, "new_id": new_id}

        old_date = str(milestone["date"])
        if YEAR_RE.fullmatch(old_date):
            milestone["date"] = f"{old_date}-01"
            milestone["date_precision"] = "year"
            date_row = {
                "id": milestone["id"],
                "old_date": old_date,
                "new_date": milestone["date"],
                "date_precision": "year",
            }

        old_level = milestone.get("evidence_level")
        old_confidence = float(milestone.get("confidence", 0))
        milestone["evidence_level"] = "candidate"
        milestone["confidence"] = min(old_confidence, 0.5)
        milestone.pop("source_research", None)
        evidence_row = {
            "id": milestone["id"],
            "old_evidence_level": old_level,
            "new_evidence_level": "candidate",
            "old_confidence": old_confidence,
            "new_confidence": milestone["confidence"],
        }

    normalize_milestone_source_contract(milestone)
    return id_row, date_row, evidence_row


def merge_rows(existing: list[dict], additions: list[dict], key: str) -> list[dict]:
    merged = {str(row[key]): row for row in existing if isinstance(row, dict) and key in row}
    for row in additions:
        merged[str(row[key])] = row
    return [merged[item] for item in sorted(merged)]


def main() -> int:
    changed_paths: list[str] = []
    source_count = 0
    source_url_count = 0
    existing = load_json(LEDGER) if LEDGER.exists() else {}
    policy_candidate_ids = set(existing.get("policy_candidate_ids", []))

    id_rows: list[dict] = []
    date_rows: list[dict] = []
    evidence_rows: list[dict] = []
    breakthroughs = load_json(BREAKTHROUGHS)
    milestones = breakthroughs.get("milestones", [])
    for milestone in milestones:
        id_row, date_row, evidence_row = migrate_milestone(milestone)
        if id_row:
            id_rows.append(id_row)
        if date_row:
            date_rows.append(date_row)
        if evidence_row:
            evidence_rows.append(evidence_row)
        source_count += len(milestone.get("sources") or [])

    normalized_ids = [m.get("id") for m in milestones]
    if len(normalized_ids) != len(set(normalized_ids)):
        raise SystemExit("migration would create duplicate milestone ids")
    if write_json_if_changed(BREAKTHROUGHS, breakthroughs):
        changed_paths.append(BREAKTHROUGHS.relative_to(ROOT).as_posix())

    kernels = load_json(KERNELS)
    kernel_rows = kernels.get("kernels", kernels) if isinstance(kernels, dict) else kernels
    for kernel in kernel_rows:
        source_count += normalize_record_sources(kernel, "entity_identity")
    if write_json_if_changed(KERNELS, kernels):
        changed_paths.append(KERNELS.relative_to(ROOT).as_posix())

    for path in sorted(CATEGORIES.glob("*.json")):
        data = load_json(path)
        products = data.get("products", data) if isinstance(data, dict) else data
        for product in products:
            source_count += normalize_record_sources(product, "entity_identity")
            for breakthrough in product.get("breakthroughs") or []:
                if isinstance(breakthrough, dict):
                    source_url_count += normalize_source_url_record(breakthrough, "candidate_lead")
        if write_json_if_changed(path, data):
            changed_paths.append(path.relative_to(ROOT).as_posix())

    policies = load_json(POLICIES)
    for policy in policies.get("policies", []):
        if policy.get("source_research") == LEGACY_RESEARCH_MARKER:
            policy_candidate_ids.add(policy["id"])
        if policy.get("id") in policy_candidate_ids:
            policy.pop("source_research", None)
            policy["verification_status"] = "candidate"
            policy["confidence"] = min(float(policy.get("confidence", 0.5)), 0.5)
            scope = "candidate_lead"
        else:
            scope = "claim_evidence"
        nested_sources, nested_source_urls = normalize_nested_provenance(policy, scope)
        source_count += nested_sources
        source_url_count += nested_source_urls
    for key, value in policies.items():
        if key == "policies":
            continue
        nested_sources, nested_source_urls = normalize_nested_provenance(value, "claim_evidence")
        source_count += nested_sources
        source_url_count += nested_source_urls
    if write_json_if_changed(POLICIES, policies):
        changed_paths.append(POLICIES.relative_to(ROOT).as_posix())

    market_stats = load_json(MARKET_STATS)
    nested_sources, nested_source_urls = normalize_nested_provenance(market_stats, "claim_evidence")
    source_count += nested_sources
    source_url_count += nested_source_urls
    if write_json_if_changed(MARKET_STATS, market_stats):
        changed_paths.append(MARKET_STATS.relative_to(ROOT).as_posix())

    all_id_rows = merge_rows(existing.get("id_map", []), id_rows, "old_id")
    all_date_rows = merge_rows(existing.get("date_map", []), date_rows, "id")
    all_evidence_rows = merge_rows(existing.get("evidence_map", []), evidence_rows, "id")
    digest = hashlib.sha256(BREAKTHROUGHS.read_bytes()).hexdigest()
    ledger = {
        "schema_version": 1,
        "legacy_public_commit": "3be98d9e9804414f837bdd50652cb54857281c0c",
        "rules": {
            "id": "replace underscores with hyphens",
            "year_date": "YYYY becomes YYYY-01 with date_precision=year",
            "reported_evidence": "candidate with confidence capped at 0.5",
            "agent_researched_policies": "candidate with confidence capped at 0.5",
            "source_authority": "exact reviewed URL registry plus explicit support scope",
        },
        "counts": {
            "id_mappings": len(all_id_rows),
            "date_mappings": len(all_date_rows),
            "evidence_mappings": len(all_evidence_rows),
            "inline_sources_scoped": source_count,
            "source_urls_scoped": source_url_count,
            "total_external_links_scoped": source_count + source_url_count,
            "policy_candidates": len(policy_candidate_ids),
        },
        "breakthroughs_sha256": digest,
        "id_map": all_id_rows,
        "date_map": all_date_rows,
        "evidence_map": all_evidence_rows,
        "policy_candidate_ids": sorted(policy_candidate_ids),
    }
    if write_json_if_changed(LEDGER, ledger):
        changed_paths.append(LEDGER.relative_to(ROOT).as_posix())

    if changed_paths:
        print("contract migration: wrote " + ", ".join(changed_paths))
    else:
        print("contract migration: already normalized")
    print(
        "contract migration: "
        f"ids={len(all_id_rows)} dates={len(all_date_rows)} "
        f"candidates={len(all_evidence_rows)} sources={source_count + source_url_count}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
