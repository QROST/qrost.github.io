#!/usr/bin/env python3
"""Contract gate for the reviewed 28-city / 168-organization audit ledger."""
from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
FIELDS = {"founded", "ownership", "listing", "employees", "vehicle_sales", "plants"}
STATUSES = {"verified", "partial", "not_disclosed", "not_applicable", "not_separately_listed", "unverified"}
CITY_PARTIAL_PUBLIC_VALUES = {("hefei", "nev_output")}


def city_value(decision: dict) -> int | None:
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


def plant_value_count(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, list):
        return len(value)
    if isinstance(value, dict):
        ids = value.get("facility_ids")
        if isinstance(ids, list):
            return len(set(str(item) for item in ids if item))
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


def mapped_plant_counts(root: Path) -> dict[str, int]:
    facilities = json.loads((root / "assets" / "data" / "facilities.json").read_text(encoding="utf-8"))["facilities"]
    roles = json.loads((root / "assets" / "data" / "city-roles.json").read_text(encoding="utf-8"))["city_roles"]
    counts: dict[str, int] = {}
    explicit = set()
    plant_types = {"vehicle_plant", "engine_plant", "battery_plant", "parts_plant"}
    for facility in facilities:
        if facility.get("facility_type") not in plant_types or not facility.get("operator_id"):
            continue
        key = (facility["city_id"], facility["operator_id"])
        explicit.add(key)
        if facility.get("status") not in {"closed", "converted"}:
            counts[facility["operator_id"]] = counts.get(facility["operator_id"], 0) + 1
    seen = set()
    for role in roles:
        key = (role.get("city_id"), role.get("entity_id"))
        if role.get("role_type") not in {"factory", "supplier_plant"} or key in explicit or key in seen:
            continue
        seen.add(key)
        counts[key[1]] = counts.get(key[1], 0) + 1
    return counts


