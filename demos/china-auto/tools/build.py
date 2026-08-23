#!/usr/bin/env python3
"""Stamp content-hash cache-bust tokens on china-auto index.html, then validate."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
HTML = ROOT / "index.html"
TOKEN_RE = re.compile(r"(\?v=)[^\"'\s>]+")
VERSION_RE = re.compile(r"(window\.CHINA_AUTO_DATA_VERSION\s*=\s*')([^']*)(')")


def sha10(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def main() -> int:
    files = sorted(p for p in DATA.rglob("*") if p.is_file() and p.suffix in {".json", ".js", ".css"})
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
        html = VERSION_RE.sub(rf"\g<1>{token}\3", html)
        html = TOKEN_RE.sub(rf"\g<1>{token}", html)
        HTML.write_text(html, encoding="utf-8")
        print(f"build: stamped ?v={token}")
    else:
        print("build: index.html missing, skip stamp")

    man_path = DATA / "manifest.json"
    if man_path.exists():
        man = json.loads(man_path.read_text(encoding="utf-8"))
        man["cache_token"] = token
        man["built_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        man_path.write_text(json.dumps(man, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    rc = subprocess.call([sys.executable, str(ROOT / "tools" / "validate.py")])
    if rc != 0:
        return rc
    rc = subprocess.call([sys.executable, str(ROOT / "tools" / "test_search.py")])
    if rc != 0:
        return rc
    print("build: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
