#!/usr/bin/env python3
"""Validate the pharma-atlas data graph.

Hard errors (exit 1): missing required fields, illegal enums, bad ids/dates,
missing sources on confidence>0.5 records, geo out of bounds, and CORE foreign-key
orphans (product.company_id / modality_id / therapeutic_area_id, site.company_id,
milestone.company_id / therapeutic_area_id, benchmark refs).

Soft warnings (non-fatal, printed to stderr): optional cross-refs that may point at
entities we deliberately don't catalog (parent_id, originator_product_id,
incumbent_product_ids, representative_product_ids, milestone.product_ids, site.focus,
secondary_ta_ids), duplicate display names, and below-target min counts.

Runs against assets/data/ when populated; falls back to tmp/research/ for a pre-merge
sanity pass. An empty scaffold validates OK.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
RESEARCH = ROOT / "tmp" / "research"

ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")

VALID_REGION = {"north_america", "europe", "japan", "greater_china", "oceania", "other_apac", "latam", "mea"}
VALID_COMPANY_TYPE = {"originator_bigpharma", "biotech", "generics", "cdmo_cro", "vaccine", "biosimilar", "tcm", "diversified", "lifesci_tools", "medtech", "consumer_health", "venture_creation"}
VALID_SITE_TYPE = {"HQ", "RD", "manufacturing", "commercial", "JV"}
VALID_APPROVAL = {"preclinical", "ph1", "ph2", "ph3", "filed", "approved", "withdrawn"}
VALID_DRUG_CLASS = {"originator", "biosimilar", "generic"}
VALID_MODALITY_CLASS = {
    "small_molecule", "mab", "bispecific", "adc", "fusion_protein", "peptide",
    "biologic", "vaccine", "cell_therapy", "gene_therapy", "rna_oligo",
    "radioligand", "biosimilar", "tcm",
}
VALID_MARKETS = {"FDA", "EMA", "NMPA", "PMDA", "TGA", "MHRA", "ANVISA", "WHO", "CDSCO", "MFDS", "HealthCanada"}
VALID_REGULATOR = {"FDA", "EMA", "NMPA", "PMDA", "TGA", "MHRA", "CDSCO", "MFDS", "HealthCanada", "ANVISA", "Swissmedic", "ANSM"}
VALID_EVIDENCE = {"audited", "case_study", "vendor_claim", "media"}
VALID_POLICY_TYPE = {"procurement", "reimbursement", "quality", "regulatory", "financing", "ip", "innovation", "access", "distribution", "data"}
VALID_POLICY_EFFECT = {"positive", "negative", "mixed", "neutral"}
VALID_DEAL_TYPE = {"license_out", "license_in", "m_and_a", "jv", "collaboration", "equity_stake"}
VALID_DEAL_STATUS = {"announced", "completed", "terminated"}
VALID_DEAL_ROLE = {"licensor", "licensee", "acquirer", "target", "partner", "investor", "investee"}

REQ_COMPANY = {"id", "name_zh", "name_en", "country", "country_display_zh", "country_display_en",
               "hq_city", "is_public", "company_type", "region", "confidence", "last_verified", "sources"}
# Roster tier: lightweight listed-company index (no required sites/products) — for broad
# exchange-by-exchange coverage of the global listed-pharma long tail.
REQ_ROSTER = {"id", "name_en", "country", "country_display_en", "company_type", "region",
              "exchange", "confidence", "last_verified", "sources"}
VALID_TIER = {"deep", "roster"}
REQ_SITE = {"id", "company_id", "name_zh", "name_en", "site_type", "country", "city",
            "lat", "lng", "is_subsidiary", "confidence", "last_verified", "sources"}
REQ_PRODUCT = {"id", "name_zh", "name_en", "brand_name", "company_id", "modality_id",
               "therapeutic_area_id", "indication_zh", "indication_en", "approval_status",
               "is_blockbuster", "drug_class", "region", "confidence", "last_verified", "sources"}
REQ_MODALITY = {"id", "name_zh", "name_en", "class", "description_zh", "description_en",
                "representative_product_ids", "confidence", "last_verified", "sources"}
REQ_TA = {"id", "name_zh", "name_en", "confidence", "last_verified", "sources"}
REQ_MILESTONE = {"id", "date", "company_id", "therapeutic_area_id", "headline_zh", "headline_en",
                 "before_gap_zh", "before_gap_en", "achievement_zh", "achievement_en",
                 "still_missing_zh", "still_missing_en", "evidence_level", "confidence", "sources"}
REQ_COUNTRY = {"country", "name_zh", "name_en", "market_size", "regulator", "confidence", "last_verified", "sources"}
REQ_POLICY = {"id", "title_zh", "title_en", "summary_zh", "summary_en", "date", "policy_type",
              "agency_zh", "agency_en", "confidence", "sources"}
REQ_DEAL = {"id", "deal_type", "date", "headline_zh", "headline_en", "parties",
            "summary_zh", "summary_en", "status", "confidence", "sources"}


def load(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def root_list(path: Path, *keys):
    """Return the first present root-key array, else [] (tolerates dict or bare list)."""
    data = load(path)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in keys:
            if isinstance(data.get(k), list):
                return data[k]
    return []


def check_sources(rec: dict, ctx: str, errors: list):
    conf = rec.get("confidence")
    srcs = rec.get("sources") or []
    if not isinstance(srcs, list) or not srcs:
        if conf is not None and float(conf) > 0.5:
            errors.append(f"{ctx}: confidence>{0.5} requires sources[]")
        return
    for i, s in enumerate(srcs):
        if not isinstance(s, dict) or not s.get("url"):
            errors.append(f"{ctx}.sources[{i}]: missing url")
        elif not str(s["url"]).startswith(("http://", "https://")):
            errors.append(f"{ctx}.sources[{i}]: url must be http(s)")
        acc = s.get("accessed") if isinstance(s, dict) else None
        if acc and not DATE_RE.match(str(acc)):
            errors.append(f"{ctx}.sources[{i}]: bad accessed date {acc!r}")


def check_common(rec: dict, ctx: str, req: set, errors: list, id_field="id"):
    missing = req - set(rec.keys())
    if missing:
        errors.append(f"{ctx}: missing fields {sorted(missing)}")
    rid = rec.get(id_field, "")
    if id_field == "id" and rid and not ID_RE.match(str(rid)):
        errors.append(f"{ctx}: invalid id {rid!r}")
    conf = rec.get("confidence")
    if conf is not None and not (0 <= float(conf) <= 1):
        errors.append(f"{ctx}: confidence out of range")
    lv = rec.get("last_verified")
    if lv and not DATE_RE.match(str(lv)):
        errors.append(f"{ctx}: invalid last_verified {lv!r}")
    check_sources(rec, ctx, errors)


def main() -> int:
    errors: list[str] = []
    warns: list[str] = []

    # ---- locate data (assets/data preferred; tmp/research fallback for pre-merge) ----
    catalog_dir = DATA / "catalog"
    using_research = False
    product_files: list[Path] = []
    if catalog_dir.exists() and any(catalog_dir.glob("*.json")):
        product_files = sorted(catalog_dir.glob("*.json"))
    elif RESEARCH.exists() and any(RESEARCH.glob("*.json")):
        product_files = sorted(RESEARCH.glob("*.json"))
        using_research = True

    def data_file(name: str) -> Path | None:
        p = DATA / name
        return p if p.exists() else None

    # ---- collect entities ----
    companies, sites, products, milestones, countries = [], [], [], [], []
    modalities, tas = [], []

    if using_research:
        for p in product_files:
            d = load(p)
            if isinstance(d, dict):
                companies += d.get("companies", [])
                sites += d.get("sites", [])
                products += d.get("products", [])
                milestones += d.get("milestones", [])
                countries += d.get("countries", [])
    else:
        cf = data_file("companies.json")
        if cf:
            companies = root_list(cf, "companies")
        sf = data_file("sites.json")
        if sf:
            sites = root_list(sf, "sites")
        for p in product_files:
            products += root_list(p, "products")
        bf = data_file("breakthroughs.json")
        if bf:
            milestones = root_list(bf, "milestones")
        csf = data_file("country-stats.json")
        if csf:
            countries = root_list(csf, "countries")

    mf = data_file("modalities.json")
    if mf:
        modalities = root_list(mf, "modalities")
    tf = data_file("therapeutic-areas.json")
    if tf:
        tas = root_list(tf, "therapeutic_areas")

    if not any([companies, products, modalities, tas]):
        print("No data yet (empty scaffold) — validation OK.")
        return 0

    company_ids = {c.get("id") for c in companies if c.get("id")}
    product_ids = {p.get("id") for p in products if p.get("id")}
    modality_ids = {m.get("id") for m in modalities if m.get("id")}
    ta_ids = {t.get("id") for t in tas if t.get("id")}

    # ---- modalities ----
    seen = set()
    for i, m in enumerate(modalities):
        ctx = f"modality[{i}] id={m.get('id','?')}"
        check_common(m, ctx, REQ_MODALITY, errors)
        if m.get("class") and m["class"] not in VALID_MODALITY_CLASS:
            errors.append(f"{ctx}: invalid class={m.get('class')!r}")
        if m.get("id") in seen:
            errors.append(f"duplicate modality id {m.get('id')}")
        seen.add(m.get("id"))
        for pid in m.get("representative_product_ids") or []:
            if product_ids and pid not in product_ids:
                warns.append(f"{ctx}: representative_product_ids -> unknown product {pid!r}")

    # ---- therapeutic areas ----
    seen = set()
    for i, t in enumerate(tas):
        ctx = f"ta[{i}] id={t.get('id','?')}"
        check_common(t, ctx, REQ_TA, errors)
        if t.get("id") in seen:
            errors.append(f"duplicate ta id {t.get('id')}")
        seen.add(t.get("id"))
        for pid in t.get("representative_product_ids") or []:
            if product_ids and pid not in product_ids:
                warns.append(f"{ctx}: representative_product_ids -> unknown product {pid!r}")

    # ---- companies ----
    seen = set()
    for i, c in enumerate(companies):
        ctx = f"company[{i}] id={c.get('id','?')}"
        is_roster = c.get("tier") == "roster"
        check_common(c, ctx, REQ_ROSTER if is_roster else REQ_COMPANY, errors)
        if c.get("tier") and c["tier"] not in VALID_TIER:
            errors.append(f"{ctx}: invalid tier={c.get('tier')!r}")
        if c.get("company_type") and c["company_type"] not in VALID_COMPANY_TYPE:
            errors.append(f"{ctx}: invalid company_type={c.get('company_type')!r}")
        if c.get("region") and c["region"] not in VALID_REGION:
            errors.append(f"{ctx}: invalid region={c.get('region')!r}")
        if c.get("country") and not re.match(r"^[A-Z]{2}$", str(c["country"])):
            errors.append(f"{ctx}: country must be ISO alpha-2 uppercase, got {c.get('country')!r}")
        cid = c.get("id")
        if cid in seen:
            errors.append(f"duplicate company id {cid}")
        seen.add(cid)
        pid = c.get("parent_id")
        if pid:
            if pid == cid:
                errors.append(f"{ctx}: parent_id self-loop")
            elif pid not in company_ids:
                warns.append(f"{ctx}: parent_id -> uncatalogued company {pid!r}")
        for ta in c.get("therapeutic_focus") or []:
            if ta_ids and ta not in ta_ids:
                warns.append(f"{ctx}: therapeutic_focus -> unknown ta {ta!r}")
    # parent cycle detection
    pmap = {c.get("id"): c.get("parent_id") for c in companies if c.get("id")}
    for cid in pmap:
        slow, fast = cid, cid
        while pmap.get(fast):
            slow = pmap.get(slow)
            fast = pmap.get(pmap.get(fast)) if pmap.get(fast) else None
            if fast is None:
                break
            if slow == fast:
                errors.append(f"company parent_id cycle involving {cid!r}")
                break

    # ---- sites ----
    seen = set()
    for i, s in enumerate(sites):
        ctx = f"site[{i}] id={s.get('id','?')}"
        check_common(s, ctx, REQ_SITE, errors)
        if s.get("site_type") and s["site_type"] not in VALID_SITE_TYPE:
            errors.append(f"{ctx}: invalid site_type={s.get('site_type')!r}")
        if s.get("id") in seen:
            errors.append(f"duplicate site id {s.get('id')}")
        seen.add(s.get("id"))
        if company_ids and s.get("company_id") not in company_ids:
            errors.append(f"{ctx}: company_id -> unknown company {s.get('company_id')!r}")
        for axis, lo, hi in (("lat", -90, 90), ("lng", -180, 180)):
            v = s.get(axis)
            if v is not None:
                try:
                    if not (lo <= float(v) <= hi):
                        errors.append(f"{ctx}: {axis}={v} out of bounds")
                except (TypeError, ValueError):
                    errors.append(f"{ctx}: {axis} not numeric ({v!r})")

    # ---- products ----
    seen = set()
    name_index: dict[str, list[str]] = {}
    for i, p in enumerate(products):
        ctx = f"product[{i}] id={p.get('id','?')}"
        check_common(p, ctx, REQ_PRODUCT, errors)
        for field, valid in (("approval_status", VALID_APPROVAL), ("drug_class", VALID_DRUG_CLASS), ("region", VALID_REGION)):
            if p.get(field) and p[field] not in valid:
                errors.append(f"{ctx}: invalid {field}={p.get(field)!r}")
        for mk in p.get("key_markets") or []:
            if mk not in VALID_MARKETS:
                errors.append(f"{ctx}: invalid key_markets entry {mk!r}")
        pid = p.get("id")
        if pid in seen:
            errors.append(f"duplicate product id {pid}")
        seen.add(pid)
        # CORE FK
        if company_ids and p.get("company_id") not in company_ids:
            errors.append(f"{ctx}: company_id -> unknown company {p.get('company_id')!r}")
        if modality_ids and p.get("modality_id") not in modality_ids:
            errors.append(f"{ctx}: modality_id -> unknown modality {p.get('modality_id')!r}")
        if ta_ids and p.get("therapeutic_area_id") not in ta_ids:
            errors.append(f"{ctx}: therapeutic_area_id -> unknown ta {p.get('therapeutic_area_id')!r}")
        for ta in p.get("secondary_ta_ids") or []:
            if ta_ids and ta not in ta_ids:
                warns.append(f"{ctx}: secondary_ta_ids -> unknown ta {ta!r}")
        opid = p.get("originator_product_id")
        if opid and product_ids and opid not in product_ids:
            warns.append(f"{ctx}: originator_product_id -> uncatalogued product {opid!r}")
        bn = (p.get("brand_name") or p.get("name_en") or "").strip().lower()
        if bn:
            name_index.setdefault(bn, []).append(pid)
    for bn, ids in name_index.items():
        if len(ids) > 1:
            warns.append(f"duplicate brand_name {bn!r} across products: {ids}")

    # ---- milestones ----
    seen = set()
    for i, m in enumerate(milestones):
        ctx = f"milestone[{i}] id={m.get('id','?')}"
        check_common(m, ctx, REQ_MILESTONE, errors)
        if m.get("date") and not DATE_RE.match(str(m["date"])):
            errors.append(f"{ctx}: invalid date {m.get('date')!r}")
        if m.get("evidence_level") and m["evidence_level"] not in VALID_EVIDENCE:
            errors.append(f"{ctx}: invalid evidence_level={m.get('evidence_level')!r}")
        if m.get("id") in seen:
            errors.append(f"duplicate milestone id {m.get('id')}")
        seen.add(m.get("id"))
        if company_ids and m.get("company_id") not in company_ids:
            errors.append(f"{ctx}: company_id -> unknown company {m.get('company_id')!r}")
        if ta_ids and m.get("therapeutic_area_id") not in ta_ids:
            errors.append(f"{ctx}: therapeutic_area_id -> unknown ta {m.get('therapeutic_area_id')!r}")
        for key in ("product_ids", "incumbent_product_ids"):
            for ref in m.get(key) or []:
                if product_ids and ref not in product_ids:
                    warns.append(f"{ctx}: {key} -> uncatalogued product {ref!r}")

    # ---- country stats ----
    seen = set()
    for i, c in enumerate(countries):
        ctx = f"country[{i}] {c.get('country','?')}"
        check_common(c, ctx, REQ_COUNTRY, errors, id_field="country")
        if c.get("regulator") and c["regulator"] not in VALID_REGULATOR:
            warns.append(f"{ctx}: unusual regulator={c.get('regulator')!r}")
        if c.get("country") in seen:
            errors.append(f"duplicate country {c.get('country')}")
        seen.add(c.get("country"))

    # ---- benchmark pairs ----
    pairs_path = DATA / "comparisons" / "benchmark-pairs.json"
    if pairs_path.exists():
        pairs = root_list(pairs_path, "pairs")
        for i, pr in enumerate(pairs):
            ctx = f"benchmark-pairs[{i}]"
            ptype = pr.get("pair_type", "product")
            pool = company_ids if ptype == "company" else product_ids
            for role in ("domestic_id", "international_id"):
                rid = pr.get(role)
                if not rid:
                    errors.append(f"{ctx}: missing {role}")
                elif pool and rid not in pool:
                    errors.append(f"{ctx}: orphan {role}={rid!r} (pair_type={ptype})")

    # ---- China policies ----
    pol_path = DATA / "policies.json"
    if pol_path.exists():
        policies = root_list(pol_path, "policies")
        policy_ids = {p.get("id") for p in policies if p.get("id")}
        seen = set()
        for i, p in enumerate(policies):
            ctx = f"policy[{i}] id={p.get('id','?')}"
            check_common(p, ctx, REQ_POLICY, errors)
            if p.get("policy_type") and p["policy_type"] not in VALID_POLICY_TYPE:
                errors.append(f"{ctx}: invalid policy_type={p.get('policy_type')!r}")
            if p.get("date") and not re.match(r"^\d{4}(-\d{2}(-\d{2})?)?$", str(p["date"])):
                errors.append(f"{ctx}: invalid date {p.get('date')!r}")
            if p.get("id") in seen:
                errors.append(f"duplicate policy id {p.get('id')}")
            seen.add(p.get("id"))
            for j, a in enumerate(p.get("affected_companies") or []):
                if not a.get("company_id"):
                    errors.append(f"{ctx}.affected_companies[{j}]: missing company_id")
                elif company_ids and a["company_id"] not in company_ids:
                    errors.append(f"{ctx}.affected_companies[{j}]: company_id -> unknown company {a['company_id']!r}")
                if a.get("effect") and a["effect"] not in VALID_POLICY_EFFECT:
                    errors.append(f"{ctx}.affected_companies[{j}]: invalid effect={a.get('effect')!r}")
            for rid in (p.get("detail") or {}).get("related") or []:
                if rid not in policy_ids:
                    warns.append(f"{ctx}: detail.related -> unknown policy {rid!r}")

    # ---- deals ----
    deals_path = DATA / "deals.json"
    if deals_path.exists():
        deals = root_list(deals_path, "deals")
        seen = set()
        for i, d in enumerate(deals):
            ctx = f"deal[{i}] id={d.get('id','?')}"
            check_common(d, ctx, REQ_DEAL, errors)
            if d.get("deal_type") and d["deal_type"] not in VALID_DEAL_TYPE:
                errors.append(f"{ctx}: invalid deal_type={d.get('deal_type')!r}")
            if d.get("status") and d["status"] not in VALID_DEAL_STATUS:
                errors.append(f"{ctx}: invalid status={d.get('status')!r}")
            if d.get("date") and not re.match(r"^\d{4}(-\d{2}(-\d{2})?)?$", str(d["date"])):
                errors.append(f"{ctx}: invalid date {d.get('date')!r}")
            if d.get("id") in seen:
                errors.append(f"duplicate deal id {d.get('id')}")
            seen.add(d.get("id"))
            parties = d.get("parties") or []
            linked = 0
            for j, pty in enumerate(parties):
                cid = pty.get("company_id")
                if cid:
                    if company_ids and cid not in company_ids:
                        errors.append(f"{ctx}.parties[{j}]: company_id -> unknown company {cid!r}")
                    else:
                        linked += 1
                if pty.get("role") and pty["role"] not in VALID_DEAL_ROLE:
                    errors.append(f"{ctx}.parties[{j}]: invalid role={pty.get('role')!r}")
            if not linked:
                warns.append(f"{ctx}: no party links to a catalogued company")

    # ---- min-count soft gates ----
    if companies and len(companies) < 40:
        warns.append(f"min-count: only {len(companies)} companies (target >=40 for ship)")
    if milestones and len(milestones) < 15:
        warns.append(f"min-count: only {len(milestones)} milestones (target >=15)")
    if modalities and len(modalities) < 18:
        warns.append(f"min-count: only {len(modalities)} modalities (target full vocab)")

    # ---- report ----
    for w in warns:
        print(f"WARN: {w}", file=sys.stderr)
    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        print(f"\nValidation FAILED: {len(errors)} error(s), {len(warns)} warning(s)", file=sys.stderr)
        return 1
    src = "tmp/research" if using_research else "assets/data"
    print(f"Validation OK [{src}]: {len(companies)} companies, {len(sites)} sites, "
          f"{len(products)} products, {len(modalities)} modalities, {len(tas)} TAs, "
          f"{len(milestones)} milestones, {len(countries)} countries "
          f"({len(warns)} warning(s)).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
