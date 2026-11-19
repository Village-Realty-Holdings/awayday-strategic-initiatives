# October 2026 review — Neon parity audit and publication preview

> **STATUS: NOT A NEON VERIFICATION — BLOCKED AT ACCESS.**
>
> No Neon connection exists in this environment. Step 1 of the brief (establish
> read-only access to `br-silent-wildflower-b438bp7m`) failed, so **no Neon row
> was read, counted or compared**. Every "Neon" column below says *not queried*.
> Sections A (counts), B (match/missing/conflict), C and D (coverage) are
> therefore **incomplete by design** — filling them in would mean inventing
> production results.
>
> What *is* verified here needs no database: the expected value inventory taken
> from the reference HTML, the observation identity each value requires, and a
> code-level review of how PR #25 selects rows. That is enough to name every
> place where the dashboard would show "missing" even though a value exists —
> which is the failure mode this audit is meant to catch.
>
> Access was checked and absent: no Neon MCP extension configured for goose; no
> `neonctl`; no `NEON_*` variables; no `~/.pgpass`; no keychain item; the repo
> `.env` points at a **local synthetic** database (`localhost/awayday_si_dev`,
> 151 observations), not at the target branch. No credentials were harvested
> from Cloudflare and none were supplied in conversation.

## Reference

`Awayday October 2026 Strategy Review.html` — the file the user confirmed on
18 Nov 2026 is the current reference (the "(2)" filename does not exist):

| Property | Value |
| --- | --- |
| Size | 72,952 bytes |
| Modified | 2026-11-16 11:15 |
| SHA-256 | `1c208ec94bd7874dded353c4f7559369c205faeecc47e26aded36ac8c378bd4b` |
| Title | "Awayday October 2026 Results" |

Figures below are transcribed from that file by parsing its tables and the
inline script that draws its charts. **Provenance is the HTML itself**: no
workbook cell, page number or Finance pack position is cited, because the HTML
does not state them.

---

## A. Executive summary

| | Count |
| --- | --- |
| Metric families expected by the reference | **55** |
| Brand rows expected | **49** brands × 5 columns = **245** cells |
| Historical chart points expected | **37** (11 lender + 11 Base Business + 15 AwayDNA TRevPAR) |
| Metric families verified present in Neon | **not queried** |
| Missing observations | **not queried** |
| Conflicting published values | **not queried** |
| Dashboard selection defects found by code review | **10** (section E) — all are "the row may exist and still not display" risks, not data gaps |

**Verdict: FAIL — blocked.** Not a failure of PR #25; the verification it asks
for could not be performed.

---

## B. HTML to Neon comparison

Every row below is a value the reference displays. "Identity required" is the
observation identity PR #25 must find for that value to appear; `BS` means
`reportingScope=BASE_BUSINESS` + `entityScope=BASE_BUSINESS`, `entityId=null`,
`sourceCategory=USER_REVIEWED_REPORT`, `publicationState=APPROVED`,
`metricKey` starting `user_review:`. Every row is **not queried** in Neon.

### B1. Executive cards (4)

| Card | Time basis | HTML value | Identity required |
| --- | --- | --- | --- |
| Oct Adj. EBITDA (base business) | MONTHLY / ACTUAL | −$1.2M | BS |
| YTD Adj. EBITDA | YTD / ACTUAL | $79.9M | BS |
| LTM PF Lender EBITDA, Oct-26 | LTM / ACTUAL | $136.0M | any population that publishes it |
| Oct Shop NOI | MONTHLY / ACTUAL | $3.8M | BS |

Comparisons printed by the HTML: `$1.8M under the $0.6M budget`, `$1.3M under
PY`; `+3.6% vs budget`, `+9.0% vs PY`; `+$0.7M in October`, `$86.4M at Dec-25`;
`−14.4% vs budget`, `+22.2% vs PY`. These need `BUDGET`/`PRIOR_YEAR` rows at the
card's own time basis and population — see F3 for why most cannot be sourced
from the HTML.

