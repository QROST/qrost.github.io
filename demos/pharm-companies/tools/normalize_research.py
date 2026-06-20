#!/usr/bin/env python3
"""Idempotent normalizer for tmp/research/*.json — canonicalizes the enum/field drift that
parallel research/enrichment agents introduce, so build.py --merge-research validates clean.

Run before each build: python3 tools/normalize_research.py && python3 tools/build.py --merge-research
"""
from __future__ import annotations
import glob, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "tmp" / "research"

VALID_CT = {"originator_bigpharma", "biotech", "generics", "cdmo_cro", "vaccine", "biosimilar", "tcm", "diversified", "lifesci_tools", "medtech"}
CT_MAP = {
    "biopharma": "biotech", "originator_biotech": "biotech", "originator_midcap": "originator_bigpharma",
    "specialty_pharma": "originator_bigpharma", "specialty": "originator_bigpharma", "innovator": "biotech",
    "cdmo": "cdmo_cro", "cro": "cdmo_cro", "cro_cdmo": "cdmo_cro", "cmo": "cdmo_cro", "api": "cdmo_cro",
    "diagnostic_services": "lifesci_tools", "diagnostics": "lifesci_tools", "diagnostic": "lifesci_tools",
    "ivd": "lifesci_tools", "genomics": "lifesci_tools", "lab_services": "lifesci_tools", "tools": "lifesci_tools",
    "device": "medtech", "medical_device": "medtech", "devices": "medtech",
    "distributor": "diversified", "distribution": "diversified", "healthcare_services": "diversified",
    "services": "diversified", "hospital": "diversified", "pharma": "diversified", "pharmaceutical": "diversified",
    "pharmaceuticals": "diversified", "pharmacy_chain": "diversified", "retail": "diversified", "animal_health": "diversified",
}
VALID_DC = {"originator", "biosimilar", "generic"}
VALID_AS = {"preclinical", "ph1", "ph2", "ph3", "filed", "approved", "withdrawn"}
VALID_MK = {"FDA", "EMA", "NMPA", "PMDA", "TGA", "MHRA", "ANVISA", "WHO", "CDSCO", "MFDS", "HealthCanada", "Swissmedic", "ANSM"}
MK_MAP = {"health canada": "HealthCanada", "healthcanada": "HealthCanada", "swissmedic": "Swissmedic"}
VALID_REGION = {"north_america", "europe", "japan", "greater_china", "oceania", "other_apac", "latam", "mea"}
CANNABIS = re.compile(r"cannabis|cronos|organigram|auxly|high tide|canopy growth|tilray|aurora cannabis", re.I)

VALID_TA = {"oncology", "immunology", "neuroscience", "cardiometabolic", "infectious-disease", "vaccines",
            "rare-disease", "ophthalmology", "respiratory", "hematology", "dermatology", "womens-health",
            "gastroenterology", "nephrology"}
