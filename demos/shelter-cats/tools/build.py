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

import argparse
import hashlib
import json
import re
import sqlite3
import sys
from collections import Counter, defaultdict
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


def deterministic_build_time(values) -> str:
    """Return a stable timestamp bound to the cached snapshot, not the build clock."""
    dates = []
    for value in values:
        if not isinstance(value, str):
            continue
        match = re.match(r"^(\d{4}-\d{2}-\d{2})", value)
        if match:
            dates.append(match.group(1))
    return (max(dates) if dates else "1970-01-01") + "T00:00:00Z"


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(json_bytes(obj))


def json_bytes(obj) -> bytes:
    """Serialize public JSON exactly once for both writes and read-only checks."""
    return (json.dumps(obj, ensure_ascii=False, indent=1) + "\n").encode("utf-8")


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


def build(write_outputs: bool = True, collect_projection: bool = False):
    if write_outputs:
        conn = db.connect(DB_PATH)
        db.init_schema(conn)
    else:
        # `--check` must be genuinely read-only: bypass db.connect(), whose
        # WAL pragma can touch sidecar files, and open SQLite in mode=ro.
        wal_path = Path(str(DB_PATH) + "-wal")
        if wal_path.exists() and wal_path.stat().st_size:
            raise RuntimeError(
                f"uncheckpointed SQLite WAL present ({wal_path.name}); "
                "close the writer/checkpoint the DB before checking public outputs"
            )
        # `immutable=1` prevents SQLite from creating -wal/-shm sidecars while
        # checking a committed snapshot. The non-empty WAL guard above prevents
        # immutable mode from silently ignoring committed sidecar state.
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro&immutable=1", uri=True)
        conn.row_factory = sqlite3.Row
    shelters = [dict(r) for r in conn.execute("SELECT * FROM shelters ORDER BY id")]
    region_by_shelter = {s["id"]: (s.get("region") or "north_america") for s in shelters}

    cats = [cat_to_obj(r) for r in conn.execute("SELECT * FROM cats ORDER BY first_seen DESC, id")]

    # ---- shard cats by region ----
    by_region: dict[str, list] = defaultdict(list)
    for c in cats:
        by_region[region_by_shelter.get(c.get("shelter_id"), "north_america")].append(c)

    if write_outputs and CATS_DIR.exists():
        for old in CATS_DIR.glob("*.json"):
            old.unlink()
    shards = []
    projection: dict[str, bytes] = {}
    for region, items in sorted(by_region.items()):
        fname = f"{region}.json"
        rel = f"cats/{fname}"
        projection[rel] = json_bytes({"region": region, "cats": items})
        if write_outputs:
            (DATA / rel).parent.mkdir(parents=True, exist_ok=True)
            (DATA / rel).write_bytes(projection[rel])
        shards.append({"region": region, "file": rel, "count": len(items)})

    # ---- shelters.json ----
    live_regions = sorted({region_by_shelter[s["id"]] for s in shelters})
    projection["shelters.json"] = json_bytes({"shelters": shelters})
    if write_outputs:
        (DATA / "shelters.json").write_bytes(projection["shelters.json"])

    # ---- enums.json (+ which regions are live) ----
    en = enums.all_enums()
    en["regions_live"] = live_regions
    projection["enums.json"] = json_bytes(en)
    if write_outputs:
        (DATA / "enums.json").write_bytes(projection["enums.json"])

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
        "build_time": deterministic_build_time(
            [c.get("first_seen", "") for c in cats] + [s.get("last_fetch", "") for s in source_meta]
        ),
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
    conn.close()
    if collect_projection:
        return manifest, projection
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


def check_outputs(manifest: dict, projection: dict[str, bytes], ver: str) -> list[str]:
    """Return stale-output errors without modifying HTML, JSON, or SQLite."""
    errors: list[str] = []
    expected_shards = {DATA / rel for rel in projection if rel.startswith("cats/")}
    actual_shards = set(CATS_DIR.glob("*.json")) if CATS_DIR.exists() else set()
    for extra in sorted(actual_shards - expected_shards):
        errors.append(f"unexpected stale cat shard: {extra.relative_to(DATA)}")
    for rel, expected in sorted(projection.items()):
        path = DATA / rel
        try:
            actual = path.read_bytes()
        except OSError as exc:
            errors.append(f"{rel} is unreadable: {exc}")
            continue
        if actual != expected:
            errors.append(f"{rel} differs from the SQLite public projection")

    try:
        current_manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"manifest.json is unreadable: {exc}"]
    expected_manifest = dict(manifest)
    expected_manifest["data_version"] = ver
    if current_manifest != expected_manifest:
        errors.append("manifest.json differs from the deterministic build result")

    try:
        html = HTML.read_text(encoding="utf-8")
    except OSError as exc:
        errors.append(f"index.html is unreadable: {exc}")
        return errors
    refs = re.findall(
        r'(?:src|href)="(assets/(?:js|data|css)/[^"?]+\.(?:js|css))(?:\?v=([^"&]+))?"',
        html,
    )
    if not refs:
        errors.append("index.html has no versioned local JS/CSS references")
    for ref, token in refs:
        if token != ver:
            errors.append(f"stale cache token for {ref}: {token or '<missing>'} (expected {ver})")
    inline = re.search(r"window\.SHELTERCATS_DATA_VERSION\s*=\s*['\"]([^'\"]+)['\"]", html)
    if not inline or inline.group(1) != ver:
        errors.append("window.SHELTERCATS_DATA_VERSION is missing or stale")
    return errors


def main() -> int:
    ap = argparse.ArgumentParser(description="Build shelter-cats static data.")
    ap.add_argument("--check", action="store_true",
                    help="Read-only check that manifest and cache tokens match current inputs.")
    args = ap.parse_args()

    if args.check:
        try:
            manifest, projection = build(write_outputs=False, collect_projection=True)
        except (OSError, RuntimeError, sqlite3.Error) as exc:
            print(f"  ! read-only SQLite projection failed: {exc}", file=sys.stderr)
            return 1
        ver = content_hash()
        errors = check_outputs(manifest, projection, ver)
        if errors:
            for error in errors:
                print(f"  ! {error}", file=sys.stderr)
            return 1
        print(f"build.py --check: SQLite projection + manifest + cache tokens current ({ver}); no files written")
        return 0

    print("build.py: SQLite -> static data layer")
    manifest = build(write_outputs=True)
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