### B2. Base Business P&L (11 lines × Oct/YTD)

| Line | HTML Oct | HTML YTD | Identity required |
| --- | --- | --- | --- |
| Revenue | 25.2 | 353.8 | BS, MONTHLY + YTD, ACTUAL |
| Cost of sales | (17.0) | (191.5) | BS |
| Shop opex | (4.4) | (42.7) | BS |
| Shop NOI | 3.8 | 119.5 | BS |
| SupportCo | (3.6) | (31.1) | BS |
| Business development | (1.7) | (12.7) | BS |
| Interest income | 0.3 | 4.2 | BS |
| Adj. EBITDA | (1.2) | 79.9 | BS |
| Shop NOI margin (reported basis) | 15.2% | 33.8% | BS |
| Shop NOI margin (ex-OTA basis) | 17.1% | 36.9% | BS |
| Support % of revenue | 12.0% | 7.7% | BS |

Comparison columns the HTML prints (vs Bud / vs PY, both periods): percentages
for nine lines, dollar differences for Adj. EBITDA (−$1.8M / −$1.3M), points for
the three ratio lines.

### B3. Operating KPIs (12 × Oct/Budget/PY/YTD/Budget/PY)

The reference prints **raw budget and prior-year values** here, so these rows
can be sourced from the HTML itself.

| KPI | Oct | Budget | PY | YTD | YTD budget | YTD PY | Identity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TRevPAR (reported, incl. OTA pass-through) | $99.2 | $105.7 | $100.1 | $177.9 | $177.2 | $170.9 | BS |
| TRevPAR ex-OTA | $94.0 | $100.8 | $97.8 | $168.3 | $169.9 | $167.2 | BS |
| ADR | $205.9 | $216.3 | $220.9 | $300.8 | $310.0 | $315.9 | BS |
| Occupancy | 30.3% | 31.8% | 30.4% | 41.4% | 41.1% | 40.1% | BS |
| GBV ($M) | 45.1 | 45.1 | 38.3 | 740.9 | 712.4 | 605.2 | BS |
| Take rate | 50.2% | 48.6% | 47.1% | 44.6% | 43.3% | 42.2% | BS |
| Average units | 14,680 | 13,749 | 12,356 | 13,697 | 13,226 | 11,648 | BS |
| Unit adds (Finance, incl. tuck-ins) | 310 | 264 | 272 | 3,546 | 2,364 | 2,785 | BS |
| Organic unit adds (Finance) | 260 | 264 | 272 | 2,997 | 2,364 | 2,422 | BS |
| Annualized churn | 12.2% | 18.4% | 13.0% | 12.4% | 11.5% | 12.7% | BS |
| TTM churn | 13.0% | 13.7% | 13.4% | — | — | — | BS |
| Cash CAC (excl. SMQ, tuck-ins) | $7,306 | $5,046 | $5,420 | $6,563 | $5,352 | $4,621 | BS |

### B4. Pillar tables

