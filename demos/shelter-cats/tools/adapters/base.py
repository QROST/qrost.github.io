"""Adapter contract + normalized record types.

Every source (Socrata open-data feed, RescueGroups API, future HTML crawler) maps
its raw rows into these dataclasses, so manage.py / the DB layer stay completely
source-agnostic. A cat record carries every field the demo collects; missing data
is simply left None / empty.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict


@dataclass
class NormalizedShelter:
    id: str                       # globally unique, source-prefixed
    source: str
    name: str
    country: str = "US"           # ISO-2
    region: str = "north_america" # one of enums.REGIONS
    city: str = ""
    state: str = ""               # state / province
    address: str = ""
    postcode: str = ""
    lat: float | None = None
    lng: float | None = None
    website: str = ""
    url: str = ""                 # adoption listing page
    email: str = ""
    phone: str = ""

    def to_row(self) -> dict:
        return asdict(self)


@dataclass
class NormalizedCat:
    id: str                       # globally unique, source-prefixed (stable across runs)
    source: str
    source_id: str
    shelter_id: str
    name: str = ""
    age_text: str = ""            # raw, e.g. "2 years"
    age_bucket: str = ""          # kitten / young / adult / senior
    birth_estimate: str = ""      # YYYY-MM if derivable, else ""
    sex: str = "unknown"          # male / female / unknown
    spayed_neutered: bool | None = None
    breed_primary: str = ""
    breed_secondary: str = ""
    breed_mixed: bool = False
    colors: list = field(default_factory=list)   # tokens from enums.COLORS
    pattern: str = ""             # token from enums.PATTERNS
    coat_length: str = ""         # token from enums.COAT
    size: str = ""                # small / medium / large
    attributes: dict = field(default_factory=dict)   # house_trained, special_needs, shots_current...
    good_with: dict = field(default_factory=dict)    # children/dogs/cats -> yes/no/unknown
    personality_tags: list = field(default_factory=list)
    description: str = ""
    photo_url: str = ""           # original full-res (live; may die on delist)
    adoption_url: str = ""
    status: str = "adoptable"     # adoptable / in_shelter / adopted / removed
    published_at: str = ""        # source publish/intake date (ISO)
    # avatar_sprite / avatar_animations are reserved for the phase-2 AIGC pipeline.
    avatar_sprite: str = ""

    def to_row(self) -> dict:
        r = asdict(self)
        # JSON-encode the structured columns for SQLite storage
        for k in ("colors", "attributes", "good_with", "personality_tags"):
            r[k] = json.dumps(r[k], ensure_ascii=False)
        return r
