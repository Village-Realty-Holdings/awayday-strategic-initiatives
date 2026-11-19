# October 2026 parity corrections — implementation and import plan

**Status:** implementation complete on `feat/review-visual-parity` (PR #26, stacked
on PR #25). Not merged, not deployed. **No production write, import, migration or
deployment was performed.** Every production figure quoted here comes from the
read-only handoff bundle (`october-2026-production-kpi-identities.json`, extracted
2026-11-19 from `frosty-resonance-20920085` / `br-silent-wildflower-b438bp7m` /
`neondb`) or from the reference page
`Awayday October 2026 Strategy Review(2).html`. Nothing in the reference bundle is
committed to git.

**Verdict: CONDITIONAL PASS** — the application now selects, labels and judges the
October measures correctly, but four configuration and content changes need
business approval and a reviewed production data change before the numbers match
the reference page. §12 lists them.

---

## 1. What the reference page actually says

Read directly from the supplied HTML (not reconstructed). Five value drivers, each
with a 2026 goal **and** an FY27 budget/stretch, which are different statements:

| Pillar | Measure (as printed) | Oct | YTD | 2026 goal | FY27 budget / stretch | Status printed |
| --- | --- | --- | --- | --- | --- | --- |
| M&A | Acquired EBITDA closed, YTD | $0.3M | $34.8M | $23M | ~$33M / $47M | Ahead |
| Grow New Units | BD unit adds, YTD (BD 2026 Master) | 330 | 3,340 | 23% | 22% / 30% | Ahead · CAC off track |
| Owner Retention | Annualized unit churn, YTD | 12.2% | 12.4% | <12% | 12% / 11% | Behind · October beat budget |
| TRevPAR Expansion | TRevPAR growth vs PY, YTD | −0.9% reported · −3.9% ex-OTA | +4.1% reported · +0.6% ex-OTA | +3.3% (reported) | +1% / 3% | On track reported · October under PY |
| Margin Expansion | Shop NOI margin vs PY, YTD | +0.5 pt ex-OTA · −0.4 pt reported | +0.8 pt ex-OTA · −1.0 pt reported | +0.7 pt (ex-OTA) | +0.25 pt / 1 pt | On goal ex-OTA · behind reported |
| Guest Experience | Review score (DOMO) | 4.64 | 4.65 | 4.65 | 4.65 / 4.70 | Floor breached |

The page states its own rule: *"Pillar status is judged against the 2026 goal; FY27
shows budget / stretch from the 12 Nov board pre-read."* That rule is now
implemented in code (§3).

---

## 2. What the production identities tell us

From the handoff JSON (61 `KpiDefinition` rows). The five pillar measures are the
FY27 **plan** definitions; the October **reviewed** measures exist separately and
carry no pillar link and no mapping:

| Pillar | Production pillar definition (id) | Mapping (id) | Direction | Basis / format | FY27 targets stored |
| --- | --- | --- | --- | --- | --- |
| M&A | `FY27:M&A` `cmvlea2930003repwgwy7lq1q` | `cmw2jexbw0000nkb7seoxwc8a` | higher | YTD · currency | 26,000,000 / 47,000,000 |
| Grow New Units | `FY27:GROW` `cmvlea2c80005repw11me2z7q` | `cmw2jexor0001nkb7n3zxtvj0` | higher | YTD · **percent** | 23 / 28 |
| Owner Retention | `FY27:RETENTION` `cmvlea2fd0007repw2rugfpzo` | `cmw2jey1e0002nkb7fommf2hj` | lower | **LTM** · percent | 11 / 9 |
| TRevPAR Expansion | `FY27:TREVPAR` `cmvlea2ig0009repwbl0utmwu` | `cmw2jeye60003nkb7c01j5rr0` | higher | YTD · percent | 1 / 5 |
| Margin Expansion | `FY27:MARGIN` `cmvlea2lk000brepwypu82b24` | `cmw2jeyqy0004nkb7825zmjbk` | higher | YTD · percent | 0.25 / 1 |

The reviewed October identities, all present in production with deterministic ids:

| Metric key | Id | What it is |
| --- | --- | --- |
| `user_review:bd_unit_adds` | `user-review-def-bd_unit_adds` | BD Unit Adds (BD Master) |
| `user_review:annualized_unit_churn` | `user-review-def-annualized_unit_churn` | Annualized Unit Churn (Finance) |
| `user_review:ttm_unit_churn_ares` | `user-review-def-ttm_unit_churn_ares` | TTM Unit Churn (Ares Pack) — independent measure |
| `user_review:trevpar_growth_reported` | `user-review-def-trevpar_growth_reported` | TRevPAR Growth vs PY (Reported) |
| `user_review:trevpar_growth_ex_ota` | `user-review-def-trevpar_growth_ex_ota` | TRevPAR Growth vs PY (Ex-OTA) — supporting |
| `user_review:shop_noi_margin_delta_py_ex_ota` | `user-review-def-shop_noi_margin_delta_py_ex_ota` | Shop NOI Margin vs PY (Ex-OTA, points) |
| `user_review:shop_noi_margin_delta_py_reported` | `user-review-def-shop_noi_margin_delta_py_reported` | Shop NOI Margin vs PY (Reported, points) — supporting |

**They are not interchangeable with the FY27 plan definitions.** `FY27:GROW` is
"Gross unit adds" (Finance adds, a percentage target); the October primary is BD
Master adds (a count). `FY27:RETENTION` is named "Owner unit churn (TTM)" and its
mapping is LTM; the October primary is annualized Finance churn on a YTD basis. The
values currently attached to the FY27 definitions happen to be the October figures,
which is exactly why the mismatch was easy to miss.

The model relationship is therefore: **a pillar's primary measure is the KPI that
carries the pillar's single active mapping.** Making the October measure the
primary means linking that reviewed definition to the pillar and activating its
mapping; it does **not** mean renaming the FY27 definition, rewriting its targets,
or moving observations. Nothing was renamed, repointed or written in this phase.

---

## 3. Task A/B — what changed in the application

| Change | File | Why |
| --- | --- | --- |
| Target markers now carry the planning **reference** their own text names (`2026`, `FY27`, or unknown) and the **quantity** the figure is written in (`percent`, `points`, `currency`, `count`). A year token is no longer counted as a second figure, so `"2026 goal $23M"` yields one goal marker. | `src/lib/review-format.ts` | The page sets the 2026 goal beside the FY27 targets; the parser must not merge them or drop them. |
| `primaryGoalMarker()` picks the figure a status may use: an explicitly-2026 goal first, then an unlabelled goal; never a budget, a stretch, or a figure labelled FY27. | `src/lib/review-format.ts` | "Judged against the 2026 goal" as a rule, not a coincidence. |
| `markerMatchesKind()` / `sameQuantity()` refuse a comparison across quantities. | `src/lib/review-format.ts` | Grow's goal is a growth percentage while its measure is a unit count; 3,340 against 23% is not a status. |
| `mappingRag()` takes an optional reference (the 2026 goal) and returns `GREY` when the target and value are in different quantities. | `src/lib/kpi-measure-mapping.ts` | A stale percentage target beside a count measure used to paint the pillar green. |
| `measureOrigin()` reports which figure the status used (`2026 goal` or `FY27 budget`) in its `reference` field and basis sentence. | `src/lib/kpi-measure-mapping.ts` | The caption must not call a 2026 goal a "budget target". |
| `statusAgainstTarget()` judges a scorecard row against the same goal, in the row's own quantity. | `src/lib/review-report.ts` | The pillar tables and the strategy house must agree. |
| The pillar measure passes the 2026 goal into the status when the definition states one. | `src/lib/review-data.ts` | The October status follows the 2026 reference. |
| Gauge markers are labelled with their context (`2026 goal`, `FY27 budget`, `FY27 stretch`). | `src/components/review/review-view.tsx` | A marker's meaning must be readable, not implied. |
| The measure editor says which reference it compared with. | `src/components/review/edit-dialogs.tsx` | Same reason, in the editing surface. |

### 2026 goal versus FY27 target — the rule now enforced

1. **Status** is judged against the pillar definition's own stated goal, in the
   measure's own quantity. A figure the target text labels FY27 is never used.
2. **FY27 budget and stretch** stay where they are — on the measure mapping
   (`targetBudget` / `targetStretch`). They are displayed as FY27, never as the
   October yardstick.
3. When the definition states no usable 2026 goal, the app falls back to the
   mapping's FY27 target **and says so** (`reference: "FY27 budget"`); when even
   that is in a different quantity, it claims no status at all (`GREY`).
4. **No production target was rewritten.** The stored FY27 figures differ from the
   board pre-read in four places (§11, D2) and remain untouched.

Regression tests added: 17 (`review-format`, `kpi-measure-mapping`, `review-report`,
`review-data`), including a test that a reviewed measure becomes the primary once
linked and mapped, that two active mappings go neutral, that an FY27-labelled goal
is refused, and that a count is never rated against a percentage.

---

## 4. Before / after mapping table — all five value drivers

**Not applied.** Column "proposed" is the reviewed configuration change; the
production ids are the ones from the handoff JSON.

| Pillar | Current primary (production) | Proposed primary | Existing definition id | Expected basis | Direction | Why | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M&A | `FY27:M&A` "Acquired EBITDA closed" | **unchanged identity**; add the 2026 goal `$23M` to the definition's target text and keep FY27 `~$33M` / `$47M` | `cmvlea2930003repwgwy7lq1q` (mapping `cmw2jexbw0000nkb7seoxwc8a`) | YTD · currency · consolidated | higher (unchanged) | Identity already matches the page. Only the target wording separates 2026 from FY27. | M&A owner (target text) |
| Grow New Units | `FY27:GROW` "Gross unit adds", percent, 23/28 | **`user_review:bd_unit_adds`** "BD Unit Adds (BD Master)", linked to the Grow area, mapping active, DIRECT · YTD · count · higher; FY27 targets 22 / 30 | `user-review-def-bd_unit_adds` | YTD · BD Master population · count | higher | The page's Grow primary is BD Master adds (3,340 YTD). Finance gross adds (3,546), organic (2,997) and October Finance adds (310) are different populations. The current mapping's percent format and 23/28 targets cannot describe a count. | Grow owner + engineering (definition→area link) |
| Owner Retention | `FY27:RETENTION` "Owner unit churn (TTM)", mapping **LTM**, 11/9 | **`user_review:annualized_unit_churn`** "Annualized Unit Churn (Finance)", linked to the Retention area, mapping active, DIRECT · **YTD** · percent · lower; FY27 12 / 11 | `user-review-def-annualized_unit_churn` | YTD · Finance annualized basis | lower | The stored 12.4% is the annualized **YTD** figure; TTM (13.0%) is a separate series and stays published as `user_review:ttm_unit_churn_ares`, a supporting row. | Retention owner + engineering |
| TRevPAR Expansion | `FY27:TREVPAR` "TRevPAR growth (YoY)", basis unstated, 1/5 | **`user_review:trevpar_growth_reported`** "TRevPAR Growth vs PY (Reported)", linked to the TRevPAR area, mapping active, DIRECT · YTD · percent · higher; FY27 1 / 3 | `user-review-def-trevpar_growth_reported` | YTD · reported basis (incl. Airbnb pass-through) | higher | The page's pillar measure is the reported basis; ex-OTA (+0.6% YTD) is a distinct supporting measure and is not interchangeable. | Revenue owner + engineering |
| Margin Expansion | `FY27:MARGIN` "Shop NOI margin vs PY", basis unstated, 0.25/1 | **`user_review:shop_noi_margin_delta_py_ex_ota`** "Shop NOI Margin vs PY (Ex-OTA, points)", linked to the Margin area, mapping active, DIRECT · YTD · **points** · higher; FY27 0.25 / 1 | `user-review-def-shop_noi_margin_delta_py_ex_ota` | YTD · ex-OTA basis · percentage points | higher | The page judges the pillar on the ex-OTA basis (+0.8 pt YTD); reported (−1.0 pt) is a separate supporting measure. Points, not percent. | Margin owner + engineering |

Rules for applying it (in this order, per pillar, in one edit):

1. Link the reviewed definition to the pillar (`KpiDefinition.strategicAreaId`).
   This is the only step the app cannot do today: Admin › Measure mappings only
   offers definitions already linked to an area in the active plan. It needs a
   reviewed data change.
2. Activate the reviewed definition's mapping with the direction and FY27 targets
   above, **and** switch the FY27 definition's mapping off in the same pass.
   Leaving both active renders the pillar as *ambiguous* — no primary, no status.
3. Put the 2026 goal into the pillar's target wording (e.g. M&A
   `2026 goal $23M · FY27 ~$33M / $47M stretch`).
