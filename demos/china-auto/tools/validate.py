#!/usr/bin/env python3
"""FK + enum + confidence/source gates for the China auto city atlas."""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
SCHEMA = json.loads((Path(__file__).parent / "schema.json").read_text(encoding="utf-8"))
ENUMS = SCHEMA["enums"]
FORBIDDEN_SOURCE_TERMS = (
    "qrost",
    "research brief",
    "研究简报",
    "internal brief",
    "内部简报",
    "self-authored",
    "自编",
)
ENRICHMENT_AVAILABILITY = {
    "verified", "partial", "not_disclosed", "not_applicable",
    "not_separately_listed", "unverified",
}
ENRICHMENT_FIELDS = {
    "founded", "ownership", "listing", "employees", "vehicle_sales", "plants",
}


def load(name: str, key: str) -> list:
    path = DATA / name
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data.get(key), list):
        raise ValueError(f"{name}: missing list '{key}'")
    return data[key]


def is_external_http_url(value: object) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        parsed = urlparse(value.strip())
    except ValueError:
        return False
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme not in {"http", "https"} or not host:
        return False
    return host != "qrost.github.io" and not host.endswith(".qrost.github.io")


def check_enrichment_source_urls(errors: list[str], entity_id: str, node: object, path: str = "") -> None:
    """Reject self-authored/internal evidence anywhere in an enrichment row."""
    if isinstance(node, dict):
        for key, value in node.items():
            here = f"{path}.{key}" if path else key
            if key == "source_url":
                if not is_external_http_url(value):
                    errors.append(f"enrich {entity_id}: {here} needs external http(s) URL")
                elif any(term.lower() in str(value).lower() for term in FORBIDDEN_SOURCE_TERMS):
                    errors.append(f"enrich {entity_id}: {here} is self-authored/internal")
            else:
                check_enrichment_source_urls(errors, entity_id, value, here)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            check_enrichment_source_urls(errors, entity_id, value, f"{path}[{index}]")


def provenance_key(kind: str, row: dict) -> str:
    rid = row.get("id")
    if rid:
        return f"{kind} {rid}"
    if kind == "stats":
        return f"stats {row.get('city_id')} {row.get('year')}"
    return kind


def evidence_ref(kind: str, row: dict) -> str:
    if kind == "stats":
        return f"statistics:{row.get('city_id')}:{row.get('year')}"
    prefix = {"org": "organization", "role": "city_role"}.get(kind, kind)
    return f"{prefix}:{row.get('id')}"


def check_provenance(
    errors: list[str], kind: str, row: dict, source_by_id: dict[str, dict]
) -> None:
    label = provenance_key(kind, row)
    confidence = row.get("confidence")
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
        errors.append(f"{label}: numeric confidence required")
        return
    if not 0 <= confidence <= 1:
        errors.append(f"{label}: confidence outside 0..1")

    source_ids = row.get("source_ids")
    if not isinstance(source_ids, list):
        errors.append(f"{label}: source_ids list required")
        return
    if len(source_ids) != len(set(source_ids)):
        errors.append(f"{label}: duplicate source_ids")
    for sid in source_ids:
        source = source_by_id.get(sid)
        if not source:
            errors.append(f"{label}: unknown source {sid}")
        elif not is_external_http_url(source.get("url")):
            errors.append(f"{label}: source {sid} has no resolvable external URL")
    if confidence > 0.5 and not source_ids:
        errors.append(f"{label}: confidence>0.5 requires external source_ids")


