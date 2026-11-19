# Strategy Review parity with the October 2026 reviewed report

_Status: implemented on branch `feat/strategy-review-parity`, awaiting engineering
review. No production data was read or written; no deployment was made._

## Reference reviewed

Presentation reference: **`Awayday October 2026 Strategy Review.html`** (title
"Awayday October 2026 Results"; supplied locally at
`~/Downloads/Awayday October 2026 Strategy Review.html`, 72,952 bytes, dated
16 Nov 2026). It is authoritative for presentation, metric labels, reporting
periods, chart structure and expected values. Neon remains authoritative for the
stored observations; where the two disagree the dashboard shows the observation
and discloses the difference rather than reconciling it.

## What this adds

The Strategy Review (`/`, and each month at `/review/<YYYY-MM>`) now presents the
reviewed monthly report's structure on top of the existing strategy house, SI
cards, editing, publishing and permissions:

1. **Executive summary cards** — Adjusted EBITDA (month and YTD, Base Business),
   LTM Pro Forma Lender EBITDA, and Shop NOI, each labelled with its reporting
   population and compared with budget, else prior year.
2. **Base Business P&L** — monthly and YTD actuals with “vs budget” and “vs prior
   year” deltas, in the report's line order.
3. **Operating KPI tables** — grouped into TRevPAR, rate/occupancy/fees, booking
   value, unit adds, churn/CAC, margins, M&A and guest experience, one row per
   metric definition.
4. **Detailed pillar scorecards** — collapsed under each pillar and enabler;
   loaded metrics plus the report's expected lines that have no definition yet.
5. **Historical charts** — LTM Pro Forma Lender EBITDA against Base Business
   Adjusted EBITDA (year to date), and AwayDNA TRevPAR (monthly), with
   restatement markers, a break in the line wherever a month is missing, and a
   data table.
6. **Brand-level churn** — searchable, sortable, high-churn highlighting, count
   totals, and no aggregated percentage.
7. **So-whats** — multiple items per section, headline and body, plain text.

Everything is read from `KpiDefinition` / `KpiObservation`. No amount, brand,
period value or monthly series is stored in source.

## Metric identities

The reviewed definitions are the ones whose `metricKey` starts with
`user_review:`. Values are selected by full identity: `reportingScope`,
`entityScope`, `timeBasis` and `comparisonBasis`, plus `entityId` for brand
rows. The populations are never mixed:

| Population | reportingScope | entityScope | Shown as |
| --- | --- | --- | --- |
| Base Business | `BASE_BUSINESS` | `BASE_BUSINESS` | Base Business |
| Finance reported | `USER_REVIEWED_REPORTED` | `REPORTED` | Finance reported |
| Awayday consolidated | `AWAYDAY_CONSOLIDATED` | `CONSOLIDATED` | Awayday consolidated |
| Any other scope present | its own value | its own value | its own value |

### Executive cards

| Card | Time basis | Population | Matching identity |
| --- | --- | --- | --- |
| Adjusted EBITDA | MONTHLY | Base Business | name/metric key contains “adjusted ebitda”, excluding lender/pro forma/margin |
| Adjusted EBITDA · YTD | YTD | Base Business | same |
| LTM Pro Forma Lender EBITDA | LTM | whichever population publishes it (label shows which) | contains “lender” or “pro forma” and “EBITDA” |
| Shop NOI | MONTHLY | Base Business | contains “shop noi”, excluding margin/% |

A card with no matching observation shows “Not loaded” and prints the expected
identity. It never borrows a figure from another population or time basis.

### Pillar scorecards

Each scorecard lists the definitions linked to that `StrategicArea`. A reviewed
metric that is linked to **no** area is attributed to the scorecard whose
documented expectation matches its name, so the depth appears before anyone
curates links. A metric linked to another area is never re-attributed.
Expectations are metric identities only (for example “Tuck-in EBITDA”,
“AwayDNA churn”, “Support cost %”); the rows carry no values.

### Brand churn

A brand is an `entityId` on a churn-family observation. Column meanings:

| Column | Metric name match | Time basis it reads |
| --- | --- | --- |
| Bookable units | “bookable units” | `POINT_IN_TIME` |
| Churned units (month) | “churned units”, not LTM/TTM | `MONTHLY` |
| Annualized churn (month) | “annualized churn” | `MONTHLY` |
| LTM churned units | LTM/TTM + “churned units” | `LTM` or `TTM` |
| LTM churn % | LTM/TTM + churn + %/percent/rate | `LTM` or `TTM` |

Each column reads exactly one time basis and one population. A `MONTHLY`, `YTD`,
`LTM` or `POINT_IN_TIME` row can never overwrite another basis, and a row that
names no basis is not assumed into a column; those rows are counted and the
table says how many were left out. Each column header prints the basis it
reads. One definition per column is chosen deterministically (shortest name,
then metric key), so two similar definitions cannot write the same cell.

A brand is one row **per population**: if the same brand name appears under two
reporting scopes, it stays two labelled rows rather than having its columns
blended. Totals sum the reported counts within a single population only; when
brands come from more than one population no total is added up, because summing
across populations would double count the same brand.

The totals row's percentages are **derived from those counts**, exactly as the
review derives them (“Rates divide by bookable units”): monthly churn × 12 ÷
bookable units, and trailing churn ÷ bookable units. No published rate is
averaged or re-weighted, nothing is stored, and the cells say they are derived.
With no bookable units, or across populations, no percentage is shown.

A brand with no bookable units keeps its counts and gets no rate — the review's
own treatment of Rent Branson (`0 | 0 | n/a | 0 | n/a`).

## Data that is still missing in production

The user independently confirmed 164 reviewed observations (138 operating, 20
Base Business, 6 pillar), 53 reviewed definitions and 7 so-whats for October
2026. This branch does not change that data. (Re-checked against the reference
page and its read-only identity export on 2026-11-19: production holds 53
`user_review:*` definitions, none of them linked to an area or selected by a
mapping, and the page's commentary is 8 sections / 33 items — the 29 stored
rows plus the 4-item bridge block.) The following are read from Neon
and will render as soon as the observations exist; each is documented rather
than guessed:

| Section | Missing identity (per month unless stated) |
| --- | --- |
| Base Business P&L comparisons | `BUDGET` and `PRIOR_YEAR` rows for each P&L line, MONTHLY and YTD, `BASE_BUSINESS` |
| Exec card comparisons | `BUDGET` / `PRIOR_YEAR` for the card's time basis and population |
| Operating table | any reviewed metric not in the 138 reported observations (for example Finance/BD/AwayDNA unit-add splits, cash CAC, TTM churn) |
| LTM Pro Forma Lender EBITDA chart | one `LTM`/`ACTUAL` observation per month, December 2025 – October 2026 |
| Base Business Adjusted EBITDA chart (dashed line) | **identity not stated by the review.** Its October point is `$77.3M`, which is not the `$79.9M` October YTD headline, so the dashboard refuses the headline identity and plots nothing until the series is published as its own definition with a declared time basis |
| AwayDNA TRevPAR chart | one `MONTHLY`/`ACTUAL` observation per month, August 2025 – October 2026 |
| Brand churn | one `entityId`-bearing observation per brand per churn column |

### Historical import preview (not executed)

Historical series are ordinary `KpiObservation` rows, so they can be published
through the existing authenticated ingestion/MCP path. Before any write,
produce a preview with one row per month:

```
metricKey             | reportingPeriod | timeBasis | comparisonBasis | reportingScope | entityScope | value | sourceDocument | sourceLocation
user_review:...        | 2025-12         | LTM       | ACTUAL          | BASE_BUSINESS  | BASE_BUSINESS | ...   | ...            | ...
```

No observation has been written by this change. The preview and the approval to
publish are engineering/business decisions outside this branch.

## Verification performed

- `npm run typecheck`, `npm run lint`, `npm test` (598 tests) and `npm run build`
  pass on the branch.
- Synthetic fixtures cover missing observations, different reporting scopes,
  negative values, percentages vs percentage points, millions vs dollars, YTD vs
  monthly, budget vs prior year, restated history, duplicate identities,
  superseded rows, scorecard target units, brand totals, and rendering.
- A local Postgres database (not Neon) was migrated and seeded with synthetic
  definitions and observations to render the real page in `next dev`. Confirmed
  on the rendered page: four executive cards with their populations, the six
  Base Business columns, grouped operating tables, both charts with month axes,
  the brand table with totals, six pillar scorecards, and the missing-data
  states. The synthetic database and `.env` are local only and gitignored.

