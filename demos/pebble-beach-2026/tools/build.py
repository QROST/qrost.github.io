#!/usr/bin/env python3
"""Refresh content hashes and validate the Pebble Beach 2026 public guide."""

from __future__ import annotations

import argparse
import hashlib
import re
import shutil
import struct
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


DEMO_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
DEMO_HTML = DEMO_DIR / "index.html"
HOME_HTML = REPO_ROOT / "index.html"

DEMO_ASSETS = (
    "assets/css/pebble-beach.css",
    "assets/js/data.js",
    "assets/js/app.js",
)
HOME_ASSET = "assets/js/home-i18n.js"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[dict[str, str]] = []
        self.scripts: list[dict[str, str]] = []
        self.styles: list[dict[str, str]] = []
        self.metas: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        if tag == "a":
            self.links.append(data)
        elif tag == "script":
            self.scripts.append(data)
        elif tag == "link":
            self.styles.append(data)
        elif tag == "meta":
            self.metas.append(data)


def short_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def tokenized(asset: str, path: Path) -> str:
    return f"{asset}?v={short_hash(path)}"


def replace_token(document: str, asset: str, digest: str) -> tuple[str, int]:
    pattern = re.compile(rf"{re.escape(asset)}\?v=[A-Za-z0-9._-]+")
    return pattern.subn(f"{asset}?v={digest}", document)


def sync_hashes() -> list[str]:
    changed: list[str] = []
    demo_text = DEMO_HTML.read_text(encoding="utf-8")
    for asset in DEMO_ASSETS:
        path = DEMO_DIR / asset
        demo_text, count = replace_token(demo_text, asset, short_hash(path))
        if count != 1:
            raise RuntimeError(f"expected one cache token for {asset}, found {count}")
    if demo_text != DEMO_HTML.read_text(encoding="utf-8"):
        DEMO_HTML.write_text(demo_text, encoding="utf-8")
        changed.append(str(DEMO_HTML.relative_to(REPO_ROOT)))

    home_text = HOME_HTML.read_text(encoding="utf-8")
    home_path = REPO_ROOT / HOME_ASSET
    home_text, count = replace_token(home_text, HOME_ASSET, short_hash(home_path))
    if count != 1:
        raise RuntimeError(f"expected one homepage cache token for {HOME_ASSET}, found {count}")
    if home_text != HOME_HTML.read_text(encoding="utf-8"):
        HOME_HTML.write_text(home_text, encoding="utf-8")
        changed.append(str(HOME_HTML.relative_to(REPO_ROOT)))
    return changed


