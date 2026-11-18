# Strategy Review parity with the October 2026 reviewed report

_Status: implemented on branch `feat/strategy-review-parity`, awaiting engineering
review. No production data was read or written; no deployment was made._

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
   Adjusted EBITDA, and AwayDNA TRevPAR, with restatement markers and a data
   table.
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

| Column | Metric name match |
| --- | --- |
| Bookable units | “bookable units” |
| Churned units (month) | “churned units”, not LTM/TTM |
| Annualized churn (month) | “annualized churn” |
| LTM churned units | LTM/TTM + “churned units” |
| LTM churn % | LTM/TTM + churn + %/percent/rate |

A brand is one row **per population**: if the same brand name appears under two
reporting scopes, it stays two labelled rows rather than having its columns
blended. Totals sum the reported counts within a single population only; when
brands come from more than one population no total is added up, because summing
across populations would double count the same brand. A percentage total is not
computed either: a weighted churn rate needs its own business definition.

## Data that is still missing in production

The user independently confirmed 164 reviewed observations (138 operating, 20
Base Business, 6 pillar), 53 reviewed definitions and 7 so-whats for October
2026. This branch does not change that data. The following are read from Neon
and will render as soon as the observations exist; each is documented rather
than guessed:

| Section | Missing identity (per month unless stated) |
| --- | --- |
| Base Business P&L comparisons | `BUDGET` and `PRIOR_YEAR` rows for each P&L line, MONTHLY and YTD, `BASE_BUSINESS` |
| Exec card comparisons | `BUDGET` / `PRIOR_YEAR` for the card's time basis and population |
| Operating table | any reviewed metric not in the 138 reported observations (for example Finance/BD/AwayDNA unit-add splits, cash CAC, TTM churn) |
| LTM Pro Forma Lender EBITDA chart | one `LTM`/`ACTUAL` observation per month, December 2025 – October 2026 |
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

- `npm run typecheck`, `npm run lint`, `npm test` (548 tests) and `npm run build`
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

## Known gaps and conflicts

- A reviewed metric that has no area link and matches no expectation appears in
  the operating tables only; the review counts it in “not linked to a pillar”.
- Chart series require at least two months to draw a line; one month renders a
  labelled single point.
- The report's “vs” columns are computed as actual minus the reported comparison.
  They are not stored observations and are labelled as such.
- `KpiDefinition.target` is a display string. A status is shown only when the
  target is a single comparable figure (“$26M”, “&lt;11%”, “1,200”); prose targets
  (“23% budget; 28% stretch”) show “No data” rather than a guessed status.
- No schema change and no new dependency were introduced.
