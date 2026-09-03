#!/usr/bin/env python3
"""Static UI contracts for responsive navigation, dialogs and fallbacks."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def require(text: str, token: str, label: str) -> None:
    assert token in text, f"{label}: missing {token!r}"


def fact_scope_values() -> set[str]:
    enrichment = json.loads(
        (ROOT / "assets/data/org-enrichment.json").read_text(encoding="utf-8")
    )["enrichment"]
    values: set[str] = set()
    for record in enrichment.values():
        for field in ("founded", "ownership_evidence", "listing", "employees", "vehicle_sales"):
            fact = record.get(field)
            if not isinstance(fact, dict):
                continue
            for scope_key in ("scope", "scope_quality"):
                scope = fact.get(scope_key)
                if isinstance(scope, str) and scope:
                    values.add(scope)
    return values


def fact_scope_labels(app: str) -> dict[str, list[str]]:
    match = re.search(r"var FACT_SCOPE_LABELS = (\{.*?\n  \});", app, re.DOTALL)
    assert match, "fact scope localization: FACT_SCOPE_LABELS JSON object is missing"
    labels = json.loads(match.group(1))
    for scope, localized in labels.items():
        assert (
            isinstance(localized, list)
            and len(localized) == 2
            and all(isinstance(label, str) and label.strip() for label in localized)
        ), f"fact scope localization: {scope!r} must have non-empty zh/en labels"
    return labels


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
    require(loader, "candidatePlantCityOrg", "candidate manufacturing-site de-duplication")
    require(loader, "plantCountDetail", "explicit and candidate plant breakdown")
    require(app, "function availabilityOf", "field availability semantics")
    require(app, "statusNotSeparatelyListed", "exact-entity listing status")
    require(app, "function parentContext", "labeled parent-scope fallback")
    require(app, "function ownershipContext", "verified parent ownership fallback")
    require(app, "function plantCell", "plant count detail rendering")
    require(app, "function familyPlantDetail", "subsidiary plant aggregation")
    require(app, "scopeKey: kids.length ? 'childrenScope'", "subsidiary plant-scope labeling")
    require(app, "d.verified + '+' + d.candidate", "candidate plant-count disclosure")
    require(app, "if (status !== 'verified') value += '<br>' + statusCell(status, o, 'plants')", "audited plant-count disclosure")
    require(app, "function fieldReview", "field-level audit receipt")
    require(app, "function orgAuditHtml", "visible six-field audit record")
    require(app, "function statFieldCell", "city-stat field availability")
    require(app, "function statReviewHtml", "city-stat audit explanation")
    require(app, "audit_boundary_zh", "entity audit boundary disclosure")
    require(charts, "operator_legal_name_en_is_translation", "graph working-translation disclosure")
    require(loader, "f.status === 'active' && f.confidence > 0.5 && (f.source_ids || []).length", "status-aware facility candidate accounting")
    require(loader, "RETIRED_PLANT_STATUS[f.status]", "retired plant exclusion")
    require(app, "m.qualifier === 'approximately'", "approximate metric disclosure")
    require(app, "function factContext", "metric scope and note disclosure")
    scope_labels = fact_scope_labels(app)
    missing_scopes = sorted(fact_scope_values() - set(scope_labels))
    assert not missing_scopes, f"fact scope localization: missing zh/en labels for {missing_scopes}"
    require(app, "I18N.isEn() ? value.note_en : value.note_zh", "strict-language fact notes")
    assert "String(scope || '').replace(/_/g, ' ')" not in app, "raw fact scope fallback must not be exposed"
    require(app, "e.target.closest('a, button, input, select, textarea')", "evidence-link row-click isolation")
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