TA_MAP = {
    "cardiovascular": "cardiometabolic", "cardiology": "cardiometabolic", "cardiac": "cardiometabolic",
    "cardio": "cardiometabolic", "metabolic": "cardiometabolic", "diabetes": "cardiometabolic",
    "endocrine": "cardiometabolic", "endocrinology": "cardiometabolic", "obesity": "cardiometabolic", "lipid": "cardiometabolic",
    "anti-infective": "infectious-disease", "anti-infectives": "infectious-disease", "antiviral": "infectious-disease",
    "antibiotic": "infectious-disease", "antibiotics": "infectious-disease", "antifungal": "infectious-disease",
    "antimicrobial": "infectious-disease", "hiv": "infectious-disease", "hepatitis": "infectious-disease",
    "infectious": "infectious-disease", "covid": "infectious-disease", "sepsis": "infectious-disease",
    "vaccine": "vaccines", "immunization": "vaccines",
    "gynecology": "womens-health", "obstetrics": "womens-health", "obgyn": "womens-health",
    "reproductive": "womens-health", "contraception": "womens-health", "fertility": "womens-health", "maternal": "womens-health",
    "gastrointestinal": "gastroenterology", "gastro": "gastroenterology", "digestive": "gastroenterology",
    "ibd": "gastroenterology", "liver": "gastroenterology", "hepatology": "gastroenterology",
    "urology": "nephrology", "renal": "nephrology", "kidney": "nephrology",
    "musculoskeletal": "immunology", "orthopedics": "immunology", "orthopedic": "immunology", "orthopaedic": "immunology",
    "bone": "immunology", "rheumatology": "immunology", "arthritis": "immunology", "inflammation": "immunology",
    "autoimmune": "immunology", "allergy": "immunology", "inflammatory": "immunology", "immuno": "immunology",
    "pain": "neuroscience", "pain-management": "neuroscience", "analgesia": "neuroscience", "anesthesia": "neuroscience",
    "neurology": "neuroscience", "cns": "neuroscience", "psychiatry": "neuroscience", "neuropsychiatric": "neuroscience",
    "neurological": "neuroscience", "neuro": "neuroscience", "alzheimer": "neuroscience", "epilepsy": "neuroscience",
    "dermatology": "dermatology", "skin": "dermatology", "wound-care": "dermatology", "wound": "dermatology",
    "ophthalmology": "ophthalmology", "eye": "ophthalmology", "ocular": "ophthalmology", "retina": "ophthalmology",
    "respiratory": "respiratory", "pulmonary": "respiratory", "asthma": "respiratory", "copd": "respiratory",
    "hematology": "hematology", "haematology": "hematology", "blood": "hematology", "coagulation": "hematology",
    "hemophilia": "hematology", "haemophilia": "hematology", "anemia": "hematology",
    "oncology": "oncology", "cancer": "oncology", "tumor": "oncology", "onco": "oncology", "leukemia": "oncology",
    "lymphoma": "oncology", "myeloma": "oncology", "hematology-oncology": "oncology",
    "immunology": "immunology", "rare": "rare-disease", "orphan": "rare-disease", "genetic": "rare-disease",
}
VALID_MOD = {"small-molecule", "mab", "bispecific-antibody", "adc", "fusion-protein", "peptide", "recombinant-protein",
             "mrna-vaccine", "protein-subunit-vaccine", "viral-vector-vaccine", "inactivated-vaccine", "car-t", "tcr-t",
             "aav-gene-therapy", "sirna", "antisense-oligo", "radioligand", "biosimilar", "tcm-formula", "tcm-injection", "msc-therapy"}
MOD_MAP = {
    "small molecule": "small-molecule", "smallmolecule": "small-molecule", "chemical": "small-molecule", "oral": "small-molecule",
    "monoclonal-antibody": "mab", "monoclonal antibody": "mab", "antibody": "mab", "mab": "mab",
    "bispecific": "bispecific-antibody", "fusion": "fusion-protein", "fusion-protein": "fusion-protein",
    "antibody-drug-conjugate": "adc", "protein": "recombinant-protein", "recombinant": "recombinant-protein",
    "enzyme": "recombinant-protein", "biologic": "recombinant-protein", "insulin": "recombinant-protein",
    "mrna": "mrna-vaccine", "vaccine": "protein-subunit-vaccine", "subunit": "protein-subunit-vaccine",
    "subunit-vaccine": "protein-subunit-vaccine", "inactivated": "inactivated-vaccine", "viral-vector": "viral-vector-vaccine",
    "cart": "car-t", "cell-therapy": "car-t", "cell": "car-t", "cell-gene-therapy": "aav-gene-therapy",
    "gene-therapy": "aav-gene-therapy", "aav": "aav-gene-therapy", "gene": "aav-gene-therapy",
    "rna": "sirna", "rnai": "sirna", "oligonucleotide": "antisense-oligo", "antisense": "antisense-oligo", "aso": "antisense-oligo",
    "radiopharmaceutical": "radioligand", "radioligand-therapy": "radioligand",
    "herbal": "tcm-formula", "tcm": "tcm-formula", "traditional-chinese-medicine": "tcm-formula",
}
NONDRUG_MOD = {"medical-device", "device", "ivd", "ivd-assay", "diagnostic", "diagnostics", "ai-software", "software",
               "digital-therapeutic", "instrument", "reagent", "kit", "sequencer", "monitor", "imaging", "consumable"}

CONF_WORDS = {"very high": 0.95, "high": 0.85, "medium-high": 0.8, "moderate": 0.7, "medium": 0.7, "med": 0.7,
              "medium-low": 0.6, "low": 0.55, "very low": 0.4}

