#!/usr/bin/env python3
"""Audit-first regression gates for organization enrichment."""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
AUDIT = ROOT / "tools" / "reviewed_entity_audit_2026_09.json"
FIELDS = ("founded", "ownership", "listing", "employees", "vehicle_sales", "plants")
STATUSES = {
    "verified", "partial", "not_disclosed", "not_applicable",
    "not_separately_listed", "unverified",
}
TERMINAL_WITHOUT_VALUE = {"not_disclosed", "not_applicable", "unverified"}
PUBLIC_VALUE_KEYS = {
    "founded": "founded",
    "ownership": "ownership_evidence",
    "listing": "listing",
    "employees": "employees",
    "vehicle_sales": "vehicle_sales",
}
FORBIDDEN_EVIDENCE_TERMS = ("qrost", "research-brief", "research brief", "研究简报")


def external(url: object) -> bool:
    if not isinstance(url, str):
        return False
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return (
        parsed.scheme in {"http", "https"}
        and bool(host)
        and host != "qrost.github.io"
        and not host.endswith(".qrost.github.io")
    )


def assert_allowed_evidence(url: object, label: str, *context: object) -> None:
    assert external(url), f"{label}: evidence URL must be external http(s): {url!r}"
    haystack = " ".join(str(item or "") for item in (url, *context)).lower()
    assert not any(term in haystack for term in FORBIDDEN_EVIDENCE_TERMS), (
        f"{label}: QROST/self-authored research cannot be evidence"
    )


def reviewed_source_urls(decision: dict, label: str) -> list[str]:
    """Return review-approved URLs; lead-only links are never public evidence."""
    approved: list[str] = []
    for index, source in enumerate(decision.get("sources") or []):
        assert isinstance(source, dict), f"{label}.sources[{index}]: source must be an object"
        url = source.get("url")
        assert_allowed_evidence(
            url, f"{label}.sources[{index}]", source.get("title"), source.get("publisher")
        )
        if source.get("evidence_role") != "lead_only":
            approved.append(url)
    return approved


def walk_sources(node: object, path: str = ""):
    if isinstance(node, dict):
        for key, value in node.items():
            here = f"{path}.{key}" if path else key
            if key == "source_url":
                yield here, value, node.get("source_title")
            else:
                yield from walk_sources(value, here)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from walk_sources(value, f"{path}[{index}]")


