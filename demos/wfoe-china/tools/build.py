#!/usr/bin/env python3
"""Stamp WFOE local assets by content; --check reports drift without writes.

Compile CSS first with `npm run build:css`, or use `npm run build` for both.
Data hashes flow into steps-render.js, then CSS/JS hashes flow into index.html.
No network or wall-clock values are involved.
"""

import argparse
import hashlib
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
STEP_DATA = (
    "assets/data/wfoe-steps.json",
    "assets/data/domestic-steps.json",
    "assets/data/joint-venture-steps.json",
)
PAGE_ASSETS = (
    "assets/css/tailwind-built.css",
    "assets/css/china-business.css",
    "assets/js/steps-render.js",
    "assets/js/i18n-china-business.js",
    "assets/js/china-business.js",
)


def content_hash(content):
    return hashlib.sha256(content).hexdigest()[:12]


def stamp(text, asset, content):
    pattern = re.compile(r"([\"'])" + re.escape(asset) + r"(?:\?v=[^\"']*)?\1")
    updated, count = pattern.subn(
        lambda match: match[1] + asset + "?v=" + content_hash(content) + match[1],
        text,
    )
    if count != 1:
        raise ValueError(f"Expected exactly one reference to {asset}; found {count}")
    return updated


def build(root=ROOT, check=False):
    renderer = root / "assets/js/steps-render.js"
    original_renderer = renderer.read_text(encoding="utf-8")
    updated_renderer = original_renderer
    for asset in STEP_DATA:
        updated_renderer = stamp(updated_renderer, asset, (root / asset).read_bytes())

    page = root / "index.html"
    original_page = page.read_text(encoding="utf-8")
    updated_page = original_page
    for asset in PAGE_ASSETS:
        content = updated_renderer.encode("utf-8") if asset == "assets/js/steps-render.js" else (root / asset).read_bytes()
        updated_page = stamp(updated_page, asset, content)

    changes = [(path, new) for path, old, new in (
        (renderer, original_renderer, updated_renderer),
        (page, original_page, updated_page),
    ) if old != new]
    if check:
        for path, _ in changes:
            print(f"WFOE asset hashes stale: {path.relative_to(root)}", file=sys.stderr)
        if changes:
            print("Run npm run build in demos/wfoe-china.", file=sys.stderr)
            return 1
        print("WFOE asset hashes: OK")
    else:
        for path, new in changes:
            path.write_text(new, encoding="utf-8")
            print(f"WFOE stamped: {path.relative_to(root)}")
        if not changes:
            print("WFOE asset hashes: already current")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check hashes without changing any files")
    args = parser.parse_args()
    try:
        sys.exit(build(check=args.check))
    except (OSError, ValueError) as error:
        print(f"WFOE asset build failed: {error}", file=sys.stderr)
        sys.exit(1)
