#!/usr/bin/env python3
"""Validate every tracked public HTML decision against site-inventory.json."""

from __future__ import annotations

import argparse
import json
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
SOCIAL_PROPERTIES = (
    "og:type", "og:site_name", "og:title", "og:description", "og:url",
    "og:image", "og:image:width", "og:image:height",
)
SOCIAL_NAMES = (
    "twitter:card", "twitter:title", "twitter:description", "twitter:image",
)


class HeadParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: list[dict[str, str]] = []
        self.links: list[dict[str, str]] = []
        self.anchors: list[str] = []
        self.anchor_attrs: list[dict[str, str]] = []
        self.titles: list[str] = []
        self._in_title = False
        self._title_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): (value or "") for key, value in attrs}
        tag = tag.lower()
        if tag == "meta":
            self.meta.append(values)
        elif tag == "link":
            self.links.append(values)
        elif tag == "a" and values.get("href"):
            self.anchors.append(values["href"])
            self.anchor_attrs.append(values)
        elif tag == "title":
            self._in_title = True
            self._title_parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title" and self._in_title:
            self.titles.append("".join(self._title_parts).strip())
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_parts.append(data)


def only(values: list[str], label: str, page: str, errors: list[str]) -> str | None:
    values = [value.strip() for value in values if value.strip()]
    if len(values) != 1:
        errors.append(f"{page}: expected one non-empty {label}, found {len(values)}")
        return None
    return values[0]


def meta_values(parser: HeadParser, key: str, attribute: str) -> list[str]:
    target = key.lower()
    return [item.get("content", "") for item in parser.meta if item.get(attribute, "").lower() == target]


def canonical_values(parser: HeadParser) -> list[str]:
    return [item.get("href", "") for item in parser.links if "canonical" in item.get("rel", "").lower().split()]


def image_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        return struct.unpack(">II", data[16:24])
    if data[:6] in {b"GIF87a", b"GIF89a"} and len(data) >= 10:
        return struct.unpack("<HH", data[6:10])
    if data.startswith(b"\xff\xd8"):
        offset = 2
        while offset + 9 < len(data):
            if data[offset] != 0xFF:
                offset += 1
                continue
            marker = data[offset + 1]
            offset += 2
            if marker in {0xD8, 0xD9}:
                continue
            if offset + 2 > len(data):
                break
            length = struct.unpack(">H", data[offset : offset + 2])[0]
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                height, width = struct.unpack(">HH", data[offset + 3 : offset + 7])
                return width, height
            offset += length
    raise ValueError("unsupported or malformed image")


def tracked_html(root: Path) -> set[str]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "--", "*.html"],
        cwd=root, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False,
    )
    if result.returncode == 0:
        return {line for line in result.stdout.splitlines() if line}
    return {
        str(path.relative_to(root)) for path in root.rglob("*.html")
        if not {"node_modules", ".venv", ".git"}.intersection(path.parts)
    }


def expected_canonical(origin: str, path: str) -> str:
    if path == "index.html":
        return origin
    if path.endswith("/index.html"):
        return origin + path.removesuffix("index.html")
    return origin + path


