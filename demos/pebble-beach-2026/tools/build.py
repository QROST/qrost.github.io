#!/usr/bin/env python3
"""Refresh content hashes and validate the Pebble Beach 2026 historical archive."""

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
        self.elements: list[tuple[str, dict[str, str]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        self.elements.append((tag, data))
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
    demo_css = (DEMO_DIR / "assets/css/pebble-beach.css").read_text(encoding="utf-8")

    for public_name, public_text in (
        ("index.html", html),
        ("assets/js/data.js", data_js),
        ("assets/js/app.js", app_js),
        ("assets/css/pebble-beach.css", demo_css),
    ):
        if "chatgpt.com/c/" in public_text:
            errors.append(f"private ChatGPT conversation URL leaked into {public_name}")

    check_tokens(errors, html, DEMO_DIR, DEMO_ASSETS)
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

    if "demos/pebble-beach-2027/index.html" not in home:
        errors.append("homepage current card for pebble-beach-2027 is missing")
    if "demos/pebble-beach-2026/index.html" in home:
        errors.append("homepage must not duplicate the 2026 archive as a current demo")
    archive_contract = {
        'class="archive-edition-banner"': "archive edition banner",
        'data-i18n="archiveBannerLabel"': "archive label",
        'data-i18n="archiveBannerBody"': "archive boundary",
        'data-i18n-aria-label="archiveBannerAria"': "bilingual archive-banner accessible label",
        'href="../pebble-beach-2027/"': "2027 planning-shell link",
    }
    for snippet, label in archive_contract.items():
        if html.count(snippet) != 1:
            errors.append(f"expected exactly one {label}, found {html.count(snippet)}")
    if "const ARCHIVE_REFERENCE_DATE = '2026-08-18';" not in app_js:
        errors.append("archive mode must use a fixed post-event reference date")
    for forbidden_clock_token in ("demoDate", "demoTime", "URLSearchParams", "new Date(", "setInterval("):
        if forbidden_clock_token in app_js:
            errors.append(f"archive mode must not use visitor-time or simulation token: {forbidden_clock_token}")
    tour_contract = {
        'id="tour-nav-link" class="archive-nav-link" href="#tour-0813"': "archived Tour navigation anchor",
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
    if not re.search(r"function\s+renderDynamicContent\(\)\s*\{\s*renderQuickPlan\(\);\s*renderScheduleFilters\(\);\s*renderSchedule\(\);\s*renderTourMorning\(\);", app_js):
        errors.append("renderDynamicContent must invoke renderTourMorning")
    if "tourNav.classList.add('archive-nav-link')" not in app_js or "const navKey = 'navTourArchive'" not in app_js:
        errors.append("Tour navigation must retain its chronological position with a permanent archive label")
    parking_map_contract = {
        'href="#parking-traffic"': "parking-map navigation anchor",
        'id="parking-traffic"': "parking-map section",
        'id="parking-tab-geographic"': "geographic-guide tab",
        'id="parking-tab-official"': "official-diagram tab",
        'id="parking-panel-geographic"': "geographic-guide panel",
        'id="parking-panel-official"': "official-diagram panel",
        'id="parking-geographic-map"': "geographic-guide Leaflet root",
        'id="parking-geographic-list"': "geographic-guide accessible list",
        'id="parking-geographic-status"': "geographic-guide live status",
        'id="parking-geographic-touch-toggle"': "geographic-guide touch control",
        'id="parking-geographic-reset"': "geographic-guide reset control",
        'id="parking-geographic-caveat"': "geographic-guide caveat",
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
        "parking-geographic-map",
        "parking-geographic-list",
        "parking-geographic-status",
        "parking-geographic-touch-toggle",
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
        "renderParkingViewTabs",
        "renderParkingGeographicList",
        "ensureParkingGeographicMap",
        "syncParkingGeographicMap",
        "renderParkingTrafficControls",
        "renderParkingTrafficList",
        "ensureParkingTrafficMap",
        "syncParkingTrafficMap",
        "clearParkingGeographicTileError",
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
    geographic_renderer_match = re.search(
        r"function\s+parkingGeographicOsmUrl\(anchor\)(.*?)function\s+stopPopupHtml\(stop, place\)",
        app_js,
        re.DOTALL,
    )
    if not geographic_renderer_match:
        errors.append("geographic-guide renderer block is missing")
    else:
        geographic_renderer = geographic_renderer_match.group(1)
        for required in (
            "window.L.tileLayer",
            "attributionControl: true",
            "window.L.circle(",
            "window.L.circleMarker(",
            "parkingViewState.active !== 'geographic'",
        ):
            if required not in geographic_renderer:
                errors.append(f"geographic-guide renderer must use {required}")
        for forbidden in (
            "window.L.CRS.Simple",
            "window.L.imageOverlay",
            "parkingDiagramLatLng",
            "mapX",
            "mapY",
            "window.L.polyline",
            "OSRM",
            "mlat=",
            "mlon=",
        ):
            if forbidden in geographic_renderer:
                errors.append(f"geographic-guide renderer must not use {forbidden}")
    if html.count('role="tab"') < 2 or html.count('role="tabpanel"') < 2:
        errors.append("parking views must expose two accessible tabs and two tab panels")
    if html.count('class="parking-map-list-item kind-') != 5:
        errors.append("no-JavaScript geographic fallback must preserve all five orientation anchors")
    if re.search(r'id="parking-panel-official"[^>]*\shidden(?:\s|>)', html):
        errors.append("no-JavaScript fallback must keep the official diagram panel visible")
    for tab_id, panel_id in (
        ("parking-tab-geographic", "parking-panel-geographic"),
        ("parking-tab-official", "parking-panel-official"),
    ):
        if f'id="{tab_id}"' not in html or f'aria-controls="{panel_id}"' not in html:
            errors.append(f"parking tab {tab_id} must control {panel_id}")
        if f'id="{panel_id}"' not in html or f'aria-labelledby="{tab_id}"' not in html:
            errors.append(f"parking panel {panel_id} must be labelled by {tab_id}")
    official_parking_svg = DEMO_DIR / "assets/img/parking-traffic-map-2026.svg"
    if not official_parking_svg.exists():
        errors.append("vendored official parking SVG is missing")
    elif 'viewBox="0 0 792 612"' not in official_parking_svg.read_text(encoding="utf-8"):
        errors.append("vendored official parking SVG has the wrong viewBox")
    if html.count('src="assets/img/parking-traffic-map-2026.svg"') != 1:
        errors.append("static parking-map fallback must use the vendored official SVG exactly once")
    for stale_copy in ("georeferenced", "公开地理资料配准"):
        if stale_copy in html or stale_copy in data_js:
            errors.append(f"parking-map copy must not claim false geographic alignment: {stale_copy}")
    official_parking_pdf = "https://www.pebblebeachconcours.net/wp-content/uploads/2026/07/01a_Parking-and-Traffic-Flow-THUR-SUN_LotsOnly.pdf"
    if html.count(official_parking_pdf) != 3:
        errors.append("geographic boundary, diagram fallback and source bar must all link the official PDF")
    brand_house_contract = {
        'href="#brand-houses"': "brand-house navigation anchor",
        'id="brand-houses"': "brand-house section",
        'id="brand-house-grid"': "brand-house renderer root",
        'id="brand-house-title"': "brand-house accessible heading",
    }
    for snippet, label in brand_house_contract.items():
        if html.count(snippet) != 1:
            errors.append(f"expected exactly one {label}, found {html.count(snippet)}")
    if html.count('data-brand-entry=') != 13:
        errors.append("static brand chapter must preserve four public drives and nine hospitality entries")
    if html.count('data-brand-detail-id=') != 13:
        errors.append("every static brand entry must be a compact details disclosure")
    if html.count('class="brand-house-lane ') != 2:
        errors.append("static brand chapter must preserve separate public-drive and hospitality lanes")
    if html.count('data-brand-lane-fold="house-hospitality"') != 1:
        errors.append("static hospitality lane must be a single second-level disclosure")
    if html.count('data-brand-guide-notes') != 1:
        errors.append("static parking, safety and evidence guidance must be folded once")
    if html.count('data-active-collapsible') != 1:
        errors.append("active brand chapter must expose one user-controlled chapter fold")
    brand_entry_ids = (
        "cadillac-v-series", "mercedes-benz-drive", "lexus-drive", "lucid-drive",
        "bentley-home", "lamborghini-villa", "range-rover-residence", "bmw-villa",
        "bugatti-le-domaine", "aston-martin-house", "mclaren-event",
        "rolls-royce-event", "koenigsegg-private",
    )
    for entry_id in brand_entry_ids:
        if html.count(f'id="brand-{entry_id}"') != 1 or html.count(f'data-brand-entry="{entry_id}"') != 1:
            errors.append(f"static brand entry {entry_id} must have one stable deep-link id and one data marker")
    for source_url in (
        "https://www.pebblebeachconcours.net/event/cadillac-v-series-drive-experience/",
        "https://www.mbusa.com/en/events-and-partnerships/pebble-beach",
        "https://bentleyexperiences.com/",
        "https://eventsala.com/products/monterey-car-week-2026",
        "https://eventsala.com/pages/monterey-car-week-2026-faq",
        "https://www.rsvprangerover.com/residence/packagedetails.aspx",
        "https://newsroom.bugatti.com/press-releases/the-bugatti-destrier-a-sculpture-of-speed",
        "https://www.countyofmonterey.gov/home/showpublisheddocument/146630/639168767873630000",
        "https://www.countyofmonterey.gov/government/departments-a-h/housing-community-development/permit-center/special-events-getting-started",
        "https://media.astonmartin.com/vanquish-25-a-celebration-of-an-automotive-flagship/?lang=eng",
        "https://www.pebblebeachconcours.net/displays-and-ride-amp-drive-schedule/",
    ):
        if source_url not in html:
            errors.append(f"static brand-house fallback is missing verification source: {source_url}")
    if app_js.count("getElementById('brand-house-grid')") != 1:
        errors.append("brand-house renderer must bind brand-house-grid exactly once")
    if len(re.findall(r"function\s+renderBrandHouses\(\)", app_js)) != 1:
        errors.append("expected exactly one renderBrandHouses implementation")
    for snippet, label in (
        ("data-brand-past-group", "per-lane ended-program disclosure"),
        ("statusWithCount('brandHousePastSummary'", "localized ended-program count"),
        ("data-brand-detail-id", "per-program compact disclosure"),
        ("data-brand-evidence-id", "nested evidence disclosure"),
        ("data-brand-lane-fold", "second-level hospitality disclosure"),
        ("data-brand-guide-notes", "folded parking and evidence guidance"),
        ("brand-house-directory-note", "official display-directory note"),
        ("guide.directorySource", "official display-directory source"),
        ("guide.permitProcessSource", "county agenda-versus-permit boundary source"),
    ):
        if snippet not in app_js:
            errors.append(f"brand-house renderer is missing {label}")
    if not re.search(r"const\s+publicCard\s*=\s*\(card\)[\s\S]{0,1200}return\s+`<details", app_js):
        errors.append("brand-house renderer must use compact details for public programs")
    if not re.search(r"if\s*\(targetInside\)\s*setTemporalOpen\(details,\s*true\);\s*else if\s*\(temporalUserOpen\.has\(section\.id\)\)", app_js):
        errors.append("active chapter fold must prioritize explicit deep links, then preserve the user's open or closed state")
    if not re.search(r"if\s*\(!hasHandledInitialHash\)[\s\S]{0,160}revealHashTarget\(true\)", app_js):
        errors.append("language rerenders must not reopen a chapter that the user explicitly folded")
    if not re.search(r"renderTourMorning\(\);\s*renderParkingTraffic\(\);\s*renderBrandHouses\(\);", app_js):
        errors.append("renderDynamicContent must render Tour, parking and brand content after the archived plans")

    section_order = (
        "quick-plan",
        "schedule",
        "tour-0813",
        "parking-traffic",
        "brand-houses",
        "nearby",
        "stay",
        "commute",
        "sources",
    )
    section_positions = [html.find(f'id="{section_id}"') for section_id in section_order]
    if any(position < 0 for position in section_positions) or section_positions != sorted(section_positions):
        errors.append("page sections must keep the audited archive reading order")

    nav_match = re.search(r'<div[^>]*\bclass="nav-links"[^>]*>(.*?)</div>', html, re.DOTALL)
    expected_nav_targets = ["quick-plan", "schedule", "tour-0813", "parking-traffic", "brand-houses", "stay", "commute"]
    nav_targets = re.findall(r'href="#([^"]+)"', nav_match.group(1)) if nav_match else []
    if nav_targets != expected_nav_targets:
        errors.append(f"navigation targets must follow page order, found {nav_targets}")
    if 'id="section-nav-toggle"' not in html or 'aria-controls="primary-nav-links"' not in html or 'id="primary-nav-links"' not in html:
        errors.append("mobile section navigation must expose one labelled menu button and controlled link panel")
    if not all(token in app_js for token in ("state.navMenuOpen", "updateSectionNavUi()", "focusFragmentTarget(link.hash)", "event.key !== 'Escape'", "classList.add('nav-ready')")):
        errors.append("mobile section navigation must retain state, manage focus, close on Escape, and update its accessible label")
    if not all(token in demo_css for token in (".icon-button.section-nav-toggle { display: none; }", ".nav-ready .nav-links { display: none; }", ".nav-ready .nav-links.is-open { display: grid; }")):
        errors.append("mobile section navigation must remain usable without JavaScript and compact after initialization")

    if html.count('class="filter-more"') != 1 or html.count('data-i18n="archiveFilters"') != 1:
        errors.append("secondary day/place/price filters must use one compact disclosure")
    if "moreSummary.dataset.activeFilters" not in app_js or ".filter-more > summary.has-active-filters" not in demo_css:
        errors.append("the compact filter disclosure must expose active hidden filters")
    if not re.search(r"\.filter-button\s*\{[^}]*min-height:\s*44px", demo_css, re.DOTALL):
        errors.append("schedule filter buttons must retain a 44px touch target")
    if html.count('id="live-status"') != 1 or 'id="schedule-status"' in html:
        errors.append("schedule filtering must expose exactly one accessible status region")
    if len(re.findall(r"function\s+splitChronologicalEntries\(", app_js)) != 1:
        errors.append("chronological split helper must be defined exactly once")
    if app_js.count("chronologicalFoldMarkup(archiveMarkup, later.map") != 2:
        errors.append("quick plan and schedule must both render the archived prefix before any later dates")
    if app_js.count('data-date-start=') != 2 or app_js.count('data-date-end=') != 2:
        errors.append("both past-date disclosures must expose their chronological range")
    if "sortEventsChronologically(filtered.filter" not in app_js:
        errors.append("same-day event cards must be sorted by their earliest parsed start time")
    if "sortEventsChronologically(item.schedule)" not in app_js:
        errors.append("quick-plan detail timelines must keep the same chronological reading direction")
    if 'data-date="${escapeHtml(dateIso)}"' not in app_js or 'data-date="${escapeHtml(day.id)}"' not in app_js:
        errors.append("rendered quick-plan cards and schedule day groups must expose semantic ISO dates")
    if not all(token in app_js for token in ("state.quickPastOpen", "state.schedulePastOpen", "data-past-group")):
        errors.append("quick-plan and schedule past disclosures must preserve independent user state")
    for stale_focus in ("dayButton.focus()", "typeButton.focus()", "modeButton.focus()", "areaButton.focus()"):
        if stale_focus in app_js:
            errors.append(f"filter rerender must not focus a detached control: {stale_focus}")
    if app_js.count("focusRenderedFilter(") != 4:
        errors.append("all three regenerated archive filter groups must restore focus through the shared helper")
    id_counts: dict[str, int] = {}
    for _, attrs in parser.elements:
        element_id = attrs.get("id")
        if element_id:
            id_counts[element_id] = id_counts.get(element_id, 0) + 1
    for link in parser.links:
        href = link.get("href", "")
        if href.startswith("#") and len(href) > 1:
            target = href[1:]
            if id_counts.get(target, 0) != 1:
                errors.append(f"internal navigation target #{target} must resolve exactly once")
    if html.count('id="back-to-top"') != 1 or html.count('href="#page-top"') != 1 or html.count('<body id="page-top">') != 1:
        errors.append("back-to-top control must resolve to the unique page-top target")
    hero_primary = re.search(r'<a[^>]*id="hero-primary-cta"[^>]*href="([^"]+)"[^>]*>', html)
    hero_secondary = re.search(r'<a[^>]*id="hero-secondary-cta"[^>]*href="([^"]+)"[^>]*>', html)
    if not hero_primary or not hero_secondary or hero_primary.group(1) == hero_secondary.group(1):
        errors.append("hero fallback CTAs must have stable IDs and distinct chapter destinations")
    if not all(token in app_js for token in (
        "item.id === 'archive'", "DATA.heroActions || []", "action.primary.href !== action.secondary.href",
        "setHeroAction(primary, action.primary)", "setHeroAction(secondary, action.secondary)",
        "activateHeroIntent(link.getAttribute('data-hero-intent'))", "focusFragmentTarget(link.hash)",
    )):
        errors.append("hero CTAs must use the archive action, explicit intents and destination focus")
    if not all(token in app_js for token in (
        "state.day = 'all'", "state.area = 'all'", "state.type = 'all'",
        "state.schedulePastOpen = intent === 'schedule-archive'", "state.quickPastOpen = true",
    )):
        errors.append("hero schedule/archive intents must deliberately reset filters and reveal requested archives")
    for section_id, through_date, label_key in (
        ("tour-0813", "2026-08-13", "temporalTourLabel"),
        ("parking-traffic", "2026-08-16", "temporalParkingLabel"),
        ("brand-houses", "2026-08-16", "temporalBrandLabel"),
        ("nearby", "2026-08-02", "temporalNearbyLabel"),
        ("stay", "2026-08-17", "temporalStayLabel"),
    ):
        pattern = rf'<section[^>]*id="{re.escape(section_id)}"[^>]*data-temporal-section[^>]*data-through-date="{through_date}"[^>]*data-temporal-label-key="{label_key}"'
        if not re.search(pattern, html):
            errors.append(f"temporal section contract is missing for {section_id}")
    if html.count('data-temporal-details open') != 5:
        errors.append("all five temporal sections must remain open in the no-JavaScript fallback")
    if html.count('data-temporal-summary') != 5:
        errors.append("all five temporal sections must expose a summary label")
    for function_name in ("applyTemporalSections", "updateHeroCtas", "revealHashTarget"):
        if len(re.findall(rf"function\s+{function_name}\([^)]*\)", app_js)) != 1:
            errors.append(f"expected exactly one {function_name} implementation")
    for forbidden_live_control in ('data-live-mode', 'live-clock-value', 'live-past-toggle'):
        if forbidden_live_control in html or forbidden_live_control in app_js:
            errors.append(f"archived schedule must not expose live control: {forbidden_live_control}")
    if not all(token in demo_css for token in (
        "html:not(.nav-ready) .parking-view-tabs", "html:not(.nav-ready) .parking-geographic-map-actions", "html:not(.nav-ready) .parking-map-toolbar",
    )):
        errors.append("map-only controls must be hidden when JavaScript is unavailable")
    if "target.scrollIntoView" not in app_js:
        errors.append("explicit archive hashes must reveal and scroll to their rendered target")
    if "target instanceof HTMLDetailsElement" not in app_js:
        errors.append("deep links to a brand-house disclosure must open the target details element")
    if ".temporal-section.is-past > .section-heading" not in demo_css:
        errors.append("expired feature headings must compact so they do not dominate the archive")
    for date in range(13, 18):
        if f"2026-08-{date:02d}" not in data_js:
            errors.append(f"data is missing 2026-08-{date:02d}")
    event_count = len(re.findall(r"area:\s*'[a-z0-9]+'\s*,\s*date:\s*'2026-08-", data_js))
    if event_count < 18:
        errors.append(f"expected at least 18 event records, found {event_count}")
    if "saturdaySpotlightsChecked: '2026-08-13'" not in data_js:
        errors.append("Saturday spotlight recheck marker is missing")
    if "brandHouseReportsChecked: '2026-08-14'" not in data_js:
        errors.append("brand-house recheck marker is missing")
    if "event.verifiedOn" not in app_js or "ui('verified')" not in app_js:
        errors.append("event cards must render the per-event verification marker")

    forbidden = ("/users/",)
    private_address_pattern = re.compile(
        r"(?:\b\d{1,5}\s+(?:poppy|cypress|spindrift)(?:\s+(?:lane|drive|road))?\b|\b(?:poppy|cypress|spindrift)(?:\s+(?:lane|drive|road))?\s*(?:#|no\.?|number|号)?\s*\d{1,5}\b)",
        re.IGNORECASE,
    )
    for path in DEMO_DIR.rglob("*"):
        if path.suffix.lower() not in {".html", ".js", ".css", ".svg"}:
            continue
        lowered = path.read_text(encoding="utf-8").lower()
        for phrase in forbidden:
            if phrase in lowered:
                errors.append(f"private/source-project phrase found in {path.relative_to(REPO_ROOT)}: {phrase}")
        if private_address_pattern.search(lowered):
            errors.append(f"private residential brand-house number found in {path.relative_to(REPO_ROOT)}")

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
    print("Pebble Beach 2026 historical archive validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
