#!/usr/bin/env python3
"""Regression gates for organization scale/identity enrichment."""
from __future__ import annotations

import json
import importlib.util
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
FIELDS = {"founded", "ownership", "listing", "employees", "vehicle_sales", "plants"}
STATUSES = {"verified", "partial", "not_disclosed", "not_applicable", "not_separately_listed", "unverified"}


def external(url: object) -> bool:
    if not isinstance(url, str):
        return False
    host = (urlparse(url).hostname or "").lower()
    return urlparse(url).scheme in {"http", "https"} and bool(host) and host != "qrost.github.io" and not host.endswith(".qrost.github.io")


def walk_sources(node: object, path: str = ""):
    if isinstance(node, dict):
        for key, value in node.items():
            here = f"{path}.{key}" if path else key
            if key == "source_url":
                yield here, value
            else:
                yield from walk_sources(value, here)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from walk_sources(value, f"{path}[{index}]")


def main() -> int:
    orgs = json.loads((DATA / "organizations.json").read_text(encoding="utf-8"))["organizations"]
    enrich = json.loads((DATA / "org-enrichment.json").read_text(encoding="utf-8"))["enrichment"]
    facilities = json.loads((DATA / "facilities.json").read_text(encoding="utf-8"))["facilities"]
    org_ids = {row["id"] for row in orgs}
    assert set(enrich) == org_ids, "enrichment must cover every organization exactly once"

    # Every source-bearing fact must be reconstructable from a checked-in
    # reviewed input, not preserved accidentally from yesterday's output JSON.
    official_path = ROOT / "tools" / "enrich_official_2025.py"
    spec = importlib.util.spec_from_file_location("china_auto_official_enrichment", official_path)
    assert spec and spec.loader
    official = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(official)
    for org_id, row in enrich.items():
        for field in ("founded", "listing", "employees", "vehicle_sales", "ownership_evidence"):
            value = row.get(field)
            if isinstance(value, dict) and value.get("source_url"):
                assert field in official.PATCH.get(org_id, {}), f"{org_id}.{field}: reviewed fact lacks a reproducible input"
                assert value == official.PATCH[org_id][field], f"{org_id}.{field}: generated fact drifted from reviewed input"

    for org_id, row in enrich.items():
        availability = row.get("availability")
        assert isinstance(availability, dict), f"{org_id}: availability missing"
        assert FIELDS <= set(availability), f"{org_id}: incomplete availability"
        assert set(availability.values()) <= STATUSES, f"{org_id}: unknown availability state"
        assert row.get("ownership") in {"soe", "private", "foreign", "jv", "public", "nonprofit", "mixed", "unknown"}, f"{org_id}: ownership missing"
        for path, url in walk_sources(row):
            assert external(url), f"{org_id}.{path}: self-authored or invalid evidence URL"
            low = str(url).lower()
            assert "qrost" not in low and "research-brief" not in low, f"{org_id}.{path}: QROST research cannot be evidence"
        for field in ("founded", "listing", "employees", "vehicle_sales", "ownership_evidence"):
            value = row.get(field)
            if isinstance(value, dict) and value.get("note_zh"):
                assert value.get("note_en"), f"{org_id}.{field}: Chinese note lacks an English counterpart"

    reviewed = lambda field: sum(row["availability"][field] != "unverified" for row in enrich.values())
    assert reviewed("founded") >= 90
    assert reviewed("ownership") >= 60
    assert reviewed("listing") >= 90
    assert reviewed("employees") >= 100
    assert reviewed("vehicle_sales") == len(enrich)
    assert reviewed("plants") >= 100

    # Exact-entity boundaries: parent or foreign-parent securities must not be
    # assigned to these subsidiaries, groups or brands.
    for org_id in ("xiaomi-auto", "tesla-china", "dongfeng", "geely", "sinotruk", "king-long", "zeekr"):
        assert enrich[org_id]["listing"]["listed"] is False, f"{org_id}: borrowed parent ticker regression"
        assert enrich[org_id]["availability"]["listing"] == "not_separately_listed"

    expected_2025 = {
        "baic": 1752000,
        "xiaomi-auto": 411082,
        "li-auto": 406343,
        "saic": 4507518,
        "changan": 2913042,
        "seres": 516860,
        "jac": 384071,
        "nio": 326028,
        "byd": 4602436,
        "gac": 1721489,
        "chery": 2631381,
        "gwm": 1323672,
        "xpeng": 429445,
        "leapmotor": 596555,
    }
    for org_id, value in expected_2025.items():
        metric = enrich[org_id]["vehicle_sales"]
        assert metric["year"] == 2025 and metric["value"] == value, f"{org_id}: 2025 sales regression"
        assert external(metric["source_url"])

    assert enrich["beijing-benz"]["availability"]["vehicle_sales"] == "not_disclosed"
    assert "vehicle_sales" not in enrich["beijing-benz"]
    assert enrich["neta"]["availability"]["vehicle_sales"] == "not_disclosed"
    assert "vehicle_sales" not in enrich["neta"]
    assert "vehicle_sales" not in enrich["dongfeng"], "listed-subsidiary sales must not be assigned to the unlisted parent"
    assert "employees" not in enrich["huaxiang"], "Ningbo Huaxiang headcount must not transfer to the different Huaxiang entity"
    assert "employees" not in enrich["pcauto"], "Pacific Online group headcount must not become PCauto channel headcount"
    for org_id in ("changan-univ", "cqut", "hfut", "jlu"):
        assert "employees" not in enrich[org_id], f"{org_id}: faculty count must not be labeled as employees"
    for org_id, field in official.SECONDARY_METRICS:
        assert enrich[org_id][field]["source_authority"] == "secondary"
        assert enrich[org_id]["availability"][field] == "partial"
    assert enrich["caam"]["ownership"] == "nonprofit"
    assert enrich["chery"]["ownership"] == "mixed"
    assert enrich["dongfeng-cv"]["ownership"] == "jv"
    for org_id in official.QUALIFIED_OWNERSHIP:
        assert enrich[org_id]["availability"]["ownership"] == "partial"
    assert enrich["tsinghua"]["availability"]["listing"] == "not_applicable"

    # Multi-site manufacturers must remain represented as distinct facilities,
    # not collapsed into one generic city/company edge.
    plant_types = {"vehicle_plant", "engine_plant", "battery_plant", "parts_plant"}
    plant_counts: dict[str, int] = {}
    for facility in facilities:
        if facility.get("facility_type") in plant_types and facility.get("operator_id"):
            operator_id = facility["operator_id"]
            plant_counts[operator_id] = plant_counts.get(operator_id, 0) + 1
    expected_minimums = {
        "beijing-benz": 2,
        "gac-honda": 3,
        "saic-vw": 4,
        "bmw-brilliance": 2,
        "catl": 7,
        "calb": 4,
        "eve-energy": 3,
        "seres": 3,
        "voyah": 2,
        "jac": 2,
        "gac-toyota": 3,
        "xiaomi-auto": 1,
        "vw-anhui": 1,
        "saic-maxus": 1,
    }
    for org_id, minimum in expected_minimums.items():
        assert plant_counts.get(org_id, 0) >= minimum, f"{org_id}: multi-plant coverage regressed"

    print("test_enrichment_coverage: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
