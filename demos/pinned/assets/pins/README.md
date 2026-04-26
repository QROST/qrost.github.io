# Pin assets

Drop **PNG files** into this folder. Each file becomes a pin on the site.

## Naming convention

`<CATEGORY>_<label>.png`

- `CATEGORY` is one of: `LETTER`, `NUMBER`, `EMOJI`, `ICON`, `FLAG`, `SPORT`, `CAR`, `CUSTOM`
- `label` is a short human label (letters/numbers only; use `-` for spaces)

Examples:
- `LETTER_A.png`
- `EMOJI_heart.png`
- `FLAG_us.png`
- `CUSTOM_palm-tree.png`

## Rules

- **Transparent background** (PNG with alpha).
- **Square aspect** recommended (512×512 or larger).
- **White silhouette** with thick strokes works best — the site finishes them silver/gold/black/rose on the fly via CSS.
- Keep file size under 200 KB.

## Registration

The site reads `assets/pins/manifest.json` on load and lists every entry as a pin.
To add pins: drop PNGs here, then append entries to `manifest.json`:

```json
{ "id": "CUSTOM_palm", "category": "icons", "label": "palm", "file": "CUSTOM_palm.png", "price": 5 }
```
