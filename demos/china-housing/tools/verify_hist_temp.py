#!/usr/bin/env python3
"""Automated data-quality checks for historical temperature extrema."""
from __future__ import annotations

import json
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "housing.db"
ENRICHED = ROOT / "assets" / "data" / "enriched.js"

LEVEL_DIST = "区镇/街道"
LEVEL_COUNTY = "区县"
LEVEL_CITY = "市"
TEMP_MIN, TEMP_MAX = -50.0, 50.0


def load_enriched_ids() -> set[int]:
    if not ENRICHED.exists():
        return set()
    text = ENRICHED.read_text(encoding="utf-8")
    m = re.search(r"window\.HOUSING_ENRICHED\s*=\s*(\{.*\});?\s*$", text, re.S)
    if not m:
        return set()
    data = json.loads(m.group(1))
    return {int(k) for k in data}


def main() -> int:
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    rows = con.execute("""
        SELECT id, prov, city, dist, lat, lng,
               hist_temp_max, hist_temp_min, hist_temp_level, hist_temp_src, hist_temp_note
        FROM listings ORDER BY id
    """).fetchall()
    total = len(rows)
    errors: list[str] = []
    warnings: list[str] = []

    missing = [r for r in rows if r["hist_temp_max"] is None or r["hist_temp_min"] is None]
    if missing:
        errors.append(f"{len(missing)}/{total} listings missing hist_temp_max/min")

    level_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}
    proxy_rows = 0
    city_fallback = 0
    for r in rows:
        if r["hist_temp_max"] is None:
            continue
        lvl = r["hist_temp_level"] or "unknown"
        src = r["hist_temp_src"] or "unknown"
        level_counts[lvl] = level_counts.get(lvl, 0) + 1
        source_counts[src] = source_counts.get(src, 0) + 1
        if src == "climate-monthly-2014-2023":
            proxy_rows += 1
        if lvl == LEVEL_CITY:
            city_fallback += 1
        tmax, tmin = r["hist_temp_max"], r["hist_temp_min"]
        if not (TEMP_MIN <= tmax <= TEMP_MAX):
            errors.append(f"id={r['id']}: hist_temp_max={tmax} out of range")
        if not (TEMP_MIN <= tmin <= TEMP_MAX):
            errors.append(f"id={r['id']}: hist_temp_min={tmin} out of range")
        if tmin > tmax:
            errors.append(f"id={r['id']}: min ({tmin}) > max ({tmax})")

    # Cross-check: same (prov,city,dist) cluster should share values
    clusters: dict[str, list] = {}
    for r in rows:
        if r["hist_temp_max"] is None:
            continue
        ck = f"{r['prov']}|{r['city']}|{r['dist']}"
        clusters.setdefault(ck, []).append(r)
    for ck, members in clusters.items():
        vals = {(m["hist_temp_max"], m["hist_temp_min"]) for m in members}
        if len(vals) > 1:
            spreads = [abs(a - b) for (a, _), (b, __) in zip(sorted(vals), sorted(vals)[1:], strict=False)]
            if max(spreads, default=0) > 0.2:
                errors.append(f"cluster {ck}: inconsistent temps {vals}")

    covered = total - len(missing)
    pct_dist = 100 * (level_counts.get(LEVEL_DIST, 0) + level_counts.get(LEVEL_COUNTY, 0)) / max(covered, 1)
    pct_city = 100 * city_fallback / max(covered, 1)

    if pct_city > 15:
        warnings.append(f"city-level fallback {pct_city:.1f}% exceeds 15% threshold")

    if proxy_rows:
        errors.append(f"{proxy_rows}/{total} listings still on climate-monthly-2014-2023 proxy")

    # enriched.js bake check
    baked = load_enriched_ids()
    if baked:
        sample = con.execute("""
            SELECT id, hist_temp_max FROM listings WHERE hist_temp_max IS NOT NULL LIMIT 5
        """).fetchall()
        text = ENRICHED.read_text(encoding="utf-8")
        for s in sample:
            if f'"histTempMax":{s["hist_temp_max"]}' not in text and f'"histTempMax": {s["hist_temp_max"]}' not in text:
                errors.append(f"enriched.js missing histTempMax for id={s['id']}")
                break

    report = {
        "total": total,
        "covered": covered,
        "missing": len(missing),
        "coverage_pct": round(100 * covered / max(total, 1), 1),
        "by_level": level_counts,
        "pct_dist_or_county": round(pct_dist, 1),
        "pct_city_fallback": round(pct_city, 1),
        "by_source": source_counts,
        "proxy_rows": proxy_rows,
        "wiki_rows": sum(1 for r in rows if r["hist_temp_src"] and r["hist_temp_src"].startswith("wikipedia")),
        "era5_rows": sum(1 for r in rows if r["hist_temp_src"] and "era5" in (r["hist_temp_src"] or "")),
        "errors": errors,
        "warnings": warnings,
        "ok": len(errors) == 0,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
