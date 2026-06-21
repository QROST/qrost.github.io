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

import html
import json
import re
import urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path

from .base import NormalizedCat, NormalizedShelter
from . import normalize as N

SOURCE_ID = "socrata"
ATTRIBUTION = {"name": "City/County Open Data (Socrata)", "url": "https://dev.socrata.com/"}
_SOURCES_FILE = Path(__file__).resolve().parent / "socrata_sources.json"

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


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


def _clean_text(s: str | None) -> str:
    if not s:
        return ""
    s = html.unescape(_TAG_RE.sub(" ", s))
    return _WS_RE.sub(" ", s).strip()


def _dig(row: dict, path: str):
    cur = row
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


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


def _normalize_row(row: dict, key: str, cfg: dict, shelter: NormalizedShelter, now_year: int) -> NormalizedCat | None:
    f = cfg["fields"]
    sid = str(_dig(row, f["source_id"]) or "").strip()
    if not sid:
        return None
    breed = _clean_text(str(_dig(row, f.get("breed", "")) or ""))
    color = _clean_text(str(_dig(row, f.get("color", "")) or ""))
    sex, fixed = N.norm_sex(_clean_text(_dig(row, f.get("sex", ""))))
    pattern = N.norm_pattern(color, breed)
    age_text, age_bucket, birth = N.norm_age(
        _clean_text(_dig(row, f.get("age_text", ""))), _dig(row, f.get("dob", "")), now_year)
    if cfg.get("photo_url_template"):
        photo = cfg["photo_url_template"].format(source_id=urllib.parse.quote(sid))
    elif f.get("photo"):
        photo = str(_dig(row, f["photo"]) or "")
    else:
        photo = ""
    desc = _clean_text(str(_dig(row, f.get("description", "")) or ""))[:1200] if f.get("description") else ""
    cat_id = f"{SOURCE_ID}-{key}-{sid}"
    adopt = cfg.get("adoption_url", "")
    if "{source_id}" in adopt:
        adopt = adopt.format(source_id=urllib.parse.quote(sid))
    return NormalizedCat(
        id=cat_id, source=SOURCE_ID, source_id=sid, shelter_id=key,
        name=N.friendly_name(_clean_text(_dig(row, f.get("name", ""))), sid),
        age_text=age_text, age_bucket=age_bucket, birth_estimate=birth,
        sex=sex, spayed_neutered=fixed,
        breed_primary=N.pretty_breed(breed), breed_mixed=N.breed_is_mixed(breed),
        colors=N.norm_colors(color, pattern), pattern=pattern,
        coat_length=N.norm_coat(breed), size=N.norm_size(_dig(row, f.get("size", ""))),
        attributes={"spayed_neutered": fixed} if fixed is not None else {},
        good_with={}, personality_tags=[], description=desc,
        photo_url=photo, adoption_url=adopt, status=cfg.get("status", "adoptable"),
        published_at=str(_dig(row, f.get("published", "")) or "")[:10],
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
                    c = _normalize_row(row, key, cfg, shelter, now_year)
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