4. Leave the old FY27 definition published: it is the supporting row.

---

## 5. Task C — Base Business P&L: what shows, what is missing

The eight principal Base Business lines display their **actuals** from approved
observations and nothing else. A comparison with no observation renders `—`
(`report-sections.tsx`), never a derived or remembered figure. The reference page
prints eight variance percentages; those are *variance* statements, not
observations, and are **not** used to synthesise a budget or a prior year.

Verified actuals in production (October): Adjusted EBITDA −$1.2M / YTD $79.9M,
Shop NOI $3.8M / YTD $119.5M, Revenue $25.2M / YTD $353.8M, LTM PF Lender EBITDA
$136.0M. The reference page adds Cost of sales (17.0)/(191.5), Shop opex
(4.4)/(42.7), SupportCo (3.6)/(31.1), Business development (1.7)/(12.7), Interest
income 0.3/4.2 — figures that must come from the Finance pack, not from this page.

**Missing identities — 32 rows** (8 lines × 2 bases × 2 comparisons). Each is an
approved observation on the existing `user_review:base_*` definition, with
`reportingScope = BASE_BUSINESS`, `entityScope = BASE_BUSINESS`, `entityId = null`,
`reportingPeriod = 2026-10`, `publicationState = APPROVED`, and the pack's own
value (signed as the P&L signs it: expenses negative).

