#!/usr/bin/env python3
"""Build the pharma-atlas data layer.

Default run: regenerate manifest.json + content-hash cache-bust (?v=) on index.html
asset tags, then validate. Non-destructive to data files.

--merge-research: union-merge tmp/research/*.json into assets/data/ (research wins on
id collision), routing each research-file's root keys:
  products    -> assets/data/catalog/<research-file-stem>.json  (the lazy-loaded shard)
  companies   -> assets/data/companies.json
  sites       -> assets/data/sites.json
  milestones  -> assets/data/breakthroughs.json
  countries   -> assets/data/country-stats.json
modalities.json / therapeutic-areas.json / comparisons/benchmark-pairs.json are
hand-authored and never overwritten by the merge.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
CATALOG = DATA / "catalog"
RESEARCH = ROOT / "tmp" / "research"
HTML = ROOT / "index.html"


def load(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def root_list(path: Path, *keys):
    if not path.exists():
        return []
    data = load(path)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in keys:
            if isinstance(data.get(k), list):
                return data[k]
    return []


def merge_research() -> None:
    """Union existing assets/data + tmp/research (research wins); rewrite data files."""
    if not RESEARCH.exists():
        print("  no tmp/research/ — nothing to merge")
        return

    # Rebuild derived files purely from tmp/research (the source of truth) so that
    # removing/renaming a record in research propagates cleanly — no stale union artifacts.
    companies: dict[str, dict] = {}
    sites: dict[str, dict] = {}
    milestones: dict[str, dict] = {}
    countries: dict[str, dict] = {}
    catalog: dict[str, dict] = {}
    country_meta = {}

    for path in sorted(RESEARCH.glob("*.json")):
        try:
            d = load(path)
        except json.JSONDecodeError as e:
            print(f"  ! SKIP {path.name}: invalid JSON ({e})")
            continue
        if not isinstance(d, dict):
            continue
        shard = path.stem
        for c in d.get("companies", []):
            cid = c.get("id")
            if not cid:
                continue
            prev = companies.get(cid)
            # Never let a lightweight roster entry overwrite an existing deep profile.
            if prev and prev.get("tier") != "roster" and c.get("tier") == "roster":
                continue
            companies[cid] = c
        for s in d.get("sites", []):
            if s.get("id"):
                sites[s["id"]] = s
        for m in d.get("milestones", []):
            if m.get("id"):
                milestones[m["id"]] = m
        for cs in d.get("countries", []):
            if cs.get("country"):
                countries[cs["country"]] = cs
        for k in ("data_as_of", "last_verified"):
            if d.get(k):
                country_meta[k] = d[k]
        prods = d.get("products", [])
        if prods:
            catalog.setdefault(shard, {})
            for p in prods:
                if p.get("id"):
                    catalog[shard][p["id"]] = p
        print(f"  merged {path.name}: "
              f"{len(d.get('companies', []))}c {len(d.get('sites', []))}s "
              f"{len(prods)}p {len(d.get('milestones', []))}m {len(d.get('countries', []))}cty")

    write_json(DATA / "companies.json", {"companies": list(companies.values())})
    write_json(DATA / "sites.json", {"sites": list(sites.values())})
    write_json(DATA / "breakthroughs.json", {"milestones": list(milestones.values())})
    if countries:
        obj = dict(country_meta)
        obj["countries"] = list(countries.values())
        write_json(DATA / "country-stats.json", obj)
    for shard, prods in sorted(catalog.items()):
        write_json(CATALOG / f"{shard}.json", {"shard": shard, "products": list(prods.values())})
    print(f"  -> {len(companies)} companies, {len(sites)} sites, "
          f"{sum(len(v) for v in catalog.values())} products across {len(catalog)} shard(s)")


def build_manifest() -> dict:
    companies = root_list(DATA / "companies.json", "companies")
    sites = root_list(DATA / "sites.json", "sites")
    modalities = root_list(DATA / "modalities.json", "modalities")
    tas = root_list(DATA / "therapeutic-areas.json", "therapeutic_areas")
    milestones = root_list(DATA / "breakthroughs.json", "milestones")
    countries = root_list(DATA / "country-stats.json", "countries")
    modality_class = {m["id"]: m.get("class", "?") for m in modalities if m.get("id")}

    shard_counts: dict[str, int] = {}
    company_type, region, modality_class_counts, ta_counts, modality_ref = (Counter() for _ in range(5))
    total_products = 0
    shards = []
    if CATALOG.exists():
        for p in sorted(CATALOG.glob("*.json")):
            prods = root_list(p, "products")
            shard_counts[p.stem] = len(prods)
            total_products += len(prods)
            shards.append({"id": p.stem, "file": f"catalog/{p.name}", "count": len(prods)})
            for pr in prods:
                mid = pr.get("modality_id")
                if mid:
                    modality_ref[mid] += 1
                    modality_class_counts[modality_class.get(mid, "?")] += 1
                if pr.get("therapeutic_area_id"):
                    ta_counts[pr["therapeutic_area_id"]] += 1
    for c in companies:
        if c.get("company_type"):
            company_type[c["company_type"]] += 1
        if c.get("region"):
            region[c["region"]] += 1

    return {
        "build_time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data_version": "",  # filled by stamp_cache_bust()
        "total_companies": len(companies),
        "total_sites": len(sites),
        "total_products": total_products,
        "total_modalities": len(modalities),
        "total_therapeutic_areas": len(tas),
        "total_milestones": len(milestones),
        "total_countries": len(countries),
        "shard_counts": shard_counts,
        "company_type_counts": dict(company_type),
        "region_counts": dict(region),
        "modality_class_counts": dict(modality_class_counts),
        "modality_ref_counts": dict(modality_ref),
        "ta_counts": dict(ta_counts),
        "shards": shards,
    }


def content_hash() -> str:
    """SHA1 over all served code + data (manifest.json excluded — it carries the hash)."""
    h = hashlib.sha1()
    files: list[Path] = []
    for d, pat in ((ROOT / "assets" / "js", "*.js"), (ROOT / "assets" / "css", "*.css")):
        if d.exists():
            files += sorted(d.glob(pat))
    if DATA.exists():
        files += sorted(p for p in DATA.rglob("*.json") if p.name != "manifest.json")
        files += sorted(DATA.glob("*.js"))  # world-geo.js etc.
    for f in sorted(set(files)):
        h.update(f.read_bytes())
    return h.hexdigest()[:10]


def stamp_cache_bust(ver: str) -> list[str]:
    """Rewrite ?v= on index.html asset tags and the inline PHARM_DATA_VERSION global."""
    log = []
    if not HTML.exists():
        return ["! index.html not found — cache-bust skipped (run again after page exists)"]
    html = HTML.read_text(encoding="utf-8")

    def sub(label, pattern, repl):
        nonlocal html
        html, n = re.subn(pattern, repl, html)
        log.append(f"  cache-bust {label}: {n} tag(s)")

    sub("js", r'(src=")(assets/(?:js|data)/[^"?]+\.js)(?:\?v=[^"]*)?(")',
        lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}")
    sub("css", r'(href=")(assets/css/[^"?]+\.css)(?:\?v=[^"]*)?(")',
        lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}")
    html, n = re.subn(r"(window\.PHARM_DATA_VERSION\s*=\s*)(['\"])[^'\"]*\2",
                      lambda m: f"{m.group(1)}{m.group(2)}{ver}{m.group(2)}", html)
    log.append(f"  cache-bust PHARM_DATA_VERSION: {n} site(s)")
    HTML.write_text(html, encoding="utf-8")
    return log


def run_validate() -> bool:
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "validate.py")],
                       cwd=str(ROOT), capture_output=True, text=True)
    print(r.stdout, end="")
    if r.stderr:
        print(r.stderr, end="", file=sys.stderr)
    return r.returncode == 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Build pharma-atlas data layer.")
    ap.add_argument("--merge-research", action="store_true",
                    help="Union tmp/research/*.json into assets/data/ (research wins on id).")
    args = ap.parse_args()

    if args.merge_research:
        print("build.py: merging research -> assets/data")
        merge_research()
    else:
        print("build.py: manifest + cache-bust only (use --merge-research to ingest tmp/research)")

    manifest = build_manifest()
    ver = content_hash()
    manifest["data_version"] = ver
    write_json(DATA / "manifest.json", manifest)
    print(f"  manifest: {manifest['total_companies']} companies, {manifest['total_products']} products, "
          f"{manifest['total_milestones']} milestones; data_version={ver}")
    for line in stamp_cache_bust(ver):
        print(line)

    if not run_validate():
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