def main() -> int:
    audit_path = Path(__file__).with_name("reviewed_entity_audit_2026_09.json")
    if not audit_path.is_file():
        raise SystemExit("reviewed_entity_audit_2026_09.json is missing")
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    orgs = json.loads((ROOT / "assets" / "data" / "organizations.json").read_text(encoding="utf-8"))["organizations"]
    cities = json.loads((ROOT / "assets" / "data" / "cities.json").read_text(encoding="utf-8"))["cities"]
    expected_ids = [row["id"] for row in orgs]
    rows = audit.get("organizations") or []
    assert [row.get("id") for row in rows] == expected_ids, "audit must cover every organization once in catalog order"
    assert audit["metadata"]["organization_count"] == 168
    assert audit["metadata"]["field_decision_count"] == 1008
    assert audit["metadata"]["city_count"] == 28
    assert audit["metadata"]["city_field_decision_count"] == 56
    assert len(audit["metadata"]["shard_receipts"]) == 14
    city_rows = audit.get("cities") or []
    assert [row.get("id") for row in city_rows] == [row["id"] for row in cities]
    public_stats = json.loads((ROOT / "assets" / "data" / "statistics.json").read_text(encoding="utf-8"))["statistics"]
    stats_by_city = {row["city_id"]: row for row in public_stats}
    assert set(stats_by_city) == {row["id"] for row in cities}, "public statistics must expose every audited city"
    for row in city_rows:
        assert set(row["fields"]) == {"total_vehicle_output", "nev_output"}
        for field, decision in row["fields"].items():
            assert decision["status"] in STATUSES, f"city:{row['id']}.{field}: invalid status"
            if decision["status"] in {"verified", "partial"}:
                assert any(
                    str(source.get("url") or "").startswith(("http://", "https://"))
                    for source in decision.get("sources", [])
                ), f"city:{row['id']}.{field}: supported status lacks an external URL"
            assert stats_by_city[row["id"]]["availability"][field] == decision["status"], (
                f"city:{row['id']}.{field}: public availability drifted from audit"
            )
            expected_value = city_value(decision) if (
                decision["status"] == "verified"
                or (row["id"], field) in CITY_PARTIAL_PUBLIC_VALUES
            ) else None
            assert stats_by_city[row["id"]][field] == expected_value, (
                f"city:{row['id']}.{field}: public value drifted from audit"
            )
    enrichment = json.loads((ROOT / "assets" / "data" / "org-enrichment.json").read_text(encoding="utf-8"))["enrichment"]
    public_plant_counts = mapped_plant_counts(ROOT)
    for row in rows:
        assert set(row["fields"]) == FIELDS, f"{row['id']}: six-field audit incomplete"
        public = enrichment[row["id"]]
        assert set(public.get("field_reviews") or {}) == FIELDS, f"{row['id']}: public field reviews incomplete"
        assert public.get("audit_boundary_zh", "") == row.get("entity_boundary_zh", "")
        assert public.get("audit_boundary_en", "") == row.get("entity_boundary_en", "")
        for field, decision in row["fields"].items():
            assert decision["status"] in STATUSES, f"{row['id']}.{field}: invalid status"
            assert public["field_reviews"][field]["status"] == decision["status"], (
                f"{row['id']}.{field}: public audit receipt drifted"
            )
            if field == "plants":
                review = public["field_reviews"][field]
                assert review.get("value_count") == public_plant_counts.get(row["id"], 0), f"{row['id']}.plants: mapped count drifted"
                assert review.get("mapped_value_count") == public_plant_counts.get(row["id"], 0), f"{row['id']}.plants: mapped count receipt drifted"
                audited_count = plant_value_count(decision.get("value"))
                if audited_count is not None:
                    assert review.get("audit_value_count") == audited_count, f"{row['id']}.plants: audited count drifted"
            assert public["availability"][field] == decision["status"], (
                f"{row['id']}.{field}: public decision state drifted from the completed audit"
            )
            haystack = " ".join(
                str(source.get(key) or "")
                for source in decision.get("sources", [])
                for key in ("url", "title", "publisher")
            ).lower()
            assert "qrost" not in haystack and "research brief" not in haystack and "研究简报" not in haystack
            if decision["status"] in {"verified", "partial"}:
                assert any(
                    str(source.get("url") or "").startswith(("http://", "https://"))
                    for source in decision.get("sources", [])
                ), f"{row['id']}.{field}: supported status lacks an external URL"
            accepted_urls = {
                source.get("url") for source in decision.get("sources", [])
                if source.get("evidence_role") != "lead_only"
            }
            review_url = public["field_reviews"][field].get("source_url")
            if review_url:
                assert review_url in accepted_urls, f"{row['id']}.{field}: public review uses a non-reviewed source"
            if field == "listing" and decision["status"] == "not_applicable":
                assert not (public.get("listing") or {}).get("listed"), (
                    f"{row['id']}: structurally inapplicable listing retains a borrowed ticker"
                )
            if field == "employees" and decision["status"] == "not_applicable":
                assert not isinstance(public.get("employees"), dict), (
                    f"{row['id']}: non-employer row retains another entity's workforce"
                )
            if field == "vehicle_sales" and decision["status"] == "not_applicable":
                assert not isinstance(public.get("vehicle_sales"), dict), (
                    f"{row['id']}: non-vehicle-sales row retains an inapplicable sales metric"
                )
            if field == "vehicle_sales" and isinstance(public.get("vehicle_sales"), dict):
                assert public["vehicle_sales"].get("non_additive") is True
                assert public["vehicle_sales"].get("source_url") in accepted_urls
                assert decision["status"] == "verified" or decision.get("public_projection_allowed") is True
            if field in {"founded", "employees", "vehicle_sales"} and decision["status"] in {
                "not_applicable", "not_disclosed", "unverified"
            }:
                assert not isinstance(public.get(field), dict), f"{row['id']}.{field}: terminal state leaked an old scalar"
            if field == "ownership" and decision["status"] == "not_applicable":
                assert not public.get("ownership"), (
                    f"{row['id']}: structurally inapplicable ownership retains a categorical value"
                )
    print("test_deep_audit: OK (28 cities / 56 city decisions / 168 organizations / 1008 organization decisions / 14 shards)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
