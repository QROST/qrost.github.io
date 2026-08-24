#!/usr/bin/env python3
"""Stamp deterministic content-hash cache tokens, then validate China Auto."""
from __future__ import annotations

import argparse
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify generated tokens without writing")
    args = parser.parse_args()

    man_path = DATA / "manifest.json"
    files = sorted(
        p for p in DATA.rglob("*")
        if p.is_file() and p != man_path and p.suffix in {".json", ".js", ".css"}
    )
    files += sorted((ROOT / "assets" / "js").glob("*.js"))
    files += sorted((ROOT / "assets" / "css").glob("*.css"))
    digest = hashlib.sha256()
    for p in files:
        digest.update(p.relative_to(ROOT).as_posix().encode())
        digest.update(p.read_bytes())
    token = digest.hexdigest()[:10]

    errors: list[str] = []
    if HTML.exists():
        html = HTML.read_text(encoding="utf-8")
        stamped = VERSION_RE.sub(rf"\g<1>{token}\3", html)
        stamped = TOKEN_RE.sub(rf"\g<1>{token}", stamped)
        if stamped != html:
            if args.check:
                errors.append(f"index.html cache token is stale (expected ?v={token})")
            else:
                HTML.write_text(stamped, encoding="utf-8")
                print(f"build: stamped ?v={token}")
        else:
            print(f"build: cache token already ?v={token}")
    else:
        errors.append("index.html is missing")

    if man_path.exists():
        original = man_path.read_text(encoding="utf-8")
        man = json.loads(original)
        if args.check:
            if man.get("cache_token") != token:
                errors.append(f"manifest cache_token is stale (expected {token})")
            if "built_at" in man:
                errors.append("manifest contains nondeterministic built_at")
        else:
            man["cache_token"] = token
            # Wall-clock build timestamps made identical inputs produce different
            # tracked output. ``generated_at`` is maintained by the data seed;
            # cache stamping itself is content-derived only.
            man.pop("built_at", None)
            rendered = json.dumps(man, ensure_ascii=False, indent=2) + "\n"
            if rendered != original:
                man_path.write_text(rendered, encoding="utf-8")
    else:
        errors.append("assets/data/manifest.json is missing")

    if errors:
        for error in errors:
            print(f"build: {error}", file=sys.stderr)
        return 1

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
    rc = subprocess.call(["node", str(ROOT / "tools" / "test_cluster_graph.js")])
    if rc != 0:
        return rc
    print(f"build: {'check ' if args.check else ''}OK ({token})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