COUNTRY_CCY = {"US": "USD", "CN": "CNY", "HK": "HKD", "TW": "TWD", "JP": "JPY", "KR": "KRW", "GB": "GBP",
    "DE": "EUR", "FR": "EUR", "CH": "CHF", "DK": "DKK", "SE": "SEK", "NL": "EUR", "BE": "EUR", "IT": "EUR",
    "ES": "EUR", "IE": "EUR", "FI": "EUR", "NO": "NOK", "AT": "EUR", "PT": "EUR", "GR": "EUR", "IN": "INR",
    "AU": "AUD", "SG": "SGD", "BR": "BRL", "IL": "ILS", "PL": "PLN", "TR": "TRY", "SA": "SAR", "AE": "AED",
    "EG": "EGP", "ZA": "ZAR", "CA": "CAD", "MX": "MXN", "ID": "IDR", "MY": "MYR", "TH": "THB", "JO": "JOD",
    "PK": "PKR", "RU": "RUB", "HU": "HUF", "CZ": "CZK", "RO": "RON", "NZ": "NZD"}
REGION_CCY = {"north_america": "USD", "greater_china": "CNY", "japan": "JPY", "europe": "EUR",
    "other_apac": "USD", "oceania": "AUD", "latam": "USD", "mea": "USD"}


def coerce_money(v, ccy):
    """Bare number -> money object; dict missing currency -> fill. ccy = inferred default currency."""
    if isinstance(v, (int, float)):
        return {"value": v, "currency": ccy, "year": 2024}
    if isinstance(v, dict) and v.get("value") is not None and not v.get("currency"):
        v["currency"] = ccy
    return v


# Unit-bearing currency tags (e.g. 'CNY_millions', 'JPY_M', 'HUF_bn', 'INR_crores') leak the scale
# into the currency string. The frontend's fxRate() only knows ISO codes, so an unknown tag falls
# back to USD=1 and the value renders ~1e6x too small. Normalize to ISO currency + scaled raw value.
_UNIT_FACTOR = {
    "m": 1e6, "mn": 1e6, "mln": 1e6, "million": 1e6, "millions": 1e6,
    "b": 1e9, "bn": 1e9, "billion": 1e9, "billions": 1e9,
    "cr": 1e7, "crore": 1e7, "crores": 1e7, "lakh": 1e5, "lakhs": 1e5, "lac": 1e5,
    "k": 1e3, "thousand": 1e3, "thousands": 1e3,
}
_UNIT_TAG = re.compile(r"^([A-Za-z]{3})[_ ]([A-Za-z]+)$")


def unit_money(v):
    """If currency is a unit-bearing tag, scale value and reduce currency to the ISO code.
    Returns (money, changed)."""
    if not isinstance(v, dict) or not isinstance(v.get("currency"), str):
        return v, False
    m = _UNIT_TAG.match(v["currency"].strip())
    if not m:
        return v, False
    factor = _UNIT_FACTOR.get(m.group(2).lower())
    if not factor:
        return v, False
    if isinstance(v.get("value"), (int, float)):
        v["value"] = v["value"] * factor
    v["currency"] = m.group(1).upper()
    return v, True


# Roster research frequently stored money in MILLIONS with a plain ISO tag (e.g. Viatris revenue
# 14300 USD = $14.3B); the frontend reads raw units, rendering these ~1e6x too small. For ESTABLISHED
# (non pre-revenue) company types, a plain-ISO money value in [0.1, 1e5) is unambiguously in millions:
# the raw reading would be an implausibly tiny <100k for a listed firm, while a genuinely small biotech
# stored raw sits at value >= 1e6. Bounding to non-biotech avoids rescaling tiny clinical-stage revenue.
# Per-field (not per-record) so intra-record drift is handled (rev in millions, R&D already raw).
# Lower bound 0.1 keeps it idempotent (scaled result >= 1e5 is never matched again).
SCALE_MILLIONS_TYPES = {
    "generics", "tcm", "lifesci_tools", "medtech", "distributor", "cdmo", "api", "cro",
    "originator_bigpharma", "diversified", "vaccine", "consumer_health", "retail_pharmacy",
    "otc", "animal_health",
}


