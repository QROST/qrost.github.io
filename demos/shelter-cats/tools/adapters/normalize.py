"""Map messy real-world shelter strings onto the canonical enums.

Shelter data is gloriously inconsistent ("DOMESTIC SH", "Black/Blue Tabby",
"Tortoiseshell", "S"/"N" for sex). These helpers do the lossy-but-honest mapping
into the controlled vocabulary so the frontend filters actually work.
"""
from __future__ import annotations

import re
import unicodedata


def _deaccent(s: str) -> str:
    """marrón -> marron, común -> comun — so multilingual matching works."""
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))

# ---- sex --------------------------------------------------------------------
# Shelter codes vary: M/F/S/N/U (Montgomery-style) and full words (Sonoma-style).
def norm_sex(raw: str | None) -> tuple[str, bool | None]:
    s = (raw or "").strip().lower()
    if not s:
        return "unknown", None
    s = _deaccent(s)
    if s in ("m", "male", "intact male", "macho", "male "):
        return "male", False
    if s in ("f", "female", "intact female", "hembra"):
        return "female", False
    if s in ("n", "neuter", "neutered", "neutered male", "altered male", "castrado"):
        return "male", True
    if s in ("s", "spay", "spayed", "spayed female", "altered female", "esterilizada", "castrada"):
        return "female", True
    if "castrad" in s or "esterilizad" in s:  # es: castrado(m)/esterilizada(f) — sex ambiguous, mark fixed
        return ("female" if s.endswith("a") else "male"), True
    if "neuter" in s or "macho" in s or ("male" in s and "fe" not in s):
        return "male", "neuter" in s or None
    if "spay" in s or "hembra" in s or "female" in s:
        return "female", "spay" in s or None
    return "unknown", None


# ---- coat length (often encoded in the breed string) ------------------------
def norm_coat(breed: str | None, fallback: str | None = None) -> str:
    b = _deaccent((breed or "").lower())
    if any(k in b for k in ("hairless", "sphynx", "peterbald", "sin pelo")):
        return "hairless"
    if re.search(r"\b(lh|long ?hair|longhair|long-hair)\b", b) or "long hair" in b or "pelo largo" in b:
        return "long"
    if re.search(r"\b(mh|medium ?hair|mediumhair)\b", b) or "medium hair" in b or "pelo medio" in b:
        return "medium"
    if re.search(r"\b(sh|short ?hair|shorthair|short-hair|dsh)\b", b) or "short hair" in b or "pelo corto" in b:
        return "short"
    # breed-implied coats
    if any(k in b for k in ("persian", "maine coon", "ragdoll", "himalayan", "angora", "siberian", "norwegian")):
        return "long"
    if "comun europeo" in b or "europeo" in b:  # es: Común Europeo = European domestic shorthair
        return "short"
    f = (fallback or "").lower()
    if f in ("short", "medium", "long", "hairless"):
        return f
    return "short"  # domestic cats are short-hair by default; honest, common case


# ---- pattern (mined from color + breed strings) -----------------------------
def norm_pattern(color: str | None, breed: str | None = "") -> str:
    s = _deaccent(f"{color or ''} {breed or ''}".lower())
    if "calico" in s or "tricolor" in s or "tri-color" in s:
        return "calico"
    if "tortie" in s or "tortoise" in s or "carey" in s or "concha" in s:
        return "tortie"
    if "tuxedo" in s:
        return "tuxedo"
    if any(k in s for k in ("siamese", "siames", "point", "lynx point", "flame point", "seal point")):
        return "pointed"
    if "tabby" in s or "tiger" in s or "mackerel" in s or "torbie" in s or "atigrado" in s or "rayado" in s:
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
    "black": "black", "blk": "black", "negro": "black", "noir": "black", "schwarz": "black",
    "white": "white", "wht": "white", "blanco": "white", "blanc": "white", "weiss": "white",
    "gray": "gray", "grey": "gray", "silver": "gray", "gris": "gray", "plateado": "gray",
    "blue": "blue", "azul": "blue",
    "brown": "brown", "sable": "brown", "seal": "brown", "pardo": "brown", "marron": "brown", "braun": "brown",
    "chocolate": "chocolate", "choc": "chocolate",
    "orange": "orange", "ginger": "orange", "red": "orange", "marmalade": "orange",
    "naranja": "orange", "rojo": "orange", "rubio": "orange",
    "cream": "cream", "ivory": "cream", "crema": "cream",
    "tan": "tan", "buff": "tan", "fawn": "tan", "gold": "tan", "yellow": "tan",
    "canela": "tan", "dorado": "tan", "amarillo": "tan",
    "lilac": "lilac", "lavender": "lilac",
    # patterns that show up in the color column -> map to their dominant pigment(s)
    "calico": "orange", "tortie": "orange", "tortoiseshell": "orange", "carey": "orange",
}


def _pigment_tokens(color: str | None) -> list[str]:
    s = _deaccent((color or "").lower())
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
    s = _deaccent((raw or "").strip().lower())
    if "small" in s or "kitten" in s or "peque" in s or s.startswith("s"):
        return "small"
    if "large" in s or "grande" in s or s.startswith("l") or s.startswith("g"):
        return "large"
    if "med" in s or s.startswith("m"):
        return "medium"
    return "medium"


def breed_is_mixed(breed: str | None) -> bool:
    b = _deaccent((breed or "").lower())
    return any(k in b for k in ("mix", "domestic", "/", " dsh", "dmh", "dlh", "moggie",
                                "comun", "europeo", "mestizo"))


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
    """Shelter names are often SHOUTED, prefixed with * for specials, or suffixed with
    a status like '(ACOGIDA)' / '(FOSTER)' — strip those for a clean display name."""
    s = (raw or "").strip().lstrip("*").strip()
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s).strip()
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