## Validation against the October 2026 reviewed figures

`src/lib/review-report.reference.test.ts` encodes the user-supplied October 2026
reviewed figures as **test fixtures** (never as application source) and asserts
what the dashboard would display if Neon held those rows. It proves the selection
and formatting rules, not the production data.

Checked and matching the reviewed report:

- Base Business revenue `$25.2M` / YTD `$353.8M`; Base Business Adjusted EBITDA
  `−$1.2M` / YTD `$79.9M` (a loss keeps its sign).
- TRevPAR reported `$99.2` / `$177.9`, ADR `$205.9` / `$300.8`, paid occupancy
  `30.3%` / `41.4%`, GBV `$45.1M` / `$740.9M`.
- Acquired EBITDA closed `$300K` / YTD `$34.8M`, BD unit adds `330` / `3,340`,
  annualized unit churn `12.2%` / `12.4%`, TRevPAR growth vs PY `−0.9%` / `+4.1%`,
  Shop NOI margin vs PY (ex-OTA) `+0.5 pt`, average review score `4.64`.
- Historical series Dec 2025 – Oct 2026: eleven monthly points, Base Business on
  `YTD` and the lender view on `LTM`, each on its own population, with the
  September lender restatement marked.

### The reviewed brand churn table reproduces exactly

`src/lib/review-report.reference.test.ts` now encodes all 49 brands of the
reviewed table (bookable units, October churned units, LTM churned units) and
asserts the dashboard reproduces it:

- 49 rows, one per brand;
- the reviewed totals row's counts — `15,324` bookable units, `169` October
  churned, `1,868` LTM churned — summed from the rows, not stored;
- the reviewed totals row's percentages — `13%` and `12%` — derived from those
  counts and rounded whole, as the review prints them (`169 × 12 ÷ 15,324 =
  13.2%`, `1,868 ÷ 15,324 = 12.2%`);
- a brand with no bookable units (Rent Branson) keeping its counts and showing
  no rate.

### The two Adjusted EBITDA values are different facts, not a discrepancy to fix

The reviewed report shows three Adjusted EBITDA figures. They are preserved as
three separate identities, and the dashboard never substitutes one for another:

| Figure | Reviewed value | Where it lives | Dashboard |
| --- | --- | --- | --- |
| October monthly actual | `−$1.2M` | headline card | Monthly observation, Base Business |
| Year-to-date actual | `$79.9M` | headline card and P&L | YTD observation, Base Business |
| Historical chart line (dashed) | `$77.3M` at Oct-26 | chart only | Its own identity; never the YTD row |

The reviewed chart's own caption, *"Base business Adj. EBITDA (dashed) fell $1.3M
in the month to $77.3M"*, describes a **level that falls month by month**, and
`$77.3M ≠ $79.9M`. So the chart line is neither the YTD headline nor the monthly
actual, and the report never states its accounting basis. The dashboard therefore:

- labels the line **“Base Business Adjusted EBITDA”**, exactly as the review does,
  with no invented `(YTD)`/`(LTM)` suffix;
- excludes the headline cards' identities from that series, so `$79.9M` can never
  appear in the chart;
- plots nothing, and prints what it needs, until the history is published as its
  own definition with a declared time basis — the definition's own basis is then
  shown in the legend (“… · LTM basis”);
- still states **LTM** for the lender line, which the chart heading does confirm.

If two published identities could both be that line, nothing is plotted and both
candidates are named. No basis is ever inferred, and no observation is rewritten.

## HTML-to-dashboard parity matrix

Every major section of the reference, against what the dashboard does today.