| Line | Definition id | Missing observations |
| --- | --- | --- |
| Revenue | `user-review-def-base_revenue` | MONTHLY/BUDGET, MONTHLY/PRIOR_YEAR, YTD/BUDGET, YTD/PRIOR_YEAR |
| Cost of sales | `user-review-def-base_cost_of_sales` | same four |
| Shop opex | `user-review-def-base_shop_opex` | same four |
| Shop NOI | `user-review-def-base_shop_noi` | same four |
| SupportCo | `user-review-def-base_supportco` | same four |
| Business development | `user-review-def-base_business_development` | same four |
| Interest income | `user-review-def-base_interest_income` | same four |
| Adj. EBITDA | `user-review-def-base_adjusted_ebitda` | same four |

Authoritative source required: *Awayday 2026-10 Results (Internal), Flash EBITDA
Final 11 Nov* — the P&L tab that carries budget and prior-year columns — reconciled
to *Awayday 2026-10 Reporting Pack vFinal (Ares & LightBay)*. The page's own
variance percentages are a cross-check only; they must not be back-solved into
amounts (an EBITDA variance printed in dollars, with a base near zero, is not
invertible).

---

## 6. Task D — Historical series: import preview (not executed)

Three series are needed. All values below are transcribed from the reference page's
chart data; each row becomes one approved observation with the basis stated. Missing
months stay missing on the chart — the chart already keeps them as gaps and never
interpolates.