def check_source_record(errors: list[str], source: dict) -> None:
    sid = source.get("id", "<missing>")
    if source.get("grade") not in ENUMS["source_grade"]:
        errors.append(f"source {sid}: bad grade")
    if source.get("source_type") not in ENUMS["source_type"]:
        errors.append(f"source {sid}: bad type")
    if not is_external_http_url(source.get("url")):
        errors.append(f"source {sid}: nonempty external http(s) URL required")
    for field in ("publisher_zh", "publisher_en"):
        if not isinstance(source.get(field), str) or not source[field].strip():
            errors.append(f"source {sid}: nonempty {field} required")
    if source.get("publisher_ownership") != "external":
        errors.append(f"source {sid}: publisher_ownership must be external")
    publisher_domain = source.get("publisher_domain")
    try:
        url_host = (urlparse(str(source.get("url") or "")).hostname or "").lower().rstrip(".")
    except ValueError:
        url_host = ""
    if not isinstance(publisher_domain, str) or not publisher_domain.strip():
        errors.append(f"source {sid}: nonempty publisher_domain required")
    elif publisher_domain.lower().rstrip(".") != url_host:
        errors.append(f"source {sid}: publisher_domain must match source URL host")

    scope = source.get("support_scope")
    if not isinstance(scope, dict):
        errors.append(f"source {sid}: support_scope object required")
    else:
        refs = scope.get("entity_refs")
        fields = scope.get("fields")
        if not isinstance(refs, list) or not refs or not all(isinstance(ref, str) and ref.strip() for ref in refs):
            errors.append(f"source {sid}: support_scope.entity_refs must be a nonempty string list")
        if not isinstance(fields, list) or not fields or not all(isinstance(field, str) and field.strip() for field in fields):
            errors.append(f"source {sid}: support_scope.fields must be a nonempty string list")
        for field in ("scope_zh", "scope_en"):
            if not isinstance(scope.get(field), str) or not scope[field].strip():
                errors.append(f"source {sid}: support_scope.{field} required")
    text = " ".join(
        str(source.get(field) or "")
        for field in (
            "id", "publisher_zh", "publisher_en", "title_zh", "title_en",
            "notes_zh", "notes_en", "url",
        )
    ).lower()
    for term in FORBIDDEN_SOURCE_TERMS:
        if term.lower() in text:
            errors.append(f"source {sid}: forbidden internal/self-authored marker {term!r}")
            break


