# Pin assets (manifest-only listing)

Pins **sold in the designer** come **only** from `manifest.json`: each row must reference a **`file`** that resolves to a **`.png`** under this folder (`assets/pins/`). There are no baked-in emoji / SVG / glyph-only pins anymore—add or remove PNGs and edit `manifest.json` to change the live catalog.

## Naming convention

Use clear filenames and stable `id` values:

`<CATEGORY>_<label>.png`

- Prefer `CUSTOM_`, `LETTER_`, `NUMBER_`, etc. as file prefixes when it helps browsing.
- `manifest.json` `id` is what placements and presets use (`L_A`, `N_7`, `I_snoopy_chr_1`, …).

## Manifest fields

Minimal row (category + label inferred from `id` if omitted):

```json
{ "id": "L_A", "file": "Black Border Letter A.png" }
```

Full row:

```json
{
  "id": "CUSTOM_palm",
  "category": "icons",
  "label": "palm",
  "file": "CUSTOM_palm.png",
  "price": 5,
  "glyph": ""
}
```

- **`category`**: UI tab filter (`letters`, `numbers`, `icons`, …). Omit for `L_`/`N_` ids and defaults are inferred.
- **`glyph`**: optional; used only for search text. Raster art does not depend on it.
- **Non-`.png` `file` values are skipped** when the catalog loads.

## Rules

- **Transparent background** (PNG with alpha).
- Prefer square art (512×512 or larger works well).

## Registration workflow

1. Drop new `.png` files into this folder.
2. Append a row to `manifest.json`.
3. Hard-refresh or bump `shared/pins.js` query string cache if you aggressively cache JS.
