# SOP: Add a Product to China Industrial Software Survey

## 1. Research

1. Confirm product name (zh/en), vendor, category L1/L2.
2. Collect ≥1 authoritative `source.url` (annual report, official site, MIIT/信通院, listed company disclosure).
3. Set `confidence` 0.0–1.0 (editorial metadata: how sure the catalog entry is given `sources[]`; **not shown on the public page**); use ≤0.3 for skeleton entries without verification.
4. Distinguish `localization_depth`: `pilot` (POC) vs `core` (production-critical).

## 2. Author JSON

**Naming rule:** Vendor is shown in a separate column (`vendor_id` → `vendors.json`), but product `name_zh` / `name_en` must remain **disambiguated** when the name alone is generic or duplicated:

- **Keep vendor/company prefix** when: name is a known acronym (ERP, DCS, MES, PLM, BIM, BIP, …), ≤4 chars, or a generic phrase (e.g. 3D实体设计, 制造执行系统).
- **Domestic products** with generic names: prefer 公司简称 + product (用友 BIP, 中控 SUPOS, 金蝶云·苍穹).
- **Strip prefix only** for globally unique brands (NX, CATIA, Revit, SolidWorks, Teamcenter, …).
- Run `python3 tools/validate.py` — duplicate `name_zh` / `name_en` across different `vendor_id` emits **WARN**.

Create or edit `tmp/research/<agent-id>.json`:

```json
{
  "products": [
    {
      "id": "zwcad-2024",
      "name_zh": "中望CAD",
      "name_en": "ZWCAD",
      "vendor_id": "zwcad",
      "category_l1": "研发设计",
      "category_l2": "CAD",
      "origin": "domestic",
      "kernel": "自主",
      "maturity": "high",
      "localization_depth": "partial",
      "strengths_zh": ["..."],
      "strengths_en": ["..."],
      "limitations_zh": ["..."],
      "limitations_en": ["..."],
      "industries": ["机械", "建筑"],
      "pricing": "mid",
      "confidence": 0.85,
      "last_verified": "2026-06",
      "sources": [{ "url": "https://...", "title": "...", "accessed": "2026-06" }]
    }
  ]
}
```

## 3. Validate & Build

```bash
cd demos/china-industrial-software
python3 tools/validate.py
python3 tools/build.py
```

## 4. Frontend smoke

```bash
python3 -m http.server 8765   # from demos/china-industrial-software
node tmp/verify-smoke.mjs http://127.0.0.1:8765
```

## 5. Audit

- Add gaps to `tmp/accuracy-audit-findings.md` if fields unverified.
- Bump `last_verified` when re-checking sources.
