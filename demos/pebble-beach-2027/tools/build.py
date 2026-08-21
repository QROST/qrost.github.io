#!/usr/bin/env python3
"""Refresh local content hashes and validate the partial Pebble Beach 2027 guide."""

from __future__ import annotations

import argparse
import hashlib
import re
import struct
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


DEMO_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = DEMO_DIR.parents[1]
DEMO_HTML = DEMO_DIR / "index.html"
HOME_HTML = REPO_ROOT / "index.html"
README = REPO_ROOT / "README.md"
ARCHIVE_HTML = REPO_ROOT / "demos/pebble-beach-2026/index.html"
DEMO_ASSETS = (
    "assets/css/pebble-beach-2027.css",
    "assets/js/data.js",
    "assets/js/app.js",
)
EXPECTED_CANONICAL = "https://qrost.github.io/demos/pebble-beach-2027/"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[dict[str, str]] = []
        self.scripts: list[dict[str, str]] = []
        self.styles: list[dict[str, str]] = []
        self.metas: list[dict[str, str]] = []
        self.ids: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if values.get("id"):
            self.ids.append(values["id"])
        if tag == "a":
            self.links.append(values)
        elif tag == "script":
            self.scripts.append(values)
        elif tag == "link":
            self.styles.append(values)
        elif tag == "meta":
            self.metas.append(values)


def short_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def tokenized(asset: str) -> str:
    return f"{asset}?v={short_hash(DEMO_DIR / asset)}"


def replace_token(document: str, asset: str) -> tuple[str, int]:
    pattern = rf'((?:src|href)="{re.escape(asset)})(?:\?v=[^"]*)?(\")'
    return re.subn(pattern, rf"\g<1>?v={short_hash(DEMO_DIR / asset)}\g<2>", document)


def sync_hashes() -> list[str]:
    html = DEMO_HTML.read_text(encoding="utf-8")
    stamped = html
    for asset in DEMO_ASSETS:
        stamped, count = replace_token(stamped, asset)
        if count != 1:
            raise RuntimeError(f"expected one cache token for {asset}, found {count}")
    if stamped == html:
        return []
    DEMO_HTML.write_text(stamped, encoding="utf-8")
    return [str(DEMO_HTML.relative_to(REPO_ROOT))]


