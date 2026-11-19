# Status

_Last updated 2026-11-18 (latest), on branch `feat/review-visual-parity`
(stacked on PR #25; neither branch is merged or deployed)._

## Latest: no status colour without a 2026 goal; So-What tone stored; October configuration ready to run (PR #26, not merged)

Three findings from the previous review are closed, and the production configuration
is now a reviewed script rather than a prose plan. Nothing was merged, deployed or
written to production, and no import was executed.

- **No FY27 fallback for October status.** The calculator no longer falls back to a
  mapping's FY27 target when a definition states no 2026 goal, and it also refuses
  an *unlabelled* figure that equals the mapping's own FY27 budget/stretch (e.g.
  production's `$26M total`). A missing, unparseable or incompatible goal, or a
  mapping with no declared time basis, now yields a neutral **"Not configured"**
  badge that names the gap (`no-goal` / `goal-not-comparable` / `no-basis` /
  `no-direction` / `no-value`). FY27 budget/stretch stay visible as context only.
  An approved `ReviewPillarStatus` still wins.
- **Historical series reconciled to 37 observations, not 26 rows.** 11 LTM lender +
  11 Base Business + 15 AwayDNA = 37 expected; 2 present in production; 35 missing;
  11 need a new definition (the Base Business line, which is a different fact from
  the $79.9M YTD headline and is **blocked** pending Finance naming its basis);
  26 rows importable today (11 + 15). Sep-26 restatements ($135.4M lender, $129.4
  AwayDNA) stay as revision 2, never edits.
- **So-What presentation parity.** `ReviewSoWhat` gained an optional semantic
  `tone` (`POSITIVE`/`WARNING`/`NEGATIVE`/`NEUTRAL`, never CSS classes) through a
  backward-compatible additive migration, applied to the **local dev database
  only**; the bridge commentary got a dedicated `FINANCIALS` scope. Absent or
  unknown tone renders neutrally and inherits the section. The four bridge items and
  the 33 per-item tones are now transcribed exactly from the reference page into
  `docs/october-2026-so-what-content-preview.md` — **preview only, not imported**, so
  nothing was invented and nothing was written.
- **Configuration script for the five primaries** — dry run by default, identity by
  `metricKey`, exactly one active mapping per driver, FY27 figures never written,
  idempotent, with `--snapshot` / `--revert`. Grow is deliberately left goal-less
  (percentage goal vs unit count) and reported as such.
- 803 tests pass (65 files). Typecheck, lint, build, `prisma validate` and
  `migrate status` pass. Browser smoke test at 1440×900 and 390×844 in both
  themes: all five routes render, no console errors, no horizontal overflow, the
  so-what editor exposes a tone select per item. Local preview on
  `127.0.0.1:3000` against `awayday_si_dev`. Details and the import register:
  [docs/october-2026-parity-corrections.md](docs/october-2026-parity-corrections.md).

### Reference bundle: located and verified

The reference HTML (`Awayday October 2026 Strategy Review(2).html`) and the read-only
production identity export (`october-2026-production-kpi-identities.json`, 61
definitions) are held in **`.reference/`, now gitignored** so they can never be
committed. Earlier passes worked from recorded extractions; this pass re-read the
source and confirmed the chart arrays (11 + 11 + 15 = 37 observations), the 49-brand
totals (15,324 / 169 / 1,868), the FY27 figures (M&A $26M/$47M, Grow 23/28,
Retention 11/9 on LTM, TRevPAR 1/5, Margin 0.25/1), the five 2026 goals, and all
**33 So-What items**. Corrections: the page has **8** commentary sections (7 + the
bridge), not 7, and **33** items whose tones are POSITIVE 10 / NEGATIVE 17 /
WARNING 6; the stored 29 match the page's wording exactly apart from a trailing full
stop in the page's bold headline. The exact transcription is
[docs/october-2026-so-what-content-preview.md](docs/october-2026-so-what-content-preview.md)
— **preview only, not imported**. The identity export also confirms directly what
was previously inferred: every `user_review:*` definition has **no area and no
mapping** in production.

## Previous: October 2026 parity — the 2026 goal is the yardstick, not the FY27 target (PR #26, not merged)

The reference page (`Awayday October 2026 Strategy Review(2).html`) sets each
pillar's **2026 goal** beside its **FY27 budget and stretch** and judges status
against the 2026 goal. The app was judging the pillar against the mapping's FY27
target instead, and could rate a count against a percentage.

- A pillar's status now compares with the goal its own definition states, in the
  measure's own quantity. A figure the target text labels `FY27` is never used;
  a goal written as a percentage is never applied to a unit count; and a target
  three orders of magnitude from the value claims no status at all (`GREY`)
  instead of a confident green.
- The reference used (`2026 goal` or `FY27 budget`) is named in the measure
  editor, and gauge markers are labelled with their context.
- Approved owner statuses are untouched and still win over the calculated one.
- Production's five pillar mappings still point at the FY27 plan definitions
  (`Gross unit adds`, `Owner unit churn (TTM)`, …), not the October measures
  (`BD unit adds (BD Master)`, `Annualized Unit Churn (Finance)`, …). The
  configuration change, the import previews (Base Business comparisons,
  historical series, 49-brand churn) and the So-What findings are in
  [docs/october-2026-parity-corrections.md](docs/october-2026-parity-corrections.md).
  **No production mapping, observation, target or So-What was changed.**
- 764 tests pass. Local preview running on `127.0.0.1:3000` against
  `awayday_si_dev`; nothing deployed.

## Previous: KPI direction and primary-measure integrity corrections (PR #26, not merged)

Two KPI integrity defects found in the previous review are corrected. This pass
adds a **proposed schema migration** (prepared for review, applied only to the
local development database) and no auth, CI or infrastructure change.

**1. Direction can no longer be silently assumed.** `KpiMeasureMapping.higherIsBetter`
defaulted to `true`, and the form turned anything other than `LOWER` into
`true`. A new mapping therefore declared “higher is better” without anyone
choosing it, which paints a rise in owner churn, CAC, operating expenses, unit
losses or cancellations green.

- The column is now `Boolean?` with **no default**; `true` = higher, `false` =
  lower, `null` = not stated. The Admin form offers Higher / Lower / **Not
  stated (no status colour)**, and the server action accepts only those three.
- A stated direction is authoritative. An unstated one is neutral everywhere:
  `mappingRag()` returns `GREY` (it cannot become green), the gauge says
  “Direction not stated”, and a mapping's silence does not fall back to the
  measure's name. Metrics with no mapping at all still use the name heuristic,
  as before.
- Negative expenses stored as negative numbers now rate by magnitude for a
  lower-is-better target (`−13` against `−15` is an improvement), and negative
  EBITDA keeps the plain higher-is-better comparison (`−$1.2M` against `−$1.0M`
  is worse).
- **Migration (needs engineering approval):**
  `prisma/migrations/20261118220000_kpi_mapping_direction_optional/` drops the
  default and the NOT NULL constraint. Existing `true`/`false` values are
  preserved; there is **no guessed backfill**, because a stored `true` cannot be
  told apart from one the old default supplied. See
  [docs/kpi-direction-audit.md](docs/kpi-direction-audit.md) §7 for the
  read-only review query. **Applied locally only — not to staging or Neon.**

**2. A pillar's primary measure is configured, not alphabetical.** The review
used `kpis[0]` from a name-ordered query, and Edit Mode wrote to the same
position. `selectPrimaryMeasure()` now reads persisted configuration: the KPI
with the **active measure mapping** is the primary measure. Renaming a KPI,
adding a supporting metric or changing order cannot change it.

- No mapping → `missing`: the plan's declared measure name with no value,
  comparison or status, plus a note pointing at Admin > Measure mappings.
- Two or more active mappings → `ambiguous`: neutral, with the conflicting names
  shown; never an alphabetical tie-break.
- Read (`getReviewPlan`) and write (`setPillarMeasure`) use the same resolver.
  A value write is refused while the primary is missing or ambiguous.
- Admin > Measure mappings now lists every KPI, marks Primary/Supporting, warns
  when a pillar has none or more than one, and **refuses to activate a second
  mapping in the same pillar**. Admin-only, audited; the review editor's
  `canEdit` rule is unchanged.
- Approved owner statuses (`ReviewPillarStatus`) still show unchanged. Three
  enablers that have a KPI but no mapping (Tech & AI, Marketing, Guest
  Experience) now show the neutral “primary measure not configured” state
  instead of a status calculated from an alphabetically chosen KPI.
- Reference measures resolve from the database for the five pillars: Acquired
  EBITDA closed, Gross unit adds, Owner unit churn (TTM), TRevPAR growth (YoY),
  Shop NOI margin vs PY. Their YTD/LTM basis comes from each mapping.

See [ADR 0003](docs/adr/0003-declared-direction-and-primary-measure.md) and
[docs/kpi-direction-audit.md](docs/kpi-direction-audit.md).

**Verified locally:** `npm run typecheck`, `npm run lint`, `npm test` (63 files,
745 tests) and `npm run build` pass. The local preview (`next dev` on
`http://127.0.0.1:3000`, local `awayday_si_dev` Postgres) renders the five
configured primary measures with their approved statuses; a temporarily cleared
direction rendered the neutral gauge and “Direction not stated” basis text, then
was restored. Light and dark server render checked.

**Not verified:** the real October 2026 observations in Neon; any staging or
production migration; any deployment. The migration is a **proposal awaiting
engineering approval**.

## Earlier: final review corrections on PR #26 (not merged)

Two review concerns were addressed, plus the defects the re-review found.

**1. Theme selection at every width.** The control is no longer hidden below
`sm`. Wide screens keep the three-option segmented control; below `sm` a compact
icon button opens a popover with the same Light / Dark / System radio group,
keyboard operable, labelled, announced, and sharing the same cookie. The first
attempt put `hidden sm:inline-flex` on the element whose unlayered stylesheet
rule declares `display`, so Tailwind's layered utility lost: the phone rendered
the segmented control **and** the compact button (header 77 px instead of 56 px)
and the desktop kept the mobile navigation button. Visibility now lives on
wrapper elements / utilities, with a stylesheet regression test.

**2. KPI direction rules audited and corrected.** See
[docs/kpi-direction-audit.md](docs/kpi-direction-audit.md). Findings:

- **A direction read from a shortened display label.** `Support cost as % of
  revenue` prints as “Support % of revenue”, so `cost` was lost and the only
  match was `revenue` → *higher is better*. A +1 pp rise in a cost ratio was
  coloured green. Rows now carry `directionKey` (definition name *and* metric-key
  words) and the table reads direction from that.
- **Broad matches narrowed:** `cost`, `units`, `days`, `scores`, `profit`,
  `churn`, `occupanc`, `vacanc`, `cancell` no longer match neighbouring words.
  Compound identities (`units lost`, `risk score`, `cost efficiency`) and an
  ambiguity rule (a name with both churn and retention) decide first; anything
  else is unknown and stays neutral.
- **Declared metadata now wins end to end.** `resolveDirection()` prefers an
  approved `KpiMeasureMapping.higherIsBetter` for gauges, headline cards and
  P&L deltas. The `@default(true)` follow-up recommended here is **completed in
  the latest section above**, with a proposed migration.
- **Gauge defects:** target prose read the **b of “budget”** as a billions
  suffix (a 3,152-unit budget became 3.152 trillion), and a tight
  actual/target pair could collapse the axis (“4.5 to 4.5”, actual outside its
  own range). Both fixed, with regression tests.

**Verified locally:** `npm run typecheck`, `npm run lint`, `npm test` (62 files,
707 tests) and `npm run build` pass. Rendered from local synthetic Postgres at
390 / 768 / 1440 px in light and dark: no page-level horizontal scroll, exactly
one theme control per width, six gauges all inside their axes, corrected
favourable/unfavourable tones (`Support % of revenue` now red when it rises),
dark background `rgb(18,26,33)`, sampled dark contrast 6.72:1 (muted) to 15.6:1
(body).

**Not verified:** the real October 2026 observations in Neon; the supplied
reference HTML is not present in this environment, so the preview dataset was
built from the reviewed figures already encoded in the repository's reference
fixtures plus the local synthetic seed. No deployment.

**Local preview (development only).** `next dev` on `http://localhost:3000`
against the local `awayday_si_dev` Postgres, with `DEV_AUTH_AS=dev@awayday.test`
(the documented local-only bypass). Synthetic, disposable, gitignored; nothing
was sent to Neon or Cloudflare.

**Documentation gaps fixed in this pass:** `docs/kpi-direction-audit.md` added;
the visual-parity document no longer claims the phone theme control is hidden.

## Current milestone: visual parity, theme, status vocabulary and AI commentary design

**What changed (branch `feat/review-visual-parity`, not merged).** The Strategy
Review now reads like the reviewed report rather than merely containing its
sections. Presentation only: every figure still comes from `KpiDefinition` /
`KpiObservation`, and there is no schema, auth, dependency or deployment change.

- **Light, dark and system themes.** The preference is a cookie read by the
  server, which stamps `data-theme` on `<html>` before first paint, so there is no
  flash and no hydration mismatch. `system` writes no attribute and the existing
  `prefers-color-scheme` block applies; an explicit choice wins over a dark OS;
  print is always light. A three-option `ThemeToggle` sits in the top bar (icons
  only below `sm`, where the shell has no room for it). Dark tokens are declared
  once, as unlayered CSS, and every component follows them.
- **One status vocabulary** (`src/lib/kpi-status.ts`): ahead, on goal, on track,
  under budget, needs attention, behind, floor breached, no data, each with a
  tone, a glyph and a word. Direction is declared per metric, never inferred from
  the sign of a number, and a metric whose direction is unknown gets no colour.
  Mixed pillars keep both sides through a factual count chip rather than a single
  verdict.
- **Gauges** (`src/lib/kpi-gauge.ts`, `KpiGauge`): several target markers read
  from the definition's own target prose, four label lanes so labels cannot
  overlap (the defect in the reference), edge-inward alignment, overflow arrows,
  currency/percent/points/count formatting, lower-is-better handling and a
  sentence `aria-label`. Below 40rem the labels are replaced by a definition list
  so nothing is clipped.
- **Executive summary and tables:** `text-3xl` values, a smaller comparison line,
  population and basis labels, sticky header and first column on wide tables,
  static on phones, and deltas coloured only when the metric's direction is known.
- **So-What sections:** one card per item, bold claim then evidence, tone from the
  section's status with a glyph and a spoken word, readable in both themes.
- **`docs/claude-so-what-generation-design.md`** specifies (and does not enable)
  the review-and-approve workflow for Claude-generated commentary, including the
  finding that `ReviewSoWhat` cannot hold a draft: it has no state, provenance or
  tone columns, so a draft store needs an approved migration.
- See [docs/strategy-review-visual-parity.md](docs/strategy-review-visual-parity.md)
  for the component-by-component comparison against the supplied HTML.

**Defect found and fixed by the visual audit:** `favorableDelta` applied the
"expenses are stored negative" sign flip to every metric, so Adjusted EBITDA of
−$1.2M against a −$1.0M budget (a wider loss) was coloured green. The flip now
applies only to lower-is-better metrics, with regression tests.

**Verified locally:** `npm run typecheck`, `npm run lint`, `npm test` (62 files,
691 tests) and `npm run build` pass. The page was rendered from local synthetic
Postgres in light/dark at 1440 px and 390 px: no page-level horizontal scroll, no
overlapping or clipped gauge labels, sticky table headers, dark background
`rgb(18,26,33)`, sampled contrast ≥ 6.01:1.

**Not verified:** the real October 2026 observations in Neon, and any deployment.
The local database and `.env` are gitignored.

## Earlier milestone (PR #25): Strategy Review structure matching the October 2026 reviewed report

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

1. Review PR #25, then the stacked visual-parity PR (base
   `feat/strategy-review-parity`, so PR #25's diff is not duplicated). PR #25
   has no schema change. PR #26 now contains **one proposed migration** (an
   engineering-owned schema change: `KpiMeasureMapping.higherIsBetter` becomes
   nullable with no default). It is applied to the local development database
   only and must be reviewed and approved before staging/production.
2. Confirm the rendered review against the real October observations after the
   data gap in the section below is closed, including that every pillar has one
   active measure mapping and one declared direction.
3. Decide the `docs/claude-so-what-generation-design.md` questions before any AI
   commentary work starts. The first is whether a draft store may be added; it is
   the only item in that document that needs a migration, and nothing in it is
   enabled today.
4. Deploy through the existing Workers Builds path from `master` after merge,
   running the pending migration through the approved release process. Do not
   activate the experimental GitHub Actions workflow on
   `feat/github-actions-cloudflare-release` as part of this work.

## Earlier milestone: incident 2026-11-16, production 500 on signed-in pages

Better Auth was built once at module load; a promise owned by an ended request
made later requests in the isolate fail. Fixed by building the instance per
request (`src/lib/auth-per-request.test.ts`). Merged as PR #22 and deployed.

## Documentation gaps

AGENTS.md lists ARCHITECTURE.md, SETUP.md, DEPLOYMENT.md and RUNBOOK.md; none of
them exist yet. README.md covers setup, deployment and MCP for now.
