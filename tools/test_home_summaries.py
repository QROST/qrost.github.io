#!/usr/bin/env python3
"""Exercise homepage summary generation in isolated, mutable checkout fixtures."""

import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECTIONS = ("index.html", "assets/js/home-i18n.js", "README.md")
MANIFESTS = {
    module: f"demos/{module}/assets/data/manifest.json"
    for module in ("architecture-history", "china-auto")
}


class HomeSummariesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in (*PROJECTIONS, "assets/css/home-built.css", "tools/build.py",
                     "tools/home_summaries.py", *MANIFESTS.values()):
            destination = self.root / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, destination)
        self.build()

    def build(self, check=False, succeeds=True):
        result = subprocess.run(
            [sys.executable, str(self.root / "tools/build.py"), *( ["--check"] if check else [])],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode == 0, succeeds, result.stdout + result.stderr)
        return result

    def snapshot(self):
        return {str(path.relative_to(self.root)): (path.read_bytes(), path.stat().st_mtime_ns)
                for path in self.root.rglob("*") if path.is_file()}

    def text(self, name):
        return (self.root / name).read_text(encoding="utf-8")

    def write(self, name, text):
        (self.root / name).write_text(text, encoding="utf-8")

    def update_counts(self, module, **counts):
        name = MANIFESTS[module]
        value = json.loads(self.text(name))
        value["counts"].update(counts)
        self.write(name, json.dumps(value, ensure_ascii=False))

    def test_manifest_changes_update_all_projections_and_content_hash(self):
        self.update_counts("architecture-history", works=1234, people=2345, practices=34,
                           places=45, verified_entities_and_relations=56)
        self.update_counts("china-auto", cities=67, core_cities=40, specialist_cities=27,
                           organizations=89, facilities=90, media=12)
        manifests_before = {name: (self.root / name).read_bytes() for name in MANIFESTS.values()}
        self.build(check=True, succeeds=False)
        self.build()
        for name in PROJECTIONS:
            content = self.text(name)
            for expected in ("1,234 revision-pinned works, 2,345 people, 34 practices and 45 places",
                             "56 verified entity/relationship records", "40 core + 27 specialist",
                             "89 organizations", "90 facility records"):
                self.assertIn(expected, content, name)
        translations = self.text("assets/js/home-i18n.js")
        self.assertIn("1,234 件固定修订作品、2,345 位人物、34 家事务所与 45 个地点", translations)
        self.assertIn("已核验 56 条实体/关系记录", translations)
        self.assertIn("67 座汽车城市（40 核心 + 27 专业）、89 家机构与 90 条设施记录", translations)
        self.assertIn("12 auto media titles", self.text("README.md"))
        self.assertNotIn("56 verified people", translations)
        digest = hashlib.sha1((self.root / "assets/js/home-i18n.js").read_bytes()).hexdigest()[:10]
        self.assertIn(f'assets/js/home-i18n.js?v={digest}"', self.text("index.html"))
        self.assertEqual(manifests_before, {name: (self.root / name).read_bytes() for name in MANIFESTS.values()})
        self.build(check=True)

    def test_each_projection_and_language_drift_is_rejected_read_only(self):
        cases = (
            ("index.html", r'(data-i18n="cardArchitectureDesc"[^>]*>\s*)'),
            ("index.html", r'(data-i18n="cardAutoDesc"[^>]*>\s*)'),
            ("assets/js/home-i18n.js", r'(cardArchitectureDesc: \{\s*en: ")'),
            ("assets/js/home-i18n.js", r'(cardArchitectureDesc: \{[^}]*zh: ")'),
            ("assets/js/home-i18n.js", r'(cardAutoDesc: \{\s*en: ")'),
            ("assets/js/home-i18n.js", r'(cardAutoDesc: \{[^}]*zh: ")'),
            ("README.md", r'(- `demos/architecture-history/` — )'),
            ("README.md", r'(- `demos/china-auto/` — )'),
        )
        for name, pattern in cases:
            with self.subTest(name=name, pattern=pattern):
                changed, count = re.subn(pattern, r'\g<1>STALE ', self.text(name))
                self.assertEqual(count, 1)
                self.write(name, changed)
                if name.endswith(".js"):
                    # Even a token matching the stale JS must not conceal summary drift.
                    digest = hashlib.sha1((self.root / name).read_bytes()).hexdigest()[:10]
                    self.write("index.html", re.sub(r'assets/js/home-i18n.js\?v=[^"]+',
                                                    f'assets/js/home-i18n.js?v={digest}',
                                                    self.text("index.html")))
                before = self.snapshot()
                result = self.build(check=True, succeeds=False)
                self.assertIn(name, result.stderr)
                self.assertEqual(before, self.snapshot())
                self.build()

    def test_clean_check_is_read_only_and_build_is_idempotent(self):
        before = self.snapshot()
        self.build(check=True)
        self.assertEqual(before, self.snapshot())
        self.build()
        self.assertEqual(before, self.snapshot())
        self.assertFalse((self.root / "tools/__pycache__").exists())

    def test_invalid_count_fails_before_writing_any_projection(self):
        for value in (-1, True, None, "128"):
            with self.subTest(value=value):
                self.update_counts("china-auto", facilities=value)
                before = self.snapshot()
                result = self.build(succeeds=False)
                self.assertIn("counts.facilities must be a nonnegative integer", result.stderr)
                self.assertEqual(before, self.snapshot())

    def test_missing_projection_fails_without_partial_writes(self):
        self.write("README.md", self.text("README.md").replace("`demos/china-auto/`", "`missing-auto/`", 1))
        self.update_counts("architecture-history", works=123456)
        before = self.snapshot()
        self.build(succeeds=False)
        self.assertEqual(before, self.snapshot())


if __name__ == "__main__":
    unittest.main()
