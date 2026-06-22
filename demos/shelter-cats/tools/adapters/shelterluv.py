"""ShelterLuv adapter — sanctioned per-organization API (NOT scraping).

ShelterLuv powers many CA/US shelters & rescues (Pasadena Humane, spcaLA, ...).
Its robots.txt permits access, but the clean route is the official API, which each
organization enables for itself: ShelterLuv account → Settings → API → generate an
API key, then share that key with us. The key alone identifies the org.

  API:  GET https://www.shelterluv.com/api/v1/animals?status_type=publishable&offset=0&limit=100
  Auth: header  X-Api-Key: <org key>
  Resp: { success, animals:[...], total_count, has_more }

Keys are read from env (the org's `key_env` name) or a gitignored
shelterluv_keys.json — NEVER committed, NEVER shipped to the browser (build-time only).
Orgs without a key are skipped, so this is safe to ship "ready" (like rescuegroups).

Status: WIRED to the documented API shape; verify field names against a live response
when the first org key arrives (the adapter degrades gracefully on missing fields).
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from .base import NormalizedCat, NormalizedShelter
from . import normalize as N
from . import recnorm

SOURCE_ID = "shelterluv"
ATTRIBUTION = {"name": "ShelterLuv partner shelters", "url": "https://www.shelterluv.com/"}
API = "https://www.shelterluv.com/api/v1/animals"
_ORGS_FILE = Path(__file__).resolve().parent / "shelterluv_orgs.json"
_KEYS_FILE = Path(__file__).resolve().parent / "shelterluv_keys.json"


def _load_orgs() -> dict:
    if not _ORGS_FILE.exists():
        return {}
    with _ORGS_FILE.open(encoding="utf-8") as f:
        return json.load(f).get("orgs", {})


def _load_keys() -> dict:
    if not _KEYS_FILE.exists():
        return {}
    try:
        with _KEYS_FILE.open(encoding="utf-8") as f:
            return {k: v for k, v in json.load(f).items() if not k.startswith("_")}
    except Exception:
        return {}


ORGS = _load_orgs()
_KEYS = _load_keys()


def key_for(org_id: str, cfg: dict) -> str | None:
    env = cfg.get("key_env")
    return (os.environ.get(env) if env else None) or _KEYS.get(org_id)


def keyed_orgs() -> list[str]:
    return [oid for oid, cfg in ORGS.items() if key_for(oid, cfg)]


def list_sources() -> list[str]:
    return [oid for oid, cfg in ORGS.items() if cfg.get("enabled")]


def _age_from(a: dict, now_year: int):
    months = a.get("Age")
    age_text = ""
    dob_iso = None
    dob = a.get("DOBUnixTime") or a.get("DOBUnixtime")
    if dob:
        try:
            dt = datetime.fromtimestamp(int(dob), tz=timezone.utc)
            dob_iso = dt.strftime("%Y-%m-15")
        except Exception:
            dob_iso = None
    if isinstance(months, (int, float)) and months > 0:
        y, m = divmod(int(months), 12)
        age_text = (f"{y}y" if y else "") + (f" {m}m" if m else "")
    return N.norm_age(age_text.strip(), dob_iso, now_year)


def _cat_from_animal(a: dict, org_id: str, cfg: dict, now_year: int) -> NormalizedCat | None:
    sid = str(a.get("Internal-ID") or a.get("ID") or "").strip()
    if not sid:
        return None
    breed = recnorm.clean_text(a.get("Breed"))
    color = recnorm.clean_text(a.get("Color") or a.get("Colors"))
    sex, fixed = N.norm_sex(a.get("Sex"))
    pattern = N.norm_pattern(color, breed)
    age_text, age_bucket, birth = _age_from(a, now_year)
    photos = a.get("Photos") if isinstance(a.get("Photos"), list) else []
    photo = recnorm._fix_url(a.get("CoverPhoto") or (photos[0] if photos else ""))
    slug = cfg.get("slug")
    adopt = (f"https://www.shelterluv.com/matchme/adopt/{slug}/Cat/{sid}"
             if slug else cfg.get("adoption_url", ""))
    return NormalizedCat(
        id=f"{SOURCE_ID}-{org_id}-{sid}", source=SOURCE_ID, source_id=sid, shelter_id=org_id,
        name=N.friendly_name(recnorm.clean_text(a.get("Name")), sid),
        age_text=age_text, age_bucket=age_bucket, birth_estimate=birth,
        sex=sex, spayed_neutered=fixed,
        breed_primary=N.pretty_breed(breed), breed_mixed=N.breed_is_mixed(breed),
        colors=N.norm_colors(color, pattern), pattern=pattern,
        coat_length=N.norm_coat(breed), size=N.norm_size(a.get("Size")),
        attributes={"spayed_neutered": fixed} if fixed is not None else {},
        good_with={}, personality_tags=[],
        description=recnorm.clean_text(a.get("Description"))[:1200],
        photo_url=photo, adoption_url=adopt, status="adoptable",
        published_at="",
    )


def _shelter_obj(org_id: str, cfg: dict) -> NormalizedShelter:
    return NormalizedShelter(
        id=org_id, source=SOURCE_ID, name=cfg.get("name", org_id),
        country=cfg.get("country", "US"), region=cfg.get("region", "north_america"),
        city=cfg.get("city", ""), state=cfg.get("state", ""), address=cfg.get("address", ""),
        postcode=str(cfg.get("postcode", "")), lat=cfg.get("lat"), lng=cfg.get("lng"),
        website=cfg.get("website", ""), url=cfg.get("adoption_url", ""),
    )


def fetch(session, source_keys: list[str] | None = None, max_per_source: int = 1000):
    """Yield (shelter, [cats]) per ShelterLuv org that has a configured API key."""
    if not keyed_orgs():
        print("  ! no ShelterLuv org keys set — skipping "
              "(add to shelterluv_keys.json or set the org's key_env). "
              f"configured orgs: {', '.join(ORGS.keys()) or '(none)'}")
        return
    now_year = datetime.now(timezone.utc).year
    ids = source_keys or keyed_orgs()
    for org_id in ids:
        cfg = ORGS.get(org_id)
        if not cfg:
            print(f"  ! unknown shelterluv org: {org_id}")
            continue
        key = key_for(org_id, cfg)
        if not key:
            print(f"  shelterluv/{org_id}: no key — skipped")
            continue
        shelter = _shelter_obj(org_id, cfg)
        cats: list[NormalizedCat] = []
        offset, limit = 0, 100
        try:
            while len(cats) < max_per_source:
                url = f"{API}?status_type=publishable&offset={offset}&limit={limit}"
                payload = session.get_json(url, headers={"X-Api-Key": key},
                                           cache_key=f"{url}|{org_id}")
                animals = (payload or {}).get("animals") or []
                if not animals:
                    break
                for a in animals:
                    if str(a.get("Type", "")).lower() != "cat":
                        continue
                    c = _cat_from_animal(a, org_id, cfg, now_year)
                    if c:
                        cats.append(c)
                if not (payload or {}).get("has_more") or len(animals) < limit:
                    break
                offset += len(animals)
        except Exception as e:
            print(f"  ! shelterluv/{org_id} failed: {type(e).__name__}: {e}")
            continue
        print(f"  shelterluv/{org_id}: {len(cats)} cat(s)")
        yield shelter, cats
