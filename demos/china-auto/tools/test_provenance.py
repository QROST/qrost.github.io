#!/usr/bin/env python3
"""Mutation and audit-first contracts for the public evidence boundary."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

from validate import DATA, check_provenance, check_source_record, is_external_http_url


ROOT = Path(__file__).resolve().parent.parent
AUDIT = ROOT / "tools" / "reviewed_entity_audit_2026_09.json"
CITY_FIELDS = ("total_vehicle_output", "nev_output")
STATUSES = {
    "verified", "partial", "not_disclosed", "not_applicable",
    "not_separately_listed", "unverified",
}
TERMINAL_WITHOUT_VALUE = {"not_disclosed", "not_applicable", "unverified"}
FORBIDDEN_EVIDENCE_TERMS = ("qrost", "research-brief", "research brief", "研究简报")


def source(**overrides: object) -> dict:
    row = {
        "id": "src-official",
        "publisher_zh": "某市统计局",
        "publisher_en": "Municipal statistics bureau",
        "title_zh": "统计公报",
        "title_en": "Statistical communiqué",
        "source_type": "government_stats",
        "grade": "A",
        "url": "https://stats.example.gov.cn/release/2025.html",
        "publisher_domain": "stats.example.gov.cn",
        "publisher_ownership": "external",
        "support_scope": {
            "entity_refs": ["statistics:x:2025"],
            "fields": ["total_vehicle_output"],
            "scope_zh": "仅支持整车产量字段。",
            "scope_en": "Supports only total vehicle output.",
        },
    }
    row.update(overrides)
    return row


def assert_rejected(errors: list[str], needle: str) -> None:
    assert any(needle in error for error in errors), errors


def assert_allowed_evidence(url: object, label: str, *context: object) -> None:
    assert is_external_http_url(url), f"{label}: evidence URL must be external http(s): {url!r}"
    host = (urlparse(str(url)).hostname or "").lower()
    assert host != "qrost.github.io" and not host.endswith(".qrost.github.io"), (
        f"{label}: QROST cannot be an evidence host"
    )
    haystack = " ".join(str(item or "") for item in (url, *context)).lower()
    assert not any(term in haystack for term in FORBIDDEN_EVIDENCE_TERMS), (
        f"{label}: QROST/self-authored research cannot be evidence"
    )


def reviewed_source_urls(decision: dict, label: str) -> list[str]:
    approved: list[str] = []
    for index, item in enumerate(decision.get("sources") or []):
        assert isinstance(item, dict), f"{label}.sources[{index}]: source must be an object"
        assert_allowed_evidence(
            item.get("url"), f"{label}.sources[{index}]", item.get("title"), item.get("publisher")
        )
        if item.get("evidence_role") != "lead_only":
            approved.append(item["url"])
    return approved


def reviewed_city_number(decision: dict) -> int | None:
    value = decision.get("value")
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, dict):
        for key in ("count", "vehicles", "units", "value", "output", "total"):
            candidate = value.get(key)
            if isinstance(candidate, (int, float)) and not isinstance(candidate, bool):
                return int(candidate)
    return None


def main() -> int:
    # Mutation-style checks preserve the validator's trust boundary.
    assert is_external_http_url("https://stats.example.gov.cn/release")
    assert not is_external_http_url("")
    assert not is_external_http_url("file:///tmp/brief.html")
    assert not is_external_http_url("https://qrost.github.io/research/brief.html")

    errors: list[str] = []
    check_source_record(errors, source())
    assert not errors, errors

    errors = []
    check_source_record(errors, source(url="https://qrost.github.io/demos/china-auto/brief.html"))
    assert_rejected(errors, "external http(s)")
    assert_rejected(errors, "forbidden internal")

    errors = []
    check_source_record(errors, source(title_en="QROST research brief"))
    assert_rejected(errors, "forbidden internal")

    # A self-authored source hosted on an unrelated domain still fails; a host
    # denylist alone is not an authorship boundary.
    errors = []
    check_source_record(errors, source(
        url="https://research.example.org/auto-note.html",
        publisher_domain="research.example.org",
        publisher_zh="独立研究笔记",
        publisher_en="Independent research note",
        publisher_ownership="self_authored",
    ))
    assert_rejected(errors, "publisher_ownership must be external")

    errors = []
    check_source_record(errors, source(support_scope=None))
    assert_rejected(errors, "support_scope object required")

    errors = []
    check_source_record(errors, source(publisher_domain="unrelated.example.org"))
    assert_rejected(errors, "publisher_domain must match")

    source_by_id = {"src-official": source()}
    errors = []
    check_provenance(errors, "stats", {"city_id": "x", "year": 2025, "confidence": 0.8, "source_ids": []}, source_by_id)
    assert_rejected(errors, "confidence>0.5")

    errors = []
    check_provenance(
        errors, "stats",
        {"city_id": "x", "year": 2025, "confidence": 0.8, "source_ids": ["missing"]},
        source_by_id,
    )
    assert_rejected(errors, "unknown source")

    errors = []
    check_provenance(errors, "stats", {"city_id": "x", "year": 2025, "confidence": 0.45, "source_ids": []}, source_by_id)
    assert not errors, errors

    errors = []
    check_provenance(
        errors, "stats",
        {"city_id": "x", "year": 2025, "confidence": 0.8, "source_ids": ["src-official"]},
        source_by_id,
    )
    assert not errors, errors

    # Every public source record is external, including contextual records not
    # selected as the compact field-review link.
    public_sources = json.loads((DATA / "sources.json").read_text(encoding="utf-8"))["sources"]
    public_source_by_id = {row["id"]: row for row in public_sources}
    assert len(public_source_by_id) == len(public_sources), "public source ids must be unique"
    for source_id, row in public_source_by_id.items():
        assert_allowed_evidence(
            row.get("url"), f"sources.{source_id}",
            row.get("title_zh"), row.get("title_en"), row.get("publisher_zh"), row.get("publisher_en"),
        )

    cities = json.loads((DATA / "cities.json").read_text(encoding="utf-8"))["cities"]
    city_ids = {row["id"] for row in cities}
    assert len(cities) == len(city_ids) == 28, "city catalog must contain 28 unique rows"

    audit_blob = json.loads(AUDIT.read_text(encoding="utf-8"))
    audit_rows = audit_blob.get("cities") or []
    assert len(audit_rows) == 28 and len({row.get("id") for row in audit_rows}) == 28
    audit_by_city = {row["id"]: row for row in audit_rows}
    assert set(audit_by_city) == city_ids, "reviewed audit and public city ids must match"

    stats = json.loads((DATA / "statistics.json").read_text(encoding="utf-8"))["statistics"]
    assert len(stats) == 28
    stat_by_city = {row["city_id"]: row for row in stats}
    assert len(stat_by_city) == 28 and set(stat_by_city) == city_ids

    reviewed_decisions = 0
    for city_id in sorted(city_ids):
        audited = audit_by_city[city_id]
        decisions = audited.get("fields")
        assert isinstance(decisions, dict) and set(decisions) == set(CITY_FIELDS), (
            f"{city_id}: reviewed audit must contain exactly two output decisions"
        )
        stat = stat_by_city[city_id]
        assert stat.get("year") == 2025
        availability = stat.get("availability")
        reviews = stat.get("field_reviews")
        assert isinstance(availability, dict) and set(availability) == set(CITY_FIELDS)
        assert isinstance(reviews, dict) and set(reviews) == set(CITY_FIELDS)

        for field in CITY_FIELDS:
            reviewed_decisions += 1
            decision = decisions[field]
            status = decision.get("status")
            assert status in STATUSES
            assert availability[field] == status, (
                f"{city_id}.{field}: public availability drifted from reviewed audit"
            )

            review = reviews[field]
            assert isinstance(review, dict)
            for key in ("status", "scope", "as_of", "note_zh", "note_en", "caveat_zh", "caveat_en"):
                expected = decision.get(key)
                if key in {"note_zh", "note_en", "caveat_zh", "caveat_en"}:
                    expected = expected or ""
                assert review.get(key) == expected, f"{city_id}.{field}.{key}: audit projection drift"

            approved_urls = reviewed_source_urls(decision, f"{city_id}.{field}")
            review_url = review.get("source_url")
            if approved_urls:
                assert review_url in approved_urls, (
                    f"{city_id}.{field}: public review source is not in the reviewed audit"
                )
                assert_allowed_evidence(review_url, f"{city_id}.{field}.field_reviews", review.get("source_title"))
            else:
                assert not review_url, f"{city_id}.{field}: lead-only/unreviewed source leaked publicly"

            public_value = stat.get(field)
            if status in TERMINAL_WITHOUT_VALUE:
                assert public_value is None, (
                    f"{city_id}.{field}: terminal audit status leaked a stale public value"
                )
            elif status == "verified":
                expected_value = reviewed_city_number(decision)
                assert expected_value is not None and public_value == expected_value, (
                    f"{city_id}.{field}: verified number drifted from reviewed audit"
                )
            elif public_value is not None:
                # A directly reported partial may be displayed, but it must
                # still be the exact scalar captured in the audit decision.
                assert public_value == reviewed_city_number(decision), (
                    f"{city_id}.{field}: partial public number drifted from reviewed audit"
                )

        for source_id in stat.get("source_ids") or []:
            assert source_id in public_source_by_id, f"{city_id}: unknown public source id {source_id}"
        if stat.get("confidence", 0) > 0.5:
            assert stat.get("source_ids"), f"{city_id}: high-confidence row needs public sources"
        assert (stat.get("confidence", 0) > 0.5) == (
            availability["total_vehicle_output"] == "verified"
            and stat.get("total_vehicle_output") is not None
        ), f"{city_id}: only a verified total may enter the ranked/high-confidence layer"

    assert reviewed_decisions == 28 * 2

    # Small, stable numeric regressions. Mixed-boundary and derived values stay
    # in reviews rather than masquerading as comparable city totals.
    expected_city_values = {
        "beijing": (1467100, 699000),
        "guangzhou": (2409600, 661900),
        "shanghai": (1772000, 1161100),
        "wuhu": (1801000, 411000),
        "shiyan": (240307, 51560),
    }
    for city_id, (total, nev) in expected_city_values.items():
        assert stat_by_city[city_id]["total_vehicle_output"] == total
        assert stat_by_city[city_id]["nev_output"] == nev
    for city_id in ("wuhan", "zhengzhou", "baoding"):
        assert stat_by_city[city_id]["total_vehicle_output"] is None
    assert stat_by_city["wuhan"]["nev_output"] is None
    assert stat_by_city["hefei"]["total_vehicle_output"] is None
    assert stat_by_city["hefei"]["availability"]["nev_output"] == "partial"
    assert stat_by_city["hefei"]["nev_output"] == 1371000

    roles = json.loads((DATA / "city-roles.json").read_text(encoding="utf-8"))["city_roles"]
    assert roles and all(row["confidence"] <= 0.5 for row in roles), (
        "city-role candidates must stay visibly downgraded"
    )

    print("test_provenance: OK (28 cities x 2 reviewed output fields)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