### 6.1 LTM Pro Forma Lender EBITDA and Base Business Adjusted EBITDA

Definition: `user_review:ltm_pf_lender_ebitda` (`user-review-def-ltm_pf_lender_ebitda`),
`timeBasis = LTM`, `comparisonBasis = ACTUAL`, monthly period. The Base Business line
is a **separate series** and must be its own definition with a declared basis: its
October point is $77.3M while the October YTD headline is $79.9M — different facts,
never substituted for one another. Production currently holds only the Oct-26
lender row.

| Period | LTM Pro Forma Lender EBITDA ($M) | Base Business Adjusted EBITDA — chart series ($M) |
| --- | --- | --- |
| Dec-25 | 86.4 | 69.4 |
| Jan-26 | 86.9 | 69.5 |
| Feb-26 | 104.0 | 68.9 |
| Mar-26 | 104.1 | 68.0 |
| Apr-26 | 109.1 | 67.7 |
| May-26 | 111.4 | 69.0 |
| Jun-26 | 118.8 | 71.6 |
| Jul-26 | 120.8 | 75.8 |
| Aug-26 | 123.3 | 77.3 |
| Sep-26 | 135.4 | 78.5 |
| Oct-26 | 136.0 | 77.3 |

**Unresolved accounting basis:** the page does not name the Base Business line's
basis. It is drawn dashed, sits below the lender line, and its October point is
$77.3M after a $1.2M weather addback and a +$0.5M tuck-in. Until the pack names the
basis (rolling twelve-month base business Adj. EBITDA including addbacks, or
excluding), this series must not be published. **Flagged, not guessed.** Sep-26
lender $135.4M is itself a **restatement** of the September review's $133.4M and
must be published as revision 2, not as an edit.