| Section | Metric | Oct | YTD | 2026 goal | Identity population |
| --- | --- | --- | --- | --- | --- |
| M&A | Acquired EBITDA closed | $0.3M | $34.8M | $23M | undecided — see G2 |
| M&A | of which tuck-ins (EBITDA) | $0.3M | $4.2M | — | undecided |
| M&A | Deals closed | 1 | 21 | 22 | undecided |
| M&A | of which tuck-ins (deals) | 1 | 11 | — | undecided |
| M&A | Units acquired | 51 | 4,822 | 3,497 | undecided |
| M&A | Multiple paid, total / synergized | 3.9x / 3.5x | 9.0x / 7.6x | — | undecided |
| M&A | Under LOI | — | 10 · $8.8M | — | undecided (two facts in one cell) |
| M&A | Offers submitted | — | 7 · $22.1M | — | undecided (two facts in one cell) |
| Grow | BD unit adds (BD Master) | 330 (+12% vs 295) | 3,340 (+28% vs 2,608) | — | BD Master population |
| Grow | Saves (units retained by BD) | 26 | 309 | — | BD Master |
| Grow | Organic unit adds (Finance) | 260 (bud 264) | 2,997 (bud 2,364) | — | BS |
| Grow | Net unit adds (Finance) | 161 (bud 53) | 2,127 (bud 1,098) | — | BS |
| Grow | Ending units (Finance, base business) | 14,760 (bud 13,775) | — | — | BS |
| Grow | Cash CAC per add | $7,306 (bud $5,046) | $6,563 (bud $5,352) | — | BS |
| Retention | Unit churn, annualized (Finance) | 12.2% (bud 18.4%) | 12.4% (bud 11.5%) | <12% | BS |
| Retention | Unit churn, TTM (Ares pack) | 13.0% (bud 13.7%) | — | — | Finance reported |
| Retention | Units churned (Finance, base business) | 149 (bud 211) | 1,419 (bud 1,266) | — | BS |
| Retention | of which shop at fault | — | 758 (53%) | — | undecided |
| Retention | Units churned (AwayDNA, all brands) | 169 | 1,868 LTM | — | AwayDNA — see G2 |
| Retention | Bookable units (AwayDNA, 16 Nov) | 15,324 | — | — | AwayDNA |
| TRevPAR | TRevPAR, reported basis | $99.2 | $177.9 (bud $177.2) | — | BS |
| TRevPAR | TRevPAR, ex-OTA basis | $94.0 | $168.3 (bud $169.9) | — | BS |
| TRevPAR | ADR | $205.9 | $300.8 (bud $310.0) | — | BS |
| TRevPAR | Other fees per night (reported) | $120.9 | $129.5 (bud $120.8) | — | BS |
| TRevPAR | Paid occupancy | 30.3% | 41.4% (bud 41.1%) | — | BS |
| TRevPAR | TRevPAR, AwayDNA (PMS rent and fees) | $90.7 | — | — | AwayDNA |
| Margin | Shop NOI margin, ex-OTA | 17.1% (+0.5 pt) | 36.9% (+0.8 pt) | +0.7 pt | BS |
| Margin | Shop NOI margin, reported | 15.2% (−0.4 pt) | 33.8% (−1.0 pt) | — | BS |
| Margin | Adj. EBITDA margin, reported | −4.6% | 22.6% | — | BS |
| Margin | Support cost, % of revenue | 12.0% | 7.7% | — | BS |
| Margin | Cost-of-sales labour, % of revenue | 40.3% | — | — | BS |
| Margin | Cleaning margin | 20.5% (bud 21.9%) | — | — | BS |
| Margin | Maintenance margin | −20.0% (bud −10.3%) | — | — | BS |
| Margin | OTA margin | −3.2% (bud 5.9%) | — | — | BS |
| Guest | Average review score | 4.64 (Sept 4.65, PY 4.69) | 4.65 (TTM 4.66) | 4.65 | DOMO population |
| Guest | Reviews received | 14,954 (Sept 18,736, PY 12,784) | 175,852 (TTM 192,806) | — | DOMO |
| Guest | Brands under the 4.5 floor (TTM) | 6 | — | 0 | DOMO, derived across brands |

**Display-rounding note.** The P&L table prints $M to one decimal; stored values
are dollars. `25.2` → `$25,200,000` displays as `$25.2M`. A store of `25.2` on a
currency metric would display as `$25.20` and must not be used.

---

## C. Historical chart coverage

Reference chart 1 is `LTM pro forma lender EBITDA ($M)`, Dec-25 → Oct-26, with
Base Business Adj. EBITDA dashed over the same months.

