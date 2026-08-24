#!/usr/bin/env python3
"""Static contracts for CIS keyboard access, dialogs and candidate disclosure."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def require(text: str, token: str, label: str) -> None:
    assert token in text, f"{label}: missing {token!r}"


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    app = (ROOT / "assets" / "js" / "app.js").read_text(encoding="utf-8")
    css = (ROOT / "assets" / "css" / "industrial-software.css").read_text(encoding="utf-8")
    build = (ROOT / "tools" / "build.py").read_text(encoding="utf-8")

    require(html, 'id="catalog-search"', "catalog search")
    require(html, 'aria-label="搜索产品 / Search products"', "catalog accessible name")
    require(html, 'id="matrix-search"', "matrix search")
    require(html, 'aria-label="搜索能力矩阵 / Search capability matrix"', "matrix accessible name")

    assert app.count('class="catalog-open-detail') >= 2, "product/kernel names must be real buttons"
    require(app, "function showDialog", "dialog open focus")
    require(app, "function hideDialog", "dialog focus return")
    require(app, "function trapDialogFocus", "dialog focus trap")
    require(app, "const dialogStack", "topmost Escape handling")
    require(app, "if (e.key === 'Tab')", "dialog Tab handling")
    require(app, "if (e.key !== 'Escape') return", "dialog Escape handling")
    for dialog_id in ("product-modal", "kernel-modal", "policy-modal", "compare-modal"):
        require(html, f'id="{dialog_id}"', f"{dialog_id} exists")
        require(html, 'aria-modal="true"', f"{dialog_id} modal contract")

    require(app, "candidate: { zh: '候选线索'", "candidate evidence badge")
    require(app, 'data-candidate="${m.evidence_level === \'candidate\'}"', "candidate DOM marker")
    require(app, "p.verification_status === 'candidate'", "policy candidate marker")
    require(app, "sourceScopeLabel", "public support-scope label")
    require(app, "s.publisher || s.publisher_domain", "public publisher label")
    require(css, '.timeline-node[data-candidate="true"]', "candidate card style")
    require(css, ".badge-evidence-candidate", "candidate badge style")
    require(css, ":focus-visible", "visible keyboard focus")

    require(build, "def content_token", "content-hash cache token")
    require(build, "normalized_content", "cache hash cycle normalization")
    assert "datetime.now" not in build and "timezone.utc" not in build, "build must not use wall clock"

    print("test_page_contract: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