def png_dimensions(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    return struct.unpack(">II", header[16:24])


def one(pattern: str, document: str, label: str, errors: list[str]) -> str:
    matches = re.findall(pattern, document, flags=re.IGNORECASE)
    if len(matches) != 1:
        errors.append(f"expected one {label}, found {len(matches)}")
        return ""
    return matches[0]


def validate() -> list[str]:
    errors: list[str] = []
    required = [
        DEMO_HTML,
        *(DEMO_DIR / asset for asset in DEMO_ASSETS),
        DEMO_DIR / "assets/img/pebble-beach-2027-og.svg",
        DEMO_DIR / "assets/img/pebble-beach-2027-og.png",
        HOME_HTML,
        README,
        ARCHIVE_HTML,
    ]
    for path in required:
        if not path.is_file():
            errors.append(f"missing required file: {path.relative_to(REPO_ROOT)}")
    if errors:
        return errors

    html = DEMO_HTML.read_text(encoding="utf-8")
    home = HOME_HTML.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")
    archive = ARCHIVE_HTML.read_text(encoding="utf-8")
    data_js = (DEMO_DIR / "assets/js/data.js").read_text(encoding="utf-8")
    app_js = (DEMO_DIR / "assets/js/app.js").read_text(encoding="utf-8")
    css = (DEMO_DIR / "assets/css/pebble-beach-2027.css").read_text(encoding="utf-8")

    for asset in DEMO_ASSETS:
        expected = tokenized(asset)
        if expected not in html:
            errors.append(f"cache token mismatch: expected {expected}")
    if "?v=dev" in html:
        errors.append("development cache token remains in demo HTML")

    parser = PageParser()
    parser.feed(html)
    if len(parser.ids) != len(set(parser.ids)):
        duplicates = sorted({value for value in parser.ids if parser.ids.count(value) > 1})
        errors.append(f"duplicate HTML ids: {', '.join(duplicates)}")

    for link in parser.links:
        if link.get("target") == "_blank":
            rel = set(link.get("rel", "").split())
            if not {"noopener", "noreferrer"}.issubset(rel):
                errors.append(f"external link lacks noopener noreferrer: {link.get('href', '')}")
        href = link.get("href", "")
        if href.startswith("#") and href != "#" and href[1:] not in set(parser.ids):
            errors.append(f"internal link target does not exist: {href}")

    local_assets: list[str] = []
    local_assets.extend(script["src"] for script in parser.scripts if script.get("src"))
    local_assets.extend(
        link["href"] for link in parser.styles
        if link.get("rel") == "stylesheet" and link.get("href")
    )
    for asset in local_assets:
        parsed = urlparse(asset)
        if parsed.scheme or parsed.netloc:
            errors.append(f"external runtime asset is not allowed: {asset}")
            continue
        if not (DEMO_DIR / parsed.path).is_file():
            errors.append(f"referenced local asset does not exist: {asset}")

    canonical = one(r'<link\s+rel="canonical"\s+href="([^"]+)"', html, "canonical link", errors)
    og_url = one(r'<meta\s+property="og:url"\s+content="([^"]+)"', html, "og:url", errors)
    if canonical and canonical != EXPECTED_CANONICAL:
        errors.append(f"canonical {canonical!r} != {EXPECTED_CANONICAL!r}")
    if og_url and og_url != EXPECTED_CANONICAL:
        errors.append(f"og:url {og_url!r} != {EXPECTED_CANONICAL!r}")

    required_meta = {
        ("name", "description"),
        ("name", "robots"),
        ("property", "og:type"),
        ("property", "og:url"),
        ("property", "og:title"),
        ("property", "og:description"),
        ("property", "og:image"),
        ("name", "twitter:card"),
        ("name", "twitter:title"),
        ("name", "twitter:description"),
        ("name", "twitter:image"),
    }
    present_meta = {
        (key, meta.get(key, ""))
        for meta in parser.metas
        for key in ("name", "property")
        if meta.get(key)
    }
    for item in sorted(required_meta - present_meta):
        errors.append(f"missing metadata: {item[1]}")
    if "status: 'partial'" not in data_js:
        errors.append("data status must remain partial until every annual module is complete")
    if '<meta name="robots" content="noindex,follow">' not in html:
        errors.append("an incomplete guide must remain noindex,follow")
    if "confirmedEventCount: 7" not in data_js:
        errors.append("data layer must expose the seven confirmed signature-event ranges")
    if "factsCheckedOn: checkedOn" not in data_js or "official-current-year-only" not in data_js:
        errors.append("data layer must expose a current-year provenance check date and policy")
    if "https://www.pebblebeachconcours.net/event-calendar/" not in data_js:
        errors.append("data layer must use the official Event Calendar canonical URL")

    expected_sections = ["status", "framework", "watchlist", "archive"]
    section_positions = [html.find(f'id="{section_id}"') for section_id in expected_sections]
    if any(position < 0 for position in section_positions):
        errors.append("one or more required planning sections are missing")
    elif section_positions != sorted(section_positions):
        errors.append("planning sections are not in the expected editorial order")

    if html.count('data-module-id="') != 7:
        errors.append("static fallback must expose exactly seven planning modules")
    if html.count('class="module-detail"') != 7:
        errors.append("static fallback must keep facts or pending fields inside all seven disclosures")
    static_partial_ids = re.findall(
        r'<details[^>]+data-module-id="([^"]+)"[^>]*>(?:(?!</details>).)*?status-partial',
        html,
        flags=re.DOTALL,
    )
    if static_partial_ids != ["calendar", "tour", "tickets", "parking", "commute"]:
        errors.append("static fallback must expose five partial modules")
    for root_id in ["module-grid", "framework-reusable", "framework-reset", "source-watchlist"]:
        if html.count(f'id="{root_id}"') != 1:
            errors.append(f"expected exactly one renderer root: {root_id}")
        if app_js.count(f"getElementById('{root_id}')") != 1:
            errors.append(f"app must bind renderer root exactly once: {root_id}")
    if "renderModules();" not in app_js or "renderFramework();" not in app_js or "renderSources();" not in app_js:
        errors.append("language application must render modules, framework, and watchlist")
    if ".filter((source) => source.watchlist !== false)" not in app_js:
        errors.append("source overview must omit detail-only evidence links")
    if "DATA.confirmedEvents.flatMap((event) => event.sourceIds || [])" not in app_js:
        errors.append("calendar disclosure must expose the sources behind detailed event facts")

    if "demos/pebble-beach-2027/index.html" not in home:
        errors.append("homepage current card must point to pebble-beach-2027")
    if "demos/pebble-beach-2026/index.html" in home:
        errors.append("homepage must not present the 2026 archive as a second current demo")
    if "demos/pebble-beach-2027/" not in readme or "demos/pebble-beach-2026/" not in readme:
        errors.append("README must list both the current 2027 shell and the 2026 archive")
    if '../pebble-beach-2026/' not in html:
        errors.append("2027 page must link to the 2026 archive")
    if '../pebble-beach-2027/' not in archive:
        errors.append("2026 archive must link to the 2027 planning shell")

    public_text = html + data_js + app_js + css
    for forbidden, label in [
        ("chatgpt.com/c/", "private ChatGPT conversation URL"),
        ("parking-traffic-map-2026", "2026 parking map"),
        ("assets/img/events/", "2026 event thumbnails"),
        ("pebble-beach-2026-og", "2026 social image"),
        ("Big Sur Timber Fire", "prior-edition route notice"),
    ]:
        if forbidden in public_text:
            errors.append(f"2027 public files contain {label}")
    if re.search(r"\$\s*\d", data_js):
        errors.append("2027 data contains a monetary amount")
    if "leaflet" in public_text.lower() or "tileLayer" in app_js:
        errors.append("partial guide must not initialize a map before 2027 geography is verified")

    try:
        dimensions = png_dimensions(DEMO_DIR / "assets/img/pebble-beach-2027-og.png")
        if dimensions != (1200, 630):
            errors.append(f"OG PNG dimensions are {dimensions}, expected (1200, 630)")
    except ValueError as exc:
        errors.append(f"invalid OG PNG: {exc}")
    svg = (DEMO_DIR / "assets/img/pebble-beach-2027-og.svg").read_text(encoding="utf-8")
    if 'width="1200"' not in svg or 'height="630"' not in svg:
        errors.append("OG SVG must declare 1200 × 630 dimensions")

    if "qrost.com" in public_text:
        errors.append("phantom qrost.com reference")
    return errors


def run_checked(command: list[str]) -> None:
    subprocess.run(command, cwd=DEMO_DIR, check=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="validate without rewriting cache tokens")
    args = parser.parse_args()

    if not args.check:
        changed = sync_hashes()
        if changed:
            print("updated cache tokens:")
            for path in changed:
                print(f"- {path}")
        else:
            print("cache tokens already current")

    errors = validate()
    if errors:
        print(f"Pebble Beach 2027 build validation failed ({len(errors)}):", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    run_checked(["node", "--check", "assets/js/data.js"])
    run_checked(["node", "--check", "assets/js/app.js"])
    run_checked(["node", "tools/validate-data.js"])
    print("Pebble Beach 2027 partial-guide validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
