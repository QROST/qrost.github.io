#!/usr/bin/env python3
"""Mutation tests for the CIS external-source authority boundary."""
from __future__ import annotations

import copy
import json
from pathlib import Path

from migrate_breakthrough_contract import normalize_record_sources
from provenance import (
    load_authority_registry,
    normalize_source,
    normalize_source_url,
    registry_contract_issues,
    source_contract_issues,
    source_url_contract_issues,
    url_host,
)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"


def load(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def expect_issue(source: dict, needle: str, *, scope: str = "entity_identity") -> None:
    issues = source_contract_issues(source, "mutation", expected_scope=scope)
    assert any(needle in issue for issue in issues), issues


def main() -> int:
    assert not url_host("https://qrost.github.io/demos/china-industrial-software/brief.html")
    assert not url_host("http://localhost:8000/research.json")
    assert not registry_contract_issues(), registry_contract_issues()
    authority_registry, _ = load_authority_registry()

    categories = sorted((DATA / "categories").glob("*.json"))
    products = []
    for path in categories:
        data = load(path)
        products.extend(data.get("products", data))
    kernels_data = load(DATA / "kernels.json")
    kernels = kernels_data.get("kernels", kernels_data)
    milestone_data = load(DATA / "breakthroughs.json")
    milestones = milestone_data["milestones"]

    checked = 0
    for kind, rows in (("product", products), ("kernel", kernels)):
        for row in rows:
            for index, source in enumerate(row.get("sources") or []):
                issues = source_contract_issues(
                    source,
                    f"{kind}:{row['id']}.sources[{index}]",
                    expected_scope="entity_identity",
                )
                assert not issues, issues
                checked += 1
            if kind == "product":
                for index, breakthrough in enumerate(row.get("breakthroughs") or []):
                    if not isinstance(breakthrough, dict) or not breakthrough.get("source_url"):
                        continue
                    issues = source_url_contract_issues(
                        breakthrough,
                        f"product:{row['id']}.breakthroughs[{index}]",
                        expected_scope="candidate_lead",
                    )
                    assert not issues, issues
                    checked += 1
    for milestone in milestones:
        scope = "candidate_lead" if milestone["evidence_level"] == "candidate" else "claim_evidence"
        for index, source in enumerate(milestone.get("sources") or []):
            issues = source_contract_issues(
                source,
                f"milestone:{milestone['id']}.sources[{index}]",
                expected_scope=scope,
            )
            assert not issues, issues
            checked += 1

    def check_auxiliary(value: object, pointer: str, expected_scope: str) -> None:
        nonlocal checked
        if isinstance(value, dict):
            if isinstance(value.get("source_url"), str):
                issues = source_url_contract_issues(value, pointer, expected_scope=expected_scope)
                assert not issues, issues
                checked += 1
            sources = value.get("sources")
            if isinstance(sources, list):
                for index, source in enumerate(sources):
                    issues = source_contract_issues(
                        source,
                        f"{pointer}/sources[{index}]",
                        expected_scope=expected_scope,
                    )
                    assert not issues, issues
                    checked += 1
            for key, child in value.items():
                if key != "sources":
                    check_auxiliary(child, f"{pointer}/{key}", expected_scope)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                check_auxiliary(child, f"{pointer}/{index}", expected_scope)

    policies_data = load(DATA / "policies.json")
    policy_candidates = 0
    for index, policy in enumerate(policies_data["policies"]):
        candidate = policy.get("verification_status") == "candidate"
        if candidate:
            policy_candidates += 1
            assert float(policy["confidence"]) <= 0.5
        check_auxiliary(
            policy,
            f"policies/{index}",
            "candidate_lead" if candidate else "claim_evidence",
        )
    for key, value in policies_data.items():
        if key != "policies":
            check_auxiliary(value, f"policies/{key}", "claim_evidence")
    check_auxiliary(load(DATA / "market-stats.json"), "market-stats", "claim_evidence")

    # Ownership is an exact reviewed decision, not something inferred from a
    # plausible external host.  Unknown URLs fail even when a caller claims
    # they are external.
    base = copy.deepcopy(products[0]["sources"][0])
    assert not source_contract_issues(base, "registered-control", expected_scope="entity_identity")

    unregistered = copy.deepcopy(base)
    unregistered.update({
        "url": "https://research.example.org/cis-note.html",
        "publisher": "Example Publisher",
        "publisher_domain": "research.example.org",
        "publisher_ownership": "external",
        "support_scope": "entity_identity",
    })
    normalized_unregistered = normalize_source(unregistered, "entity_identity")
    expect_issue(normalized_unregistered, "absent from reviewed source authority registry")

    # The migration normalizer must never wash a self-authored decision into
    # external ownership, even for an otherwise registered URL.
    mutated = copy.deepcopy(base)
    mutated["publisher_ownership"] = "self_authored"
    migration_record = {"sources": [mutated]}
    normalize_record_sources(migration_record, "entity_identity")
    normalized = migration_record["sources"][0]
    assert normalized["publisher_ownership"] == "self_authored", normalized
    expect_issue(normalized, "publisher_ownership must be external")

    mutated = copy.deepcopy(base)
    mutated["publisher"] = "QROST research brief"
    expect_issue(mutated, "forbidden self-authored marker")

    mutated = copy.deepcopy(base)
    mutated["publisher_domain"] = "unrelated.example.org"
    expect_issue(mutated, "publisher_domain must match")

    mutated = copy.deepcopy(base)
    mutated["support_scope"] = ""
    expect_issue(mutated, "invalid support_scope")

    shorthand_base = next(
        breakthrough
        for product in products
        for breakthrough in (product.get("breakthroughs") or [])
        if isinstance(breakthrough, dict) and breakthrough.get("source_url")
    )
    shorthand = copy.deepcopy(shorthand_base)
    shorthand.update({
        "source_publisher_ownership": "self_authored",
        "source_support_scope": "candidate_lead",
    })
    normalized_shorthand = normalize_source_url(shorthand, "candidate_lead")
    assert normalized_shorthand["source_publisher_ownership"] == "self_authored", normalized_shorthand
    issues = source_url_contract_issues(normalized_shorthand, "shorthand", expected_scope="candidate_lead")
    assert any("publisher_ownership must be external" in issue for issue in issues), issues

    candidate_rows = [m for m in milestones if m["evidence_level"] == "candidate"]
    assert len(candidate_rows) == 252, len(candidate_rows)
    assert all(float(m["confidence"]) <= 0.5 for m in candidate_rows)
    assert policy_candidates == 96, policy_candidates
    assert checked == 1100, checked
    print(
        f"test_provenance: OK ({checked} scoped exact-URL links, "
        f"{len(authority_registry)} authority decisions; "
        f"{len(candidate_rows)} milestone + {policy_candidates} policy candidates)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
