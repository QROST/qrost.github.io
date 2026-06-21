"""Map messy real-world shelter strings onto the canonical enums.

Shelter data is gloriously inconsistent ("DOMESTIC SH", "Black/Blue Tabby",
"Tortoiseshell", "S"/"N" for sex). These helpers do the lossy-but-honest mapping
into the controlled vocabulary so the frontend filters actually work.
"""
from __future__ import annotations

import re

# ---- sex --------------------------------------------------------------------
# Shelter codes vary: M/F/S/N/U (Montgomery-style) and full words (Sonoma-style).
def norm_sex(raw: str | None) -> tuple[str, bool | None]:
    s = (raw or "").strip().lower()
    if not s:
        return "unknown", None
    if s in ("m", "male", "intact male"):
        return "male", False
    if s in ("f", "female", "intact female"):
        return "female", False
    if s in ("n", "neuter", "neutered", "neutered male", "altered male"):
        return "male", True
    if s in ("s", "spay", "spayed", "spayed female", "altered female"):
        return "female", True
    if "neuter" in s or ("male" in s and "fe" not in s):
        return "male", "neuter" in s or None
    if "spay" in s or "female" in s:
        return "female", "spay" in s or None
    return "unknown", None


# ---- coat length (often encoded in the breed string) ------------------------
def norm_coat(breed: str | None, fallback: str | None = None) -> str:
    b = (breed or "").lower()
    if any(k in b for k in ("hairless", "sphynx", "peterbald")):
        return "hairless"
    if re.search(r"\b(lh|long ?hair|longhair|long-hair)\b", b) or "long hair" in b:
        return "long"
    if re.search(r"\b(mh|medium ?hair|mediumhair)\b", b) or "medium hair" in b:
        return "medium"
    if re.search(r"\b(sh|short ?hair|shorthair|short-hair|dsh)\b", b) or "short hair" in b:
        return "short"
    # breed-implied long-hairs
    if any(k in b for k in ("persian", "maine coon", "ragdoll", "himalayan", "angora", "siberian", "norwegian")):
        return "long"
    f = (fallback or "").lower()
    if f in ("short", "medium", "long", "hairless"):
        return f
    return "short"  # domestic cats are short-hair by default; honest, common case


# ---- pattern (mined from color + breed strings) -----------------------------
def norm_pattern(color: str | None, breed: str | None = "") -> str:
    s = f"{color or ''} {breed or ''}".lower()
    if "calico" in s:
        return "calico"
    if "tortie" in s or "tortoise" in s:
        return "tortie"
    if "tuxedo" in s:
        return "tuxedo"
    if any(k in s for k in ("siamese", "point", "lynx point", "flame point", "seal point")):
        return "pointed"
    if "tabby" in s or "tiger" in s or "mackerel" in s or "torbie" in s:
        return "tabby"
    if "smoke" in s or "shaded" in s or "chinchilla" in s:
        return "smoke"
    if "tuxedo" in s:
        return "tuxedo"
    # two pigment words separated by / or & or "and" -> bicolor
    pigs = _pigment_tokens(color)
    if "white" in pigs and len(pigs) >= 2:
        return "tuxedo" if "black" in pigs else "bicolor"
    if len(pigs) >= 2:
        return "bicolor"
    return "solid"


# ---- colors (palette tokens) ------------------------------------------------
_COLOR_SYNONYMS = {
    "black": "black", "blk": "black",
    "white": "white", "wht": "white",
    "gray": "gray", "grey": "gray", "silver": "gray",
    "blue": "blue",
    "brown": "brown", "sable": "brown", "seal": "brown",
    "chocolate": "chocolate", "choc": "chocolate",
    "orange": "orange", "ginger": "orange", "red": "orange", "marmalade": "orange",
    "cream": "cream", "ivory": "cream",
    "tan": "tan", "buff": "tan", "fawn": "tan", "gold": "tan", "yellow": "tan",
    "lilac": "lilac", "lavender": "lilac",
    # patterns that show up in the color column -> map to their dominant pigment(s)
    "calico": "orange", "tortie": "orange", "tortoiseshell": "orange",
}


def _pigment_tokens(color: str | None) -> list[str]:
    s = (color or "").lower()
    out: list[str] = []
    for word, tok in _COLOR_SYNONYMS.items():
        if re.search(rf"\b{re.escape(word)}\b", s) and tok not in out:
            out.append(tok)
    return out


def norm_colors(color: str | None, pattern: str = "") -> list[str]:
    out = _pigment_tokens(color)
    if not out:
        # calico/tortie imply a multi-pigment coat even if the raw word was the pattern
        if pattern in ("calico", "tortie"):
            out = ["orange", "black", "white"] if pattern == "calico" else ["orange", "black"]
        else:
            out = ["gray"]   # honest neutral default
    return out[:3]