| Month | Lender (solid) | Base Business (dashed) | Lender identity | Base Business identity |
| --- | --- | --- | --- | --- |
| 2025-12 | 86.4 | 69.4 | LTM / ACTUAL | **undetermined** |
| 2026-01 | 86.9 | 69.5 | LTM / ACTUAL | **undetermined** |
| 2026-02 | 104.0 | 68.9 | LTM / ACTUAL | **undetermined** |
| 2026-03 | 104.1 | 68.0 | LTM / ACTUAL | **undetermined** |
| 2026-04 | 109.1 | 67.7 | LTM / ACTUAL | **undetermined** |
| 2026-05 | 111.4 | 69.0 | LTM / ACTUAL | **undetermined** |
| 2026-06 | 118.8 | 71.6 | LTM / ACTUAL | **undetermined** |
| 2026-07 | 120.8 | 75.8 | LTM / ACTUAL | **undetermined** |
| 2026-08 | 123.3 | 77.3 | LTM / ACTUAL | **undetermined** |
| 2026-09 | 135.4 (restated) | 78.5 | LTM / ACTUAL, revision 2 | **undetermined** |
| 2026-10 | 136.0 | 77.3 | LTM / ACTUAL | **undetermined** |

Reference chart 2 is AwayDNA PMS TRevPAR, Aug-25 → Oct-26:

| Month | Value | Month | Value | Month | Value |
| --- | --- | --- | --- | --- | --- |
| 2025-08 | 193.7 | 2026-01 | 98.5 | 2026-06 | 282.7 |
| 2025-09 | 106.5 | 2026-02 | 133.9 | 2026-07 | 333.4 |
| 2025-10 | 90.4 | 2026-03 | 168.5 | 2026-08 | 194.5 |
| 2025-11 | 60.3 | 2026-04 | 119.5 | 2026-09 | 129.4 (restated from 121.9) |
| 2025-12 | 100.6 | 2026-05 | 148.6 | 2026-10 | 90.7 |

Coverage in Neon: **not queried**. 22 lender/Base Business points and 15
AwayDNA points expected.

---

## D. Brand churn coverage

49 brands × {bookable units, October churned, October annualized %, LTM churned,
LTM %}. Reference totals: 15,324 bookable · 169 October churned · 1,868 LTM
churned; totals-row percentages 13% and 12%, derived as 169×12÷15,324 and
1,868÷15,324 (verified arithmetic; every brand's own rates reconcile to its
counts ÷ bookable units).

Coverage in Neon: **not queried**. The exact per-brand values are encoded in
`src/lib/review-report.reference.test.ts` (49 rows) and asserted against the
shaping code, so the *rendering* half is proven; only the *stored* half is open.

Identity required per cell: `entityId` = brand name, `entityScope` = BRAND,
`reportingScope` = the AwayDNA population, one explicit `timeBasis` per column
(POINT_IN_TIME / MONTHLY / MONTHLY / LTM / LTM), `comparisonBasis` = ACTUAL,
`sourceCategory` = USER_REVIEWED_REPORT, one definition per column.

---

## E. Dashboard rendering and selection gaps (code review of PR #25)

These are code facts, not data questions. Each one can make a value that exists
in Neon display as "not loaded".

**E1 — Definition key prefix is mandatory.** `review-report-data.ts` loads only
definitions whose `metricKey` starts with `user_review:`. A reviewed definition
stored under any other key is invisible to the whole page, including the exec
cards and charts.

**E2 — Source category must be exactly `USER_REVIEWED_REPORT`.** Both queries
filter `sourceCategory = 'USER_REVIEWED_REPORT'`. Nothing in this repository
writes that value: Edit Mode and the MCP `set_pillar_measure` write
`sourceCategory = 'MANUAL'` (`review-kpi.ts`), and the Prisma import/seed
scripts write their own categories. If the 164 reviewed observations the user
confirmed carry a different category — or none — **every reviewed section
renders empty while the data is present**. This is the single highest-risk
selection defect and the first thing to check in Neon:

```sql
SELECT "sourceCategory", count(*) FROM "KpiObservation"
WHERE "reportingPeriod" = '2026-10' GROUP BY 1 ORDER BY 2 DESC;
```

