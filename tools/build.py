#!/usr/bin/env python3
"""Project manifest-backed homepage summaries, then stamp asset content hashes."""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

# Keep --check read-only, including when the helper has not been imported before.
sys.dont_write_bytecode = True
from home_summaries import project


ROOT = Path(__file__).resolve().parents[1]
HOME_I18N = ROOT / "assets/js/home-i18n.js"
HOME_CSS = ROOT / "assets/css/home-built.css"


def stamp(html: str, asset: Path, url: str, content: bytes | None = None) -> tuple[str, str]:
    version = hashlib.sha1(asset.read_bytes() if content is None else content).hexdigest()[:10]
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
        help="verify generated summaries and cache tokens without writing any files",
    )
    args = parser.parse_args()

    try:
        projected = project(ROOT)
        stamped, js_version = stamp(projected["index.html"], HOME_I18N, "assets/js/home-i18n.js",
                                    projected["assets/js/home-i18n.js"].encode("utf-8"))
        stamped, css_version = stamp(stamped, HOME_CSS, "assets/css/home-built.css")
        projected["index.html"] = stamped
    except (ValueError, KeyError, OSError) as exc:
        raise SystemExit(str(exc)) from exc

    changed = [name for name, content in projected.items()
               if (ROOT / name).read_text(encoding="utf-8") != content]
    if args.check and changed:
        raise SystemExit("root build: stale summaries/cache tokens in " + ", ".join(changed) +
                         "; run python3 tools/build.py")
    if not args.check:
        for name in changed:
            (ROOT / name).write_text(projected[name], encoding="utf-8")
    print(
        "root build: OK "
        f"(home-i18n.js?v={js_version}, home-built.css?v={css_version}, "
        f"mode={'check' if args.check else 'write'})"
    )


if __name__ == "__main__":
    main()