# ---- age --------------------------------------------------------------------
def norm_age(age_text: str | None, dob_iso: str | None = None, now_year: int | None = None) -> tuple[str, str, str]:
    """Return (age_text, age_bucket, birth_estimate). Prefers DOB when available."""
    years = None
    birth = ""
    if dob_iso:
        m = re.match(r"(\d{4})-(\d{2})", dob_iso)
        if m:
            birth = f"{m.group(1)}-{m.group(2)}"
            if now_year:
                years = max(0.0, now_year - int(m.group(1)))
    txt = (age_text or "").strip()
    if years is None and txt:
        y = re.search(r"(\d+)\s*year", txt, re.I)
        mo = re.search(r"(\d+)\s*month", txt, re.I)
        wk = re.search(r"(\d+)\s*week", txt, re.I)
        years = 0.0
        if y:
            years += int(y.group(1))
        if mo:
            years += int(mo.group(1)) / 12.0
        if wk:
            years += int(wk.group(1)) / 52.0
        if not (y or mo or wk):
            years = None
    bucket = ""
    if years is not None:
        if years < 1:
            bucket = "kitten"
        elif years < 3:
            bucket = "young"
        elif years < 8:
            bucket = "adult"
        else:
            bucket = "senior"
    if not txt and years is not None:
        txt = f"{years:.1f}y".rstrip("0").rstrip(".") + "y" if years < 1 else f"{int(years)}y"
    return txt, bucket, birth


def norm_size(raw: str | None) -> str:
    s = (raw or "").strip().lower()
    if s.startswith("s") or "small" in s or "kitten" in s:
        return "small"
    if s.startswith("l") or "large" in s:
        return "large"
    if s.startswith("m") or "med" in s:
        return "medium"
    return "medium"


def breed_is_mixed(breed: str | None) -> bool:
    b = (breed or "").lower()
    return any(k in b for k in ("mix", "domestic", "/", " dsh", "dmh", "dlh", "moggie"))


def pretty_breed(raw: str | None) -> str:
    """Expand shelter shorthand: 'DOMESTIC SH' -> 'Domestic Shorthair'."""
    b = (raw or "").split("/")[0].strip()
    if not b:
        return "Domestic"
    low = b.lower()
    repl = [
        (r"\bsh\b", "Shorthair"), (r"\bmh\b", "Mediumhair"), (r"\blh\b", "Longhair"),
        (r"\bdsh\b", "Domestic Shorthair"), (r"\bdmh\b", "Domestic Mediumhair"),
        (r"\bdlh\b", "Domestic Longhair"),
        (r"short ?hair", "Shorthair"), (r"medium ?hair", "Mediumhair"), (r"long ?hair", "Longhair"),
        (r"\bamer\b", "American"), (r"\bdom\b", "Domestic"),
    ]
    for pat, sub in repl:
        low = re.sub(pat, sub, low.lower())
    return low.title()


def title_name(raw: str | None) -> str:
    """Shelter names are often SHOUTED and prefixed with * for specials."""
    s = (raw or "").strip().lstrip("*").strip()
    if s.isupper() or s.islower():
        s = s.title()
    return s


# whimsical, unisex nicknames for cats the shelter logged without a name (common
# for strays). Seeded by the cat's stable id so it never changes between runs.
_NICKNAMES = [
    "Whiskers", "Mittens", "Shadow", "Pumpkin", "Clover", "Biscuit", "Mochi", "Pepper",
    "Luna", "Oreo", "Ziggy", "Maple", "Tofu", "Pixel", "Nimbus", "Sprout", "Sesame",
    "Marble", "Pickle", "Waffles", "Dusty", "Gizmo", "Noodle", "Bean", "Cricket",
    "Hazel", "Olive", "Pesto", "Suki", "Yuki", "Bao", "Momo", "Coco", "Taro", "Miso",
    "Juniper", "Fern", "Comet", "Smokey", "Dumpling", "Peanut", "Bagel", "Ravioli",
    "Cinnamon", "Pudding", "Mango", "Saffron", "Biscotti", "Pebble", "Wasabi",
]


def friendly_name(raw: str | None, seed: str) -> str:
    """Real name when present; otherwise a stable seeded nickname (strays often
    arrive unnamed, and a wall of 'Unnamed' reads dead). Truth is kept in the
    source id / adoption link."""
    s = title_name(raw)
    low = s.lower()
    if not s or low in ("unnamed", "unknown", "no name", "stray", "kitten", "cat") or s.isdigit() or len(s) < 2:
        h = 2166136261
        for ch in (seed or "x"):
            h = (h ^ ord(ch)) * 16777619 & 0xFFFFFFFF
        return _NICKNAMES[h % len(_NICKNAMES)]
    return s
