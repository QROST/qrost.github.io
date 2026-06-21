"""Socrata open-data adapter — the safe, ban-proof bootstrap source.

Many U.S. city/county animal shelters publish their *currently sheltered /
adoptable* animals as Socrata open datasets with a documented SODA JSON API
(`/resource/<id>.json`, paginated via $limit/$offset, filterable via $where).
This is open government data explicitly published for reuse — so fetching it is
sanctioned, structured, and efficient. Each Socrata dataset corresponds to ONE
known shelter, whose physical location we embed below (stable public facts), so a
handful of datasets yields a real multi-shelter map.

Add a shelter = add a SOURCES entry. No scraping, no ban risk.
"""
from __future__ import annotations

import urllib.parse
from datetime import datetime, timezone, timedelta

from .base import NormalizedCat, NormalizedShelter
from . import normalize as N
from .. import enums

SOURCE_ID = "socrata"
ATTRIBUTION = {"name": "City/County Open Data (Socrata)", "url": "https://dev.socrata.com/"}


def _recent_cutoff(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00")


# Each source: a shelter + its dataset + how to read the rows.
SOURCES: dict[str, dict] = {
    # -------- Montgomery County, MD — "Adoptable Pets" (clean, every-2h, photos) --------
    "montgomery_md": {
        "enabled": True,
        "domain": "data.montgomerycountymd.gov",
        "dataset": "e54u-qx42",
        "species_field": "animaltype",
        "species_value": "CAT",
        "where": None,                       # whole feed is already "adoptable"
        "order": "animalid",
        "status": "adoptable",
        "fields": {
            "source_id": "animalid", "name": "petname", "age_text": "petage",
            "breed": "breed", "color": "color", "sex": "sex", "size": "petsize",
            "published": "indate",
        },
        # the dataset's url.url is stale (www/http/lowercase 404s); the canonical
        # apex-https form below actually serves the JPEG.
        "photo_url_template": "https://petharbor.com/get_image.asp?RES=Detail&ID={source_id}&LOCATION=MONT",
        "adoption_url": "https://petharbor.com/pet.asp?uaid=MONT.{source_id}",
        "shelter": NormalizedShelter(
            id="montgomery_md", source="socrata",
            name="Montgomery County Animal Services & Adoption Center",
            country="US", region="north_america", city="Derwood", state="MD",
            address="7315 Muncaster Mill Rd, Derwood, MD 20855", postcode="20855",
            lat=39.1289, lng=-77.1525,
            website="https://www.montgomerycountymd.gov/animalservices/",
            url="https://www.montgomerycountymd.gov/animalservices/adoption/",
        ),
    },
    # -------- Sonoma County, CA — current animals (rich: real date_of_birth) --------
    "sonoma_ca": {
        "enabled": True,
        "domain": "data.sonomacounty.ca.gov",
        "dataset": "w3nx-jfcx",
        "species_field": "type",
        "species_value": "CAT",
        # cumulative dataset -> restrict to recent intakes so we show genuinely-current cats
        "where": lambda: f"intake_date > '{_recent_cutoff(60)}'",
        "order": "intake_date DESC",
        "limit_cap": 60,
        "status": "in_shelter",
        "fields": {
            "source_id": "id", "name": "name", "breed": "breed", "color": "color",
            "sex": "sex", "size": "size", "dob": "date_of_birth", "published": "intake_date",
        },
        "adoption_url": "https://sonomacounty.ca.gov/health-and-human-services/health-services/divisions/public-health/animal-services/adopt",
        "shelter": NormalizedShelter(
            id="sonoma_ca", source="socrata",
            name="Sonoma County Animal Services",
            country="US", region="north_america", city="Santa Rosa", state="CA",
            address="1247 Century Ct, Santa Rosa, CA 95403", postcode="95403",
            lat=38.4663, lng=-122.7269,
            website="https://sonomacounty.ca.gov/animals",
            url="https://sonomacounty.ca.gov/animals",
        ),
    },
    # -------- Bloomington, IN — historical dump; off by default (needs heavy current-filtering) --------
    "bloomington_in": {
        "enabled": False,
        "domain": "data.bloomington.in.gov",
        "dataset": "e245-r9ub",
        "species_field": "speciesname",
        "species_value": "Cat",
        "where": lambda: "movementdate IS NULL AND deceaseddate IS NULL",
        "order": "intakedate DESC",
        "limit_cap": 60,
        "status": "in_shelter",
        "fields": {
            "source_id": "id", "name": "animalname", "age_text": "animalage",
            "breed": "breedname", "color": "basecolour", "sex": "sexname",
            "published": "intakedate",
        },
        "adoption_url": "https://bloomington.in.gov/animal-shelter/animals",
        "shelter": NormalizedShelter(
            id="bloomington_in", source="socrata",
            name="Bloomington Animal Care & Control",
            country="US", region="north_america", city="Bloomington", state="IN",
            address="3410 S Walnut St, Bloomington, IN 47401", postcode="47401",
            lat=39.1268, lng=-86.5320,
            website="https://bloomington.in.gov/animal-shelter",
            url="https://bloomington.in.gov/animal-shelter/animals",
        ),
    },
}


def _dig(row: dict, path: str):
    cur = row
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def list_sources() -> list[str]:
    return [k for k, v in SOURCES.items() if v.get("enabled")]


def _normalize_row(row: dict, cfg: dict, now_year: int) -> NormalizedCat | None:
    f = cfg["fields"]
    sid = str(_dig(row, f["source_id"]) or "").strip()
    if not sid:
        return None
    breed = str(_dig(row, f.get("breed", "")) or "")
    color = str(_dig(row, f.get("color", "")) or "")
    sex, fixed = N.norm_sex(_dig(row, f.get("sex", "")))
    pattern = N.norm_pattern(color, breed)
    age_text, age_bucket, birth = N.norm_age(
        _dig(row, f.get("age_text", "")), _dig(row, f.get("dob", "")), now_year)
    if cfg.get("photo_url_template"):
        photo = cfg["photo_url_template"].format(source_id=urllib.parse.quote(sid))
    elif f.get("photo"):
        photo = str(_dig(row, f["photo"]) or "")
    else:
        photo = ""
    src = cfg["shelter"].source
    cat_id = f"{src}-{cfg['shelter'].id}-{sid}"
    return NormalizedCat(
        id=cat_id, source=src, source_id=sid, shelter_id=cfg["shelter"].id,
        name=N.title_name(_dig(row, f.get("name", "")) or "Unnamed"),
        age_text=age_text, age_bucket=age_bucket, birth_estimate=birth,
        sex=sex, spayed_neutered=fixed,
        breed_primary=N.pretty_breed(breed),
        breed_mixed=N.breed_is_mixed(breed),
        colors=N.norm_colors(color, pattern), pattern=pattern,
        coat_length=N.norm_coat(breed), size=N.norm_size(_dig(row, f.get("size", ""))),
        attributes={"spayed_neutered": fixed} if fixed is not None else {},
        good_with={}, personality_tags=[],
        photo_url=photo,
        adoption_url=cfg["adoption_url"].format(source_id=urllib.parse.quote(sid)),
        status=cfg["status"],
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
        base = f"https://{cfg['domain']}/resource/{cfg['dataset']}.json"
        cap = min(max_per_source, cfg.get("limit_cap", max_per_source))
        where = cfg.get("where")
        where_clause = where() if callable(where) else where
        cats: list[NormalizedCat] = []
        offset, page = 0, 1000
        while len(cats) < cap:
            params = {
                "$limit": min(page, cap - len(cats)), "$offset": offset,
                "$order": cfg.get("order", ":id"),
                cfg["species_field"]: cfg["species_value"],
            }
            if where_clause:
                params["$where"] = where_clause
            url = base + "?" + urllib.parse.urlencode(params)
            rows = session.get_json(url)   # throttled + cached + honest UA
            if not rows:
                break
            for row in rows:
                c = _normalize_row(row, cfg, now_year)
                if c:
                    cats.append(c)
            if len(rows) < params["$limit"]:
                break
            offset += len(rows)
        print(f"  socrata/{key}: {len(cats)} cat(s)")
        yield cfg["shelter"], cats