### 6.2 AwayDNA PMS TRevPAR

Definition `user_review:trevpar_awaydna_pms` (`user-review-def-trevpar_awaydna_pms`),
`timeBasis = MONTHLY`, `reportingScope = AWAYDNA_PMS`, `entityScope = AWAYDNA_PMS`.
Production holds October only ($90.7). Source: *AwayDNA dbt Semantic Layer*, queried
16 Nov. Sep-26 reads $129.4 (was $121.9 in the September review → revision 2).

| Period | AwayDNA PMS TRevPAR ($) |
| --- | --- |
| Aug-25 | 193.7 |
| Sep-25 | 106.5 |
| Oct-25 | 90.4 |
| Nov-25 | 60.3 |
| Dec-25 | 100.6 |
| Jan-26 | 98.5 |
| Feb-26 | 133.9 |
| Mar-26 | 168.5 |
| Apr-26 | 119.5 |
| May-26 | 148.6 |
| Jun-26 | 282.7 |
| Jul-26 | 333.4 |
| Aug-26 | 194.5 |
| Sep-26 | 129.4 |
| Oct-26 | 90.7 |

---

## 7. Task E — Brand churn: import preview (not executed)

Model: one observation per brand per column, `entityId = <brand>` (the table reads
brands only from `entityId`), `reportingPeriod = 2026-10`, `comparisonBasis = ACTUAL`,
`publicationState = APPROVED`, `reportingScope = AWAYDNA_PMS`,
`entityScope = BRAND`. Five definitions are needed (245 observations):

| Column | Definition key | `timeBasis` | Kind | Source |
| --- | --- | --- | --- | --- |
| Bookable units | `user_review:brand_bookable_units` | `POINT_IN_TIME` (16 Nov 2026) | count | AwayDNA dbt |
| Oct churned | `user_review:brand_churned_units` | `MONTHLY` | count | AwayDNA dbt |
| Oct annualized | `user_review:brand_churn_annualized_pct` | `MONTHLY` | percent | AwayDNA dbt |
| LTM churned | `user_review:brand_ltm_churned_units` | `LTM` (Nov-25 → Oct-26) | count | AwayDNA dbt |
| LTM churn | `user_review:brand_ltm_churn_pct` | `LTM` | percent | AwayDNA dbt |

Rules the table already enforces, and the import must respect: one population per
row; a column reads only its own time basis; totals are sums of reported counts with
percentages derived from them (never averaged); a brand with no denominator shows no
rate. Brand labels are the page's own (the HTML is the label source — no brand list
lives in code).

Two exceptions to publish explicitly rather than silently:
* **Beach Retreats is excluded** from the page (the Village Realty motels, exiting
  31 Dec 2026). If production carries rows for it, they must be published under a
  population the table does not include, or not published — not deleted.
