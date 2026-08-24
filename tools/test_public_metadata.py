#!/usr/bin/env python3
"""Mutation tests proving the public metadata gate fails closed."""

from __future__ import annotations

import json
import struct
import tempfile
import unittest
import zlib
from pathlib import Path

import check_public_metadata as checker


ORIGIN = "https://qrost.github.io/"


def png(width: int, height: int) -> bytes:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    scanline = b"\x00" + (b"\x20\x40\x60" * width)
    pixels = zlib.compress(scanline * height, 9)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", pixels) + chunk(b"IEND", b"")


def html(canonical: str = ORIGIN, width: int = 1200, height: int = 630) -> str:
    image = f"{ORIGIN}assets/og.png"
    return f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fixture page</title><meta name="description" content="Fixture description">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website"><meta property="og:site_name" content="QROST">
<meta property="og:title" content="Fixture page"><meta property="og:description" content="Fixture description">
<meta property="og:url" content="{ORIGIN}"><meta property="og:image" content="{image}">
<meta property="og:image:width" content="{width}"><meta property="og:image:height" content="{height}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Fixture page">
<meta name="twitter:description" content="Fixture description"><meta name="twitter:image" content="{image}">
</head><body></body></html>"""


class MetadataMutationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scratch = tempfile.TemporaryDirectory(prefix="qrost-metadata-fixture-")
        self.root = Path(self.scratch.name)
        (self.root / "assets").mkdir()
        (self.root / "assets/og.png").write_bytes(png(1200, 630))
        (self.root / "index.html").write_text(html(), encoding="utf-8")
        inventory = {
            "schema_version": 1,
            "origin": ORIGIN,
            "pages": [{
                "path": "index.html", "kind": "home", "status": "current",
                "published": True, "indexable": True, "canonical": ORIGIN,
                "metadata": "social", "sitemap": True,
            }],
        }
        (self.root / "site-inventory.json").write_text(json.dumps(inventory), encoding="utf-8")
        (self.root / "sitemap.xml").write_text(
            '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'
            + ORIGIN + "</loc></url></urlset>", encoding="utf-8",
        )
        (self.root / "robots.txt").write_text(
            f"User-agent: *\nAllow: /\n\nSitemap: {ORIGIN}sitemap.xml\n", encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.scratch.cleanup()

    def errors(self) -> list[str]:
        return checker.validate(self.root, enforce_catalog=False)

    def test_valid_fixture_passes(self) -> None:
        self.assertEqual(self.errors(), [])

    def test_wrong_canonical_is_detected(self) -> None:
        (self.root / "index.html").write_text(html(f"{ORIGIN}wrong/"), encoding="utf-8")
        self.assertTrue(any("canonical" in error for error in self.errors()))

    def test_inventory_cannot_redefine_a_pages_canonical(self) -> None:
        wrong = f"{ORIGIN}wrong/"
        path = self.root / "site-inventory.json"
        inventory = json.loads(path.read_text(encoding="utf-8"))
        inventory["pages"][0]["canonical"] = wrong
        path.write_text(json.dumps(inventory), encoding="utf-8")
        page = html(wrong).replace(f'<meta property="og:url" content="{ORIGIN}">', f'<meta property="og:url" content="{wrong}">')
        (self.root / "index.html").write_text(page, encoding="utf-8")
        (self.root / "sitemap.xml").write_text(
            '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'
            + wrong + "</loc></url></urlset>", encoding="utf-8",
        )
        self.assertTrue(any("must match page path" in error for error in self.errors()))

    def test_missing_twitter_field_is_detected(self) -> None:
        page = (self.root / "index.html").read_text(encoding="utf-8")
        page = page.replace(f'<meta name="twitter:image" content="{ORIGIN}assets/og.png">', "")
        (self.root / "index.html").write_text(page, encoding="utf-8")
        self.assertTrue(any("twitter:image" in error for error in self.errors()))

    def test_unlisted_html_is_detected(self) -> None:
        (self.root / "stray.html").write_text("<!doctype html><title>Stray</title>", encoding="utf-8")
        self.assertTrue(any("tracked HTML decisions drifted" in error for error in self.errors()))

    def test_malformed_inventory_fails_cleanly(self) -> None:
        path = self.root / "site-inventory.json"
        inventory = json.loads(path.read_text(encoding="utf-8"))
        del inventory["pages"][0]["path"]
        path.write_text(json.dumps(inventory), encoding="utf-8")
        errors = self.errors()
        self.assertTrue(any("missing keys" in error for error in errors))

    def test_noindex_page_cannot_enter_sitemap(self) -> None:
        path = self.root / "site-inventory.json"
        inventory = json.loads(path.read_text(encoding="utf-8"))
        inventory["pages"][0]["indexable"] = False
        inventory["pages"][0]["metadata"] = "noindex"
        path.write_text(json.dumps(inventory), encoding="utf-8")
        self.assertTrue(any("sitemap pages must be published and indexable" in error for error in self.errors()))

    def test_sitemap_omission_is_detected(self) -> None:
        (self.root / "sitemap.xml").write_text(
            '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>',
            encoding="utf-8",
        )
        self.assertTrue(any("sitemap.xml: URL set drifted" in error for error in self.errors()))

    def test_duplicate_sitemap_url_is_detected(self) -> None:
        (self.root / "sitemap.xml").write_text(
            '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            f"<url><loc>{ORIGIN}</loc></url><url><loc>{ORIGIN}</loc></url></urlset>",
            encoding="utf-8",
        )
        self.assertTrue(any("duplicate URL entries" in error for error in self.errors()))

    def test_home_catalog_rejects_unexpected_and_duplicate_cards(self) -> None:
        parser = checker.HeadParser()
        parser.feed(
            '<a class="card-link" href="demos/one/index.html">one</a>'
            '<a class="card-link" href="demos/one/index.html">duplicate</a>'
            '<a class="card-link" href="demos/typo/index.html">typo</a>'
        )
        errors: list[str] = []
        checker.validate_home_catalog(parser, {"demos/one/index.html"}, set(), errors)
        self.assertTrue(any("unexpected" in error for error in errors), errors)
        self.assertTrue(any("duplicate current demo cards" in error for error in errors), errors)

    def test_unpublished_page_must_stay_under_docs_boundary(self) -> None:
        path = self.root / "site-inventory.json"
        inventory = json.loads(path.read_text(encoding="utf-8"))
        inventory["pages"][0].update({
            "published": False,
            "indexable": False,
            "canonical": None,
            "metadata": "internal",
            "sitemap": False,
            "kind": "internal-reference",
            "status": "internal",
        })
        path.write_text(json.dumps(inventory), encoding="utf-8")
        self.assertTrue(any("must stay under" in error for error in self.errors()))

    def test_inventory_kind_typo_is_detected(self) -> None:
        path = self.root / "site-inventory.json"
        inventory = json.loads(path.read_text(encoding="utf-8"))
        inventory["pages"][0]["kind"] = "demmo"
        path.write_text(json.dumps(inventory), encoding="utf-8")
        self.assertTrue(any("kind must be one of" in error for error in self.errors()))

    def test_small_social_image_is_detected(self) -> None:
        (self.root / "assets/og.png").write_bytes(png(300, 200))
        (self.root / "index.html").write_text(html(width=300, height=200), encoding="utf-8")
        self.assertTrue(any("reasonable large sharing card" in error for error in self.errors()))


if __name__ == "__main__":
    unittest.main(verbosity=2)
