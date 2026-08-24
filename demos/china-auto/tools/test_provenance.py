#!/usr/bin/env python3
"""Mutation-style contract tests for the public evidence boundary."""
from __future__ import annotations

import json

from validate import check_provenance, check_source_record, is_external_http_url
from validate import DATA


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


def main() -> int:
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

    # A self-authored source hosted on an unrelated external domain must still
    # fail; host allow/deny checks alone are not an authorship boundary.
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
    check_provenance(errors, "stats", {"city_id": "x", "year": 2025, "confidence": 0.8, "source_ids": ["missing"]}, source_by_id)
    assert_rejected(errors, "unknown source")

    errors = []
    check_provenance(errors, "stats", {"city_id": "x", "year": 2025, "confidence": 0.45, "source_ids": []}, source_by_id)
    assert not errors, errors

    errors = []
    check_provenance(errors, "stats", {"city_id": "x", "year": 2025, "confidence": 0.8, "source_ids": ["src-official"]}, source_by_id)
    assert not errors, errors

    stats = json.loads((DATA / "statistics.json").read_text(encoding="utf-8"))["statistics"]
    verified_ids = [row["city_id"] for row in stats if row["confidence"] > 0.5]
    assert verified_ids == ["chongqing", "guangzhou", "wuhu", "shanghai", "xian", "beijing", "zhengzhou"], verified_ids
    assert all(row["source_ids"] for row in stats if row["confidence"] > 0.5)
    candidate_ids = {row["city_id"] for row in stats if row["confidence"] <= 0.5}
    assert candidate_ids == {"hefei", "changchun", "liuzhou"}, candidate_ids

    roles = json.loads((DATA / "city-roles.json").read_text(encoding="utf-8"))["city_roles"]
    assert roles and all(row["confidence"] <= 0.5 for row in roles), "city-role candidates must stay visibly downgraded"

    print("test_provenance: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