* **Rent Branson** has no bookable units in AwayDNA: publish 0 bookable, 0 churned,
  and **no rate** (the page prints "n/a"). The table shows `—` where no rate exists.

Reference totals for reconciliation: 15,324 bookable · 169 October churned ·
1,868 LTM churned.

### 7.1 Row-by-row preview

| # | Brand (HTML label) | Bookable units (POINT_IN_TIME, 16 Nov 2026) | Oct churned (MONTHLY) | Oct annualized % (MONTHLY) | LTM churned (LTM, Nov-25→Oct-26) | LTM churn % (LTM) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Avada Properties | 306 | 4 | 16% | 174 | 57% |
| 2 | Scottsdale Rentals | 85 | 0 | 0% | 36 | 42% |
| 3 | Luxury Beach Rentals | 237 | 22 | 111% | 91 | 38% |
| 4 | Carolina Beach Realty | 172 | 4 | 28% | 55 | 32% |
| 5 | Stay Local Austin | 93 | 0 | 0% | 27 | 29% |
| 6 | Emerald Coast Retreats | 109 | 3 | 33% | 29 | 27% |
| 7 | Big Sky Vacation Rentals | 111 | 1 | 11% | 28 | 25% |
| 8 | Stay Montana | 422 | 13 | 37% | 81 | 19% |
| 9 | Sedona.org | 158 | 0 | 0% | 26 | 16% |
| 10 | SummitCove | 429 | 9 | 25% | 63 | 15% |
| 11 | Emerald Coast Vacation Rentals | 271 | 2 | 9% | 39 | 14% |
| 12 | Oregon Beach Vacations | 201 | 3 | 18% | 28 | 14% |
| 13 | Stay Winter Park | 304 | 2 | 8% | 42 | 14% |
| 14 | Village Realty | 974 | 14 | 17% | 133 | 14% |
| 15 | RealJoy | 1,893 | 27 | 17% | 254 | 13% |
| 16 | Sunset Rentals | 281 | 5 | 21% | 36 | 13% |
| 17 | Sun Palace Vacation Homes | 239 | 2 | 10% | 30 | 13% |
| 18 | Park City Rental Properties | 437 | 4 | 11% | 52 | 12% |
| 19 | Kiawah / Seabrook Exclusives | 208 | 1 | 6% | 24 | 12% |
| 20 | Great Ocean Condos | 454 | 7 | 19% | 50 | 11% |
| 21 | Resort Rentals | 474 | 3 | 8% | 51 | 11% |
| 22 | Great Western Lodging | 344 | 2 | 7% | 36 | 10% |
| 23 | Stony Brook Cabins | 197 | 1 | 6% | 19 | 10% |
| 24 | Echelon Luxury Properties | 136 | 0 | 0% | 13 | 10% |
| 25 | Retreatia | 290 | 2 | 8% | 27 | 9% |
| 26 | Lodging in Telluride | 54 | 0 | 0% | 5 | 9% |
| 27 | Stay Better Vacations | 165 | 0 | 0% | 15 | 9% |
| 28 | Pristine Properties Vacation Rentals | 365 | 1 | 3% | 33 | 9% |
| 29 | Vacation Homes Collection | 282 | 1 | 4% | 25 | 9% |
| 30 | Meredith Lodging | 785 | 13 | 20% | 69 | 9% |
| 31 | Bluewater Vacation Rentals | 571 | 4 | 8% | 47 | 8% |
| 32 | Pensacola Beach Properties | 258 | 0 | 0% | 21 | 8% |
| 33 | Gulf Coast Getaways | 70 | 0 | 0% | 5 | 7% |
| 34 | Blue Moon Vacation Rentals | 102 | 0 | 0% | 7 | 7% |
| 35 | Holiday Isle Properties | 442 | 2 | 5% | 30 | 7% |
| 36 | Luxury Coastal Vacations | 587 | 1 | 2% | 39 | 7% |
| 37 | Summit County Mountain Retreats | 639 | 1 | 2% | 41 | 6% |
| 38 | Sand 'N Sea Properties | 201 | 2 | 12% | 12 | 6% |
| 39 | Travel Life Vacations | 156 | 2 | 15% | 9 | 6% |
| 40 | Spinnaker's Reach Realty | 140 | 3 | 26% | 7 | 5% |
| 41 | Ski Country Resorts | 161 | 1 | 7% | 8 | 5% |
| 42 | Arrived | 270 | 0 | 0% | 13 | 5% |
| 43 | Warren Beach Rentals | 261 | 0 | 0% | 11 | 4% |
| 44 | All Seasons | 485 | 5 | 12% | 19 | 4% |
| 45 | Ocracoke Island Realty | 299 | 2 | 8% | 8 | 3% |
| 46 | Element Vacation Homes | 46 | 0 | 0% | 0 | 0% |
| 47 | Steamboat Lodging Company | 55 | 0 | 0% | 0 | 0% |
| 48 | Winter Park Lodging Company | 105 | 0 | 0% | 0 | 0% |
| 49 | Rent Branson | 0 | 0 | n/a | 0 | n/a |
| — | **All brands (as printed)** | **15,324** | **169** | **13%** | **1,868** | **12%** |

