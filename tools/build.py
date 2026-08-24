#!/usr/bin/env python3
"""Stamp content-addressed cache tokens for root-page static assets."""

from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
HOME_I18N = ROOT / "assets/js/home-i18n.js"
HOME_CSS = ROOT / "assets/css/home-built.css"


def content_version(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()[:10]


def stamp(html: str, asset: Path, url: str) -> tuple[str, str]:
    version = content_version(asset)
    pattern = rf'((?:src|href)="{re.escape(url)})(?:\?v=[^"]*)?(")'
    stamped, count = re.subn(pattern, rf"\g<1>?v={version}\g<2>", html)
    if count != 1:
        raise ValueError(f"root build: expected one {url} asset tag, found {count}")
    return stamped, version


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail on stale tokens without modifying index.html",
    )
    args = parser.parse_args()

    html = INDEX.read_text(encoding="utf-8")
    try:
        stamped, js_version = stamp(html, HOME_I18N, "assets/js/home-i18n.js")
        stamped, css_version = stamp(stamped, HOME_CSS, "assets/css/home-built.css")
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    if args.check and stamped != html:
        raise SystemExit("root build: stale cache token(s); run python3 tools/build.py")
    if not args.check and stamped != html:
        INDEX.write_text(stamped, encoding="utf-8")
    print(
        "root build: OK "
        f"(home-i18n.js?v={js_version}, home-built.css?v={css_version}, "
        f"mode={'check' if args.check else 'write'})"
    )


if __name__ == "__main__":
    main()