**E3 — Current means APPROVED and not INVALID/UNAVAILABLE.** Superseded rows are
excluded correctly. But a reviewed value that is still `DRAFT` or carries
quality `STALE` will not appear; the page says "not loaded" rather than "draft".

**E4 — Sections split by (reportingScope, entityScope) pair.** A Base Business
row stored with `entityScope` null and another with `BASE_BUSINESS` produces two
sections and a split table that looks like missing data.

**E5 — Chart history is name-filtered.** The history query only returns
definitions whose **name** contains `ebitda` or `trevpar`, within 24 months of
the period. A series published under a name without those words never reaches
the chart, however well the identity is set.

**E6 — The Base Business chart line is deliberately blank.** It refuses the
headline identity (see G1) and refuses to infer a basis. Until its own
definition exists with an explicit `timeBasis`, the dashed line plots nothing.

**E7 — Brand rows need `entityId` and an explicit `timeBasis`.** A row with no
basis, or a basis that does not match its column, is dropped and counted in the
table note; a row with no `entityId` is not a brand row at all.

**E8 — Pillar attribution is not re-curated.** A metric linked to a
`StrategicArea` appears there; if it is linked to the wrong area, it stays
wrong. Unlinked metrics fall back to name-based expectations. Linkage must be
checked in Neon, not assumed.

**E9 — Unmatched P&L labels sort to the end.** A line whose name does not match
the catalogue's aliases appears after the ordered block, alphabetically, with no
error. It looks like a new line rather than a mis-named one.

**E10 — Deltas are absolute, the report prints percentages.** For a currency
metric the dashboard shows `+$1.5M` where the HTML shows `+5.7%`; for ratio
metrics it prints `pp` where the HTML prints `pt`. Values are not wrong, but the
two are not visually identical. This is a display-parity gap, separate from any
data gap.

---

## F. Proposed publication preview

**Nothing here has been written.** No observation, definition, revision or
publication state was created.

### F1. Historical EBITDA (22 rows)

| Definition | Rows | Identity |
| --- | --- | --- |
| `user_review:ltm_pro_forma_lender_ebitda` (existing) | 11 (2025-12 → 2026-10) | LTM / ACTUAL / Finance reported; 2026-09 as revision 2 |
| Base Business history — **new definition required** | 11 | basis undeclared by the report — see G1 |

### F2. AwayDNA TRevPAR history (15 rows)

One `MONTHLY` / `ACTUAL` row per month, Aug-25 → Oct-26, on the AwayDNA
population, definition named so that it contains "trevpar" (E5). 2026-09 is the
restated 129.4.

### F3. Brand-level churn (245 rows)

49 brands × 5 columns. Counts: bookable units, October churned, LTM churned
(147 rows). Rates: October annualized, LTM churn (98 rows) — both are published
by the report and also equal counts ÷ bookable, so storing the published rate
keeps the report's own number authoritative.

### F4. Other missing October KPIs

- **Actuals the HTML prints directly** — 11 P&L lines × {MONTHLY, YTD}, 12
  operating KPIs × {MONTHLY, YTD}, and the pillar rows above. Sourced from the
  HTML, provenance = the HTML.
- **Budget and prior-year KPI values** — available for the 12 operating KPIs
  (the table prints them). Sourced from the HTML.
- **Budget and prior-year P&L values** — **not in the HTML**: it prints only the
  *differences* ("+5.7% vs budget"). These cannot be published from this source
  without deriving them, which would make a Finance figure out of arithmetic.
  They must come from the Finance pack.
- **Derived deltas are never published.** The dashboard computes them (E10);
  they are not observations.

### F5. Missing KPI definitions

At minimum: the Base Business history definition (G1), the AwayDNA population
definitions if absent, and the per-brand churn definitions if absent. Exact
count requires the Neon inventory.

### Every preview row carries the same required fields

