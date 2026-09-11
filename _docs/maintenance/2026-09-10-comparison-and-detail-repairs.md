# 2026-09-10 comparison and detail repairs

This batch follows the visual-semantics review with clearer comparisons, stable
graph scales, reliable housing detail transitions, and consistent homepage counts.
It does not refresh research facts or complete the full site audit.

## Changes

- **Housing details:** delayed map and climate work belongs to the currently open
  listing. Rapid close/reopen cannot initialize the next modal with the previous
  listing. Touch maps relock on each opening. Imported offer and POI text is
  displayed literally, and source links accept only HTTP or HTTPS URLs. The two
  art pages receive the matching token for their shared Housing script dependency.
- **Industrial Software:** remove the capability radar derived from maturity,
  reference counts and pricing labels. The existing 2–4-product comparison now
  includes recorded pricing model/tier alongside source fields; quotes and unknown
  values receive no score. Table headings, removal controls, focus return and
  horizontal keyboard scrolling remain usable on narrow screens.
- **Pharma groups:** categories retain their colors through filtering and language
  changes. A visible size legend explains parent, flagship and other member roles;
  size does not represent revenue, market value or employees.
- **Pharma deals:** distinguish the complete catalog, filter matches and drawable
  deals/companies. The current catalog contains 87 deals, of which 42 can be drawn;
  M&A has 31 matches and 2 drawable deals. Missing endpoints do not erase records.
  Node counts use independent deal IDs, separate from pairwise edges; one three-party
  deal produces three edges but counts once per company. Legend line styles match
  the graph, and amount hints preserve the potential-total/milestone qualification.
- **Architecture History:** node size uses the complete study/influence candidate
  relation collection, with a fixed scale and no five-record cap. The present
  collection has 926 unique relation records across 847 people, with a maximum of
  49 records per person. Filtering changes visibility, not the scale. Tooltips
  distinguish total and visible counts. The numeric legend explains that counts
  do not measure historical standing or relationship reliability. Candidate dashed
  edges, original relation types and evidence review are preserved.
- **Homepage:** Architecture History and China Auto counts now come from their
  public manifests for static HTML, both languages and README together. A read-only
  check catches drift in any projection. The verification count explicitly covers
  entity/relationship records rather than implying a count of verified people.

## Verification scope

The common suite now includes 48 read-only gates and 74 desktop/touch browser
cases. New regressions cover stale modal callbacks, literal imported text and URL
protocols, factual comparisons, group identity, multi-party deal counting, fixed
candidate-relation scales and independently stale homepage projections. Tests
derive expected catalog counts from source fixtures and retain missing-data cases.

Housing detail tests use the real pinned Leaflet stylesheet, script and integrity
attributes with deterministic tile fixtures. Other chart tests use local locked
fixtures. These tests establish local browser behavior; they do not establish
external provider availability, physical-device performance or current research
facts. Research records and Architecture History's editing source remain unchanged.

Public release status is established separately by the release run and live-file
comparison. Source commits and local passing checks alone are not deployment proof.

## Remaining priorities

1. Repair Housing completeness applicability and preserve explicit unknown reasons
   in the source workflow, without depending on private research files.
2. Add or verify per-value listing/rent sources, observation types and coordinate
   precision; distinguish observed amounts from model-derived estimates.
3. Complete shared language/theme continuity, remaining literal-text handling and
   accessible state/focus behavior across pages.
4. Repair Makoauto's cross-page prototype workflows and keep simulated operations
   explicitly labeled before considering real service integration.
5. Define evidence, scope, unknown handling and reproducible rules before adding
   capability or historical-importance scores. Candidate counts are not such scores.
