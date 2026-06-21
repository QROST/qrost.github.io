"""Shared record -> NormalizedCat mapping, used by every config-driven adapter
(socrata + generic CKAN/OpenDataSoft/ArcGIS). One code path so all sources
normalize identically (colors/pattern/coat/age/sex/friendly-name/html-clean)."""
from __future__ import annotations

import html
import re
import urllib.parse

from .base import NormalizedCat
from . import normalize as N

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def clean_text(s) -> str:
    if not s:
        return ""
    s = html.unescape(_TAG_RE.sub(" ", str(s)))
    return _WS_RE.sub(" ", s).strip()


def _fix_url(u: str) -> str:
    """Normalize messy image URLs: protocol-relative '//host/..' -> https, encode spaces."""
    u = (u or "").strip()
    if not u:
        return ""
    if u.startswith("//"):
        u = "https:" + u
    return u.replace(" ", "%20")


def dig(row, path: str):
    """Read a (possibly dotted) path out of a nested dict."""
    cur = row
    for part in str(path).split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def normalize_cat(rec: dict, source_tag: str, key: str, cfg: dict, shelter, now_year: int) -> NormalizedCat | None:
    """rec is one already-de-nested record dict. cfg.fields maps our keys -> columns."""
    f = cfg["fields"]
    sid = str(dig(rec, f["source_id"]) or "").strip()
    if not sid:
        return None
    breed = clean_text(dig(rec, f.get("breed", "")))
    color = clean_text(dig(rec, f.get("color", "")))
    sex, fixed = N.norm_sex(clean_text(dig(rec, f.get("sex", ""))))
    pattern = N.norm_pattern(color, breed)
    age_text, age_bucket, birth = N.norm_age(
        clean_text(dig(rec, f.get("age_text", ""))), dig(rec, f.get("dob", "")), now_year)
    if cfg.get("photo_url_template"):
        photo = cfg["photo_url_template"].format(source_id=urllib.parse.quote(sid))
    elif f.get("photo"):
        photo = _fix_url(str(dig(rec, f["photo"]) or ""))
    else:
        photo = ""
    desc = clean_text(dig(rec, f.get("description", "")))[:1200] if f.get("description") else ""
    adopt = cfg.get("adoption_url", "")
    if "{source_id}" in adopt:
        adopt = adopt.format(source_id=urllib.parse.quote(sid))
    return NormalizedCat(
        id=f"{source_tag}-{key}-{sid}", source=source_tag, source_id=sid, shelter_id=key,
        name=N.friendly_name(clean_text(dig(rec, f.get("name", ""))), sid),
        age_text=age_text, age_bucket=age_bucket, birth_estimate=birth,
        sex=sex, spayed_neutered=fixed,
        breed_primary=N.pretty_breed(breed), breed_mixed=N.breed_is_mixed(breed),
        colors=N.norm_colors(color, pattern), pattern=pattern,
        coat_length=N.norm_coat(breed), size=N.norm_size(dig(rec, f.get("size", ""))),
        attributes={"spayed_neutered": fixed} if fixed is not None else {},
        good_with={}, personality_tags=[], description=desc,
        photo_url=photo, adoption_url=adopt, status=cfg.get("status", "adoptable"),
        published_at=str(dig(rec, f.get("published", "")) or "")[:10],
    )
