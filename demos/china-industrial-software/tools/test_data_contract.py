#!/usr/bin/env python3
"""Mutation checks for CIS closed schemas and milestone foreign keys."""
from __future__ import annotations

import copy
import json
from pathlib import Path

import validate as contract


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"


def load(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    products: list[dict] = []
    for path in sorted((DATA / "categories").glob("*.json")):
        payload = load(path)
        products.extend(payload.get("products", payload))
    kernels_payload = load(DATA / "kernels.json")
    kernels = kernels_payload.get("kernels", kernels_payload)
    vendors_payload = load(DATA / "vendors.json")
    vendors = vendors_payload.get("vendors", vendors_payload)
    milestones = load(DATA / "breakthroughs.json")["milestones"]
    policies = load(DATA / "policies.json")["policies"]

    for definition, rows in (
        ("product", products),
        ("kernel", kernels),
        ("vendor", vendors),
        ("milestone", milestones),
    ):
        for row in rows:
            issues = contract.strict_object_issues(row, definition, f"{definition}:{row.get('id')}")
            assert not issues, issues

    unknown = copy.deepcopy(products[0])
    unknown["undeclared_research_note"] = "must fail"
    issues = contract.strict_object_issues(unknown, "product", "mutation-product")
    assert any("unexpected fields" in issue for issue in issues), issues

    capability_row = next(product for product in products if isinstance(product.get("capabilities"), dict))
    mutated_capabilities = copy.deepcopy(capability_row)
    mutated_capabilities["capabilities"]["unknown_bucket"] = []
    issues = contract.validate_product(mutated_capabilities, "mutation-capabilities")
    assert any("capabilities has unexpected fields" in issue for issue in issues), issues

    product_ids = {product["id"] for product in products}
    vendor_ids = {vendor["id"] for vendor in vendors}
    policy_ids = {policy["id"] for policy in policies}
    for milestone in milestones:
        issues = contract.validate_milestone_references(
            milestone,
            f"milestone:{milestone['id']}",
            product_ids,
            vendor_ids,
            policy_ids,
        )
        assert not issues, issues

    orphan = copy.deepcopy(milestones[0])
    orphan["related_policy_ids"] = ["missing-policy"]
    issues = contract.validate_milestone_references(
        orphan,
        "mutation-orphan",
        product_ids,
        vendor_ids,
        policy_ids,
    )
    assert any("related_policy_ids references unknown policy" in issue for issue in issues), issues

    print(
        "test_data_contract: OK "
        f"({len(products)} products, {len(kernels)} kernels, "
        f"{len(milestones)} milestones; unknown fields and orphan policy FK rejected)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
