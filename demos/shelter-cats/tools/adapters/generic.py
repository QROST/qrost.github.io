"""Generic config-driven adapter for non-Socrata open-data platforms
(OpenDataSoft, CKAN datastore, ArcGIS, plain JSON). Each source supplies a
`records_url` template with {limit}/{offset} (or {page}) placeholders, a
`records_path` (dot-path to the array in the response) and optional
`field_in_record` (key each record nests its fields under). Field mapping +
cat normalization is shared with Socrata via recnorm.

Sources live in generic_sources.json (append-only). Verified live before adding.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

from .base import NormalizedShelter
from . import recnorm

SOURCE_ID = "generic"
ATTRIBUTION = {"name": "International open data (CKAN / OpenDataSoft / Socrata)", "url": ""}
_SOURCES_FILE = Path(__file__).resolve().parent / "generic_sources.json"


def _load_sources() -> dict:
    if not _SOURCES_FILE.exists():
        return {}
    with _SOURCES_FILE.open(encoding="utf-8") as f:
        return json.load(f).get("sources", {})


SOURCES = _load_sources()


def list_sources() -> list[str]:
    return [k for k, v in SOURCES.items() if v.get("enabled")]


def _cutoff(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00")


def _resolve(url: str) -> str:
    return re.sub(r"\{cutoff_(\d+)\}", lambda m: _cutoff(int(m.group(1))), url or "")


def _dig_path(obj, path: str):
    if not path:
        return obj
    cur = obj
    for part in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    return cur


def _shelter_obj(key: str, cfg: dict) -> NormalizedShelter:
    s = cfg["shelter"]
    return NormalizedShelter(
        id=key, source=SOURCE_ID, name=s.get("name", key),
        country=s.get("country", ""), region=s.get("region", "north_america"),
        city=s.get("city", ""), state=s.get("state", ""), address=s.get("address", ""),
        postcode=str(s.get("postcode", "")), lat=s.get("lat"), lng=s.get("lng"),
        website=s.get("website", ""), url=s.get("url", ""),
        email=s.get("email", ""), phone=str(s.get("phone", "")),
    )


def fetch(session, source_keys: list[str] | None = None, max_per_source: int = 1000):
    """Yield (shelter, [cats]) per enabled (or requested) generic source."""
    now_year = datetime.now(timezone.utc).year
    keys = source_keys or list_sources()
    for key in keys:
        cfg = SOURCES.get(key)
        if not cfg:
            print(f"  ! unknown generic source: {key}")
            continue
        shelter = _shelter_obj(key, cfg)
        cap = min(max_per_source, cfg.get("limit_cap", max_per_source))
        page_size = cfg.get("page_size", 100)
        rpath = cfg.get("records_path", "")
        fkey = cfg.get("field_in_record", "")
        tmpl = _resolve(cfg["records_url"])
        cats = []
        offset, page = 0, cfg.get("page_start", 1)
        try:
            while len(cats) < cap:
                lim = min(page_size, cap - len(cats))
                url = tmpl.replace("{limit}", str(lim)).replace("{offset}", str(offset)).replace("{page}", str(page))
                payload = session.get_json(url)
                rows = _dig_path(payload, rpath)
                if not isinstance(rows, list) or not rows:
                    break
                for raw in rows:
                    rec = raw.get(fkey, {}) if (fkey and isinstance(raw, dict)) else raw
                    if not isinstance(rec, dict):
                        continue
                    c = recnorm.normalize_cat(rec, SOURCE_ID, key, cfg, shelter, now_year)
                    if c:
                        cats.append(c)
                if len(rows) < lim:
                    break
                offset += len(rows)
                page += 1
        except Exception as e:
            print(f"  ! generic/{key} failed: {type(e).__name__}: {e}")
            continue
        print(f"  generic/{key}: {len(cats)} cat(s)")
        yield shelter, cats
