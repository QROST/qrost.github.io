#!/usr/bin/env python3
"""Stamp deterministic content-hash cache tokens, then validate China Auto."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
HTML = ROOT / "index.html"
TOKEN_RE = re.compile(r"(\?v=)[^\"'\s>]+")
VERSION_RE = re.compile(r"(window\.CHINA_AUTO_DATA_VERSION\s*=\s*')([^']*)(')")


def sha10(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def main() -> int:
    man_path = DATA / "manifest.json"
    files = sorted(
        p for p in DATA.rglob("*")
        if p.is_file() and p != man_path and p.suffix in {".json", ".js", ".css"}
    )
    files += sorted((ROOT / "assets" / "js").glob("*.js"))
    css = ROOT / "assets" / "css" / "china-auto.css"
    if css.exists():
        files.append(css)
    digest = hashlib.sha256()
    for p in files:
        digest.update(p.relative_to(ROOT).as_posix().encode())
        digest.update(p.read_bytes())
    token = digest.hexdigest()[:10]

    if HTML.exists():
        html = HTML.read_text(encoding="utf-8")
        stamped = VERSION_RE.sub(rf"\g<1>{token}\3", html)
        stamped = TOKEN_RE.sub(rf"\g<1>{token}", stamped)
        if stamped != html:
            HTML.write_text(stamped, encoding="utf-8")
            print(f"build: stamped ?v={token}")
        else:
            print(f"build: cache token already ?v={token}")
    else:
        print("build: index.html missing, skip stamp")

    if man_path.exists():
        man = json.loads(man_path.read_text(encoding="utf-8"))
        man["cache_token"] = token
        # Wall-clock build timestamps made identical inputs produce different
        # tracked output. ``generated_at`` is maintained by the data seed;
        # cache stamping itself is content-derived only.
        man.pop("built_at", None)
        rendered = json.dumps(man, ensure_ascii=False, indent=2) + "\n"
        if rendered != man_path.read_text(encoding="utf-8"):
            man_path.write_text(rendered, encoding="utf-8")

    rc = subprocess.call([sys.executable, str(ROOT / "tools" / "validate.py")])
    if rc != 0:
        return rc
    rc = subprocess.call([sys.executable, str(ROOT / "tools" / "test_search.py")])
    if rc != 0:
        return rc
    rc = subprocess.call([sys.executable, str(ROOT / "tools" / "test_provenance.py")])
    if rc != 0:
        return rc
    rc = subprocess.call([sys.executable, str(ROOT / "tools" / "test_page_contract.py")])
    if rc != 0:
        return rc
    print("build: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
