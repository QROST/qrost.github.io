#!/usr/bin/env python3
"""Validate canonical metadata for the QROST public index and linked demos."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ORIGIN = "https://qrost.github.io/"
ARCHIVE_ENTRIES = {"demos/pebble-beach-2026/index.html"}


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
    linked_entries = set(
        re.findall(r'href=["\'](demos/[^"\']+/index\.html)["\']', root_html)
    )
    all_entries = {
        str(path.relative_to(ROOT))
        for path in (ROOT / "demos").glob("*/index.html")
    }
    current_entries = all_entries - ARCHIVE_ENTRIES
    if len(current_entries) != 12:
        raise ValueError(f"repository: expected 12 current public demos, found {len(current_entries)}")
    if linked_entries != current_entries:
        missing = sorted(current_entries - linked_entries)
        unexpected = sorted(linked_entries - current_entries)
        raise ValueError(
            "index.html: current demo links drifted; "
            f"missing={missing or 'none'}, unexpected={unexpected or 'none'}"
        )
    if not ARCHIVE_ENTRIES.issubset(all_entries):
        raise ValueError("repository: expected Pebble Beach 2026 archive is missing")
    if ARCHIVE_ENTRIES & linked_entries:
        raise ValueError("index.html: historical archives must not be duplicated as current demo cards")
    if "demos/pebble-beach-2027/index.html" not in linked_entries:
        raise ValueError("index.html: current Pebble Beach 2027 planning page is missing")

    validate_page(root_index, PUBLIC_ORIGIN)
    for entry in sorted(all_entries):
        path = ROOT / entry
        if not path.is_file():
            raise ValueError(f"public demo is missing: {entry}")
        expected = PUBLIC_ORIGIN + entry.removesuffix("index.html")
        validate_page(path, expected)

    print(
        "public metadata: OK "
        f"({len(current_entries)} current demos + {len(ARCHIVE_ENTRIES)} archive + root)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