def scale_millions(v, company_type):
    if company_type not in SCALE_MILLIONS_TYPES or not isinstance(v, dict):
        return False
    cur = v.get("currency")
    if not isinstance(cur, str) or not re.fullmatch(r"[A-Z]{3}", cur):
        return False
    val = v.get("value")
    if isinstance(val, (int, float)) and 0.1 <= val < 1e5:
        v["value"] = val * 1e6
        return True
    return False


def conf(x):
    if isinstance(x, (int, float)):
        v = float(x)
    elif isinstance(x, str):
        try:
            v = float(x.strip())
        except ValueError:
            v = CONF_WORDS.get(x.strip().lower(), 0.6)
    else:
        return 0.6
    return max(0.0, min(1.0, v))


def site_type(v):
    n = re.sub(r"[^a-z]", "", (v or "").lower())
    return {"manufacturing": "manufacturing", "rd": "RD", "randd": "RD", "rnd": "RD", "researchanddevelopment": "RD",
            "hq": "HQ", "headquarters": "HQ", "commercial": "commercial", "sales": "commercial", "jv": "JV"}.get(n, v)


def approval(v):
    n = (v or "").lower().replace(" ", "").replace("phase", "ph").replace("/", "")
    return {"ph3": "ph3", "phiii": "ph3", "ph2": "ph2", "phii": "ph2", "ph1": "ph1", "phi": "ph1", "ph12": "ph2",
            "ph23": "ph3", "marketed": "approved", "launched": "approved", "approved": "approved", "filed": "filed",
            "preclinical": "preclinical", "withdrawn": "withdrawn"}.get(n, v if v in VALID_AS else "approved")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def clean_sources(rec):
    """Keep only sources with an http(s) url; if none remain and confidence>0.5, lower to 0.5."""
    src = [s for s in (rec.get("sources") or []) if isinstance(s, dict) and str(s.get("url", "")).startswith(("http://", "https://"))]
    rec["sources"] = src
    if not src and conf(rec.get("confidence")) > 0.5:
        rec["confidence"] = 0.5


def map_ta(v):
    n = re.sub(r"\s+", "-", (v or "").lower().strip())
    if n in VALID_TA:
        return n
    return TA_MAP.get(n) or TA_MAP.get(n.split("-")[0])


def map_mod(v):
    n = re.sub(r"\s+", "-", (v or "").lower().strip())
    if n in NONDRUG_MOD:
        return None
    if n in VALID_MOD:
        return n
    return MOD_MAP.get(n)