---

## 8. Task F — Alex's So-What's

Production holds **7 October so-what records** in `ReviewSoWhat` for the DRAFT
October period. That matches the reference page's seven sections exactly: the
summary, the five pillars, and Guest Experience. They are Strategy's content, read
by the review page from the database and edited only through the existing
`ReviewSoWhat` editor; nothing in this branch generates, rewrites or re-orders
them, and no Anthropic credential, endpoint, prompt or job was added.

Two limits to record, neither of them a reason to introduce a parallel system:

1. **Per-item tone is not stored.** `ReviewSoWhat` has `headline` and `body` only.
   The page colours each item red / green / yellow individually; the app currently
   colours a whole section by the pillar's status and each item inherits it. To
   match the page exactly, the store needs an optional per-item tone
   (`positive` / `negative` / `warning` / `neutral`) — an additive column that is
   engineering-owned and out of scope for this phase. The renderer already accepts
   the tone when it exists (`SoWhatList`'s `tone` field), so adding it later changes
   no presentation code.
2. **The "So what in the bridge" block** on the reference page (four items under the
   financials) has no home in the current scope model, which is summary + one scope
   per area. Representing it would mean a new scope value (e.g. `FINANCIALS`) and
   four rows — a content-and-schema decision, not a code change to make silently.

Everything else — the wording, the numbers quoted inside the sentences, the order,
and the red/green/yellow intent — is preserved because it lives in the database and
is untouched by this branch.

---

## 9. Task G — migration review (unchanged)

`prisma/migrations/20261118220000_kpi_mapping_direction_optional/migration.sql`
(`DROP DEFAULT`, `DROP NOT NULL`) is still **proposed only**. Production remains
`NOT NULL DEFAULT true`. Re-verified this phase:

| Check | Result |
| --- | --- |
| Existing true/false values | Unchanged: two catalogue operations, no row rewritten, no backfill. |
| Unknown directions stay neutral | `mappingRag` returns `GREY` for `null` before any comparison; `resolveDirection` treats `null` as declared-unknown and does not fall back to the name. |
| No unintended fallback to higher-is-better | The admin action maps `HIGHER`/`LOWER`/blank→`null` and rejects anything else (`error=direction`); no write path leaves the field unset. |
| Existing mappings and review statuses intact | Mapping rows and `ReviewPillarStatus` overrides are untouched; an approved status still wins over the calculated one. |
| Admin-only mapping writes | `adminSaveMeasureMapping` still calls `requireSession({ role: "admin" })` and audits every save. |
| No duplicate active primary | The action refuses a second active mapping per area (`error=primary-exists`), and the resolver renders `ambiguous` rather than choosing. |

Static review only; nothing applied to production or staging in this phase.

---

## 10. Self-review findings and corrections

| Area | Finding | Action |
| --- | --- | --- |
| Wrong status direction | A stale percentage target beside a count measure could paint a pillar green (Grow: 3,340 against 23). | Fixed: quantity guard returns `GREY`. Test added. |
| Target confusion 2026 / FY27 | Status was judged against the mapping's FY27 target; the page judges against the 2026 goal. | Fixed: 2026 goal preferred, FY27 labelled, fallback disclosed. Tests added. |
| Year token parsed as a figure | `"2026 goal $23M"` produced no marker at all, because the year counted as a second number. | Fixed: year/`FY27` tokens scrubbed before the one-figure rule. Test added. |
| Gauge marker meaning | Markers read "Goal / Budget / Stretch" with no context. | Fixed: labelled with their planning context. |
| Percentage vs percentage point | Already correct: a margin-vs-PY metric is `points` (`+0.8 pt`), a growth metric is `percent` (`+4.1%`), and `formatDelta` prints `pp`. Verified by existing tests. | No change |
| Population mixing | Reviewed definitions stay in their own populations; the finance table still excludes `user_review:*`; the pillar measure reads one population. | No change; test for a reviewed definition becoming a primary added |
| Duplicate counting | The brand table keys rows by population + brand; totals refuse across populations. | No change |
| Historical restatement | Sep-26 values are revisions, not edits; the chart marks revised points. | No change |
| Empty states | Missing comparisons render `—`; missing brands render the expected-identity note; missing primaries render "not configured". | No change |
| Gauge scaling | Domain derives from value + stated targets only; a mixed-quantity gauge is suppressed rather than drawn. | No change |
| Security / authorization | No auth, session, MFA, token, entitlement, audit or infrastructure file touched. `dev-auth` untouched; no new route. | Verified by diff |
| Protected files | Diff limited to `src/lib/review-format.ts`, `src/lib/kpi-measure-mapping.ts`, `src/lib/review-model.ts`, `src/lib/review-data.ts`, `src/lib/review-report.ts`, `src/components/review/review-view.tsx`, `src/components/review/edit-dialogs.tsx`, four test files and documentation. | Verified |

---

## 11. Validation

| Gate | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm test` | **63 files, 762 tests, all pass** (was 745; +17) |
| `npm run build` | pass |
| `npx prisma validate` | "The schema at prisma/schema.prisma is valid" |
| Local preview | `http://127.0.0.1:3000`, local Postgres `awayday_si_dev` only; strategy house, reviewer page and measure editor render; light and dark themes verified |

---

## 12. Decisions still needed

| # | Decision | Owner | Blocks |
| --- | --- | --- | --- |
| D1 | Link `user_review:bd_unit_adds` / `annualized_unit_churn` / `trevpar_growth_reported` / `shop_noi_margin_delta_py_ex_ota` to their pillars, then activate their mappings and switch the FY27 mappings off. | Pillar owners + engineering (data change) | The five-pillar identity match |
| D2 | FY27 targets in production are the earlier set; the board pre-read supersedes them for four pillars (M&A ~$33M vs $26M stored; Grow 22/30 vs 23/28; Retention 12/11 vs 11/9; TRevPAR 1/3 vs 1/5). Refresh the mappings? | FP&A + owners | FY27 markers, not the October status |
| D3 | Base Business line basis for the chart series ($77.3M October) — name it before publishing the series. | Finance | Historical chart |
| D4 | Publish the 32 Base Business comparison observations from the Finance pack. | FP&A | P&L "vs Bud / vs PY" columns |
| D5 | Approve the 26 historical rows and 245 brand-churn rows for import (after D3). | Finance + Strategy | Charts and the brand table |
| D6 | Add an optional per-item So-What tone and a `FINANCIALS` scope for the bridge so-whats. | Engineering + Strategy | Exact page parity for commentary |

### Execution order

1. Engineering review + merge decisions for PR #25 → #26 (stacked, unchanged).
2. Apply the migration through the approved release process.
3. D1 configuration (per pillar, one edit each: link → activate → switch off → target text).
4. D2 FY27 target refresh, if approved.
5. D3/D4/D5 approved imports, published as revision 1 (restatements as revision 2).
6. D6 schema decision for per-item tone.
7. Re-check the strategy house and the October page against the reference; then deploy.