def png_dimensions(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    return struct.unpack(">II", header[16:24])


def check_tokens(errors: list[str], html: str, base: Path, assets: tuple[str, ...]) -> None:
    for asset in assets:
        expected = tokenized(asset, base / asset)
        if expected not in html:
            errors.append(f"cache token mismatch: expected {expected}")


def validate() -> list[str]:
    errors: list[str] = []
    required = [
        DEMO_HTML,
        *(DEMO_DIR / asset for asset in DEMO_ASSETS),
        DEMO_DIR / "assets/img/pebble-beach-2026-og.png",
        DEMO_DIR / "assets/img/pebble-beach-2026-og.svg",
    ]
    for path in required:
        if not path.is_file():
            errors.append(f"missing required file: {path.relative_to(REPO_ROOT)}")
    if errors:
        return errors

    html = DEMO_HTML.read_text(encoding="utf-8")
    home = HOME_HTML.read_text(encoding="utf-8")
    data_js = (DEMO_DIR / "assets/js/data.js").read_text(encoding="utf-8")
    app_js = (DEMO_DIR / "assets/js/app.js").read_text(encoding="utf-8")

    check_tokens(errors, html, DEMO_DIR, DEMO_ASSETS)
    check_tokens(errors, home, REPO_ROOT, (HOME_ASSET,))
    if "?v=dev" in html:
        errors.append("development cache token remains in demo HTML")

    parser = PageParser()
    parser.feed(html)
    for link in parser.links:
        if link.get("target") == "_blank":
            rel = set(link.get("rel", "").split())
            if not {"noopener", "noreferrer"}.issubset(rel):
                errors.append(f"external link lacks noopener noreferrer: {link.get('href', '')}")

    local_assets: list[str] = []
    for script in parser.scripts:
        if script.get("src"):
            local_assets.append(script["src"])
    for link in parser.styles:
        href = link.get("href", "")
        if href and link.get("rel") == "stylesheet":
            local_assets.append(href)
    for asset in local_assets:
        parsed = urlparse(asset)
        if parsed.scheme or parsed.netloc:
            errors.append(f"external runtime asset is not allowed: {asset}")
            continue
        path = DEMO_DIR / parsed.path
        if not path.is_file():
            errors.append(f"referenced local asset does not exist: {asset}")

    required_meta = {
        ("property", "og:type"),
        ("property", "og:url"),
        ("property", "og:title"),
        ("property", "og:description"),
        ("property", "og:image"),
        ("name", "twitter:card"),
        ("name", "twitter:title"),
        ("name", "twitter:description"),
        ("name", "twitter:image"),
        ("name", "description"),
    }
    present_meta = {
        (key, meta.get(key, ""))
        for meta in parser.metas
        for key in ("name", "property")
        if meta.get(key)
    }
    for item in sorted(required_meta - present_meta):
        errors.append(f"missing metadata: {item[1]}")

    if "demos/pebble-beach-2026/index.html" not in home:
        errors.append("homepage card for pebble-beach-2026 is missing")
    tour_contract = {
        'class="tour-nav-link" href="#tour-0813"': "Tour navigation anchor",
        'id="tour-0813"': "Tour section",
        'id="tour-route"': "Tour route renderer root",
        'id="tour-wave-list"': "Tour wave renderer root",
        'id="tour-parking-alternative-list"': "Tour parking-alternative renderer root",
        'id="tour-parking-no-go-list"': "Tour parking-exclusion renderer root",
        'id="tour-plan-list"': "Tour viewing-plan renderer root",
        'id="tour-source-list"': "Tour official-source renderer root",
    }
    for snippet, label in tour_contract.items():
        if html.count(snippet) != 1:
            errors.append(f"expected exactly one {label}, found {html.count(snippet)}")
    for root_id in (
        "tour-route",
        "tour-wave-list",
        "tour-parking-alternative-list",
        "tour-parking-no-go-list",
        "tour-plan-list",
        "tour-source-list",
    ):
        renderer_lookup = f"getElementById('{root_id}')"
        if app_js.count(renderer_lookup) != 1:
            errors.append(
                f"expected Tour renderer to bind {root_id} exactly once, "
                f"found {app_js.count(renderer_lookup)}"
            )
    if not re.search(r"function\s+renderDynamicContent\(\)\s*\{\s*renderTourMorning\(\);", app_js):
        errors.append("renderDynamicContent must invoke renderTourMorning")
    parking_map_contract = {
        'href="#parking-traffic"': "parking-map navigation anchor",
        'id="parking-traffic"': "parking-map section",
        'id="parking-map-day-filter"': "parking-map day filter",
        'id="parking-map-layer-filter"': "parking-map layer filter",
        'id="parking-traffic-map"': "parking-map Leaflet root",
        'id="parking-map-list"': "parking-map accessible list",
        'id="parking-map-status"': "parking-map live status",
        'id="parking-map-touch-toggle"': "parking-map touch control",
        'id="parking-map-line-legend"': "parking-map line legend",
    }
    for snippet, label in parking_map_contract.items():
        if html.count(snippet) != 1:
            errors.append(f"expected exactly one {label}, found {html.count(snippet)}")
    for root_id in (
        "parking-map-day-filter",
        "parking-map-layer-filter",
        "parking-traffic-map",
        "parking-map-list",
        "parking-map-status",
        "parking-map-touch-toggle",
        "parking-map-line-legend",
    ):
        renderer_lookup = f"getElementById('{root_id}')"
        if app_js.count(renderer_lookup) < 1:
            errors.append(
                f"expected parking-map renderer to bind {root_id} at least once, "
                f"found {app_js.count(renderer_lookup)}"
            )
    if not re.search(r"renderTourMorning\(\);\s*renderParkingTraffic\(\);", app_js):
        errors.append("renderDynamicContent must invoke renderParkingTraffic after renderTourMorning")
    for function_name in (
        "renderParkingTrafficControls",
        "renderParkingTrafficList",
        "ensureParkingTrafficMap",
        "syncParkingTrafficMap",
    ):
        if len(re.findall(rf"function\s+{function_name}\(\)", app_js)) != 1:
            errors.append(f"expected exactly one {function_name} implementation")
    parking_renderer_match = re.search(
        r"function\s+makeParkingTrafficIcon\(point\)(.*?)function\s+getMapPlace\(placeId\)",
        app_js,
        re.DOTALL,
    )
    if not parking_renderer_match:
        errors.append("parking-map renderer block is missing")
    else:
        parking_renderer = parking_renderer_match.group(1)
        for required in (
            "window.L.CRS.Simple",
            "window.L.imageOverlay",
            "parkingDiagramLatLng",
            "parkingDiagramBounds",
        ):
            if required not in parking_renderer:
                errors.append(f"parking-map renderer must use {required}")
        for forbidden in ("window.L.tileLayer", "window.L.polyline", "point.lat", "point.lng"):
            if forbidden in parking_renderer:
                errors.append(f"parking-map diagram renderer must not use {forbidden}")
    official_parking_svg = DEMO_DIR / "assets/img/parking-traffic-map-2026.svg"
    if not official_parking_svg.exists():
        errors.append("vendored official parking SVG is missing")
    elif 'viewBox="0 0 792 612"' not in official_parking_svg.read_text(encoding="utf-8"):
        errors.append("vendored official parking SVG has the wrong viewBox")
    if html.count('src="assets/img/parking-traffic-map-2026.svg"') != 1:
        errors.append("static parking-map fallback must use the vendored official SVG exactly once")
    for stale_copy in ("georeferenced", "公开地理资料配准", "OpenStreetMap 地理底图"):
        if stale_copy in html or stale_copy in data_js:
            errors.append(f"parking-map copy must not claim false geographic alignment: {stale_copy}")
    official_parking_pdf = "https://www.pebblebeachconcours.net/wp-content/uploads/2026/07/01a_Parking-and-Traffic-Flow-THUR-SUN_LotsOnly.pdf"
    if html.count(official_parking_pdf) != 2:
        errors.append("parking-map static fallback and source bar must both link the official PDF")
    for date in range(13, 18):
        if f"2026-08-{date:02d}" not in data_js:
            errors.append(f"data is missing 2026-08-{date:02d}")
    event_count = len(re.findall(r"area:\s*'[a-z0-9]+'\s*,\s*date:\s*'2026-08-", data_js))
    if event_count < 18:
        errors.append(f"expected at least 18 event records, found {event_count}")

    forbidden = ("/users/",)
    for path in DEMO_DIR.rglob("*"):
        if path.suffix.lower() not in {".html", ".js", ".css", ".svg"}:
            continue
        lowered = path.read_text(encoding="utf-8").lower()
        for phrase in forbidden:
            if phrase in lowered:
                errors.append(f"private/source-project phrase found in {path.relative_to(REPO_ROOT)}: {phrase}")

    og_path = DEMO_DIR / "assets/img/pebble-beach-2026-og.png"
    try:
        if png_dimensions(og_path) != (1200, 630):
            errors.append(f"OG image must be 1200x630, found {png_dimensions(og_path)}")
    except ValueError as exc:
        errors.append(f"invalid OG image: {exc}")

    node = shutil.which("node")
    if not node:
        errors.append("node is required for JavaScript validation")
    else:
        js_files = (
            DEMO_DIR / "assets/js/data.js",
            DEMO_DIR / "assets/js/app.js",
            REPO_ROOT / HOME_ASSET,
        )
        for path in js_files:
            result = subprocess.run(
                [node, "--check", str(path)],
                cwd=REPO_ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            if result.returncode:
                details = (result.stderr or result.stdout).strip().splitlines()
                errors.append(f"JavaScript syntax failed for {path.relative_to(REPO_ROOT)}: {details[0] if details else 'unknown error'}")
        semantic = subprocess.run(
            [node, str(DEMO_DIR / "tools/validate-data.js")],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        if semantic.returncode:
            errors.append(f"data validation failed: {(semantic.stderr or semantic.stdout).strip()}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="validate without rewriting cache tokens")
    args = parser.parse_args()

    if not args.check:
        changed = sync_hashes()
        if changed:
            print("updated cache tokens:")
            for path in changed:
                print(f"  {path}")
        else:
            print("cache tokens already current")

    errors = validate()
    if errors:
        print("validation failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("Pebble Beach 2026 guide validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
