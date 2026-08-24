# China Auto public-source policy

Public evidence must be a specific, resolvable external HTTP(S) page. Prefer a
government statistical release, regulator record, company filing, company
facility page, association disclosure, or university unit profile that directly
supports the linked claim dimension.

QROST-authored research briefs, working notes, local files, and this site's own
pages never count as sources. A company or university homepage may establish
identity only; it must not be stretched to support headquarters, ownership,
facility status, output, or partnership claims.

Every evidence-bearing row keeps `confidence` and `source_ids`. A row above
`0.5` must resolve to at least one source registry record with an external URL.
Facts without adequate external evidence remain in the raw public projection at
`confidence <= 0.5` and are visibly labelled as candidates. Do not delete those
facts merely to make validation pass.

Every source also declares `publisher_domain`,
`publisher_ownership: "external"`, and a structured `support_scope`. The scope
names the exact evidence row and fields supported by the page, with bilingual
scope text. Validation requires the URL host to match `publisher_domain` and
cross-checks the declared entity reference against actual `source_ids` usage.
An externally hosted self-authored note still fails the ownership gate.

Before publishing:

1. Add the exact external page to `SOURCES` in `tools/seed_v1.py` with access
   date and a scope note saying what it supports.
2. Link only the matching record or relation; do not use an identity page as
   blanket evidence.
3. Run `python3 tools/seed_v1.py`, `python3 tools/validate.py`,
   `python3 tools/test_provenance.py`, and `python3 tools/build.py`.
4. Run `python3 tools/test_build_idempotence.py`; a second build must be a byte
   no-op for `index.html` and `assets/data/manifest.json`.
