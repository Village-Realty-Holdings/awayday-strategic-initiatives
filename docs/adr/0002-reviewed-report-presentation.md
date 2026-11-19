# ADR 0002 — Reviewed-report presentation stays database-driven and scope-explicit

- Date: 2026-11-18
- Status: Proposed (awaiting engineering review)
- Context: Feature parity with the October 2026 Strategy Review HTML

## Context

The reviewed October 2026 Strategy Review (created in Claude) has four headline
financial cards, a Base Business P&L with budget and prior-year comparisons,
roughly twenty operating metrics, detailed pillar scorecards, two historical
charts and a brand-level churn table. The application already stores the
reviewed observations as `KpiDefinition` / `KpiObservation` rows with explicit
reporting scope, comparison basis, time basis and entity, and already shows two
reviewed tables (PR #23).

The HTML is a presentation reference, not a data source. Copying its numbers or
its 49-brand list into React would violate the project rules and would drift as
soon as November is published. Several populations (Base Business, Finance
reported, Awayday consolidated, Ex-OTA, AwayDNA PMS) must never be blended.

## Decision

1. **All report content is read from `KpiDefinition` / `KpiObservation`.**
   Source code contains metric *identities* (name patterns, canonical line
   labels, column order) and formatting rules, never observations. A regression
   test scans the presentation rules for currency or thousands-separated
   literals.
2. **Presentation rules are a pure module** (`src/lib/review-report.ts`, with
   formatting split into `src/lib/review-format.ts`). It can be unit-tested and
   imported by a client component without pulling Prisma into the browser
   bundle.
3. **Every row is selected by its full identity**, and every table section
   names its population. A card or series never falls back to another
   population. When a figure is absent the UI prints the identity it needs.
4. **Deltas are arithmetic, not observations.** “vs budget” and “vs prior year”
   are the difference between two reported values and are labelled as such.
5. **Brand-level churn uses `KpiObservation.entityId`.** No brand table or brand
   list is added to source or schema; brands are data. A brand is one row per
   population, and counts are totalled only within one population, so the same
   brand is never blended across reporting scopes or double counted.
6. **Historical charts read `KpiObservation` across periods.** Restatements are
   the current approved revision; superseded rows never appear. A missing series
   renders an empty state, and importing the series is a separate, authorised
   data action.
7. **A historical series is one time basis.** The reviewed history is published
   year to date for Base Business Adjusted EBITDA and on LTM for the lender view.
   Each series therefore names its own `timeBasis`; monthly rows are a different
   fact and are never accumulated into a YTD line, nor is one basis converted into
   another. The chart axis is every calendar month in range, and the line breaks
   where a month has no observation rather than interpolating.
8. **Authority outranks recency.** When two approved rows claim one identity, the
   lower `authorityRank` wins; a missing rank is the weakest rank (not an
   incomparable value), and observation time, refresh time and revision only break
   a tie between equal ranks. This is the canonical resolver's rule in `kpi.ts`,
   and both implementations now compare ranks rather than subtracting them, so a
   comparator can never return NaN.
9. **Brand-churn columns are basis-specific.** Each column reads exactly one time
   basis (point in time, month, trailing) and one population; rows on another basis
   never fill or overwrite it, and any that are skipped are counted in the table.
10. **No schema change, no new dependency, no auth change.** The existing
    `ReviewPeriod` draft/published workflow and edit mode are untouched.

## Consequences

- The review will show “not loaded” until the corresponding observations are
  published. That is deliberate: a missing figure is visible, not invented.
- Curating `KpiDefinition.strategicAreaId` improves scorecards, but unlinked
  reviewed metrics are still attributed to a pillar by their documented
  identity, so depth is not blocked on curation.
- If a future report renames a metric, its row still appears (unmatched rows
  follow the catalogue alphabetically); only its scorecard/expectation slot and
  chart classification need the pattern updated.
- A weighted churn percentage is not aggregated in the UI. If the business wants
  one, it needs a definition and an observation (or an approved calculation),
  not a UI shortcut.
