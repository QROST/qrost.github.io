#!/usr/bin/env python3
"""Static UI contracts for responsive navigation, dialogs and fallbacks."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def require(text: str, token: str, label: str) -> None:
    assert token in text, f"{label}: missing {token!r}"


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "assets/css/china-auto.css").read_text(encoding="utf-8")
    built_css_path = ROOT / "assets/css/tailwind-built.css"
    app = (ROOT / "assets/js/app.js").read_text(encoding="utf-8")
    charts = (ROOT / "assets/js/charts.js").read_text(encoding="utf-8")
    loader = (ROOT / "assets/js/data-loader.js").read_text(encoding="utf-8")

    for token in ("auto-nav-links", "auto-nav-search", "auto-nav-controls"):
        require(html, token, "responsive nav")
    require(css, "@media (max-width: 900px)", "tablet nav")
    require(css, "@media (max-width: 520px)", "narrow nav")
    require(css, 'grid-template-areas: "brand controls" "links links" "search search"', "320px nav")

    require(html, 'aria-labelledby="city-modal-title"', "city dialog")
    require(html, 'aria-labelledby="org-modal-title"', "org dialog")
    require(app, 'id="city-modal-title"', "city dialog title")
    require(app, 'id="org-modal-title"', "org dialog title")
    require(app, "trapDialogFocus", "dialog focus trap")
    require(app, 'role="tab"', "dialog tabs")
    require(app, 'role="button" tabindex="0"', "keyboard table rows")

    require(app, "function verifiedOutputStat", "verified output partition")
    require(app, "function compareOutputCities", "evidence-aware output sort")
    require(app, "if (!!sa !== !!sb) return sa ? -1 : 1", "verified-first output sort")
    require(app, "raw candidate figures never determine an implicit ranking", "candidate output non-ranking")
    require(app, "confBadge(o.confidence)", "organization catalog confidence marker")
    require(app, 'data-candidate="', "candidate DOM contract")
    require(app, "h.confidence <= 0.5 ? ' ' + confBadge", "search result candidate marker")
    require(app, "confBadge((row.role || ent).confidence)", "city-role candidate marker")
    require(charts, "st && st.confidence <= 0.5 ? ' · ' + I18N.t('candidate')", "cluster tooltip candidate marker")
    require(html, 'data-i18n="thSupportScope"', "public source scope column")
    require(app, "(s.support_scope || {}).scope_zh", "public source scope rendering")
    require(html, 'data-i18n-aria-label="clusterGraphAria"', "cluster graph accessible label")
    require(app, "manufacturingRolesForCity: D.manufacturingRolesForCity", "manufacturing-role graph projection")
    require(app, "manufacturingCountForCity: D.manufacturingCountForCity", "manufacturing count projection")
    require(charts, "MANUFACTURING_ROLE_TYPES", "manufacturing role rendering")
    require(charts, "PLANT_FACILITY_TYPES", "plant-only facility rendering")
    require(loader, "f.operator_id && PLANT_FACILITY_TYPES[f.facility_type]", "plant-only organization count")
    require(charts, "r.confidence <= 0.5", "candidate manufacturing disclosure")
    require(charts, "window.innerWidth <= 520", "narrow graph label control")

    require(html, 'href="assets/css/tailwind-built.css?v=', "committed Tailwind CSS")
    assert "cdn.tailwindcss.com" not in html, "runtime Tailwind CDN must not be used"
    assert "CHINA_AUTO_TAILWIND_FAILED" not in html, "obsolete Tailwind fallback signal remains"
    assert "window.tailwind" not in app, "runtime Tailwind detection remains"
    assert built_css_path.exists() and built_css_path.stat().st_size > 1000, "committed Tailwind CSS is missing or empty"
    assert html.index("tailwind-built.css") < html.index("china-auto.css"), "custom CSS must load after Tailwind"
    require(html, "CHINA_AUTO_ECHARTS_FAILED", "ECharts failure signal")
    require(html, 'id="runtime-warning"', "visible runtime warning")
    require(app, "renderRuntimeFallbacks", "runtime fallback renderer")
    require(css, ".runtime-chart-fallback", "chart fallback style")

    print("test_page_contract: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
