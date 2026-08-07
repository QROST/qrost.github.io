#!/usr/bin/env python3
"""Static page-contract tests for the Architecture Lineages browser."""

from __future__ import annotations

import hashlib
import json
import re
import struct
import unittest
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"
I18N = ROOT / "assets" / "js" / "i18n.js"
LOADER = ROOT / "assets" / "js" / "data-loader.js"
APP = ROOT / "assets" / "js" / "app.js"
MAPS = ROOT / "assets" / "js" / "maps.js"
CSS = ROOT / "assets" / "css" / "architecture-history.css"
MANIFEST = ROOT / "assets" / "data" / "manifest.json"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.id_counts: Counter[str] = Counter()
        self.i18n_keys: set[str] = set()
        self.asset_refs: list[str] = []
        self.scripts: list[dict[str, str]] = []
        self.images: list[dict[str, str]] = []

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        row = {key: value or "" for key, value in attrs}
        if row.get("id"):
            self.ids.add(row["id"])
            self.id_counts[row["id"]] += 1
        for attr in ("data-i18n", "data-i18n-placeholder", "data-i18n-aria-label"):
            if row.get(attr):
                self.i18n_keys.add(row[attr])
        if tag == "script":
            self.scripts.append(row)
        if tag == "img":
            self.images.append(row)
        for attr in ("src", "href"):
            ref = row.get(attr, "")
            if ref.startswith("assets/js/") or ref.startswith("assets/css/"):
                self.asset_refs.append(ref)


class PageContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = HTML.read_text(encoding="utf-8")
        cls.i18n = I18N.read_text(encoding="utf-8")
        cls.loader = LOADER.read_text(encoding="utf-8")
        cls.app = APP.read_text(encoding="utf-8")
        cls.maps = MAPS.read_text(encoding="utf-8")
        cls.css = CSS.read_text(encoding="utf-8")
        cls.manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        cls.parser = PageParser()
        cls.parser.feed(cls.html)

    def test_required_browser_surfaces_exist(self) -> None:
        required = {
            "world-map",
            "coordinate-list",
            "catalog-search",
            "region-filter",
            "period-filter",
            "status-filter",
            "catalog-table-body",
            "catalog-card-list",
            "lineage-graph",
            "lineage-list",
            "coverage-matrix",
            "source-grid",
            "detail-modal",
            "detail-close",
            "init-error",
        }
        self.assertEqual(required - self.parser.ids, set())
        self.assertEqual(
            {key: count for key, count in self.parser.id_counts.items() if count > 1},
            {},
        )

    def test_every_static_i18n_reference_is_declared(self) -> None:
        declared = set(
            re.findall(
                r"^\s{4}([A-Za-z][A-Za-z0-9_]*):\s*\{",
                self.i18n,
                flags=re.MULTILINE,
            )
        )
        self.assertEqual(self.parser.i18n_keys - declared, set())

    def test_local_assets_are_content_hash_stamped(self) -> None:
        self.assertEqual(len(self.parser.asset_refs), len(set(self.parser.asset_refs)))
        for ref in self.parser.asset_refs:
            match = re.fullmatch(r"([^?]+)\?v=([0-9a-f]{10})", ref)
            self.assertIsNotNone(match, ref)
            path = ROOT / match.group(1)
            self.assertTrue(path.is_file(), path)
            expected = hashlib.sha1(path.read_bytes()).hexdigest()[:10]
            self.assertEqual(match.group(2), expected, ref)

    def test_echarts_is_exactly_pinned_with_sri(self) -> None:
        matches = [
            script
            for script in self.parser.scripts
            if "echarts" in script.get("src", "")
        ]
        self.assertEqual(len(matches), 1)
        script = matches[0]
        self.assertEqual(
            script["src"],
            "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js",
        )
        self.assertEqual(
            script.get("integrity"),
            "sha384-Mx5lkUEQPM1pOJCwFtUICyX45KNojXbkWdYhkKUKsbv391mavbfoAmONbzkgYPzR",
        )
        self.assertEqual(script.get("crossorigin"), "anonymous")

    def test_script_dependency_order_is_explicit(self) -> None:
        sources = [script.get("src", "").split("?", 1)[0] for script in self.parser.scripts]
        expected = [
            "assets/js/world-geo.js",
            "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js",
            "assets/js/i18n.js",
            "assets/js/data-loader.js",
            "assets/js/maps.js",
            "assets/js/app.js",
        ]
        self.assertEqual([source for source in sources if source], expected)

    def test_loader_version_matches_manifest(self) -> None:
        match = re.search(
            r"const DATA_VERSION = '([0-9a-f]{64})';",
            self.loader,
        )
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1), self.manifest["data_version"])
        manifest_hash = re.search(
            r"const MANIFEST_SHA256 = '([0-9a-f]{64})';",
            self.loader,
        )
        self.assertIsNotNone(manifest_hash)
        self.assertEqual(
            manifest_hash.group(1),
            hashlib.sha256(MANIFEST.read_bytes()).hexdigest(),
        )
        self.assertIn(
            f"const SCHEMA_ID = '{self.manifest['schema_id']}';",
            self.loader,
        )
        self.assertIn(
            f"const SCHEMA_VERSION = '{self.manifest['schema_version']}';",
            self.loader,
        )

    def test_loader_uses_public_arrays_not_private_or_snapshot_payloads(self) -> None:
        for filename in (
            "manifest.json",
            "works.json",
            "people.json",
            "practices.json",
            "places.json",
            "relations.json",
            "claims.json",
            "source-registry.json",
            "methodology/wikidata-coverage-config.json",
        ):
            self.assertIn(filename, self.loader)
        self.assertNotIn("source-snapshots/", self.loader)
        self.assertNotIn("catalog/", self.loader)

    def test_loader_verifies_manifest_hashes_and_counts(self) -> None:
        for phrase in (
            "response.arrayBuffer()",
            "window.crypto.subtle.digest('SHA-256', bytes)",
            "actual !== expectedFile.sha256",
            "records.length !== expected.count",
            "fetchJson(FILES.manifest, { sha256: MANIFEST_SHA256 })",
            "manifest.hash_algorithm !== 'sha256'",
        ):
            self.assertIn(phrase, self.loader)

    def test_runtime_failure_boundaries_are_explicit(self) -> None:
        self.assertIn("Architecture world map failed:", self.app)
        self.assertIn("Architecture lineage graph failed:", self.app)
        self.assertGreaterEqual(self.maps.count(".dispose()"), 4)
        self.assertIn("if (!event.persisted) dispose();", self.maps)
        self.assertIn("window.addEventListener('pagehide', handlePageHide)", self.maps)

    def test_hash_restore_is_fail_closed(self) -> None:
        self.assertIn("const SECTION_IDS = new Set(", self.app)
        self.assertIn("try {\n      const id = decodeURIComponent(", self.app)
        self.assertIn("return SECTION_IDS.has(id) ? id : '';", self.app)

    def test_relation_and_rights_evidence_are_auditable(self) -> None:
        for phrase in (
            "data-open-relation",
            "openRelationDetail",
            "source.allowed_operations",
            "source.reuse_class",
            "source_record_sha256",
            "native_field_path",
            "evidence.references",
        ):
            self.assertIn(phrase, self.html + self.app)

    def test_field_level_claims_are_folded_by_default(self) -> None:
        wrapper = '<details class="detail-section claims-disclosure"><summary>'
        self.assertIn(wrapper, self.app)
        self.assertNotIn(
            '<details class="detail-section claims-disclosure" open>',
            self.app,
        )
        self.assertIn("i18n.t('detailClaims')", self.app)
        self.assertIn("i18n.t('claimsCount', { count: claims.length })", self.app)
        self.assertIn("</ul></details>", self.app)

    def test_source_derived_period_filter_is_wired_without_claiming_coverage(self) -> None:
        for phrase in (
            "period: 'all'",
            "function renderPeriodOptions()",
            "entity.period !== filters.period",
            "i18n.t('detailPeriod')",
        ):
            self.assertIn(phrase, self.app)
        for phrase in (
            "periodFilter",
            "periodFilterAria",
            "periodAll",
            "detailPeriod",
            "source-derived period",
        ):
            self.assertIn(phrase, self.i18n)
        self.assertEqual(self.manifest["coverage"]["cells_total"], 72)
        self.assertIn(self.manifest["coverage"]["status"], {"not_run", "partial"})
        self.assertGreaterEqual(self.manifest["coverage"]["cells_run"], 0)
        self.assertLessEqual(
            self.manifest["coverage"]["cells_run"],
            self.manifest["coverage"]["cells_total"],
        )
        self.assertEqual(
            len(self.manifest["coverage"].get("cells", [])),
            self.manifest["coverage"]["cells_run"],
        )
        if self.manifest["coverage"]["cells_run"] == 0:
            self.assertEqual(self.manifest["coverage"]["status"], "not_run")

    def test_truth_boundaries_are_visible_in_both_languages(self) -> None:
        for phrase in (
            "不是全球建筑史全集",
            "not a complete global history",
            "关系线索不等于已确认师承",
            "relation clues are not verified lineage",
            "核验状态与原始记录分离",
            "verification stays separate from source records",
            "72 个",
            "72 region × period",
        ):
            self.assertIn(phrase, (self.html + self.i18n).lower())
        for forbidden in ("游戏", "塔防", "升级树", "game", "gaming", "tower-defense"):
            self.assertNotIn(forbidden, (self.html + self.i18n).lower())
        self.assertRegex(
            self.html,
            r'id="hero-verified">0</strong>',
        )

    def test_social_preview_is_declared_and_present(self) -> None:
        expected = ROOT / "assets" / "img" / "architecture-history-og.png"
        self.assertTrue(expected.is_file(), expected)
        self.assertGreater(expected.stat().st_size, 10_000)
        payload = expected.read_bytes()
        self.assertEqual(payload[:8], b"\x89PNG\r\n\x1a\n")
        width, height = struct.unpack(">II", payload[16:24])
        self.assertEqual((width, height), (1200, 630))
        self.assertIn("architecture-history-og.png", self.html)

    def test_site_header_matches_qrost_research_shell(self) -> None:
        self.assertRegex(
            self.html,
            r'<a class="brand"[^>]*>Qrost</a>',
        )
        self.assertNotIn("brand-mark", self.html + self.css)
        for rule in (
            "width: min(72rem, 100%);",
            "min-height: 3.5rem;",
            "border-radius: 0.5rem;",
            "html.dark #theme-toggle .sun-icon",
        ):
            self.assertIn(rule, self.css)


if __name__ == "__main__":
    unittest.main()
