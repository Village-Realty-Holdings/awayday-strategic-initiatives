# KPI performance-direction audit (October 2026 review)

**Status:** corrections implemented on `feat/review-visual-parity` (PR #26), not
merged. No schema change, no migration.
**Scope:** `src/lib/kpi-status.ts`, `src/lib/review-report.ts`,
`src/lib/review-format.ts`, `src/lib/kpi-gauge.ts` and their call sites.

---

## 1. Why this exists

Status colour must follow business meaning. A green number that is actually bad
is worse than a neutral one, because it is read as reassurance. The rules were
re-audited for four failure modes:

1. a broad substring matching an unrelated metric;
2. a direction read from a shortened **display label** rather than the metric's
   identity;
3. a favourable/unfavourable judgement taken from the sign of a number alone;
4. a comparison drawn across populations or bases.

---

## 2. Rule inventory (after the audit)

`metricDirection()` resolves in this order, first match wins:

| Step | Rule | Example |
| --- | --- | --- |
| 1 | **Ambiguous names stay unknown** | `churn and retention`, bare `change` / `variance` / `growth` |
| 2 | **Compound identities** | `units lost`, `revenue lost`, `risk score`, `cost efficiency`, `cycle time` |
| 3 | **Lower is better** (word-bounded) | churn, attrition, turnover, CAC, cost, cost of sales/goods/revenue/service, opex, expenses, spend, vacancy, delinquency, cancellations, refunds, chargebacks, write-offs, errors, incidents, escalations, floor breached, loss, leakage, backlog, downtime |
| 4 | **Higher is better** (word-bounded) | margin, EBITDA, NOI, gross profit, profit, revenue, occupancy, (t)revpar, ADR, GBV, take rate, retention, saves, score, adds, deals, units, earnings, bookings, reviews, guests |
| 5 | **Otherwise unknown** | `widget throughput`, `business development`, `supportco` |

An unknown direction returns `known: false`, which makes both the tone and the
status neutral. Nothing is coloured on a guess.

### Precedence with declared metadata

`resolveDirection(higherIsBetter, name)` prefers an approved `KpiMeasureMapping`'s
own `higherIsBetter`, and only then falls back to the name. It is used for pillar
gauges, headline cards and P&L deltas, so an explicit declaration always wins.

No migration is needed: `KpiMeasureMapping.higherIsBetter` already exists.

---

## 3. Defects found and corrected

### 3.1 Direction read from a display label (miscoloured cost ratio)

The P&L table passed `${row.label} budget variance` as the direction source. The
label is the *display* line, which is shortened. `Support cost as % of revenue`
prints as **“Support % of revenue”**, so the word `cost` was gone and the only
remaining match was `revenue` → *higher is better*. A **+1 pp rise in a cost
ratio was coloured green**.

**Fix:** `ReportTableRow.directionKey` carries the definition's name *and* its
metric-key words (`directionKeyFor()`), and the delta tone reads from that.
`support % of revenue` now resolves `lower`, so `+1 pp` is red and `−0.6 pp` is
green — verified in the rendered table.

### 3.2 Broad matches narrowed

The previous lists used `\w*` stems and bare words that catch neighbouring
metrics:

| Was | Problem | Now |
| --- | --- | --- |
| `/\bcost\b/` | also matched “cost efficiency” (better when it rises) | word-bounded `costs?` + a compound rule for `cost efficiency`/`cost savings` |
| `/\bunits?\b/` (higher) | “units lost” would have been green | compound `units/owners/deals/customers lost` → lower |
| `/\bscores?\b/` (higher) | “risk score” would have been green | compound `risk score`/`risk rating`/`severity` → lower |
| `/\bdays?\b/` (lower) | a bare “Days” is not a direction | compound `days to`/`days per`/`cycle time`/`time to` |
| `/\bprofit\w*/` (higher) | matched “profit warning” | `gross profit` and `profit(ability)?` |
| `/\boccupanc\w*/`, `/\bvacanc\w*/`, `/\bcancell\w*/`, `/\bchurn\w*/` | over-broad stems | word-bounded forms |

Also added: `loss/leakage/backlog/downtime` (lower) and the ambiguity rule that
keeps a name containing **both** churn and retention uncoloured.

### 3.3 Gauge target prose read a word as a scale suffix

`parseTargetMarkers()` extracted figures with `\s*[kmb]?`, so the **b of
“budget”** was read as a billions suffix: `2,608 goal; 3,152 budget` produced a
budget marker of **3,152,000,000,000** and an axis of 0–3.6 trillion. The marker
was off-scale and the column unreadable.

**Fix:** a scale letter must be attached to the digits (`33M`) or be a standalone
word (`2.5 M`), never the first letter of the next word.

### 3.4 A gauge domain could collapse to a single point

`suggestDomain()` rounded both ends to the same step, so `4.64` actual against a
`4.5` goal returned `4.5 … 4.5` and the gauge reported “Actual 4.64 (outside the
charted range)”. **Fix:** the domain always spans at least one step and always
contains every plotted value.

---

## 4. Validation of the reviewed measures

Direction as the business reads it (asserted in `kpi-status.test.ts`):

| KPI | Direction | Result |
| --- | --- | --- |
| Revenue | Higher is better | ✅ |
| Adjusted EBITDA | Higher is better | ✅ |
| Shop NOI | Higher is better | ✅ |
| Gross profit | Higher is better | ✅ |
| Occupancy | Higher is generally better against a comparable target | ✅ |
| Unit adds | Higher is better | ✅ |
| Owner churn | Lower is better | ✅ |
| Cash CAC | Lower is better | ✅ |
| Operating expenses | Lower is generally better on a comparable basis | ✅ |
| Guest review score | Higher is better | ✅ |
| Maintenance margin | Higher is better | ✅ |
| Shop NOI margin | Higher is better | ✅ |

### Special cases

| Case | Expected | Result |
| --- | --- | --- |
| Negative EBITDA, −$1.2M vs −$1.0M budget | wider loss → **worse** | ✅ red |
| Negative EBITDA, −$0.8M vs −$1.0M budget | smaller loss → **better** | ✅ green |
| Operating expenses stored negative, −14 vs −15 | less spend → better | ✅ |
| Operating expenses stored positive, 14 vs 15 | less spend → better | ✅ same verdict |
| Percentage-point comparison, +0.8 pts vs +0.7 pts | ahead; never a “+114%” move | ✅ |
| Ex-OTA vs reported margin | each basis keeps its own verdict | ✅ |
| Churn vs retention in one name | no single verdict | ✅ neutral |
| Retention alone / churn alone | higher / lower | ✅ |
| KPI with no target | `no_data`, never ahead or behind | ✅ |
| Unknown direction | no tone, no status | ✅ |
| Missing or NaN observation | `no_data` | ✅ |

---

## 5. Reporting population and comparison basis

Direction never overrides identity. A delta is only computed from two
observations of the **same** definition, population (`reportingScope` +
`entityScope`), time basis and comparison basis; the reviewed report's Base
Business, reported and LTM populations stay separate and each section names its
own. The headline cards prefer a budget comparator and fall back to prior year,
and say which one was used.

---

## 6. Residual risks and recommended follow-ups

1. **`KpiMeasureMapping.higherIsBetter` defaults to `true`.** A mapping created
   without an explicit choice therefore declares “higher is better”. For
   lower-is-better measures (churn, CAC, cost ratios) that is silently wrong.
   No schema change is needed, but the mapping should require an explicit value
   — recommended migration for later approval:
   *drop the `@default(true)` and backfill existing rows from the measure's
   reviewed direction before making the column required.* Not done here.
2. **Line selection is alphabetical, not explicit.** `getReviewPlan()` takes
   `a.kpis[0]` (ordered by name) as “the area's measure”, and the pillar editor
   writes to the same row. With one definition per area that is unambiguous; if
   a curated area ever has two, the headline measure is decided by alphabet.
   Recommendation (needs review because it changes an edit target): select the
   measure that has an **active mapping** in both the read and the write path.
3. **Names are still heuristic** for metrics that carry no mapping. Unknown
   names stay neutral by design, so the remaining risk is an *uncoloured* delta
   rather than a wrongly coloured one.
4. **Sign-only inference** is gone: `favorableDelta` requires a known direction
   and applies the expense flip only to lower-is-better metrics whose comparator
   is negative.