def main() -> int:
    fixes = 0
    for fp in sorted(glob.glob(str(RESEARCH / "*.json"))):
        try:
            d = json.loads(Path(fp).read_text(encoding="utf-8"))
        except Exception as e:
            print(f"SKIP invalid JSON {Path(fp).name}: {e}")
            continue
        if not isinstance(d, dict):
            continue
        ch = False
        # ---- companies ----
        if d.get("companies"):
            kept = []
            for c in d["companies"]:
                if CANNABIS.search((c.get("name_en") or "") + " " + (c.get("sub_sector") or "")):
                    ch = True; fixes += 1; continue
                cid = c.get("id", "")
                if cid and re.search(r"[^a-z0-9-]", cid):
                    c["id"] = slug(cid); ch = True; fixes += 1
                ct = c.get("company_type")
                if ct and ct not in VALID_CT:
                    c["company_type"] = CT_MAP.get(ct, "diversified"); ch = True; fixes += 1
                if "confidence" in c:
                    nc = conf(c["confidence"])
                    if nc != c["confidence"]:
                        c["confidence"] = nc; ch = True
                ccy = COUNTRY_CCY.get(c.get("country"), "USD")
                ct_now = c.get("company_type")
                for fld in ("revenue", "market_cap", "rnd_spend"):
                    if c.get(fld) is not None:
                        nv = coerce_money(c[fld], ccy)
                        nv, uchanged = unit_money(nv)
                        schanged = scale_millions(nv, ct_now)
                        if uchanged or schanged or nv is not c[fld]:
                            c[fld] = nv; ch = True; fixes += 1
                if isinstance(c.get("employees"), (int, float)):
                    c["employees"] = {"value": int(c["employees"]), "year": 2024}; ch = True
                c.setdefault("last_verified", "2026-06")
                before = len(c.get("sources") or [])
                clean_sources(c)
                if len(c.get("sources") or []) != before:
                    ch = True; fixes += 1
                kept.append(c)
            d["companies"] = kept
        # ---- sites ----
        for s in d.get("sites", []):
            if s.get("site_type"):
                v = site_type(s["site_type"])
                if v != s["site_type"]:
                    s["site_type"] = v; ch = True; fixes += 1
            s.setdefault("is_subsidiary", False)
            if not s.get("name_en"):
                lbl = {"HQ": "HQ", "RD": "R&D", "manufacturing": "Manufacturing", "commercial": "Commercial", "JV": "JV"}.get(s.get("site_type"), "Site")
                s["name_en"] = (str(s.get("city") or "").strip() + " " + lbl).strip() or s.get("id")
            if not s.get("name_zh"):
                s["name_zh"] = s["name_en"]
            if "confidence" in s:
                nc = conf(s["confidence"])
                if nc != s["confidence"]:
                    s["confidence"] = nc; ch = True
            s.setdefault("last_verified", "2026-06")
            before = len(s.get("sources") or [])
            clean_sources(s)
            if len(s.get("sources") or []) != before:
                ch = True
        # ---- products (drop non-drug / unmappable; canonicalize) ----
        if d.get("products"):
            keptp = []
            for p in d["products"]:
                mod = map_mod(p.get("modality_id"))
                ta = map_ta(p.get("therapeutic_area_id"))
                if mod is None or ta is None:  # non-drug or unclassifiable -> drop
                    ch = True; fixes += 1
                    continue
                if mod != p.get("modality_id"):
                    p["modality_id"] = mod; ch = True
                if ta != p.get("therapeutic_area_id"):
                    p["therapeutic_area_id"] = ta; ch = True
                pccy = REGION_CCY.get(p.get("region"), "USD")
                for fld in ("latest_annual_sales", "annual_sales", "peak_sales"):
                    if p.get(fld) is not None:
                        nv = coerce_money(p[fld], pccy)
                        nv, uchanged = unit_money(nv)
                        if uchanged or nv is not p[fld]:
                            p[fld] = nv; ch = True; fixes += 1
                if p.get("annual_sales") and not p.get("latest_annual_sales"):
                    p["latest_annual_sales"] = p["annual_sales"]; ch = True
                if p.get("drug_class") and p["drug_class"] not in VALID_DC:
                    p["drug_class"] = "originator"; ch = True; fixes += 1
                p.setdefault("drug_class", "originator")
                if p.get("approval_status") and p["approval_status"] not in VALID_AS:
                    p["approval_status"] = approval(p["approval_status"]); ch = True; fixes += 1
                p.setdefault("approval_status", "approved")
                if p.get("key_markets"):
                    nk = [MK_MAP.get((x or "").lower(), x) for x in p["key_markets"]]
                    p["key_markets"] = [x for x in nk if x in VALID_MK]
                if not p.get("brand_name"):
                    p["brand_name"] = p.get("name_en") or p.get("name_zh") or p.get("id")
                if not p.get("name_en"):
                    p["name_en"] = p.get("brand_name"); ch = True
                if not p.get("name_zh"):
                    p["name_zh"] = p.get("name_en"); ch = True
                if not p.get("indication_en"):
                    p["indication_en"] = p.get("indication_zh") or p.get("brand_name")
                if not p.get("indication_zh"):
                    p["indication_zh"] = p.get("indication_en")
                if "is_blockbuster" not in p:
                    sales = p.get("latest_annual_sales") or p.get("annual_sales") or {}
                    p["is_blockbuster"] = bool(isinstance(sales, dict) and (sales.get("value") or 0) >= 1e9)
                if "confidence" in p:
                    p["confidence"] = conf(p["confidence"])
                p.setdefault("confidence", 0.6)
                p.setdefault("last_verified", "2026-06")
                before = len(p.get("sources") or [])
                clean_sources(p)
                if len(p.get("sources") or []) != before:
                    ch = True
                keptp.append(p)
            d["products"] = keptp
        # always rewrite (setdefault-added keys must persist; idempotent on stable content)
        Path(fp).write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"normalize_research: {fixes} fix(es) applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
