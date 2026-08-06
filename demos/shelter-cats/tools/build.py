#!/usr/bin/env python3
"""Build the static data layer from the SQLite SSOT.

Emits (all under assets/data/):
  cats/<region>.json   region shards (lazy-loaded via manifest)
  shelters.json        all shelters (geocoded)
  enums.json           controlled vocabularies + zh/en labels + palette hexes
  manifest.json        build meta + shard index + the content-hash data_version

Then stamps content-hash ?v= onto index.html asset tags + SHELTERCATS_DATA_VERSION
(the cache-busting recurring-gotcha fix — never hand-edit those stamps).

Usage (from demos/shelter-cats/):  python tools/build.py
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools import db, enums                     # noqa: E402

DB_PATH = ROOT / "data" / "shelters.db"
DATA = ROOT / "assets" / "data"
CATS_DIR = DATA / "cats"
HTML = ROOT / "index.html"

JSON_COLS = ("colors", "attributes", "good_with", "personality_tags")
# cat fields written to the static shards (compact: falsy optionals dropped below)
OUT_FIELDS = [
    "id", "source", "source_id", "shelter_id", "name", "age_text", "age_bucket",
    "birth_estimate", "sex", "spayed_neutered", "breed_primary", "breed_secondary",
    "breed_mixed", "colors", "pattern", "coat_length", "size", "attributes",
    "good_with", "personality_tags", "description", "photo_url", "thumb_path",
    "adoption_url", "status", "published_at", "first_seen", "avatar_sprite",
]
KEEP_IF_FALSY = {"colors", "pattern", "coat_length", "name", "status", "sex"}


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def cat_to_obj(row) -> dict:
    d = dict(row)
    for c in JSON_COLS:
        try:
            d[c] = json.loads(d.get(c) or ("[]" if c in ("colors", "personality_tags") else "{}"))
        except Exception:
            d[c] = [] if c in ("colors", "personality_tags") else {}
    for k in ("breed_mixed",):
        d[k] = bool(d.get(k))
    if d.get("spayed_neutered") is not None:
        d["spayed_neutered"] = bool(d["spayed_neutered"])
    out = {}
    for k in OUT_FIELDS:
        v = d.get(k)
        if v in (None, "", [], {}) and k not in KEEP_IF_FALSY:
            continue
        out[k] = v
    return out


def build() -> dict:
    conn = db.connect(DB_PATH)
    db.init_schema(conn)
    shelters = [dict(r) for r in conn.execute("SELECT * FROM shelters ORDER BY id")]
    region_by_shelter = {s["id"]: (s.get("region") or "north_america") for s in shelters}

    cats = [cat_to_obj(r) for r in conn.execute("SELECT * FROM cats ORDER BY first_seen DESC, id")]

    # ---- shard cats by region ----
    by_region: dict[str, list] = defaultdict(list)
    for c in cats:
        by_region[region_by_shelter.get(c.get("shelter_id"), "north_america")].append(c)

    if CATS_DIR.exists():
        for old in CATS_DIR.glob("*.json"):
            old.unlink()
    shards = []
    for region, items in sorted(by_region.items()):
        fname = f"{region}.json"
        write_json(CATS_DIR / fname, {"region": region, "cats": items})
        shards.append({"region": region, "file": f"cats/{fname}", "count": len(items)})

    # ---- shelters.json ----
    live_regions = sorted({region_by_shelter[s["id"]] for s in shelters})
    write_json(DATA / "shelters.json", {"shelters": shelters})

    # ---- enums.json (+ which regions are live) ----
    en = enums.all_enums()
    en["regions_live"] = live_regions
    write_json(DATA / "enums.json", en)

    # ---- counts ----
    def counts(key):
        c = Counter()
        for cat in cats:
            v = cat.get(key)
            if isinstance(v, list):
                for x in v:
                    c[x] += 1
            elif v:
                c[v] += 1
        return dict(c)

    region_counts = {r: len(v) for r, v in by_region.items()}
    source_meta = []
    for s in sorted({sh["source"] for sh in shelters}):
        source_meta.append({
            "id": s,
            "attribution": db.get_meta(conn, f"attribution_{s}", s),
            "last_fetch": db.get_meta(conn, f"last_fetch_{s}", ""),
        })

    manifest = {
        "build_time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data_version": "",  # filled by stamp_cache_bust
        "generator": "tools/build.py",
        "total_cats": len(cats),
        "total_shelters": len(shelters),
        "total_adoptable": sum(1 for c in cats if c.get("status") == "adoptable"),
        "with_photo": sum(1 for c in cats if c.get("photo_url")),
        "with_thumb": sum(1 for c in cats if c.get("thumb_path")),
        "region_counts": region_counts,
        "regions_live": live_regions,
        "status_counts": counts("status"),
        "coat_counts": counts("coat_length"),
        "pattern_counts": counts("pattern"),
        "color_counts": counts("colors"),
        "age_counts": counts("age_bucket"),
        "sex_counts": counts("sex"),
        "shards": shards,
        "shelters_file": "shelters.json",
        "enums_file": "enums.json",
        "sources": source_meta,
    }
    return manifest


def content_hash() -> str:
    """SHA1 over served code + data (manifest.json excluded; images excluded — they're
    content-addressed by cat id, so new photos don't churn every asset's ?v=)."""
    h = hashlib.sha1()
    files: list[Path] = []
    for d, pat in ((ROOT / "assets" / "js", "*.js"), (ROOT / "assets" / "css", "*.css")):
        if d.exists():
            files += sorted(d.glob(pat))
    if DATA.exists():
        files += sorted(p for p in DATA.rglob("*.json") if p.name != "manifest.json")
        files += sorted(DATA.glob("*.js"))  # world-geo.js
    for f in sorted(set(files)):
        h.update(f.read_bytes())
    return h.hexdigest()[:10]


def stamp_cache_bust(ver: str) -> list[str]:
    log = []
    if not HTML.exists():
        return ["  ! index.html not found — cache-bust skipped (run again after page exists)"]
    html = HTML.read_text(encoding="utf-8")

    def sub(label, pattern, repl):
        nonlocal html
        html, n = re.subn(pattern, repl, html)
        log.append(f"  cache-bust {label}: {n} tag(s)")

    sub("js", r'(src=")(assets/(?:js|data)/[^"?]+\.js)(?:\?v=[^"]*)?(")',
        lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}")
    sub("css", r'(href=")(assets/css/[^"?]+\.css)(?:\?v=[^"]*)?(")',
        lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}")
    html, n = re.subn(r"(window\.SHELTERCATS_DATA_VERSION\s*=\s*)(['\"])[^'\"]*\2",
                      lambda m: f"{m.group(1)}{m.group(2)}{ver}{m.group(2)}", html)
    log.append(f"  cache-bust SHELTERCATS_DATA_VERSION: {n} site(s)")
    HTML.write_text(html, encoding="utf-8")
    return log


def main() -> int:
    print("build.py: SQLite -> static data layer")
    manifest = build()
    ver = content_hash()
    manifest["data_version"] = ver
    write_json(DATA / "manifest.json", manifest)
    print(f"  {manifest['total_cats']} cats / {manifest['total_shelters']} shelters / "
          f"{len(manifest['shards'])} region shard(s); data_version={ver}")
    print(f"  regions live: {', '.join(manifest['regions_live'])}")
    for line in stamp_cache_bust(ver):
        print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
