# shelter-cats source adapters

Each adapter yields `(NormalizedShelter, [NormalizedCat])`; `manage.py` stays
source-agnostic. **Safety stance:** documented JSON APIs (Socrata, ShelterLuv,
RescueGroups) are *called* (throttled + cached + honest UA via `crawl/http.py`);
`robots.txt` is strictly enforced only for HTML-crawl adapters. We do **not** scrape
sources whose robots/ToS forbid it (e.g. **PetHarbor** `Disallow: /`), and we do not
reverse-engineer token-gated JS widgets. Data access is via the sanctioned routes below.

## Adapters

| name | how data is obtained | status |
|---|---|---|
| `socrata` | gov open-data SODA feeds (`socrata_sources.json`) | LIVE — 4 shelters |
| `generic` | any platform (OpenDataSoft/CKAN/ArcGIS/custom JSON) via API-recipe (`generic_sources.json`) | LIVE — Zaragoza ES |
| `shelterluv` | **per-org ShelterLuv API key** (`shelterluv_orgs.json` + gitignored `shelterluv_keys.json`) | READY — needs org keys |
| `rescuegroups` | RescueGroups v5 API key (`RESCUEGROUPS_API_KEY`) | READY — needs key |

## ShelterLuv: how to light up an org (the legitimate route)

1. The shelter logs into **its** ShelterLuv account → **Settings → API** → *Generate API key*.
2. They share that key with you (it identifies their org; build-time only, never shipped to the browser).
3. `cp shelterluv_keys.example.json shelterluv_keys.json` and paste the key under the org id
   (or set the org's `key_env` env var). `shelterluv_keys.json` is gitignored.
4. If the org isn't in `shelterluv_orgs.json` yet, append a block (real geocode + `slug` if known).
5. `python tools/manage.py fetch --source shelterluv && python tools/thumbs.py && python tools/build.py`.

Seeded (confirmed ShelterLuv, awaiting keys): **Pasadena Humane** (`PHC`), **spcaLA**.

## Expansion roadmap (SoCal → NorCal → nationwide)

The platform decides the path — when you request data access, the shelter says what they run:
**ShelterLuv** → add here; **RescueGroups** → the one `RESCUEGROUPS_API_KEY` covers it (the
big bulk unlock — it aggregates thousands incl. many below); **PetHarbor/Petango** → not
scrapable (robots/ToS) — reachable only if they also syndicate to RescueGroups.

**Southern California (first):** Pasadena Humane ✓seed · spcaLA ✓seed · San Diego Humane Society ·
Helen Woodward Animal Center · Best Friends (LA) · Kitten Rescue (LA) · Stray Cat Alliance ·
Michelson Found Animals · (LA City / LA County / OC / Riverside county shelters are PetHarbor/Petango → via RescueGroups only).

**Northern California (next):** SF SPCA · San Francisco ACC · Oakland Animal Services ·
East Bay SPCA · Berkeley Humane · Marin Humane · Humane Society Silicon Valley ·
Sacramento SPCA · Peninsula Humane (PHS-SPCA) · Tony La Russa's ARF.

**Then nationwide, state by state:** target each state's largest humane societies / SPCAs /
municipal shelters. In practice the scalable mechanism is the **RescueGroups key** (one API,
nationwide); ShelterLuv keys add specific orgs that prefer that platform. This list grows as
keys are obtained — there is no clean bulk-scrape shortcut (verified across PetHarbor/Petango/
ShelterLuv/open-data; see project memory `shelter-cats-demo`).
