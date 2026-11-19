# KPI performance-direction audit (October 2026 review)

**Status:** corrections implemented on `feat/review-visual-parity` (PR #26), not
merged. One **proposed** migration is prepared and applied only to the local
development database; it has **not** been run against production Neon.
**Scope:** `src/lib/kpi-status.ts`, `src/lib/kpi-measure-mapping.ts`,
`src/lib/kpi-gauge.ts`, `src/lib/primary-measure.ts`, `src/lib/review-data.ts`,
`src/lib/review-edits.ts`, the Admin > Measure mappings page/action,
`src/lib/review-report.ts` and their call sites.

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

`resolveDirection(higherIsBetter, name)` distinguishes three states:

| Declared value | Meaning | Result |
| --- | --- | --- |
| `true` / `false` | an approved mapping states a direction | authoritative; the name is ignored |
| `null` | a mapping exists but states **no** direction | `known: false`; neutral, and it does **not** fall back to the name |
| `undefined` | there is no mapping at all | the measure's name is the only evidence; an unreadable name stays neutral |

It is used for pillar gauges, headline cards and P&L deltas, so an explicit
declaration always wins and an explicit silence stays silent.

`mappingRag()` applies the same rule to a pillar's status: a mapping with a
target but no stated direction returns `GREY`. **An unknown direction cannot
become green**, even when the value happens to sit above its target. When a
target itself states direction (`<12%`), that statement still wins for the gauge,
because it is an explicit business declaration.

### Declared direction is required, but "not stated" is a valid answer

`KpiMeasureMapping.higherIsBetter` is now nullable and has **no default**. The
Admin > Measure mappings form offers three options:

- **Higher** — stored as `true`;
- **Lower** — stored as `false`;
- **Not stated (no status colour)** — stored as `null`.

The server action maps only `HIGHER`/`LOWER` to booleans; a blank value stores
`null`, and an unrecognised value is rejected (`error=direction`). A new mapping
can therefore never silently inherit "higher is better" again.

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

## 6. Primary-measure selection is configuration, not list position

### The defect

`getReviewPlan()` read `a.kpis[0]` from a query ordered by `name`, and the pillar
editor wrote to the same row. With one KPI per area that happened to work, but
it made the headline measure depend on alphabetical order: renaming a KPI,
adding a supporting metric or changing sort order could change which measure the
strategy house presented. It could also put an observation from a supporting KPI
under the pillar's name.

### The rule now

`src/lib/primary-measure.ts` (`selectPrimaryMeasure`) applies one persisted
rule:

| State | Result |
| --- | --- |
| exactly one KPI in the area has an **active** `KpiMeasureMapping` | that KPI is the primary measure |
| no KPI has an active mapping | `missing` — neutral; no value or status is claimed |
| two or more KPIs have active mappings | `ambiguous` — neutral; the conflicting names are shown, never an alphabetical tie-break |

The resolver reads no name, order or date. Read (`getReviewPlan`) and write
(`setPillarMeasure`) paths call the same function, so the measure the review
shows is the measure Edit Mode writes to.

The **Admin > Measure mappings** page now lists every KPI a pillar owns, marks
the one with the active mapping as **Primary measure** and the rest as
**Supporting measure**, and warns when a pillar has none or more than one.
Activating a second mapping in the same pillar is refused (`error=primary-exists`);
the admin must switch the current one off first, so the change is deliberate
and audited rather than a silent re-point. Only admins can reach the page or the
action (`requireSession({ role: "admin" })`); the review editor's existing
`canEdit` permission is unchanged.

### Neutral states, not guesses

- `measure.primary = "missing"` shows the plan's declared measure name (when it
  has one) with no value, no target comparison and a `no_data` status, plus a
  note pointing at Admin > Measure mappings.
- `measure.primary = "ambiguous"` shows the conflicting measure names and no
  value or status.
- A value write is refused while the primary is missing or ambiguous, rather
  than writing to an arbitrary KPI.
- A pillar's approved owner status (ReviewPillarStatus) still shows unchanged;
  the change only removes a status that was previously *calculated* from an
  alphabetically chosen KPI.

### October reference measures

The local dataset (synthetic, seeded from the reviewed plan) resolves:

| Pillar | Primary measure shown |
| --- | --- |
| M&A | Acquired EBITDA closed |
| Grow New Units | Gross unit adds |
| Owner Retention | Owner unit churn (TTM) |
| TRevPAR Expansion | TRevPAR growth (YoY) |
| Margin Expansion | Shop NOI margin vs PY |

The mapping's `timeBasis` supplies the YTD/LTM basis the reviewed report states.
These names are **read from the database**, not hardcoded; the five pillars
resolve only because their active mappings exist. If a deployment lacks those
mappings, the review shows the neutral "primary measure not configured" state
instead of guessing.

## 7. Existing-data compatibility and the proposed migration

### What the migration does

`prisma/migrations/20261118220000_kpi_mapping_direction_optional/migration.sql`:

```sql
ALTER TABLE "KpiMeasureMapping" ALTER COLUMN "higherIsBetter" DROP DEFAULT;
ALTER TABLE "KpiMeasureMapping" ALTER COLUMN "higherIsBetter" DROP NOT NULL;
```

It is additive/non-destructive: every stored `true`/`false` is preserved exactly.
There is no backfill, because a stored `true` **cannot** be distinguished from
one the old default supplied. Guessing would be the same defect in a different
place.

### Review before approval (read-only)

List every mapping and the direction its stored value declares. A human must
confirm each one against the business definition:

```sql
SELECT k."metricKey", k.name, m."higherIsBetter", m."targetBudget", m.active
FROM "KpiMeasureMapping" m
JOIN "KpiDefinition" k ON k.id = m."measureKpiId"
ORDER BY k.name;
```

Local development database (5 mappings): `Owner unit churn (TTM)` is `false`; the
other four are `true` and agree with their names. Production Neon was **not**
inspected or modified from this environment.

### If a correction is needed

Use Admin > Measure mappings (audited, admin-only) to set the direction, or
propose an explicit data migration naming each KPI and its approved direction.
Do not bulk-flip values from a name heuristic.

## 8. Residual risks and recommended follow-ups

1. **Names are still heuristic** for metrics that carry no mapping. Unknown
   names stay neutral by design, so the remaining risk is an *uncoloured* delta
   rather than a wrongly coloured one.
2. **Sign-only inference** is gone: `favorableDelta` requires a known direction
   and applies the expense flip only to lower-is-better metrics whose comparator
   is negative.
3. **A mapping with an unstated direction still derives a value**, but its
   status is neutral. This is intentional: the number is factual, the verdict is
   not.
4. **Supporting KPIs have no status of their own** in the strategy house. They
   remain supporting measures; their metrics continue to appear in the reviewed
   report tables, where direction still comes from their definition name or
   mapping.
