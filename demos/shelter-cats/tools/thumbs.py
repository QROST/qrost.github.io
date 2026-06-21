#!/usr/bin/env python3
"""Cache cat photos as small thumbnails so they survive after a cat is delisted.

Hybrid policy (per the design): keep the source photo_url for full-res while the
listing is live, AND store a downscaled ~320px thumbnail in the repo so the cached
image persists once the cat is gone. Thumbnails are tiny (~15–30 KB) to respect
GitHub Pages' ~1 GB budget. Best-effort: a 404 / non-image just leaves thumb_path
NULL and the UI falls back to the procedural pixel-cat.

Usage (from demos/shelter-cats/):  python tools/thumbs.py [--max N] [--refetch]
"""
from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools import db                       # noqa: E402
from tools.crawl import PoliteSession      # noqa: E402

try:
    from PIL import Image
except ImportError:
    print("Pillow required: pip install Pillow")
    raise SystemExit(1)

DB_PATH = ROOT / "data" / "shelters.db"
IMG_DIR = ROOT / "assets" / "img" / "cats"
CACHE_DIR = ROOT / ".httpcache"
THUMB_PX = 320
REL_PREFIX = "assets/img/cats"


def main() -> int:
    ap = argparse.ArgumentParser(description="Cache cat photos as 320px thumbnails.")
    ap.add_argument("--max", type=int, default=2000)
    ap.add_argument("--refetch", action="store_true", help="re-download even if thumb exists")
    ap.add_argument("--min-interval", type=float, default=1.0)
    args = ap.parse_args()

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    conn = db.connect(DB_PATH)
    session = PoliteSession(CACHE_DIR, min_interval=args.min_interval)

    where = "photo_url IS NOT NULL AND photo_url<>''"
    if not args.refetch:
        where += " AND (thumb_path IS NULL OR thumb_path='')"
    rows = conn.execute(f"SELECT id, photo_url FROM cats WHERE {where} LIMIT ?", (args.max,)).fetchall()
    print(f"thumbs: {len(rows)} candidate(s)")
    ok = skip = 0
    for r in rows:
        out = IMG_DIR / f"{r['id']}.jpg"
        try:
            raw = session.get_bytes(r["photo_url"])
            if not raw or len(raw) < 512:
                skip += 1
                continue
            im = Image.open(io.BytesIO(raw))
            im = im.convert("RGB")
            im.thumbnail((THUMB_PX, THUMB_PX))
            im.save(out, "JPEG", quality=82, optimize=True)
            conn.execute("UPDATE cats SET thumb_path=? WHERE id=?",
                         (f"{REL_PREFIX}/{r['id']}.jpg", r["id"]))
            conn.commit()
            ok += 1
        except Exception as e:
            skip += 1
            print(f"  skip {r['id']}: {type(e).__name__}")
    print(f"thumbs: {ok} cached, {skip} skipped (left to pixel-cat fallback)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