| HTML section | Expected behaviour | Dashboard behaviour | Result | Remaining gap |
| --- | --- | --- | --- | --- |
| Header / meta | Prepared by, data as of, finance basis | Period header with prepared-by, data-as-of and loaded source documents | Match | Narrative “basis” sentence is not stored |
| Reading October | Hurricane context, basis note, September restatement | Restatement markers on charts and `review` notes; source list | Partial | Prose notes have no storage; see `review-data-gaps.md` |
| Strategy house | Mission, BHAG, five pillars, owners, SI list | Strategy house, pillar badges, SI cards | Match | — |
| Summary cards | Oct & YTD Adj. EBITDA, LTM lender, Oct Shop NOI | Four cards with those names, population badges, budget-then-PY comparison | Match | Comparison prints the arithmetic difference; the HTML prints `% vs budget` |
| Summary so-whats | Four short items | Stored so-whats, multiple per section, plain text | Match | Content is data (7 records), not code |
| Where the pillars stand | Oct + YTD + 2026 goal + FY27 per pillar | Pillar scorecards: month value, comparison, target, status | Partial | No single 8-row cross-pillar table; FY27 stretch column absent |
| Base Business P&L | 11 lines × Oct/YTD × vs budget/vs PY | Same lines and order, monthly + YTD, both deltas | Match | Deltas are absolute in the metric's unit; HTML mostly `%` |
| Operating KPIs | 12 metrics × Oct/Budget/PY/YTD/Budget/PY | Same metrics by family, actual + two deltas per period | Partial | HTML shows the comparison values; dashboard shows the difference (value on hover) |
| Historical EBITDA chart | Solid LTM lender + dashed Base Business | Solid lender on LTM, dashed Base Business on its own identity, restatement markers, gap-breaking lines, data table | Partial | Base Business identity not published yet, so that line is empty with a stated reason |
| AwayDNA TRevPAR chart | Monthly, Aug-25 → Oct-26, PMS basis | Monthly, matched by definition name, restatement markers, data table | Match | Needs the monthly observations |
| Brand churn table | 49 brands + totals; red ≥20%, green <10%; LTM sort | Data-driven rows, per-column time bases, search/sort, risk/good shading at 20%/10%, derived totals | Match | Brand rows must exist per brand; totals suppressed when populations are mixed |
| Pillar 1 M&A | 8 lines (EBITDA, deals, tuck-ins, units, multiples, LOI, offers, cycle time) | M&A scorecard lists the same identities | Partial | Values depend on stored definitions; LOI/offers are combined in one row |
| Pillar 2 Grow | 8 lines incl. BD adds, saves, organic, net, ending units, CAC | GROW scorecard lists the same identities | Partial | Same |
| Pillar 3 Retention | 8 lines + brand table | RETENTION scorecard + brand churn table | Match | Shop-at-fault split needs its own definition |
| Pillar 4 TRevPAR | 8 lines + AwayDNA chart + market comparisons | TREVPAR scorecard + chart | Partial | Market-comparison rows need observations |
| Pillar 5 Margin | 9 lines incl. sub-margins | MARGIN scorecard | Partial | Cleaning/maintenance/OTA margins need observations |
| Guest Experience | Review score, reviews received, floor metrics, call-outs | GUEST scorecard | Partial | Sept/PY/TTM columns and brand call-outs are not modelled |
| So-what in the bridge | Bridge commentary per driver | Stored so-whats per pillar | Partial | No bridge section/table in the dashboard |
| Sources and data notes | Nine sources + ten data notes | Source documents come from the observations themselves | Partial | Data-note prose is not stored anywhere |

“Match” means the same metrics, population, time basis, units and honest missing
states. “Partial” means the information is present but shaped differently, or one
side of it has no storage yet. Nothing is invented to close a gap.

## Known gaps and conflicts

- A reviewed metric that has no area link and matches no expectation appears in
  the operating tables only; the review counts it in “not linked to a pillar”.
- A row with no `timeBasis` is read as `YTD` in the P&L tables and scorecards (the
  application default, `DEFAULT_TIME_BASIS`), but it is never assumed into a
  brand-churn column, which requires an explicit basis.
- A brand-churn row whose time basis does not match its column is left out and
  counted in the table's note rather than moved into another basis.
- Chart series require at least two months to draw a line; one month renders a
  labelled single point.
- The report's “vs” columns are computed as actual minus the reported comparison.
  They are not stored observations and are labelled as such.
- `KpiDefinition.target` is a display string. A status is shown only when the
  target is a single comparable figure (“$26M”, “&lt;11%”, “1,200”); prose targets
  (“23% budget; 28% stretch”) show “No data” rather than a guessed status.
- No schema change and no new dependency were introduced.
