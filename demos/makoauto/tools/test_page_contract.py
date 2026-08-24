#!/usr/bin/env python3
"""Static contract for prototype indexing, theme bootstrap and shared cache tokens."""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = sorted(ROOT.glob("*.html"))


def token(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


errors: list[str] = []
expected_i18n = token(ROOT / "shared" / "i18n.js")
expected_extended = token(ROOT / "shared" / "i18n-extended.js")

for page in PAGES:
    html = page.read_text(encoding="utf-8")
    canonical = "https://qrost.github.io/demos/makoauto/" + ("" if page.name == "index.html" else page.name)
    if f'<link rel="canonical" href="{canonical}"' not in html:
        errors.append(f"{page.name}: missing canonical {canonical}")
    if "localStorage.getItem('pinned_theme')" not in html or "document.documentElement.setAttribute('data-theme',t)" not in html:
        errors.append(f"{page.name}: missing head anti-FOUC theme bootstrap")
    robots = re.search(r'<meta name="robots" content="([^"]+)"', html)
    if page.name == "index.html":
        if robots and "noindex" in robots.group(1).lower():
            errors.append("index.html: landing must remain indexable")
    elif page.name == "admin.html":
        if not robots or robots.group(1).replace(" ", "").lower() != "noindex,nofollow":
            errors.append("admin.html: expected noindex,nofollow")
    elif not robots or robots.group(1).replace(" ", "").lower() != "noindex,follow":
        errors.append(f"{page.name}: expected noindex,follow")

    for match in re.finditer(r'shared/i18n\.js\?v=([^"\']+)', html):
        if match.group(1) != expected_i18n:
            errors.append(f"{page.name}: stale shared/i18n.js token {match.group(1)}")
    for match in re.finditer(r'shared/i18n-extended\.js\?v=([^"\']+)', html):
        if match.group(1) != expected_extended:
            errors.append(f"{page.name}: stale shared/i18n-extended.js token {match.group(1)}")

if len(PAGES) != 13:
    errors.append(f"expected 13 Makoauto pages, found {len(PAGES)}")

admin = (ROOT / "admin.html").read_text(encoding="utf-8")
for label in ("Bay location for ${v.pin_id}", "Stock quantity for ${v.pin_id}",
              "Reorder threshold for ${v.pin_id}", "Save inventory for ${v.pin_id}"):
    if f'aria-label="{label}' not in admin:
        errors.append(f"admin.html: dynamic inventory control lacks {label!r} accessible name")

preview = (ROOT / "preview.html").read_text(encoding="utf-8")
if '<button type="button" class="scene-tile' not in preview or 'aria-pressed="true"' not in preview:
    errors.append("preview.html: scene choices are not semantic toggle buttons")
if '`<button type="button" class="cc ' not in preview or 'aria-labelledby="color-label"' not in preview:
    errors.append("preview.html: color choices are not named semantic buttons")
if "ch.setAttribute('aria-pressed', String(active))" not in preview:
    errors.append("preview.html: color selection does not update aria-pressed")

cart = (ROOT / "cart.html").read_text(encoding="utf-8")
for field_id, autocomplete in (
    ("ship-name", "shipping name"), ("ship-email", "email"), ("ship-phone", "shipping tel"),
    ("ship-address", "shipping street-address"), ("ship-city", "shipping address-level2"),
    ("ship-state", "shipping address-level1"), ("ship-postal", "shipping postal-code"),
):
    if not re.search(rf'<input[^>]*id="{field_id}"[^>]*autocomplete="{autocomplete}"', cart):
        errors.append(f"cart.html: {field_id} missing precise autofill token {autocomplete!r}")
if "document.getElementById('ship-email').value" not in cart:
    errors.append("cart.html: checkout still ignores the autofilled email field")

designer = (ROOT / "designer.html").read_text(encoding="utf-8")
if '<button type="button" class="pin-item"' not in designer:
    errors.append("designer.html: pin choices are not semantic keyboard controls")
if 'aria-pressed="${state.keyboardPinId === p.id}"' not in designer:
    errors.append("designer.html: pin selection does not expose its pressed state")
if "selectForPlacement(true)" not in designer:
    errors.append("designer.html: pin choices lack an explicit Enter/Space selection path")
if "el.addEventListener('keydown', (e) =>" not in designer or "placeSelectedPin(e)" not in designer:
    errors.append("designer.html: frame holes lack Enter/Space placement")
if '<button type="button" class="color-chip' not in designer or "document.querySelectorAll('#frame-color-row [data-frame-color]')" not in designer or "c.setAttribute('aria-pressed', String(active))" not in designer:
    errors.append("designer.html: frame colors are not semantic named toggles")
if '<button type="button" class="finish-chip ' not in designer:
    errors.append("designer.html: finish choices are not semantic buttons")

if '<a href="#overview" data-section="overview"' not in admin:
    errors.append("admin.html: section navigation is not keyboard-addressable")
if '<button type="button" class="design-card"' not in admin:
    errors.append("admin.html: design cards are not semantic buttons")

if errors:
    print("FAIL")
    for error in errors:
        print(" -", error)
    raise SystemExit(1)
print(f"OK: {len(PAGES)} pages; landing indexable, 12 prototype pages bounded, cache tokens current")
