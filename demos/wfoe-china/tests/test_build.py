"""Content-hash dependency and read-only drift checks, using disposable fixtures."""

from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location("wfoe_build", Path(__file__).resolve().parents[1] / "tools/build.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class AssetBuildTest(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        for asset in builder.STEP_DATA + builder.PAGE_ASSETS:
            path = self.root / asset
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('[{"title":"示例"}]' if asset.endswith(".json") else "/* fixture */", encoding="utf-8")
        (self.root / "assets/js/steps-render.js").write_text("\n".join(f"fetch('{asset}')" for asset in builder.STEP_DATA), encoding="utf-8")
        (self.root / "index.html").write_text("\n".join(f'<link href="{asset}?v=old">' for asset in builder.PAGE_ASSETS), encoding="utf-8")

    def run_build(self, check=False):
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            return builder.build(self.root, check=check)

    def snapshot(self):
        return {str(path.relative_to(self.root)): path.read_bytes() for path in self.root.rglob("*") if path.is_file()}

    def test_check_is_read_only_and_rebuild_is_idempotent(self):
        original = self.snapshot()
        self.assertEqual(self.run_build(check=True), 1)
        self.assertEqual(original, self.snapshot())
        self.assertEqual(self.run_build(), 0)
        generated = self.snapshot()
        self.assertEqual(self.run_build(check=True), 0)
        self.assertEqual(self.run_build(), 0)
        self.assertEqual(generated, self.snapshot())

    def test_step_change_propagates_to_renderer_and_page_only(self):
        self.run_build()
        original = self.snapshot()
        changed_asset = builder.STEP_DATA[0]
        (self.root / changed_asset).write_text('[{"title":"更新"}]', encoding="utf-8")
        self.assertEqual(self.run_build(check=True), 1)
        self.run_build()
        changed = {name for name, content in self.snapshot().items() if original[name] != content}
        self.assertEqual(changed, {changed_asset, "assets/js/steps-render.js", "index.html"})
        renderer = (self.root / "assets/js/steps-render.js").read_text(encoding="utf-8")
        page = (self.root / "index.html").read_text(encoding="utf-8")
        self.assertIn(changed_asset + "?v=" + builder.content_hash((self.root / changed_asset).read_bytes()), renderer)
        self.assertIn("assets/js/steps-render.js?v=" + builder.content_hash(renderer.encode("utf-8")), page)

    def test_css_and_js_changes_update_page_without_rewriting_renderer(self):
        self.run_build()
        for asset in ("assets/css/china-business.css", "assets/js/china-business.js"):
            before = self.snapshot()
            (self.root / asset).write_text("/* changed */", encoding="utf-8")
            self.assertEqual(self.run_build(check=True), 1)
            self.run_build()
            changed = {name for name, content in self.snapshot().items() if before[name] != content}
            self.assertEqual(changed, {asset, "index.html"})

    def test_missing_reference_fails_before_writing(self):
        (self.root / "index.html").write_text("<html></html>", encoding="utf-8")
        original = self.snapshot()
        with self.assertRaisesRegex(ValueError, "exactly one reference"):
            self.run_build()
        self.assertEqual(original, self.snapshot())


if __name__ == "__main__":
    unittest.main()
