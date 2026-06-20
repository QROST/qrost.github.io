#!/usr/bin/env python3
"""ONE-TIME migration: fix the three residual financial-unit classes that the deterministic
bulk normalizer (normalize_research.scale_millions) could not safely automate, because they
require per-company verification against primary filings (annual report / 20-F / exchange IR).

Run ONCE, then the recurring pipeline (normalize_research.py && build.py --merge-research) is
idempotent and leaves these values alone (all results land >= 1e5, and biotech is excluded
from scale_millions). A marker file guards against accidental double-application (scaling a
sub-1e5 result twice would corrupt it). Delete the marker to re-run after editing rules.

Classes (see commit message / task spec):
  1. BIOTECH millions-convention: scale revenue (0,1e4), market_cap (0,1e5), rnd_spend (0,1e5)
     by 1e6. Revenue keeps the tighter (0,1e4) bound to PROTECT genuinely-raw pre-revenue
     figures sitting in [1e4,1e5) (verified: actinium $90K grant, senhwa NT$1M, valirx £49,775).
     market_cap/rnd never sit genuinely sub-1e5 for a public/clinical firm, so the looser bound
     is safe. Verified spot-checks (madrigal $958.4M, giant-biogene ¥5,539M, insilico $85.8M,
     arrowhead $829M) confirm (0,1e4) is uniformly millions-convention.
  2. Inflation/weak-currency danger-zone [1e5,1e6): scale only the primary-filing-confirmed
     millions ones; strong-currency small-biotech raw figures (incl. xlife CHF 0.7M) left as-is.
  3. Currency mistags: domestically-listed local firms whose USD-tagged revenue renders at the
     WRONG magnitude (verified real revenue differs >15%). Overwrite to native reporting currency
     + verified absolute figure. Correct-USD-equivalent tags (render right) are left untouched.

Every change is printed for audit.
"""
from __future__ import annotations
import glob, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "tmp" / "research"
COMPANIES = ROOT / "assets" / "data" / "companies.json"
MARKER = RESEARCH / ".units_migrated"

# --- Class 1: biotech revenue genuinely-raw pre-revenue (verified) -> never scale revenue ---
REVENUE_RAW_KEEP = {"actinium-pharmaceuticals", "senhwa-biosciences", "valirx"}

# --- Class 2: primary-filing-confirmed millions in the [1e5,1e6) danger zone -> ×1e6 ---
CLASS2_SCALE = {
    "laboratorios-richmond-ar": {"revenue", "market_cap"},  # ARS ~127B rev / ~131B mc
    "corporativo-fragua": {"revenue"},                       # MXN 132,118M (Investing: "In Millions of MXN")
    "hanall-biopharma": {"revenue"},                         # KRW ~139-155B
    "granules-india": {"market_cap"},                        # INR ~194,730M (₹19,473 cr)
    "hem-pharma": {"market_cap"},                            # KRW 193.33B
}

# --- Class 3: verified value-wrong currency mistags -> native reporting currency + native figure.
#     (value, currency, year, source_url); None field => preserve existing on the record. ---
CLASS3_REVENUE = {
    "nutramax-hunan":        (209309277,    "CNY", 2024, "https://pdf.dfcfw.com/pdf/H2_AN202504181658414112_1.pdf"),
    "fuxiang-pharmaceutical":(1178000000,   "CNY", 2024, "https://visualfin.cnstock.com/h5/202412/300497.html"),
    "jinhao-medical":        (186077900,    "CNY", 2024, "https://www.cfi.net.cn/p20250516003704.html"),
    "acetar-bio":            (177692273,    "CNY", 2024, "https://xinsanban.eastmoney.com/Article/NoticeContent?id=AN202504081653291857"),
    "zenji-pharma":          (130000000,    "CNY", None, None),  # retag USD->CNY, keep value (stale FY18-19 ~¥130-137M)
    "genomics-biosci-tech":  (708000000,    "TWD", 2025, "https://news.gbimonthly.com/tw/invest/show.php?num=83001"),
    "helixmith":             (2598000000,   "KRW", 2025, "https://stockanalysis.com/quote/kosdaq/084990/financials/"),
    "huons":                 (620768000000, "KRW", 2025, "https://stockanalysis.com/quote/kosdaq/243070/financials/"),
}


def is_money(v):
    return isinstance(v, dict) and isinstance(v.get("value"), (int, float))


def main() -> int:
    if MARKER.exists():
        print(f"REFUSING: {MARKER.name} present — migration already applied. Delete it to re-run.")
        return 1

    _cj = json.loads(COMPANIES.read_text())
    _clist = _cj if isinstance(_cj, list) else _cj.get("companies", [])
    types = {c["id"]: c.get("company_type") for c in _clist}
    changes = 0

    for fp in sorted(glob.glob(str(RESEARCH / "*.json"))):
        try:
            d = json.loads(Path(fp).read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(d, dict) or not d.get("companies"):
            continue
        fname = Path(fp).name
        dirty = False
        for c in d["companies"]:
            cid = c.get("id")
            if not cid:
                continue
            ct = types.get(cid, c.get("company_type"))

            def scale(fld, lo, hi, tag):
                nonlocal dirty, changes
                m = c.get(fld)
                if is_money(m) and lo <= m["value"] < hi:
                    before = m["value"]; m["value"] = before * 1e6
                    dirty = True; changes += 1
                    print(f"[{tag:<9}] {fname:<26} {cid:<26} {fld} {before} -> {m['value']:.0f} {m.get('currency')}")

            # ---- revenue: class-3 override > class-2 scale > class-1 biotech scale ----
            if cid in CLASS3_REVENUE:
                val, cur, yr, src = CLASS3_REVENUE[cid]
                old = c.get("revenue")
                new = dict(old) if is_money(old) else {}
                new["value"] = val
                new["currency"] = cur
                new["year"] = yr if yr is not None else (old.get("year") if isinstance(old, dict) else None)
                if src is not None:
                    new["source_url"] = src
                elif isinstance(old, dict) and old.get("source_url"):
                    new["source_url"] = old["source_url"]
                if new != old:
                    c["revenue"] = new
                    dirty = True; changes += 1
                    print(f"[C3 retag ] {fname:<26} {cid:<26} revenue {old} -> {new}")
            elif cid in CLASS2_SCALE and "revenue" in CLASS2_SCALE[cid]:
                scale("revenue", 1e5, 1e6, "C2 scale")
            elif ct == "biotech" and cid not in REVENUE_RAW_KEEP:
                # (0,1e4) only — protect genuinely-raw pre-revenue figures in [1e4,1e5)
                scale("revenue", 1e-12, 1e4, "C1 rev")

            # ---- market_cap: class-2 danger-zone, else biotech (0,1e5) millions ----
            if cid in CLASS2_SCALE and "market_cap" in CLASS2_SCALE[cid]:
                scale("market_cap", 1e5, 1e6, "C2 scale")
            elif ct == "biotech":
                scale("market_cap", 1e-12, 1e5, "C1 mcap")

            # ---- rnd_spend: biotech (0,1e5) millions (never genuinely sub-1e5 for a clinical firm) ----
            if ct == "biotech":
                scale("rnd_spend", 1e-12, 1e5, "C1 rnd")

        if dirty:
            Path(fp).write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    MARKER.write_text("financial-unit migration applied; see tools/fix_financial_units.py\n", encoding="utf-8")
    print(f"\nfix_financial_units: {changes} field change(s) applied. Marker written: {MARKER.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