`metricKey` · `reportingPeriod` · `reportingScope` · `entityScope` · `entityId`
(where applicable) · `comparisonBasis` · `timeBasis` · numeric `value` · `unit`
· `sourceCategory = USER_REVIEWED_REPORT` · `sourceDocumentName = "Awayday
October 2026 Strategy Review.html"` · `sourceLocation` = the section and table
the value came from (e.g. "P&L · October MTD and YTD") · `publicationState =
APPROVED` · `valueDerivation = REPORTED` · `authorityRank` per the existing
ingestion scale · conflict check against any existing approved row with the same
identity.

---

## G. Conflicts requiring a decision

**G1 — The Base Business historical line has no stated basis.** The chart's
dashed line ends at `$77.3M` for October; the YTD headline is `$79.9M`; the
monthly actual is `−$1.2M`. Its caption ("fell $1.3M in the month to $77.3M")
describes a level, so it is not the monthly figure and it is not the YTD
headline. Publishing it as "YTD" or "LTM" would be a guess. **Needs Finance to
name the basis**, then it can be published as its own definition.

**G2 — Population names are only partly agreed.** The report separates Finance
base business from AwayDNA (PMS) and from the BD Master. The code exports scope
constants for exactly two populations — `BASE_BUSINESS_SCOPE`
(`BASE_BUSINESS|BASE_BUSINESS`) and `REPORTED_SCOPE`
(`USER_REVIEWED_REPORTED|REPORTED`) — and recognises `AWAYDAY_CONSOLIDATED`,
`EX_OTA` and `AWAYDNA_PMS` only as display labels in `SCOPE_LABELS`. There is no
constant for AwayDNA and **no label at all for the BD Master**. Because sections
are split by the `(reportingScope, entityScope)` pair (E4), publishing an
AwayDNA or BD row under a guessed pair creates a new section with a lowercased
raw name instead of the intended label — and the brand table, which groups by
population, would report "no total across populations". Agree the exact pair for
each before publishing anything from those sources.

**G3 — Two facts in one cell.** "Under LOI: 10 · $8.8M" and "Offers submitted:
7 · $22.1M" each pair a deal count with a value. They cannot be one observation;
they need two definitions each (count and $M).

**G4 — Source category.** E2 must be settled first: if the existing 164 reviewed
observations are not `USER_REVIEWED_REPORT`, either the dashboard filter or the
stored category has to change — and changing the filter is a code change to a
security-adjacent read path, so it needs engineering sign-off rather than a
silent edit.

**G5 — September restatements.** Lender `$135.4M` (was `$133.4M`) and AwayDNA
TRevPAR `$129.4` (was `$121.9`). The publication model handles these as a new
revision superseding the old row; the old row must not be edited in place.

---

## H. Recommended next steps

1. **Grant read-only Neon access** (MCP server, or a SELECT-only role). Nothing
   below can proceed without it.
2. **Run E2's query first.** If the source category is wrong, no amount of
   publishing will make the page render.
3. Run the full inventory (definitions, October rows, scopes, bases, states,
   revisions) and complete sections A–D of this document.
4. Decide G1 and G2 — these block the Base Business chart and every AwayDNA row.
5. Publish actuals that the HTML states, with HTML provenance, after a
   row-by-row preview and explicit approval.
6. Source P&L budget and prior-year **values** from the Finance pack, not from
   the HTML's differences.
7. Re-run the audit with real counts, then compare the rendered page against the
   HTML section by section.

---

## Verification performed for this document

- Reference parsed directly (10 tables, 2 inline chart series, 49 brand rows).
- Brand totals recomputed from the rows: 15,324 / 169 / 1,868; totals-row rates
  13% and 12% reproduce from counts ÷ bookable units.
- Code review of `review-report-data.ts`, `review-report.ts`, `review-format.ts`,
  `review-kpi.ts`, `mcp.ts` for the selection rules in section E.
- **No database was contacted.** No observation, definition, revision,
  publication state, scope, permission, branch or migration was created,
  changed or deleted. No secret was printed. No deployment was made.
