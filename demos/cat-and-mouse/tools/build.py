#!/usr/bin/env python3
"""Validate Cat & Mouse and stamp all local assets with one content hash."""

from __future__ import annotations

import hashlib
import re
import shutil
import struct
import subprocess
import sys
from pathlib import Path


DEMO = Path(__file__).resolve().parents[1]
REPO = DEMO.parents[1]
INDEX = DEMO / "index.html"
OG_IMAGE = DEMO / "assets/img/cat-and-mouse-og.png"
ASSETS = (
    DEMO / "assets/css/cat-and-mouse.css",
    DEMO / "assets/js/i18n.js",
    DEMO / "assets/js/gait.js",
    DEMO / "assets/js/appearance.js",
    DEMO / "assets/js/app.js",
)


def tree_version() -> str:
    digest = hashlib.sha256()
    for path in ASSETS:
        digest.update(path.relative_to(DEMO).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()[:10]


def stamp_assets(version: str) -> str:
    html = INDEX.read_text(encoding="utf-8")
    pattern = r'((?:src|href)="assets/(?:css|js)/[^"?]+)(?:\?v=[^"]*)?(")'
    stamped, count = re.subn(pattern, rf"\g<1>?v={version}\g<2>", html)
    if count != len(ASSETS):
        raise SystemExit(f"cat-and-mouse build: expected {len(ASSETS)} local asset tags, found {count}")
    if stamped != html:
        INDEX.write_text(stamped, encoding="utf-8")
    return stamped


def png_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise SystemExit(f"cat-and-mouse build: {path.name} is not a valid PNG")
    return struct.unpack(">II", data[16:24])


def validate_html(html: str, version: str) -> None:
    required = (
        '<meta property="og:type"',
        '<meta property="og:url"',
        '<meta property="og:site_name"',
        '<meta property="og:image"',
        '<meta name="twitter:card"',
        'id="language-toggle"',
        'id="theme-toggle"',
        'id="pause-toggle"',
        'id="appearance-toggle"',
        'id="appearance-fur-length"',
        'data-i18n-aria-label="canvasAria"',
        'href="../../favicon.svg"',
    )
    missing = [token for token in required if token not in html]
    if missing:
        raise SystemExit(f"cat-and-mouse build: index.html missing {missing}")
    tokens = re.findall(r'(?:src|href)="assets/(?:css|js)/[^"?]+\?v=([^"]+)"', html)
    if len(tokens) != len(ASSETS) or any(token != version for token in tokens):
        raise SystemExit("cat-and-mouse build: local cache tokens are incomplete or inconsistent")
    if re.search(r'<script[^>]+src="https?://', html):
        raise SystemExit("cat-and-mouse build: external runtime scripts are not allowed")


def run_js_gates() -> None:
    node = shutil.which("node")
    if not node:
        raise SystemExit("cat-and-mouse build: node is required for JavaScript verification")
    for gate in ("check-gait.mjs", "check-runtime.mjs"):
        subprocess.run([node, str(DEMO / "tools" / gate)], check=True)


def main() -> None:
    for path in (*ASSETS, INDEX, OG_IMAGE):
        if not path.is_file():
            raise SystemExit(f"cat-and-mouse build: missing {path.relative_to(DEMO)}")
    width, height = png_dimensions(OG_IMAGE)
    if (width, height) != (1200, 630):
        raise SystemExit(f"cat-and-mouse build: OG image must be 1200x630, got {width}x{height}")

    version = tree_version()
    stamped = stamp_assets(version)
    validate_html(stamped, version)
    run_js_gates()
    subprocess.run([sys.executable, str(REPO / "tools/build.py")], check=True)
    print(f"cat-and-mouse build: assets?v={version}; OG 1200x630; validation OK")


if __name__ == "__main__":
    main()
