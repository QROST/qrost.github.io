# Neon Abyss · 霓虹渊

The dance-floor sibling of [Data Abyss](../visual-page/) (`demos/visual-page/`).
Same chaotic-attractor cosmos, same data-driven self-organizing map — re-scored as
**138 BPM Trance / Progressive** with beat-synced bloom and strobe.

> 数据深渊的夜店变体。同一套混沌吸引子星海、同一份自组织神经地图，换上
> **138 BPM Trance / Progressive** 的生成配乐、节拍同步的辉光与频闪。

## What changed vs. Data Abyss

| | Data Abyss (`visual-page/`) | Neon Abyss (`neon-abyss/`) |
|---|---|---|
| **Music** | lo-fi hip-hop (76–87 BPM, Rhodes, boom-bap) | Trance / Progressive (138 BPM, four-on-the-floor, supersaw, sidechain) |
| **Pulse source** | microphone amplitude (`getUserMedia`) | generated audio engine's `beatPulse` (per-kick) |
| **Bloom** | none | `UnrealBloomPass` (desktop only; off on mobile) |
| **Beat-sync visuals** | — | camera shake, FOV punch, bloom-strength pulse, drop-section strobe |
| **Palette** | off-color, restrained | neon-saturated (magenta / cyan / lime / orange) |
| **Arrangement** | 4-bar phrases + sparse breakdown | 32-bar Trance structure (intro → build → drop → breakdown → loop) |
| **Mic / gyro** | mic rhythm mode + gyro nav | removed (pure generative music) |

The two projects are **fully independent forks** — editing one does not touch the other.
They share no code at runtime; the `demos/china-housing/assets/data/*.js` globals and
the Three.js importmap are the only cross-references (both read-only).

## Files

- `index.html` — page shell, meta, photosensitivity gate, importmap
- `app-club.js` — Three.js scene + SOM + attractors + bloom + beat-sync (forked from `visual-page/app.js`)
- `audio-club.js` — generative Trance engine + `beatPulse` output (rewritten from `visual-page/audio.js`)
- `style-club.css` — neon palette, weaker grain, tighter vignette, strobe + gate styles
- `i18n.js` — EN/中文 UI strings (forked, neon copy)
- `assets/og-image.png` — placeholder (reused from Data Abyss for now)

## Interaction

- **Tap / click anywhere** → enable sound (mobile autoplay policy requires a gesture).
- **`Motion & sound` button** → toggle sound on / mute.
- **Drag** → orbit · **pinch / wheel** → zoom · **click a star** → inspect its data.
- **Click the title** → cycle hidden / English / 中文.
- **`D` key** → toggle the data-layers panel.

## Photosensitivity warning

This experience contains **beat-synced strobing flashes** (drop section). A first-run
gate requires acknowledgment before the strobe runs. If you are sensitive to flashing
lights or have photosensitive epilepsy, **do not continue** past the gate — the "Leave"
link returns to the home page.

> 本作品含与节拍同步的频闪。光敏性癫痫或对闪光敏感者请勿通过警示门。

## Performance

- Bloom is **desktop-only** (`IS_MOBILE` → no `UnrealBloomPass`); mobile renders directly.
- Pixel ratio capped at 1.5 on mobile.
- The Trance engine runs ~7-voice supersaws + 16th-note arp + sidechain on the Web Audio
  graph — native nodes, low CPU on desktop; on mid-range mobile it is acceptable but the
  supersaw voice count can be lowered in `audio-club.js` (`_supersaw`, `v < 7`) if needed.

## Data

Reuses the same baked globals as Data Abyss, sourced from the sibling sub-sites:

- China housing (cities) — `../china-housing/assets/data/{listings,enriched,hazards}.js`
- Industrial software (products / kernels / milestones / policies / vendors) — `../china-industrial-software/assets/data/`
- Pharma (companies / sites / drugs / modalities) — `../pharm-companies/assets/data/`
- Shelter cats (cats / shelters) — `../shelter-cats/assets/data/`

None of those source files are modified by this project.

## Dev

Serve the repo root over HTTP (ES modules + classic data-globals require it):

```bash
cd /path/to/qrost.github.io
python3 -m http.server 8000
# open http://localhost:8000/demos/neon-abyss/
```

Add `?debug` to the URL for console diagnostics.