def validate_inventory_shape(data: Any, root: Path, errors: list[str]) -> list[dict[str, Any]]:
    if not isinstance(data, dict) or data.get("schema_version") != 1:
        errors.append("site-inventory.json: schema_version must be 1")
        return []
    origin = data.get("origin")
    if not isinstance(origin, str) or not origin.startswith("https://") or not origin.endswith("/"):
        errors.append("site-inventory.json: origin must be an https URL ending in /")
    pages = data.get("pages")
    if not isinstance(pages, list):
        errors.append("site-inventory.json: pages must be an array")
        return []

    required = {"path", "kind", "status", "published", "indexable", "canonical", "metadata", "sitemap"}
    allowed_profiles = {"social", "noindex", "internal"}
    allowed_kinds = {"home", "demo", "utility", "test-harness", "prototype", "app-support", "demo-support", "internal-reference"}
    allowed_statuses = {"current", "archive", "internal-tool", "prototype", "internal"}
    seen_paths: set[str] = set()
    seen_canonicals: set[str] = set()
    for number, page in enumerate(pages, start=1):
        label = f"site-inventory.json pages[{number}]"
        if not isinstance(page, dict):
            errors.append(f"{label}: entry must be an object")
            continue
        missing = sorted(required - set(page))
        extra = sorted(set(page) - required)
        if missing:
            errors.append(f"{label}: missing keys {missing}")
        if extra:
            errors.append(f"{label}: unexpected keys {extra}")
        path = page.get("path")
        relative_path = PurePosixPath(path) if isinstance(path, str) else None
        if (
            not isinstance(path, str)
            or relative_path is None
            or relative_path.is_absolute()
            or ".." in relative_path.parts
            or relative_path.as_posix() != path
            or not path.endswith(".html")
        ):
            errors.append(f"{label}: path must be a safe repository-relative .html path")
            continue
        if path in seen_paths:
            errors.append(f"{label}: duplicate path {path}")
        seen_paths.add(path)
        if not (root / path).is_file():
            errors.append(f"{path}: inventory entry points to a missing file")
        if not all(isinstance(page.get(key), bool) for key in ("published", "indexable", "sitemap")):
            errors.append(f"{label}: published, indexable and sitemap must be booleans")
        profile = page.get("metadata")
        if profile not in allowed_profiles:
            errors.append(f"{label}: metadata must be one of {sorted(allowed_profiles)}")
        if page.get("kind") not in allowed_kinds:
            errors.append(f"{label}: kind must be one of {sorted(allowed_kinds)}")
        if page.get("status") not in allowed_statuses:
            errors.append(f"{label}: status must be one of {sorted(allowed_statuses)}")
        canonical = page.get("canonical")
        if page.get("published"):
            if not isinstance(canonical, str) or not isinstance(origin, str) or not canonical.startswith(origin):
                errors.append(f"{label}: published page canonical must use inventory origin")
            elif canonical != expected_canonical(origin, path):
                errors.append(
                    f"{label}: canonical {canonical!r} must match page path "
                    f"{expected_canonical(origin, path)!r}"
                )
            elif canonical in seen_canonicals:
                errors.append(f"{label}: duplicate canonical {canonical}")
            else:
                seen_canonicals.add(canonical)
            if profile == "internal":
                errors.append(f"{label}: published page cannot use internal metadata profile")
        else:
            if page.get("indexable") or page.get("sitemap") or canonical is not None or profile != "internal":
                errors.append(f"{label}: unpublished page must be non-indexable, absent from sitemap, canonical null, metadata internal")
            if not path.startswith("_docs/"):
                errors.append(f"{label}: unpublished HTML must stay under the Jekyll-excluded _docs/ boundary")
        if page.get("indexable") and profile != "social":
            errors.append(f"{label}: indexable pages require the social metadata profile")
        if page.get("sitemap") and (not page.get("published") or not page.get("indexable")):
            errors.append(f"{label}: sitemap pages must be published and indexable")
    return [page for page in pages if isinstance(page, dict)]


