"""Socrata open-data adapter — the safe, ban-proof bootstrap source.

Many U.S. city/county animal shelters publish their *currently sheltered /
adoptable* animals as Socrata open datasets with a documented SODA JSON API
(`/resource/<id>.json`, paginated via $limit/$offset, filterable via $where).
This is open government data explicitly published for reuse — sanctioned,
structured, efficient. Each dataset = ONE known shelter (location embedded), so a
handful of datasets yields a real multi-shelter map.

Sources live in socrata_sources.json (add a shelter = append JSON, no code edit).
Discovered + live-verified via the Socrata Discovery API; see adapters/README.md.
"""
from __future__ import annotations

import json
import re
import urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path

from .base import NormalizedShelter
from . import recnorm

SOURCE_ID = "socrata"
ATTRIBUTION = {"name": "City/County Open Data (Socrata)", "url": "https://dev.socrata.com/"}
_SOURCES_FILE = Path(__file__).resolve().parent / "socrata_sources.json"


def _load_sources() -> dict:
    with _SOURCES_FILE.open(encoding="utf-8") as f:
        return json.load(f).get("sources", {})


SOURCES = _load_sources()


def list_sources() -> list[str]:
    return [k for k, v in SOURCES.items() if v.get("enabled")]


def _cutoff(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00")


def _resolve_where(where: str | None) -> str | None:
    if not where:
        return where
    # substitute {cutoff_N} -> ISO date N days ago
    return re.sub(r"\{cutoff_(\d+)\}", lambda m: _cutoff(int(m.group(1))), where)


def _shelter_obj(key: str, cfg: dict) -> NormalizedShelter:
    s = cfg["shelter"]
    return NormalizedShelter(
        id=key, source=SOURCE_ID, name=s.get("name", key),
        country=s.get("country", "US"), region=s.get("region", "north_america"),
        city=s.get("city", ""), state=s.get("state", ""), address=s.get("address", ""),
        postcode=str(s.get("postcode", "")), lat=s.get("lat"), lng=s.get("lng"),
        website=s.get("website", ""), url=s.get("url", ""),
        email=s.get("email", ""), phone=str(s.get("phone", "")),
    )


def fetch(session, source_keys: list[str] | None = None, max_per_source: int = 1000):
    """Yield (shelter, [cats]) per enabled (or requested) Socrata source."""
    now_year = datetime.now(timezone.utc).year
    keys = source_keys or list_sources()
    for key in keys:
        cfg = SOURCES.get(key)
        if not cfg:
            print(f"  ! unknown socrata source: {key}")
            continue
        shelter = _shelter_obj(key, cfg)
        base = f"https://{cfg['domain']}/resource/{cfg['dataset']}.json"
        cap = min(max_per_source, cfg.get("limit_cap", max_per_source))
        where_clause = _resolve_where(cfg.get("where"))
        cats: list[NormalizedCat] = []
        offset, page = 0, 1000
        try:
            while len(cats) < cap:
                params = {
                    "$limit": min(page, cap - len(cats)), "$offset": offset,
                    "$order": cfg.get("order", ":id"),
                    cfg["species_field"]: cfg["species_value"],
                }
                if where_clause:
                    params["$where"] = where_clause
                url = base + "?" + urllib.parse.urlencode(params)
                rows = session.get_json(url)
                if not rows:
                    break
                for row in rows:
                    c = recnorm.normalize_cat(row, SOURCE_ID, key, cfg, shelter, now_year)
                    if c:
                        cats.append(c)
                if len(rows) < params["$limit"]:
                    break
                offset += len(rows)
        except Exception as e:
            print(f"  ! socrata/{key} failed: {type(e).__name__}: {e}")
            continue
        print(f"  socrata/{key}: {len(cats)} cat(s)")
        yield shelter, cats
