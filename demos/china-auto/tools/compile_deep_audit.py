#!/usr/bin/env python3
"""Compile ignored multi-agent research shards into one reviewed audit ledger.

The raw shards are working evidence and stay gitignored.  This compiler emits a
compact, checked-in record of every entity/field decision, its exact scope and
the external sources used.  It deliberately does not mutate public facts: the
reviewer still decides which value is safe to project into org-enrichment.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
RESEARCH = ROOT / "tmp" / "research" / "2026-09-03"
OUT = Path(__file__).with_name("reviewed_entity_audit_2026_09.json")
FIELDS = ("founded", "ownership", "listing", "employees", "vehicle_sales", "plants")
CITY_FIELDS = ("total_vehicle_output", "nev_output")
SHARDS = (
    "wave1_beijing_core.json",
    "wave1_shanghai_core.json",
    "wave1_guangzhou_core.json",
    "wave2_beijing_media_a.json",
    "wave2_shenzhen_huizhou.json",
    "wave2_chongqing_chengdu.json",
    "wave3_beijing_media_b.json",
    "wave3_wuhan_central.json",
    "wave3_north.json",
    "wave4_beijing_media_c.json",
    "wave4_yangtze.json",
    "wave4_south_coast.json",
    "wave5_shanghai_media.json",
    "wave5_guangzhou_media.json",
)
STATUS_MAP = {
    "confirm_current": "verified",
    "update": "verified",
    "verified": "verified",
    "partial": "partial",
    "not_disclosed": "not_disclosed",
    "not_applicable": "not_applicable",
    "not_separately_listed": "not_separately_listed",
    "unverified": "unverified",
}
SOURCE_URL_REPLACEMENTS = {
    "https://www.gotion.com.cn/news/announcementinfos/764.html": "https://www.gotion.com.cn/newsInfo/502",
    "https://www.gotion.com.cn/news/announcementinfos/659.html": "https://www.gotion.com.cn/news/companydetails/613.html",
}
LEAD_ONLY_URLS = {
    # Independent review found that these are hosted reposts or third-party
    # profiles, not first-party evidence for the asserted metric.
    "https://english.shanghai.gov.cn/en-Latest-WhatsNew/20260107/4c2060e1dc874d40b56a3a8fa8baedf5.html",
    "https://scvtc.university-hr.com/index.php?act=view&join_id=6LrRgAkPO3kw&module=joinunits&sys=home",
}
INDEPENDENT_SOURCE_ADDITIONS = {
    ("dongfeng-liuzhou", "vehicle_sales"): [{
        "url": "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0112/2026011200612.pdf",
        "title": "Dongfeng Motor Group December 2025 sales bulletin",
        "publisher": "Dongfeng Motor Group / Hong Kong Stock Exchange",
        "source_type": "company_exchange_filing",
        "published_or_fact_date": "2026-01-12",
        "accessed_at": "2026-09-03",
    }],
}
INDEPENDENT_VALUE_OVERRIDES = {
    ("sgmw", "vehicle_sales"): {
        "value": {
            "count": 1615066,
            "year": 2025,
            "unit": "vehicles",
            "measure": "joint_venture_wholesale",
            "alternate_official_values": [{
                "count": 1635066,
                "measure": "company_release_overall_sales",
                "reconciled": False,
            }],
        },
        "scope": "2025 SGMW legal-entity wholesale volume in SAIC's production-and-sales table; company-release overall sales retained as an unreconciled alternate",
        "note_zh": "公开主值采用上汽年报产销表的1,615,066辆；公司稿1,635,066辆保留为未调节替代口径，二者不可相加。",
        "note_en": "The public primary value is 1,615,066 from SAIC's annual-report production-and-sales table; the company release's 1,635,066 remains an unreconciled alternate and must not be added.",
        "preferred_source_url": "https://www.saicmotor.com/chinese/images/tzzgx/ggb/dqgg/2025ndqgg/2026/4/1/03D5AE52F7884360BDB6A8A7BC830D5D.pdf",
        "public_projection_allowed": True,
    },
    ("dongfeng-liuzhou", "vehicle_sales"): {
        "value": {
            "count": 132951,
            "year": 2025,
            "unit": "vehicles",
            "measure": "company_wholesale",
            "alternate_official_values": [{
                "count": 147600,
                "measure": "terminal_sales",
                "reconciled": False,
            }],
        },
        "scope": "2025 Dongfeng Liuzhou Motor wholesale volume; terminal sales retained as an unreconciled alternate",
        "note_zh": "公开主值采用港交所公告的批发量132,951辆；公司稿终端销量147,600辆保留为未调节替代口径，二者不可相加。",
        "note_en": "The public primary value is wholesale volume of 132,951 from the exchange filing; the company release's terminal-sales figure of 147,600 remains an unreconciled alternate and must not be added.",
        "preferred_source_url": "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0112/2026011200612.pdf",
        "public_projection_allowed": True,
    },
}
INDEPENDENT_STATUS_OVERRIDES = {
    # The underlying facts remain useful but do not support the stronger
    # decision encoded in the raw shard.
    ("calb", "ownership"): (
        "partial",
        "无股东持有30%以上投票权，不足以单独证明不存在控制人。",
        "No shareholder holding more than 30% of voting rights does not by itself prove that no controller exists.",
    ),
    ("exeed", "founded"): (
        "partial",
        "2017产品系列发布、2018品牌自述诞生及2019集团发布是不同里程碑。",
        "The 2017 product-series debut, 2018 brand-origin statement, and 2019 group launch are distinct milestones.",
    ),
    ("sgmw", "vehicle_sales"): (
        "partial",
        "公司稿1,635,066辆与上汽年报产销表1,615,066辆属于尚未调节的两套官方口径；公开单值保留年报口径。",
        "The company release's 1,635,066 and SAIC's annual-report table's 1,615,066 are two unreconciled official scopes; the public scalar retains the annual-report measure.",
    ),
    ("dongfeng-liuzhou", "vehicle_sales"): (
        "partial",
        "147,600辆终端销量与132,951辆批发量不是同一指标；公开单值保留批发口径。",
        "The 147,600 terminal-sales figure and 132,951 wholesale figure are different measures; the public scalar retains wholesale volume.",
    ),
    ("golden-dragon", "ownership"): (
        "partial",
        "交易批准与会计处理支持收购推进，但当前最小公开层不把拟完成后的100%直接持股写成无条件精确现值。",
        "Transaction approval and accounting treatment support the acquisition, but the minimal public layer does not present the proposed post-completion 100% holding as an unconditional exact current fact.",
    ),
}

# These rows denote legal companies or parent groups for which securities
# listing is an applicable question.  Raw research occasionally used N/A even
# while the cited decision explicitly said "unlisted".  Normalize that semantic
# mismatch without changing brand, channel, university or association rows.
APPLICABLE_UNLISTED_IDS = {
    "faw", "faw-vw", "audi-faw-nev", "sgmw", "dongfeng-liuzhou",
    "guangxi-auto", "faw-toyota", "volvo-cars-chengdu", "huaxiang",
    "sinotruk", "king-long", "golden-dragon", "catarc", "bmw-brilliance",
}

CITY_STATUS_OVERRIDES = {
    # A government-body release supports the number, but it is not a directly
    # comparable statistical-communique product table.
    ("hefei", "nev_output"): (
        "partial",
        "该值来自政府机构公开材料，未达到统一城市统计公报产品表的可比口径。",
        "The value comes from a government-body release rather than a directly comparable municipal statistical-communique product table.",
    ),
}


def text_pair(value: object) -> tuple[str, str]:
    if isinstance(value, dict):
        return str(value.get("zh") or ""), str(value.get("en") or "")
    return (str(value), "") if value else ("", "")


def explicitly_not_separately_listed(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    for key in ("listed", "is_listed", "separately_listed"):
        if value.get(key) is False:
            return True
    return str(value.get("status") or "").lower() in {
        "not_separately_listed",
        "delisted_after_privatisation",
        "quoted_on_neeq",
        "quoted_not_exchange_listed",
    }


def normalize_sources(sources: object) -> list[dict]:
    out = []
    for source in sources if isinstance(sources, list) else []:
        if not isinstance(source, dict):
            continue
        url = str(source.get("url") or "").strip()
        url = SOURCE_URL_REPLACEMENTS.get(url, url)
        title = str(source.get("title") or "").strip()
        publisher = str(source.get("publisher") or "").strip()
        joined = " ".join((url, title, publisher)).lower()
        if "qrost" in joined or "research brief" in joined or "研究简报" in joined:
            raise SystemExit(f"forbidden self-authored source in audit shard: {url or title}")
        if url and not url.startswith(("https://", "http://")):
            raise SystemExit(f"non-http source in audit shard: {url}")
        # Empty source stubs are not evidence.  They may appear in research
        # notes for searches that did not resolve a fact, but keeping them in
        # the reviewed ledger would make an unsupported decision look cited.
        if not url:
            continue
        normalized = {
            "url": url,
            "title": title,
            "publisher": publisher,
            "source_type": source.get("source_type"),
            "published_or_fact_date": (
                source.get("published_or_filed") or source.get("published_at")
                or source.get("fact_date")
            ),
            "accessed_at": source.get("accessed_at") or source.get("accessed"),
        }
        if url in LEAD_ONLY_URLS:
            normalized["evidence_role"] = "lead_only"
        out.append(normalized)
    # Preserve first-seen source metadata while removing duplicate URLs.
    unique = {}
    for source in out:
        unique.setdefault(source["url"], source)
    return list(unique.values())


def organization_rows(blob: dict) -> list[dict]:
    organizations = blob.get("organizations")
    if isinstance(organizations, list):
        return organizations
    if isinstance(organizations, dict):
        rows = []
        for key, row in organizations.items():
            if not isinstance(row, dict):
                raise SystemExit(f"invalid organization row for {key}")
            if row.get("id") != key:
                raise SystemExit(f"organization key/id mismatch: {key} != {row.get('id')}")
            rows.append(row)
        return rows
    raise SystemExit("research shard has no organizations collection")


def city_rows(blob: dict) -> list[dict]:
    """Return only city findings that contain the two output audit decisions."""
    findings = blob.get("city_findings")
    candidates: list[dict] = []
    if isinstance(findings, list):
        candidates = [row for row in findings if isinstance(row, dict)]
    elif isinstance(findings, dict) and findings.get("city_id"):
        candidates = [findings]
    elif isinstance(findings, dict):
        for city_id, row in findings.items():
            if isinstance(row, dict):
                row = dict(row)
                row.setdefault("city_id", city_id)
                candidates.append(row)
    return [row for row in candidates if isinstance(row.get("field_decisions"), dict)]


def normalize_city(city: dict) -> dict:
    city_id = str(city.get("city_id") or "")
    raw = city["field_decisions"]
    aliases = {
        "total_vehicle_output": ("total_vehicle_output", "vehicle_output_2025"),
        "nev_output": ("nev_output", "nev_output_2025"),
    }
    decisions = {}
    for field, keys in aliases.items():
        value = next((raw[key] for key in keys if key in raw), None)
        if value is None:
            raise SystemExit(f"{city_id}: missing city decision for {field}")
        normalized = normalize_field(f"city:{city_id}", field, value)
        override = CITY_STATUS_OVERRIDES.get((city_id, field))
        if override:
            status, caveat_zh, caveat_en = override
            normalized["status"] = status
            normalized["action"] = "independent_review_downgrade"
            normalized["caveat_zh"] = " ".join(filter(None, (normalized.get("caveat_zh"), caveat_zh)))
            normalized["caveat_en"] = " ".join(filter(None, (normalized.get("caveat_en"), caveat_en)))
        decisions[field] = normalized
    return {
        "id": city_id,
        "entity_boundary_zh": city.get("entity_boundary_zh") or city.get("statistical_scope_zh") or "",
        "entity_boundary_en": city.get("entity_boundary_en") or city.get("statistical_scope_en") or "",
        "fields": decisions,
    }


def normalize_field(org_id: str, field: str, raw: object) -> dict:
    if not isinstance(raw, dict):
        raise SystemExit(f"{org_id}.{field}: decision must be an object")
    decision = str(raw.get("decision") or "")
    if decision not in STATUS_MAP:
        raise SystemExit(f"{org_id}.{field}: unsupported decision {decision!r}")
    status = STATUS_MAP[decision]
    raw_value = raw.get("value")
    if field == "listing" and explicitly_not_separately_listed(raw_value) and (
        status == "verified" or org_id in APPLICABLE_UNLISTED_IDS
    ):
        status = "not_separately_listed"
    qualifier = raw_value.get("qualifier") if isinstance(raw_value, dict) else None
    scope_text = str(raw.get("scope") or "").lower()
    # Updates expressed only as a lower bound, approximation, or rounded
    # derivation are useful evidence but are not exact verified scalars.
    if status == "verified" and (
        qualifier in {"over", "more_than", "approximately", "approximate"}
        or (isinstance(raw_value, dict) and any(
            key in raw_value for key in ("minimum", "approximate", "approximate_value")
        ))
        or (isinstance(raw_value, dict) and any(str(key).endswith("_lower_bound") for key in raw_value))
        or "approximate" in scope_text
        or "derived" in scope_text
    ):
        status = "partial"
    if field == "plants" and status == "verified" and isinstance(raw_value, dict):
        physical_keys = (
            "count", "facility_count", "confirmed_facility_count",
            "physical_vehicle_campus_count", "official_whole_vehicle_plants",
            "active_physical_vehicle_campuses_in_six_city_scope",
            "confirmed_active_physical_vehicle_campuses_in_six_city_scope",
            "deduplicated_physical_vehicle_campuses",
        )
        has_physical_count = any(
            isinstance(raw_value.get(key), (int, float)) and not isinstance(raw_value.get(key), bool)
            for key in physical_keys
        ) or bool(raw_value.get("facility_ids"))
        if not has_physical_count:
            # Regional "bases" or an incomplete layout statement are useful,
            # but they are not an exact, deduplicated physical-campus count.
            status = "partial"
    action = raw.get("proposed_action") or (decision if decision in {"confirm_current", "update"} else decision)
    sources = normalize_sources(raw.get("sources"))
    for source in INDEPENDENT_SOURCE_ADDITIONS.get((org_id, field), []):
        if source["url"] not in {item["url"] for item in sources}:
            sources.append(dict(source))
    accepted_sources = [source for source in sources if source.get("evidence_role") != "lead_only"]
    if status in {"verified", "partial"} and not accepted_sources:
        status = "unverified"
        action = "independent_review_downgrade"
    override = INDEPENDENT_STATUS_OVERRIDES.get((org_id, field))
    override_caveat_zh = ""
    override_caveat_en = ""
    if override:
        status, override_caveat_zh, override_caveat_en = override
        action = "independent_review_downgrade"
    value_override = INDEPENDENT_VALUE_OVERRIDES.get((org_id, field))
    if value_override:
        raw_value = value_override["value"]
    if status in {"verified", "partial"} and not accepted_sources:
        raise SystemExit(f"{org_id}.{field}: {status} decision has no external source")
    if status == "verified" and raw.get("value") is None:
        raise SystemExit(f"{org_id}.{field}: verified decision has no value")
    caveat_zh, caveat_en = text_pair(raw.get("caveat"))
    base_caveat_zh = raw.get("caveat_zh") or caveat_zh
    base_caveat_en = raw.get("caveat_en") or caveat_en
    # When the independent review replaces the published scalar, the raw
    # shard's selection rationale may describe the superseded value.  Keep the
    # raw shard untouched and publish only the final-review caveat here.
    if value_override and override:
        base_caveat_zh = ""
        base_caveat_en = ""
    normalized = {
        "status": status,
        "action": action,
        "value": raw_value,
        "scope": value_override.get("scope") if value_override else raw.get("scope"),
        "as_of": raw.get("as_of"),
        "note_zh": value_override.get("note_zh") if value_override else raw.get("note_zh") or "",
        "note_en": value_override.get("note_en") if value_override else raw.get("note_en") or "",
        "caveat_zh": " ".join(filter(None, (base_caveat_zh, override_caveat_zh))),
        "caveat_en": " ".join(filter(None, (base_caveat_en, override_caveat_en))),
        "sources": sources,
    }
    if value_override:
        normalized["preferred_source_url"] = value_override["preferred_source_url"]
        normalized["public_projection_allowed"] = bool(value_override.get("public_projection_allowed"))
    return normalized


def main() -> int:
    expected_orgs = json.loads((DATA / "organizations.json").read_text(encoding="utf-8"))["organizations"]
    expected_ids = [row["id"] for row in expected_orgs]
    expected_cities = json.loads((DATA / "cities.json").read_text(encoding="utf-8"))["cities"]
    expected_city_ids = [row["id"] for row in expected_cities]
    by_id: dict[str, dict] = {}
    city_by_id: dict[str, dict] = {}
    receipts = []

    for name in SHARDS:
        path = RESEARCH / name
        if not path.is_file():
            raise SystemExit(f"missing completed audit shard: {path}")
        raw_bytes = path.read_bytes()
        blob = json.loads(raw_bytes)
        rows = organization_rows(blob)
        cities = city_rows(blob)
        receipts.append({
            "file": name,
            "sha256": hashlib.sha256(raw_bytes).hexdigest(),
            "organization_count": len(rows),
            "city_count": len(cities),
        })
        for city in cities:
            normalized_city = normalize_city(city)
            city_id = normalized_city["id"]
            if city_id in city_by_id:
                raise SystemExit(f"duplicate city output audit across shards: {city_id}")
            city_by_id[city_id] = normalized_city
        for row in rows:
            org_id = row.get("id")
            if not isinstance(org_id, str) or not org_id:
                raise SystemExit(f"{name}: organization without id")
            if org_id in by_id:
                raise SystemExit(f"duplicate organization across audit shards: {org_id}")
            decisions = row.get("field_decisions") or row.get("fields")
            if not isinstance(decisions, dict) or set(decisions) != set(FIELDS):
                raise SystemExit(f"{org_id}: expected exactly six field decisions")
            by_id[org_id] = {
                "id": org_id,
                "entity_boundary_zh": row.get("entity_boundary_zh") or "",
                "entity_boundary_en": row.get("entity_boundary_en") or "",
                "fields": {field: normalize_field(org_id, field, decisions[field]) for field in FIELDS},
            }

    missing = sorted(set(expected_ids) - set(by_id))
    extra = sorted(set(by_id) - set(expected_ids))
    if missing or extra:
        raise SystemExit(f"audit partition mismatch: missing={missing}, extra={extra}")
    missing_cities = sorted(set(expected_city_ids) - set(city_by_id))
    extra_cities = sorted(set(city_by_id) - set(expected_city_ids))
    if missing_cities or extra_cities:
        raise SystemExit(f"city audit partition mismatch: missing={missing_cities}, extra={extra_cities}")

    status_counts = {field: {} for field in FIELDS}
    for row in by_id.values():
        for field, decision in row["fields"].items():
            status = decision["status"]
            status_counts[field][status] = status_counts[field].get(status, 0) + 1

    output = {
        "metadata": {
            "schema_version": 1,
            "reviewed_at": "2026-09-03",
            "organization_count": len(expected_ids),
            "field_decision_count": len(expected_ids) * len(FIELDS),
            "city_count": len(expected_city_ids),
            "city_field_decision_count": len(expected_city_ids) * len(CITY_FIELDS),
            "fields": list(FIELDS),
            "status_counts": status_counts,
            "source_policy_zh": "只接受政府、监管/交易所、公司/机构官方一手来源；QROST自身内容不得作为证据。",
            "source_policy_en": "Only government, regulator/exchange and first-party organization sources are accepted; QROST's own content is never evidence.",
            "independent_review_adjustments": {
                "status_overrides": len(INDEPENDENT_STATUS_OVERRIDES),
                "lead_only_urls": len(LEAD_ONLY_URLS),
                "canonical_url_replacements": len(SOURCE_URL_REPLACEMENTS),
            },
            "shard_receipts": receipts,
        },
        "cities": [city_by_id[city_id] for city_id in expected_city_ids],
        "organizations": [by_id[org_id] for org_id in expected_ids],
    }
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"wrote {OUT.relative_to(ROOT)} cities={len(expected_city_ids)} city_fields={len(expected_city_ids) * len(CITY_FIELDS)} "
        f"organizations={len(expected_ids)} fields={len(expected_ids) * len(FIELDS)}"
    )
    print(json.dumps(status_counts, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