def reviewed_plant_count(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    if isinstance(value, list):
        return len(value)
    if not isinstance(value, dict):
        return None
    facility_ids = value.get("facility_ids")
    if isinstance(facility_ids, list):
        return len({str(item) for item in facility_ids if item})
    for key in (
        "count", "facility_count", "confirmed_facility_count",
        "physical_vehicle_campus_count", "official_whole_vehicle_plants",
        "active_physical_vehicle_campuses_in_six_city_scope",
        "confirmed_active_physical_vehicle_campuses_in_six_city_scope",
        "deduplicated_physical_vehicle_campuses",
    ):
        candidate = value.get(key)
        if isinstance(candidate, (int, float)) and not isinstance(candidate, bool):
            return int(candidate)
    return None


def reviewed_scalar(field: str, value: object) -> int | None:
    """Mirror the public scalar projection from heterogeneous audit receipts."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        match = (
            re.search(r"(?:18|19|20)\d{2}", value)
            if field == "founded"
            else re.fullmatch(r"\s*(\d{1,9})\s*", value)
        )
        return int(match.group(0 if field == "founded" else 1)) if match else None
    if not isinstance(value, dict):
        return None
    keys = {
        "founded": (
            "year", "approximate_year", "legal_entity_established_year",
            "joint_stock_company_established_year", "institutional_origin_year",
            "earliest_lineage_year", "academy_lineage_year", "legal_company_created_year",
            "brand_launch_year", "brand_reorganization_year",
        ),
        "employees": (
            "count", "people", "employees", "group_employees", "employees_lower_bound",
            "faculty_and_staff", "faculty_and_staff_lower_bound", "rd_team", "total_employees",
            "employees_total", "full_time_employees", "employees_approx", "minimum",
        ),
        "vehicle_sales": (
            "count", "vehicles", "units", "total", "deliveries", "global_deliveries",
            "sales_lower_bound", "approximate_vehicles", "special_purpose_vehicles",
        ),
    }[field]
    if field == "founded":
        for key in (
            "incorporated", "legal_entity_established", "issuer_incorporated",
            "current_group_established", "brand_launch_date", "date",
            "institutional_origin", "current_joint_stock_company",
        ):
            match = re.search(r"(?:18|19|20)\d{2}", str(value.get(key) or ""))
            if match:
                return int(match.group(0))
    for key in keys:
        candidate = value.get(key)
        if isinstance(candidate, (int, float)) and not isinstance(candidate, bool):
            return int(candidate)
    return None


def main() -> int:
    orgs = json.loads((DATA / "organizations.json").read_text(encoding="utf-8"))["organizations"]
    enrich = json.loads((DATA / "org-enrichment.json").read_text(encoding="utf-8"))["enrichment"]
    facilities = json.loads((DATA / "facilities.json").read_text(encoding="utf-8"))["facilities"]
    audit_blob = json.loads(AUDIT.read_text(encoding="utf-8"))
    audit_rows = audit_blob.get("organizations") or []

    org_ids = {row["id"] for row in orgs}
    assert len(orgs) == len(org_ids) == 168, "organization catalog must contain 168 unique rows"
    assert set(enrich) == org_ids, "enrichment must cover every organization exactly once"
    assert len(audit_rows) == 168, "reviewed audit must contain 168 organization rows"
    assert len({row.get("id") for row in audit_rows}) == 168, "reviewed organization ids must be unique"
    audit_by_id = {row["id"]: row for row in audit_rows}
    assert set(audit_by_id) == org_ids, "reviewed audit and public organization ids must match"

    status_counts = {field: {status: 0 for status in STATUSES} for field in FIELDS}
    for org_id in sorted(org_ids):
        audited = audit_by_id[org_id]
        decisions = audited.get("fields")
        assert isinstance(decisions, dict) and set(decisions) == set(FIELDS), (
            f"{org_id}: reviewed audit must contain exactly six field decisions"
        )
        row = enrich[org_id]
        availability = row.get("availability")
        reviews = row.get("field_reviews")
        assert isinstance(availability, dict) and set(availability) == set(FIELDS), (
            f"{org_id}: public availability must contain exactly six fields"
        )
        assert isinstance(reviews, dict) and set(reviews) == set(FIELDS), (
            f"{org_id}: public field_reviews must contain exactly six fields"
        )
        assert row.get("audit_boundary_zh") == (audited.get("entity_boundary_zh") or "")
        assert row.get("audit_boundary_en") == (audited.get("entity_boundary_en") or "")
        assert row.get("audit_reviewed_at") == audit_blob.get("metadata", {}).get("reviewed_at")

        for field in FIELDS:
            decision = decisions[field]
            status = decision.get("status")
            assert status in STATUSES, f"{org_id}.{field}: unknown reviewed status {status!r}"
            assert availability[field] == status, (
                f"{org_id}.{field}: public availability drifted from reviewed audit"
            )
            status_counts[field][status] += 1

            review = reviews[field]
            assert isinstance(review, dict), f"{org_id}.{field}: public review must be an object"
            for key in ("status", "scope", "as_of", "note_zh", "note_en", "caveat_zh", "caveat_en"):
                expected = decision.get(key)
                if key in {"note_zh", "note_en", "caveat_zh", "caveat_en"}:
                    expected = expected or ""
                assert review.get(key) == expected, f"{org_id}.{field}.{key}: audit projection drift"

            approved_urls = reviewed_source_urls(decision, f"{org_id}.{field}")
            review_url = review.get("source_url")
            if approved_urls:
                assert review_url in approved_urls, (
                    f"{org_id}.{field}: public review source is not in the reviewed audit"
                )
                assert_allowed_evidence(review_url, f"{org_id}.{field}.field_reviews", review.get("source_title"))
            else:
                assert not review_url, f"{org_id}.{field}: lead-only/unreviewed source leaked publicly"

            if field == "plants":
                audited_count = reviewed_plant_count(decision.get("value"))
                if audited_count is None:
                    assert "audit_value_count" not in review
                else:
                    assert review.get("audit_value_count") == audited_count, (
                        f"{org_id}.plants: audited count drifted from reviewed decision"
                    )
                assert review.get("value_count") == review.get("mapped_value_count"), (
                    f"{org_id}.plants: displayed count must be the mapped physical-site count"
                )
                continue

            public_key = PUBLIC_VALUE_KEYS[field]
            if status in TERMINAL_WITHOUT_VALUE:
                assert public_key not in row, (
                    f"{org_id}.{field}: terminal audit status leaked a stale public value"
                )
                if field == "ownership":
                    assert "ownership" not in row, (
                        f"{org_id}.ownership: terminal audit status leaked a category"
                    )

            public_value = row.get(public_key)
            if isinstance(public_value, dict) and public_value.get("source_url"):
                assert public_value["source_url"] in approved_urls, (
                    f"{org_id}.{field}: public fact source is outside the reviewed audit"
                )
                if field in {"founded", "employees", "vehicle_sales"}:
                    audited_scalar = reviewed_scalar(field, decision.get("value"))
                    if audited_scalar is not None:
                        assert public_value.get("value") == audited_scalar, (
                            f"{org_id}.{field}: public scalar drifted from reviewed audit"
                        )

        # Supported exact facts must have a public representation. Partial
        # metrics may intentionally remain review-only when scopes overlap.
        required_public_values = {
            "founded": availability["founded"] == "verified",
            "ownership_evidence": availability["ownership"] in {"verified", "partial"},
            "listing": availability["listing"] in {"verified", "not_separately_listed"},
            "employees": availability["employees"] == "verified",
            "vehicle_sales": availability["vehicle_sales"] == "verified",
        }
        for public_key, required in required_public_values.items():
            if required:
                assert isinstance(row.get(public_key), dict), (
                    f"{org_id}.{public_key}: supported exact audit decision needs a public value"
                )

        listing = row.get("listing")
        if isinstance(listing, dict) and listing.get("listed") is False and not listing.get("quotation"):
            assert availability["listing"] == "not_separately_listed", (
                f"{org_id}.listing: an ordinary unlisted entity cannot render as Verified"
            )

        for path, url, title in walk_sources(row):
            assert_allowed_evidence(url, f"{org_id}.{path}", title)
        for field in ("founded", "listing", "employees", "vehicle_sales", "ownership_evidence"):
            value = row.get(field)
            if isinstance(value, dict) and value.get("note_zh"):
                assert value.get("note_en"), f"{org_id}.{field}: Chinese note lacks English counterpart"

    assert sum(sum(counts.values()) for counts in status_counts.values()) == 168 * 6

    # A small set of high-value number and entity-boundary regressions remains
    # explicit. The audit ledger, rather than a legacy Python PATCH, is the
    # authority for every other fact.
    expected_2025 = {
        "baic": 1752000,
        "xiaomi-auto": 411082,
        "saic": 4507518,
        "byd": 4602436,
        "chery": 2631381,
        "gwm": 1323672,
        "sgmw": 1615066,
        "dongfeng-liuzhou": 132951,
        "wuling": 1319196,
    }
    for org_id, value in expected_2025.items():
        metric = enrich[org_id]["vehicle_sales"]
        assert metric["year"] == 2025 and metric["value"] == value, f"{org_id}: 2025 sales regression"
        assert metric.get("non_additive") is True, f"{org_id}: sales must be explicitly non-additive"

    for row in enrich.values():
        metric = row.get("vehicle_sales")
        if isinstance(metric, dict):
            assert metric.get("non_additive") is True, "every displayed sales metric must be non-additive"

    for org_id in ("xiaomi-auto", "tesla-china", "dongfeng", "geely", "zeekr"):
        assert enrich[org_id]["listing"]["listed"] is False, f"{org_id}: borrowed parent ticker regression"
        assert enrich[org_id]["availability"]["listing"] == "not_separately_listed"

    for field in FIELDS:
        assert enrich["neta"]["availability"][field] == "unverified"
    for key in PUBLIC_VALUE_KEYS.values():
        assert key not in enrich["neta"], f"neta.{key}: unverified current fact must remain absent"
    assert "employees" not in enrich["huaxiang"], "a different Huaxiang issuer's headcount must not transfer"
    assert "employees" not in enrich["pcauto"], "parent-platform headcount must not become channel headcount"
    for org_id in ("changan-univ", "hfut", "jlu"):
        assert "employees" not in enrich[org_id], f"{org_id}: faculty count must not be labeled as employees"
    assert enrich["cqut"]["employees"]["value"] == 2400
    assert enrich["cqut"]["employees"]["qualifier"] == "more_than"
    assert enrich["caam"]["ownership"] == "nonprofit"
    assert enrich["chery"]["ownership"] == "mixed"
    assert enrich["dongfeng-cv"]["ownership"] == "jv"
    assert enrich["truck-home"]["listing"]["quotation"] == {
        "exchange": "NEEQ", "ticker": "834063",
    }

    facility_ids = [facility["id"] for facility in facilities]
    assert len(facility_ids) == len(set(facility_ids)), "facility ids must be unique"
    assert all(facility.get("operator_id") in org_ids for facility in facilities)
    assert "changan-chongqing" not in facility_ids, "generic Changan point must stay split into campuses"
    assert "avatr-chongqing" not in facility_ids, "Changan Digital Factory must not be duplicated under Avatr"
    assert "changan-yubei-digital" in facility_ids

    print("test_enrichment_coverage: OK (168 organizations x 6 reviewed fields)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