def main() -> int:
    errors: list[str] = []
    cities = load("cities.json", "cities")
    orgs = load("organizations.json", "organizations")
    facilities = load("facilities.json", "facilities")
    roles = load("city-roles.json", "city_roles")
    relations = load("relations.json", "relations")
    clusters = load("clusters.json", "clusters")
    stats = load("statistics.json", "statistics")
    media = load("media.json", "media")
    institutions = load("institutions.json", "institutions")
    sources = load("sources.json", "sources")

    city_ids = {c["id"] for c in cities}
    org_ids = {o["id"] for o in orgs}
    org_by_id = {o["id"]: o for o in orgs}
    cluster_ids = {c["id"] for c in clusters}
    source_ids = {s["id"] for s in sources}
    source_by_id = {s["id"]: s for s in sources}
    entity_ids = city_ids | org_ids | cluster_ids | {f["id"] for f in facilities} | {m["id"] for m in media}

    if len(city_ids) != len(cities):
        errors.append("duplicate city id")
    if len(org_ids) != len(orgs):
        errors.append("duplicate organization id")
    if len(source_ids) != len(sources):
        errors.append("duplicate source id")

    for source in sources:
        check_source_record(errors, source)

    evidence_sets = (
        ("city", cities),
        ("org", orgs),
        ("facility", facilities),
        ("role", roles),
        ("relation", relations),
        ("cluster", clusters),
        ("stats", stats),
        ("media", media),
        ("institution", institutions),
    )
    for kind, rows in evidence_sets:
        for row in rows:
            check_provenance(errors, kind, row, source_by_id)

    ref_to_row: dict[str, dict] = {}
    source_usage: dict[str, set[str]] = defaultdict(set)
    for kind, rows in evidence_sets:
        for row in rows:
            ref = evidence_ref(kind, row)
            if ref in ref_to_row:
                errors.append(f"duplicate evidence ref {ref}")
            ref_to_row[ref] = row
            for sid in row.get("source_ids") or []:
                source_usage[sid].add(ref)
    for source in sources:
        sid = source.get("id", "<missing>")
        scope = source.get("support_scope")
        if not isinstance(scope, dict):
            continue
        declared = set(scope.get("entity_refs") or [])
        used = source_usage.get(sid, set())
        for ref in sorted(declared - set(ref_to_row)):
            errors.append(f"source {sid}: support_scope unknown entity_ref {ref}")
        for ref in sorted(used - declared):
            errors.append(f"source {sid}: used by {ref} but support_scope omits it")
        for ref in sorted(declared - used):
            errors.append(f"source {sid}: declares {ref} but that row does not link the source")
        for field in scope.get("fields") or []:
            for ref in declared & set(ref_to_row):
                if field not in ref_to_row[ref]:
                    errors.append(f"source {sid}: scoped field {field} missing from {ref}")

    core = [c for c in cities if c.get("tier") == "core"]
    specialist = [c for c in cities if c.get("tier") == "specialist"]
    if len(core) != 17:
        errors.append(f"expected 17 core cities, found {len(core)}")
    if len(specialist) != 11:
        errors.append(f"expected 11 specialist cities, found {len(specialist)}")

    for c in cities:
        if c.get("tier") not in ENUMS["city_tier"]:
            errors.append(f"city {c['id']}: bad tier {c.get('tier')}")
        if c.get("admin_level") not in ENUMS["admin_level"]:
            errors.append(f"city {c['id']}: bad admin_level")
        for t in c.get("role_tags") or []:
            if t not in ENUMS["role_tag"]:
                errors.append(f"city {c['id']}: bad role_tag {t}")
        for cid in c.get("cluster_ids") or []:
            if cid not in cluster_ids:
                errors.append(f"city {c['id']}: unknown cluster {cid}")
        for eid in c.get("featured_entity_ids") or []:
            if eid not in org_ids:
                errors.append(f"city {c['id']}: featured org missing {eid}")
        if None in (c.get("lat"), c.get("lng")):
            errors.append(f"city {c['id']}: missing coordinates")

    for o in orgs:
        if o.get("organization_type") not in ENUMS["organization_type"]:
            errors.append(f"org {o['id']}: bad type")
        hq = o.get("headquarters_city_id")
        if not hq:
            errors.append(f"org {o['id']}: headquarters_city_id required")
        elif hq not in city_ids:
            errors.append(f"org {o['id']}: HQ city {hq} not in atlas cities")
        parent = o.get("parent_id")
        if parent and parent not in org_ids:
            errors.append(f"org {o['id']}: parent {parent} missing")
        if o.get("status") not in ENUMS["org_status"]:
            errors.append(f"org {o['id']}: bad status")

    enrich_path = DATA / "org-enrichment.json"
    enrich = {}
    if enrich_path.exists():
        blob = json.loads(enrich_path.read_text(encoding="utf-8"))
        enrich = blob.get("enrichment") if isinstance(blob.get("enrichment"), dict) else blob
        if not isinstance(enrich, dict):
            errors.append("org-enrichment.json: expected enrichment object")
            enrich = {}
    for eid, row in enrich.items():
        if eid not in org_ids:
            errors.append(f"enrich {eid}: unknown org")
            continue
        if not isinstance(row, dict):
            errors.append(f"enrich {eid}: not an object")
            continue
        check_enrichment_source_urls(errors, eid, row)
        availability = row.get("availability")
        if not isinstance(availability, dict):
            errors.append(f"enrich {eid}: availability object required")
            availability = {}
        missing_availability = sorted(ENRICHMENT_FIELDS - set(availability))
        if missing_availability:
            errors.append(f"enrich {eid}: availability missing {missing_availability}")
        for field, status in availability.items():
            if field in ENRICHMENT_FIELDS and status not in ENRICHMENT_AVAILABILITY:
                errors.append(f"enrich {eid}: bad availability {field}={status}")
        own = row.get("ownership")
        if own and own not in ENUMS["ownership"]:
            errors.append(f"enrich {eid}: bad ownership {own}")
        if availability.get("ownership") in {"verified", "partial"}:
            evidence = row.get("ownership_evidence")
            if not isinstance(evidence, dict) or not is_external_http_url(evidence.get("source_url")):
                errors.append(f"enrich {eid}: reviewed ownership needs ownership_evidence.source_url")
        founded = row.get("founded")
        if founded:
            if not isinstance(founded, dict):
                errors.append(f"enrich {eid}: founded must be an object")
            else:
                value = founded.get("value")
                if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 2100:
                    errors.append(f"enrich {eid}: founded.value must be a plausible integer year")
                if not is_external_http_url(founded.get("source_url")):
                    errors.append(f"enrich {eid}: founded needs external source_url")
                bare_year = org_by_id[eid].get("founded_year")
                if bare_year is not None and value != bare_year:
                    errors.append(
                        f"enrich {eid}: founded.value {value} conflicts with organization founded_year {bare_year}"
                    )
        if availability.get("founded") == "verified" and not founded:
            errors.append(f"enrich {eid}: verified founded needs founded evidence object")
        listing = row.get("listing")
        if listing:
            if listing.get("exchange") and listing["exchange"] not in ENUMS["exchange"]:
                errors.append(f"enrich {eid}: bad exchange")
            if not isinstance(listing.get("listed"), bool):
                errors.append(f"enrich {eid}: listing.listed boolean required")
            elif listing["listed"] and not listing.get("ticker"):
                errors.append(f"enrich {eid}: listed entity needs ticker")
            elif not listing["listed"] and (listing.get("ticker") is not None or listing.get("exchange") not in (None, "none")):
                errors.append(f"enrich {eid}: unlisted entity cannot carry exchange/ticker")
            venues = listing.get("venues") or []
            if not isinstance(venues, list):
                errors.append(f"enrich {eid}: listing.venues must be an array")
                venues = []
            for venue in venues:
                if not isinstance(venue, dict):
                    errors.append(f"enrich {eid}: listing venue must be an object")
                    continue
                if venue.get("exchange") not in {value for value in ENUMS["exchange"] if value != "none"}:
                    errors.append(f"enrich {eid}: bad listing venue exchange {venue.get('exchange')}")
                if not venue.get("ticker"):
                    errors.append(f"enrich {eid}: listing venue needs ticker")
            if availability.get("listing") in {"verified", "not_separately_listed"} and not is_external_http_url(listing.get("source_url")):
                errors.append(f"enrich {eid}: reviewed listing needs external source_url")
        for tag in row.get("powertrain") or []:
            if tag not in ENUMS["powertrain"]:
                errors.append(f"enrich {eid}: bad powertrain {tag}")
        for tag in row.get("segment") or []:
            if tag not in ENUMS["segment"]:
                errors.append(f"enrich {eid}: bad segment {tag}")
        er = row.get("export_role")
        if er and er not in ENUMS["export_role"]:
            errors.append(f"enrich {eid}: bad export_role {er}")
        for tag in row.get("education_tags") or []:
            if tag not in ENUMS["education_tag"]:
                errors.append(f"enrich {eid}: bad education_tag {tag}")
        for field in ("employees", "vehicle_sales"):
            m = row.get(field)
            if not m:
                if availability.get(field) == "verified":
                    errors.append(f"enrich {eid}: verified {field} needs a metric")
                continue
            if not isinstance(m, dict) or m.get("value") is None:
                errors.append(f"enrich {eid}: {field} needs value")
            elif not is_external_http_url(m.get("source_url")):
                errors.append(f"enrich {eid}: {field} needs external http(s) source_url")
            else:
                metric_url = str(m["source_url"]).lower()
                if any(term.lower() in metric_url for term in FORBIDDEN_SOURCE_TERMS):
                    errors.append(f"enrich {eid}: {field} source_url is self-authored/internal")
                if m.get("source_authority") not in (None, "primary", "secondary"):
                    errors.append(f"enrich {eid}: {field} has invalid source_authority")
            if availability.get(field) == "verified" and (not isinstance(m, dict) or m.get("value") is None):
                errors.append(f"enrich {eid}: verified {field} needs a metric")
            if field == "vehicle_sales" and isinstance(m, dict):
                if m.get("non_additive") is not True:
                    errors.append(f"enrich {eid}: vehicle_sales must be marked non_additive")
                if m.get("aggregation_level") not in {"brand", "reported_entity_scope"}:
                    errors.append(f"enrich {eid}: vehicle_sales has invalid aggregation_level")

    missing_enrich = sorted(org_ids - set(enrich))
    if missing_enrich:
        errors.append(f"org-enrichment.json: missing organizations {missing_enrich}")

    for f in facilities:
        if f.get("operator_id") not in org_ids:
            errors.append(f"facility {f['id']}: operator missing")
        manufactures_for = f.get("manufactures_for_ids") or []
        if not isinstance(manufactures_for, list) or any(org_id not in org_ids for org_id in manufactures_for):
            errors.append(f"facility {f['id']}: manufactures_for_ids must resolve to organizations")
        if len(manufactures_for) != len(set(manufactures_for)):
            errors.append(f"facility {f['id']}: duplicate manufactures_for_ids")
        if f.get("operator_id") in manufactures_for:
            errors.append(f"facility {f['id']}: operator must not repeat as contract-manufacturing customer")
        associated = f.get("associated_organization_ids") or []
        if not isinstance(associated, list) or any(org_id not in org_ids for org_id in associated):
            errors.append(f"facility {f['id']}: associated_organization_ids must resolve to organizations")
        if len(associated) != len(set(associated)):
            errors.append(f"facility {f['id']}: duplicate associated_organization_ids")
        if f.get("operator_id") in associated:
            errors.append(f"facility {f['id']}: operator must not repeat as associated organization")
        boundary_match = f.get("operator_matches_entity_boundary")
        if boundary_match not in (True, False, None):
            errors.append(f"facility {f['id']}: operator_matches_entity_boundary must be true, false or null")
        if boundary_match in (True, False) and not (
            f.get("operator_legal_name_zh") and f.get("operator_legal_name_en")
        ):
            errors.append(f"facility {f['id']}: a resolved operator boundary needs exact bilingual legal names")
        translation_flag = f.get("operator_legal_name_en_is_translation", False)
        if not isinstance(translation_flag, bool):
            errors.append(f"facility {f['id']}: operator_legal_name_en_is_translation must be boolean")
        elif translation_flag and f.get("operator_matches_entity_boundary") is not False:
            errors.append(f"facility {f['id']}: working operator translation requires a non-matching catalog boundary")
        if bool(f.get("address_zh")) != bool(f.get("address_en")):
            errors.append(f"facility {f['id']}: address must be bilingual")
        if bool(f.get("site_scope_note_zh")) != bool(f.get("site_scope_note_en")):
            errors.append(f"facility {f['id']}: site scope note must be bilingual")
        if f.get("city_id") not in city_ids:
            errors.append(f"facility {f['id']}: city missing")
        if f.get("facility_type") not in ENUMS["facility_type"]:
            errors.append(f"facility {f['id']}: bad type")
        if f.get("status") not in ENUMS["facility_status"]:
            errors.append(f"facility {f['id']}: bad status")
        if f.get("facility_type") in {"vehicle_plant", "engine_plant", "battery_plant", "parts_plant"} and f.get("confidence", 0) > 0.5:
            ref = f"facility:{f['id']}"
            type_supported = any(
                ref in ((source_by_id.get(sid) or {}).get("support_scope") or {}).get("entity_refs", [])
                and "facility_type" in ((source_by_id.get(sid) or {}).get("support_scope") or {}).get("fields", [])
                for sid in f.get("source_ids") or []
            )
            if not type_supported:
                errors.append(f"facility {f['id']}: counted verified plant needs source scope for facility_type")

    role_keys = set()
    for r in roles:
        key = (r["city_id"], r["entity_id"], r["role_type"])
        if key in role_keys:
            errors.append(f"duplicate city_role {key}")
        role_keys.add(key)
        if r["city_id"] not in city_ids:
            errors.append(f"role {r['id']}: city missing")
        if r["entity_id"] not in org_ids:
            errors.append(f"role {r['id']}: entity missing")
        if r.get("role_type") not in ENUMS["role_type"]:
            errors.append(f"role {r['id']}: bad role_type")

    for rel in relations:
        if rel.get("relation_type") not in ENUMS["relation_type"]:
            errors.append(f"relation {rel['id']}: bad type")
        if rel["from_id"] not in entity_ids:
            errors.append(f"relation {rel['id']}: from {rel['from_id']} missing")
        if rel["to_id"] not in entity_ids:
            errors.append(f"relation {rel['id']}: to {rel['to_id']} missing")
        cid = rel.get("cluster_id")
        if cid and cid not in cluster_ids:
            errors.append(f"relation {rel['id']}: cluster missing")

    for cl in clusters:
        for cid in cl.get("city_ids") or []:
            if cid not in city_ids:
                errors.append(f"cluster {cl['id']}: city {cid} missing")

    if len(stats) != len(city_ids):
        errors.append(f"expected one 2025 statistics audit row per city ({len(city_ids)}), found {len(stats)}")
    stat_keys = [(st.get("city_id"), st.get("year")) for st in stats]
    if len(stat_keys) != len(set(stat_keys)):
        errors.append("statistics rows must be unique by city_id/year")
    for st in stats:
        if st["city_id"] not in city_ids:
            errors.append(f"stats {st['city_id']} {st['year']}: city missing")
        if not st.get("statistical_scope"):
            errors.append(f"stats {st['city_id']} {st['year']}: statistical_scope required")
        availability = st.get("availability")
        stat_fields = {"total_vehicle_output", "nev_output"}
        if not isinstance(availability, dict) or set(availability) != stat_fields:
            errors.append(f"stats {st['city_id']} {st['year']}: exact two-field availability required")
            availability = {}
        reviews = st.get("field_reviews")
        if not isinstance(reviews, dict) or set(reviews) != stat_fields:
            errors.append(f"stats {st['city_id']} {st['year']}: exact two-field reviews required")
            reviews = {}
        for field in stat_fields:
            status = availability.get(field)
            if status not in ENRICHMENT_AVAILABILITY:
                errors.append(f"stats {st['city_id']} {st['year']}: bad {field} availability {status}")
            if status == "verified" and st.get(field) is None:
                errors.append(f"stats {st['city_id']} {st['year']}: verified {field} needs value")
            review = reviews.get(field) if isinstance(reviews.get(field), dict) else {}
            if status in {"verified", "partial"} and not is_external_http_url(review.get("source_url")):
                # Legacy hand-reviewed rows may predate the compact review, but
                # they still need a linked external registry source.
                if not st.get("source_ids"):
                    errors.append(f"stats {st['city_id']} {st['year']}: supported {field} needs external evidence")

    for m in media:
        if m["organization_id"] not in org_ids:
            errors.append(f"media {m['id']}: org missing")
        if m.get("media_type") not in ENUMS["media_type"]:
            errors.append(f"media {m['id']}: bad type")
        for field in ("registered_city_id", "editorial_city_id"):
            if m.get(field) and m[field] not in city_ids:
                errors.append(f"media {m['id']}: {field} missing")

    for inst in institutions:
        if inst["organization_id"] not in org_ids:
            errors.append(f"institution {inst['id']}: org missing")
        if inst["city_id"] not in city_ids:
            errors.append(f"institution {inst['id']}: city missing")

    if errors:
        print(f"validate: {len(errors)} error(s)")
        for e in errors[:80]:
            print(" -", e)
        if len(errors) > 80:
            print(f" ... {len(errors) - 80} more")
        return 1
    print(
        f"validate: OK  cities={len(cities)} orgs={len(orgs)} facilities={len(facilities)} "
        f"roles={len(roles)} relations={len(relations)} stats={len(stats)} media={len(media)} "
        f"institutions={len(institutions)} sources={len(sources)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
