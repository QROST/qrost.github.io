#!/usr/bin/env python3
"""Validate canonical metadata for the QROST public index and linked demos."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ORIGIN = "https://qrost.github.io/"


def one(pattern: str, html: str, label: str, path: Path) -> str:
    matches = re.findall(pattern, html, flags=re.IGNORECASE)
    if len(matches) != 1:
        raise ValueError(f"{path.relative_to(ROOT)}: expected one {label}, found {len(matches)}")
    return matches[0]


def validate_page(path: Path, expected_url: str) -> None:
    html = path.read_text(encoding="utf-8")
    canonical = one(
        r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)["\']',
        html,
        "canonical link",
        path,
    )
    og_url = one(
        r'<meta\s+property=["\']og:url["\']\s+content=["\']([^"\']+)["\']',
        html,
        "og:url",
        path,
    )
    if canonical != expected_url:
        raise ValueError(
            f"{path.relative_to(ROOT)}: canonical {canonical!r} != {expected_url!r}"
        )
    if og_url != expected_url:
        raise ValueError(f"{path.relative_to(ROOT)}: og:url {og_url!r} != {expected_url!r}")
    if "qrost.com" in html:
        raise ValueError(f"{path.relative_to(ROOT)}: phantom qrost.com reference")


def main() -> int:
    root_index = ROOT / "index.html"
    root_html = root_index.read_text(encoding="utf-8")
    demo_entries = sorted(
        set(re.findall(r'href=["\'](demos/[^"\']+/index\.html)["\']', root_html))
    )
    if len(demo_entries) != 11:
        raise ValueError(f"index.html: expected 11 linked public demos, found {len(demo_entries)}")

    validate_page(root_index, PUBLIC_ORIGIN)
    for entry in demo_entries:
        path = ROOT / entry
        if not path.is_file():
            raise ValueError(f"index.html: linked public demo is missing: {entry}")
        expected = PUBLIC_ORIGIN + entry.removesuffix("index.html")
        validate_page(path, expected)

    print(f"public metadata: OK ({len(demo_entries)} demos + root)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
