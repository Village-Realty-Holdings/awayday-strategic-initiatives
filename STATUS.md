# Status

_Last updated 2026-11-18, on branch `feat/strategy-review-parity` (PR #25 open, review corrections pushed, not merged or deployed)._

## Current milestone: Strategy Review parity with the October 2026 reviewed report

**What changed (branch, not merged).** The Strategy Review now presents the
reviewed monthly report's structure on top of the existing strategy house,
SI cards, editing, publishing and permissions:

- four executive summary cards (month and YTD Base Business Adjusted EBITDA,
  LTM Pro Forma Lender EBITDA, Shop NOI) with budget/prior-year comparison and
  an explicit population label;
- the Base Business P&L with monthly and YTD actuals plus “vs budget” and
  “vs prior year” deltas, in the report's line order;
- operating KPI tables grouped by family, one row per definition;
- collapsed detailed scorecards under each pillar and enabler, including the
  report's expected lines that have no definition yet;
- two historical charts (LTM lending EBITDA vs Base Business Adjusted EBITDA;
  AwayDNA TRevPAR) with restatement markers and a data table;
- a searchable, sortable brand-level churn table with count totals and
  high-churn highlighting;
- multi-item so-what presentation.

Every figure is read from `KpiDefinition` / `KpiObservation`; nothing is
hardcoded. Reporting populations stay separate and are labelled. There is no
schema change, no new dependency and no auth change. See
[docs/strategy-review-parity.md](docs/strategy-review-parity.md) and
[ADR 0002](docs/adr/0002-reviewed-report-presentation.md).

**Verified locally:**

- `npm run typecheck`, `npm run lint`, `npm test` (598 tests) and
  `npm run build` pass.
- A local Postgres database (not Neon) was migrated and seeded with synthetic
  definitions/observations; `next dev` rendered the page with all sections,
  including the empty states. The synthetic database and `.env` are local and
  gitignored.

**Corrections after independent review:**

- The Base Business Adjusted EBITDA history now reads `YTD` observations (the
  reviewed history is cumulative); the lender view stays on `LTM`. Monthly rows
  are never accumulated into the YTD line.
- Observation authority is compared directly rather than subtracted, so a missing
  `authorityRank` can no longer let a newer, less authoritative row win an
  identity. `kpi.ts`'s canonical comparator was corrected the same way.
- Brand-churn columns are basis-specific (point in time, month, trailing), so one
  time basis cannot overwrite another; skipped rows are counted in the table.
- Further self-review fixes: exact catalogue matches win over weak ones, chart
  lines break across missing months, scorecards label a value's time basis and
  population, and cross-pillar expectation collisions were narrowed.
- Labels and bands now follow the reviewed report's own wording: “Oct Adj. EBITDA
  (base business)”, “Shop opex”, “Shop NOI margin (reported basis)”, “Support % of
  revenue”, and the brand table's red ≥20% / green <10% bands.
- The brand-churn totals row now carries the reviewed report's percentages,
  derived from its own counts (monthly × 12 ÷ bookable units; LTM ÷ bookable
  units). Found while validating against the supplied HTML: the derived value was
  a fraction, so the table would have printed `0%` where the review prints `13%`.
  It is now in percent points, and `review-report.reference.test.ts` encodes all
  49 reviewed brands and asserts the `15,324 / 169 / 1,868` totals and the `13%`
  and `12%` rates.

**Not verified:**

- The real October 2026 observations in Neon (no production access from this
  environment).
- Any deployment: this branch is not deployed.

**Reference now in hand.** The presentation reference,
`Awayday October 2026 Strategy Review.html` (72,952 bytes, dated 16 Nov 2026),
was supplied on 18 Nov 2026 and has been read directly: its labels, section
order, chart series (Dec-25 – Oct-26), brand table and data notes. Its figures are
encoded as test fixtures and asserted, never imported by application code. The
reviewed report's own numbers reconcile: the 49 brands sum to its totals row
exactly, and every brand's stated rate equals its counts divided by bookable
units.

## Resolved: the three October Adjusted EBITDA figures

The reviewed report shows `−$1.2M` (October month), `$79.9M` (YTD) and a dashed
chart line ending `$77.3M` at Oct-26. Earlier this branch treated the last two as
a contradiction. They are three different facts: the chart line is a level that
falls month by month and is not the YTD headline. All three are kept as separate
identities; no basis is inferred, and the chart plots nothing until the review's
own series is published with a declared time basis. See
`docs/strategy-review-parity.md`.

## Open data gaps (business data, not code)

The reviewed October observations exist for 164 rows (138 operating, 20 Base
Business, 6 pillar) and 53 definitions, but the reviewed report's budget and
prior-year comparison rows, the two historical series and brand-level churn are
not all present. The dashboard names each missing identity instead of inventing
a value. Importing them is a separate, authorised ingestion action.

## Before release (engineering)

1. Review PR #25. No protected code (auth, schema, migrations, CI,
   infrastructure) is touched.
2. Confirm the rendered review against the real October observations.
3. Deploy through the existing Workers Builds path from `master` after merge.
   Do not activate the experimental GitHub Actions workflow on
   `feat/github-actions-cloudflare-release` as part of this work.

## Earlier milestone: incident 2026-11-16, production 500 on signed-in pages

Better Auth was built once at module load; a promise owned by an ended request
made later requests in the isolate fail. Fixed by building the instance per
request (`src/lib/auth-per-request.test.ts`). Merged as PR #22 and deployed.

## Documentation gaps

AGENTS.md lists ARCHITECTURE.md, SETUP.md, DEPLOYMENT.md and RUNBOOK.md; none of
them exist yet. README.md covers setup, deployment and MCP for now.