def validate_page(root: Path, origin: str, page: dict[str, Any], errors: list[str]) -> HeadParser | None:
    relative = page["path"]
    path = root / relative
    if not path.is_file():
        return None
    html = path.read_text(encoding="utf-8")
    if "qrost.com" in html.lower():
        errors.append(f"{relative}: phantom qrost.com reference")

    parser = HeadParser()
    parser.feed(html)
    only(parser.titles, "title", relative, errors)
    if not page["published"]:
        if canonical_values(parser):
            errors.append(f"{relative}: unpublished internal page must not declare a public canonical")
        robots = only(meta_values(parser, "robots", "name"), "robots meta", relative, errors)
        directives = {item.strip().lower() for item in robots.split(",")} if robots else set()
        if "noindex" not in directives and "none" not in directives:
            errors.append(f"{relative}: unpublished internal page must carry noindex defense-in-depth")
        if meta_values(parser, "og:url", "property") or meta_values(parser, "twitter:card", "name"):
            errors.append(f"{relative}: unpublished internal page must not declare social publication metadata")
        return None

    canonical = only(canonical_values(parser), "canonical link", relative, errors)
    if canonical is not None and canonical != page["canonical"]:
        errors.append(f"{relative}: canonical {canonical!r} != inventory {page['canonical']!r}")

    robots_values = meta_values(parser, "robots", "name")
    robots = only(robots_values, "robots meta", relative, errors) if robots_values else "index,follow"
    directives = {item.strip().lower() for item in robots.split(",")} if robots else set()
    blocks_indexing = "noindex" in directives or "none" in directives
    if page["indexable"] and blocks_indexing:
        errors.append(f"{relative}: inventory says indexable but robots contains noindex")
    if not page["indexable"] and not blocks_indexing:
        errors.append(f"{relative}: inventory says noindex but robots does not contain noindex")

    if page["metadata"] != "social":
        return parser

    only(meta_values(parser, "description", "name"), "description meta", relative, errors)
    social: dict[str, str | None] = {}
    for key in SOCIAL_PROPERTIES:
        social[key] = only(meta_values(parser, key, "property"), key, relative, errors)
    for key in SOCIAL_NAMES:
        social[key] = only(meta_values(parser, key, "name"), key, relative, errors)

    if social.get("og:url") and social["og:url"] != page["canonical"]:
        errors.append(f"{relative}: og:url must equal inventory canonical")
    if social.get("twitter:card") and social["twitter:card"] != "summary_large_image":
        errors.append(f"{relative}: twitter:card must be summary_large_image")
    og_image = social.get("og:image")
    twitter_image = social.get("twitter:image")
    if og_image and twitter_image and og_image != twitter_image:
        errors.append(f"{relative}: og:image and twitter:image must match")
    if not og_image:
        return parser

    parsed = urlparse(og_image)
    expected_origin = urlparse(origin)
    if (parsed.scheme, parsed.netloc) != (expected_origin.scheme, expected_origin.netloc):
        errors.append(f"{relative}: social image must be hosted on {expected_origin.netloc}")
        return parser
    image_relative = PurePosixPath(unquote(parsed.path).lstrip("/"))
    if image_relative.is_absolute() or ".." in image_relative.parts:
        errors.append(f"{relative}: social image path must stay inside the public repository")
        return parser
    image_path = root / image_relative
    if not image_path.is_file():
        errors.append(f"{relative}: social image does not exist: {image_path.relative_to(root)}")
        return parser
    try:
        width, height = image_size(image_path)
    except ValueError as exc:
        errors.append(f"{relative}: social image {exc}")
        return parser
    try:
        declared = (int(social["og:image:width"] or 0), int(social["og:image:height"] or 0))
    except ValueError:
        errors.append(f"{relative}: og:image width/height must be integers")
        return parser
    if declared != (width, height):
        errors.append(f"{relative}: declared social image size {declared} != actual {(width, height)}")
    ratio = width / height if height else 0
    if width < 600 or height < 315 or not 1.8 <= ratio <= 2.0:
        errors.append(f"{relative}: social image {(width, height)} is not a reasonable large sharing card")
    return parser


def validate_sitemap(root: Path, pages: list[dict[str, Any]], errors: list[str]) -> None:
    expected = {
        page.get("canonical")
        for page in pages
        if page.get("sitemap") and isinstance(page.get("canonical"), str)
    }
    path = root / "sitemap.xml"
    if not path.is_file():
        errors.append("sitemap.xml: missing")
        return
    try:
        tree = ET.parse(path)
    except ET.ParseError as exc:
        errors.append(f"sitemap.xml: malformed XML: {exc}")
        return
    namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    if tree.getroot().tag != f"{namespace}urlset":
        errors.append("sitemap.xml: root element must be the sitemap urlset")
    locations = [
        (node.text or "").strip()
        for node in tree.findall(f"{namespace}url/{namespace}loc")
        if (node.text or "").strip()
    ]
    duplicate_locations = sorted(url for url, count in Counter(locations).items() if count > 1)
    if duplicate_locations:
        errors.append(f"sitemap.xml: duplicate URL entries {duplicate_locations}")
    found = set(locations)
    if found != expected:
        errors.append(
            "sitemap.xml: URL set drifted; "
            f"missing={sorted(expected - found) or 'none'}, unexpected={sorted(found - expected) or 'none'}"
        )


def validate_robots(root: Path, origin: str, errors: list[str]) -> None:
    path = root / "robots.txt"
    if not path.is_file():
        errors.append("robots.txt: missing")
        return
    lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.lstrip().startswith("#")]
    expected = ["User-agent: *", "Allow: /", f"Sitemap: {origin}sitemap.xml"]
    if lines != expected:
        errors.append(f"robots.txt: expected crawlable noindex policy and canonical sitemap lines {expected!r}")


