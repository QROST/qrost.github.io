"""RescueGroups.org v5 adapter — the primary structured source once the API key lands.

Status: WIRED, pending a real key for live verification. RescueGroups is the
strongest free, structured adoptable-pet feed (US/CA-centric, no hard rate limits,
radius/postcode search, exposes color/pattern/coat/breed/qualities + org records).

Auth: request a free key at https://rescuegroups.org/services/adoptable-pet-data-api/
then export it:  RESCUEGROUPS_API_KEY=...  (never commit the key; never ship it to
the browser — this runs at build time only).

The v5 API is JSON:API. We use the public "available cats" search; each animal's
`relationships` reference an `orgs` (shelter) and `pictures` included in the payload.
Field mapping below is conservative; verify against a live response when the key
arrives (the Socrata adapter is the already-tested live source in the meantime).
"""
from __future__ import annotations

import os
import urllib.parse
from datetime import datetime, timezone

from .base import NormalizedCat, NormalizedShelter
from . import normalize as N
from .. import enums

SOURCE_ID = "rescuegroups"
ATTRIBUTION = {"name": "RescueGroups.org", "url": "https://rescuegroups.org/"}
API_BASE = "https://api.rescuegroups.org/v5/public"


def have_key() -> bool:
    return bool(os.environ.get("RESCUEGROUPS_API_KEY"))


def _headers() -> dict:
    return {
        "Authorization": os.environ.get("RESCUEGROUPS_API_KEY", ""),
        "Content-Type": "application/vnd.api+json",
        "Accept": "application/vnd.api+json",
    }


def _index_included(payload: dict) -> dict:
    """type:id -> attributes, for resolving JSON:API relationships (orgs, pictures)."""
    idx: dict[str, dict] = {}
    for item in payload.get("included", []) or []:
        idx[f"{item.get('type')}:{item.get('id')}"] = item
    return idx


def _shelter_from_org(org: dict | None) -> NormalizedShelter | None:
    if not org:
        return None
    a = org.get("attributes", {})
    country = (a.get("country") or "US")[:2].upper()
    return NormalizedShelter(
        id=f"rg-org-{org.get('id')}", source=SOURCE_ID,
        name=a.get("name", "RescueGroups partner"),
        country=country, region=enums.region_for_country(country),
        city=a.get("city", ""), state=a.get("state", ""),
        address=a.get("street", ""), postcode=a.get("postalcode", ""),
        lat=_f(a.get("lat")), lng=_f(a.get("lon")),
        website=a.get("url", ""), url=a.get("url", ""),
        email=a.get("email", ""), phone=a.get("phone", ""),
    )


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _cat_from_animal(animal: dict, included: dict, shelter_id: str, now_year: int) -> NormalizedCat | None:
    a = animal.get("attributes", {})
    aid = str(animal.get("id") or "").strip()
    if not aid:
        return None
    breed = a.get("breedPrimary") or a.get("breedString") or "Domestic"
    color = a.get("colorDetails") or a.get("color") or ""
    sex, fixed = N.norm_sex(a.get("sex"))
    pattern = N.norm_pattern(color, breed)
    age_text, age_bucket, birth = N.norm_age(
        a.get("ageString"), a.get("birthDate"), now_year)
    coat = N.norm_coat(breed, a.get("coatLength"))
    # pictures relationship -> first large url
    photo = ""
    rels = (animal.get("relationships") or {}).get("pictures", {}).get("data") or []
    for ref in rels:
        pic = included.get(f"pictures:{ref.get('id')}")
        if pic:
            pa = pic.get("attributes", {})
            photo = (pa.get("large") or {}).get("url") or (pa.get("original") or {}).get("url") or ""
            if photo:
                break
    good = {}
    for k, key in (("children", "isKidsOk"), ("dogs", "isDogsOk"), ("cats", "isCatsOk")):
        v = a.get(key)
        good[k] = "yes" if v is True else ("no" if v is False else "unknown")
    tags = [t for t in (a.get("qualities") or []) if isinstance(t, str)]
    return NormalizedCat(
        id=f"rg-{aid}", source=SOURCE_ID, source_id=aid, shelter_id=shelter_id,
        name=N.friendly_name(a.get("name"), aid),
        age_text=age_text, age_bucket=age_bucket, birth_estimate=birth,
        sex=sex, spayed_neutered=fixed,
        breed_primary=N.pretty_breed(str(breed)),
        breed_secondary=N.title_name(a.get("breedSecondary") or ""),
        breed_mixed=bool(a.get("isBreedMixed")) or N.breed_is_mixed(breed),
        colors=N.norm_colors(color, pattern), pattern=pattern, coat_length=coat,
        size=N.norm_size(a.get("sizeGroup")),
        attributes={
            "spayed_neutered": a.get("isAltered"),
            "house_trained": a.get("isHousetrained"),
            "special_needs": a.get("isSpecialNeeds"),
            "shots_current": a.get("isCurrentVaccinations"),
        },
        good_with=good, personality_tags=tags,
        description=(a.get("descriptionText") or "")[:1200],
        photo_url=photo, adoption_url=a.get("url", ""),
        status="adoptable",
        published_at=str(a.get("availableDate") or a.get("createdDate") or "")[:10],
    )


def fetch(session, max_total: int = 500, location: str | None = None, radius: int = 100):
    """Yield (shelter, [cats]). Groups animals by their org (shelter)."""
    if not have_key():
        print("  ! RESCUEGROUPS_API_KEY not set — skipping (Socrata is the live source meanwhile)")
        return
    now_year = datetime.now(timezone.utc).year
    by_shelter: dict[str, tuple[NormalizedShelter, list]] = {}
    page, per = 1, 100
    fetched = 0
    while fetched < max_total:
        params = {"limit": min(per, max_total - fetched), "page": page,
                  "include": "orgs,pictures", "fields[animals]": ""}
        if location:
            params["filter[locations.postalcode]"] = location
            params["filterRadius"] = radius
        url = f"{API_BASE}/animals/search/available/cats/?" + urllib.parse.urlencode(params)
        payload = session.get_json(url, headers=_headers())
        if not payload or not payload.get("data"):
            break
        included = _index_included(payload)
        for animal in payload["data"]:
            org_ref = ((animal.get("relationships") or {}).get("orgs", {}).get("data") or [{}])
            org = included.get(f"orgs:{org_ref[0].get('id')}") if org_ref else None
            shelter = _shelter_from_org(org)
            if not shelter:
                continue
            cat = _cat_from_animal(animal, included, shelter.id, now_year)
            if not cat:
                continue
            by_shelter.setdefault(shelter.id, (shelter, []))[1].append(cat)
            fetched += 1
        if len(payload["data"]) < params["limit"]:
            break
        page += 1
    for shelter, cats in by_shelter.values():
        print(f"  rescuegroups/{shelter.id}: {len(cats)} cat(s)")
        yield shelter, cats
