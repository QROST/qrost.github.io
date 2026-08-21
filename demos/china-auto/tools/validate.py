#!/usr/bin/env python3
"""FK + enum + confidence/source gates for the China auto city atlas."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
SCHEMA = json.loads((Path(__file__).parent / "schema.json").read_text(encoding="utf-8"))
ENUMS = SCHEMA["enums"]


def load(name: str, key: str) -> list:
    path = DATA / name
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data.get(key), list):
        raise ValueError(f"{name}: missing list '{key}'")
    return data[key]


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
    cluster_ids = {c["id"] for c in clusters}
    source_ids = {s["id"] for s in sources}
    entity_ids = city_ids | org_ids | cluster_ids | {f["id"] for f in facilities} | {m["id"] for m in media}

    if len(city_ids) != len(cities):
        errors.append("duplicate city id")
    if len(org_ids) != len(orgs):
        errors.append("duplicate organization id")

    core = [c for c in cities if c.get("tier") == "core"]
    specialist = [c for c in cities if c.get("tier") == "specialist"]
    if len(core) != 15:
        errors.append(f"expected 15 core cities, found {len(core)}")
    if len(specialist) != 10:
        errors.append(f"expected 10 specialist cities, found {len(specialist)}")

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
        if hq and hq not in city_ids:
            errors.append(f"org {o['id']}: HQ city {hq} not in V1 cities")
        parent = o.get("parent_id")
        if parent and parent not in org_ids:
            errors.append(f"org {o['id']}: parent {parent} missing")
        if o.get("status") not in ENUMS["org_status"]:
            errors.append(f"org {o['id']}: bad status")
        conf = o.get("confidence") or 0
        if conf > 0.5 and not o.get("source_ids"):
            errors.append(f"org {o['id']}: confidence>0.5 requires source_ids")
        for sid in o.get("source_ids") or []:
            if sid not in source_ids:
                errors.append(f"org {o['id']}: unknown source {sid}")

    for f in facilities:
        if f.get("operator_id") not in org_ids:
            errors.append(f"facility {f['id']}: operator missing")
        if f.get("city_id") not in city_ids:
            errors.append(f"facility {f['id']}: city missing")
        if f.get("facility_type") not in ENUMS["facility_type"]:
            errors.append(f"facility {f['id']}: bad type")
        if f.get("status") not in ENUMS["facility_status"]:
            errors.append(f"facility {f['id']}: bad status")
        for sid in f.get("source_ids") or []:
            if sid not in source_ids:
                errors.append(f"facility {f['id']}: unknown source {sid}")

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

    for st in stats:
        if st["city_id"] not in city_ids:
            errors.append(f"stats {st['city_id']} {st['year']}: city missing")
        if not st.get("statistical_scope"):
            errors.append(f"stats {st['city_id']} {st['year']}: statistical_scope required")
        for sid in st.get("source_ids") or []:
            if sid not in source_ids:
                errors.append(f"stats {st['city_id']}: unknown source {sid}")
        if (st.get("confidence") or 0) > 0.5 and not st.get("source_ids"):
            errors.append(f"stats {st['city_id']}: confidence>0.5 requires source")

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

    for s in sources:
        if s.get("grade") not in ENUMS["source_grade"]:
            errors.append(f"source {s['id']}: bad grade")
        if s.get("source_type") not in ENUMS["source_type"]:
            errors.append(f"source {s['id']}: bad type")

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