def required_page_keys_present(page: dict[str, Any]) -> bool:
    return all(key in page for key in ("path", "published", "indexable", "canonical", "metadata"))


def validate_home_catalog(
    home: HeadParser,
    current_demos: set[str],
    archives: set[str],
    errors: list[str],
) -> None:
    """Require exactly one card-link anchor for every current demo and no other card."""
    card_hrefs = [
        anchor.get("href", "")
        for anchor in home.anchor_attrs
        if "card-link" in anchor.get("class", "").split()
    ]
    counts = Counter(card_hrefs)
    linked = set(card_hrefs)
    if linked != current_demos:
        errors.append(
            "index.html: current demo cards drifted; "
            f"missing={sorted(current_demos - linked) or 'none'}, "
            f"unexpected={sorted(linked - current_demos) or 'none'}"
        )
    duplicates = sorted(href for href, count in counts.items() if count > 1)
    if duplicates:
        errors.append(f"index.html: duplicate current demo cards {duplicates}")
    archive_links = linked & archives
    if archive_links:
        errors.append(f"index.html: archive duplicated as current card: {sorted(archive_links)}")


def validate(root: Path = ROOT, inventory_path: Path | None = None, *, enforce_catalog: bool = True) -> list[str]:
    errors: list[str] = []
    inventory_path = inventory_path or root / "site-inventory.json"
    try:
        data = json.loads(inventory_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"site-inventory.json: cannot read valid JSON: {exc}"]
    pages = validate_inventory_shape(data, root, errors)
    origin = data.get("origin", "") if isinstance(data, dict) else ""

    if any(not page.get("published") for page in pages) and (root / ".nojekyll").exists():
        errors.append("site-inventory.json: unpublished _docs HTML requires Jekyll; root .nojekyll would expose it")

    actual_html = tracked_html(root)
    inventory_html = {page.get("path") for page in pages if isinstance(page.get("path"), str)}
    if actual_html != inventory_html:
        errors.append(
            "site-inventory.json: tracked HTML decisions drifted; "
            f"missing={sorted(actual_html - inventory_html) or 'none'}, stale={sorted(inventory_html - actual_html) or 'none'}"
        )

    parsers: dict[str, HeadParser] = {}
    for page in pages:
        if not required_page_keys_present(page):
            continue
        parser = validate_page(root, origin, page, errors)
        if parser is not None:
            parsers[page["path"]] = parser

    if enforce_catalog:
        current_demos = {
            page["path"] for page in pages
            if page.get("kind") == "demo"
            and page.get("status") == "current"
            and isinstance(page.get("path"), str)
        }
        archives = {
            page["path"] for page in pages
            if page.get("kind") == "demo"
            and page.get("status") == "archive"
            and isinstance(page.get("path"), str)
        }
        if len(current_demos) != 12:
            errors.append(f"site-inventory.json: expected 12 current demos, found {len(current_demos)}")
        if archives != {"demos/pebble-beach-2026/index.html"}:
            errors.append(f"site-inventory.json: archive set must be only Pebble Beach 2026, found {sorted(archives)}")
        home = parsers.get("index.html")
        if home:
            validate_home_catalog(home, current_demos, archives, errors)

    validate_sitemap(root, pages, errors)
    validate_robots(root, origin, errors)
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="repository root (for fixture tests)")
    parser.add_argument("--inventory", type=Path, help="inventory path (defaults to ROOT/site-inventory.json)")
    args = parser.parse_args()
    root = args.root.resolve()
    inventory = args.inventory.resolve() if args.inventory else root / "site-inventory.json"
    errors = validate(root, inventory)
    if errors:
        print(f"public metadata: FAILED ({len(errors)} issue{'s' if len(errors) != 1 else ''})", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    data = json.loads(inventory.read_text(encoding="utf-8"))
    current = sum(page["kind"] == "demo" and page["status"] == "current" for page in data["pages"])
    archive = sum(page["kind"] == "demo" and page["status"] == "archive" for page in data["pages"])
    published = sum(page["published"] for page in data["pages"])
    print(f"public metadata: OK ({published} published HTML decisions; {current} current demos + {archive} archive)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
