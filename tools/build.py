#!/usr/bin/env python3
"""Stamp content-addressed cache tokens for root-page static assets."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
HOME_I18N = ROOT / "assets/js/home-i18n.js"


def content_version(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()[:10]


def main() -> None:
    version = content_version(HOME_I18N)
    html = INDEX.read_text(encoding="utf-8")
    pattern = r'((?:src)="assets/js/home-i18n\.js)(?:\?v=[^"]*)?(")'
    stamped, count = re.subn(pattern, rf"\g<1>?v={version}\g<2>", html)
    if count != 1:
        raise SystemExit(f"root build: expected one home-i18n.js asset tag, found {count}")
    if stamped != html:
        INDEX.write_text(stamped, encoding="utf-8")
    if f'assets/js/home-i18n.js?v={version}' not in stamped:
        raise SystemExit("root build: cache token verification failed")
    print(f"root build: home-i18n.js?v={version}")


if __name__ == "__main__":
    main()
