# October 2026 parity corrections — implementation and import plan

**Status:** implementation complete on `feat/review-visual-parity` (PR #26, stacked
on PR #25). Not merged, not deployed. **No production write, import, migration or
deployment was performed.** Every production figure quoted here comes from the
read-only handoff bundle (`october-2026-production-kpi-identities.json`, extracted
2026-11-19 from `frosty-resonance-20920085` / `br-silent-wildflower-b438bp7m` /
`neondb`) or from the reference page
`Awayday October 2026 Strategy Review(2).html`. Nothing in the reference bundle is
committed to git — it lives in `.reference/`, which is gitignored.

> **Reference bundle — verified this session.** `Awayday October 2026 Strategy
> Review(2).html` and `october-2026-production-kpi-identities.json` are now present
> in `.reference/` (gitignored; they contain business financial content and are
> never committed). The values in §1, §6.0, §7 and §8 were re-checked **against the
> HTML itself** this session, not against earlier notes: the chart arrays
> (`lender=[11]`, `base=[11]`, `v=[15]`), the 49-brand table with its 15,324 / 169 /
> 1,868 totals, the FY27 figures, and all 33 So-What items. Where a claim depends on
> production *observations* — which the identity export does not contain — it is
> marked **NOT VERIFIED** in §6.0.

**Verdict: CONDITIONAL PASS** — the application now selects, labels and judges the
October measures correctly, refuses to invent a status where the 2026 goal is
missing, stores per-item commentary tone with a backward-compatible migration, and
carries a runnable, idempotent, dry-run-by-default configuration script for the five
primaries. What remains is business approval plus reviewed production data changes:
FY27 target refresh, Base Business basis, the imports, and the four bridge texts.
§12 lists them.

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

**Re-verified against the identity export (61 rows, 2026-11-19).** Every one of the
53 `user_review:*` definitions in production has `area = null` and `mapping_id =
null` — they are published definitions that no pillar reads and no mapping selects,
which is precisely why the pillars fall back to the FY27 definitions. The five FY27
pillar definitions and their single active mappings are exactly as tabulated above
(`FY27:M&A` currency 26,000,000 / 47,000,000; `FY27:GROW` percent 23 / 28;
`FY27:RETENTION` percent 11 / 9 on **LTM**, lower-is-better; `FY27:TREVPAR` percent
1 / 5; `FY27:MARGIN` percent 0.25 / 1). `FY27:GUEST`, `FY27:MARKETING` and
`FY27:TECH` carry no mapping, so Guest Experience's status comes from elsewhere —
not from a mapping this change touches.

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
| A pillar with no usable 2026 goal shows a neutral **"Not configured"** badge, and the caption names the missing piece (`no-goal`, `goal-not-comparable`, `no-basis`, `no-direction`, `no-value`). | `src/lib/kpi-measure-mapping.ts`, `src/lib/review-model.ts`, `src/components/review/kpi-status-badge.tsx`, `src/components/review/review-view.tsx` | A grey badge alone hides the cause; the owner needs to know what to configure. |
| FY27 figures are shown as *context only*, never as the yardstick. | `src/lib/kpi-measure-mapping.ts`, `src/components/review/edit-dialogs.tsx` | Satisfies "FY27 budget/stretch remain displayed" without letting them set a colour. |
| So-What items store an optional semantic tone; the bridge commentary has a `FINANCIALS` scope. | `prisma/schema.prisma` + migration, `src/lib/review-model.ts`, `src/components/review/so-whats.tsx`, `so-what-editor.tsx`, `review-editor.tsx`, `review-view.tsx`, `src/lib/review-edits.ts`, `src/lib/mcp.ts` | Page parity for commentary (§8). |

### 2026 goal versus FY27 target — the rule now enforced

1. **Status** is judged against the pillar definition's own stated goal, in the
   measure's own quantity. A figure the target text labels FY27 is never used.
2. **FY27 budget and stretch** stay where they are — on the measure mapping
   (`targetBudget` / `targetStretch`). They are displayed as FY27 context beside
   the measure, never as the October yardstick.
3. **There is no fallback.** Earlier in this branch the calculator fell back to the
   mapping's FY27 target when no 2026 goal was stated, and labelled the fallback.
   That path is gone: `mappingRag()` now requires a goal before it will return any
   colour, so no code path runs from an FY27 figure to a red/amber/green status.
   When the 2026 goal cannot be established the pillar shows a neutral **"Not
   configured"** badge and names what is missing.
3a. **An unlabelled figure that *is* the FY27 budget is refused too.** Production's
   M&A target text reads `$26M total` — the stored FY27 budget written without a
   label — and a naive parser reads that as a goal. `isPlanningFigure()` therefore
   compares an unlabelled goal with the mapping's own `targetBudget` /
   `targetStretch` (0.5% tolerance, so `$26.0M` still matches 25,980,000) and
   refuses it as FY27 planning data. A figure the text explicitly calls `2026` is
   never refused this way. This is what makes "FY27 never determines October
   status" true in production *before* the configuration script runs, rather than
   only after.
4. **No production target was rewritten.** The stored FY27 figures differ from the
   board pre-read in four places (§12, D2) and remain untouched.

### The gap vocabulary — what "Not configured" says, and why

A bare grey badge hides the cause. `statusGap()` returns one of five named gaps,
which the badge tooltip and the caption under the measure print:

| Gap | Meaning | What an owner must do |
| --- | --- | --- |
| `no-goal` | The definition states no 2026 goal (only FY27 figures, or nothing). | Write the 2026 goal into the target wording. |
| `goal-not-comparable` | A goal exists but is a different quantity from the measure (e.g. 3,340 units against a 23% growth goal). | State the goal in the measure's own unit. |
| `no-basis` | The mapping declares no reporting time basis, so "YTD" cannot be assumed. | Set the mapping's basis. |
| `no-direction` | Nobody said whether higher or lower is better. | Set the direction. |
| `no-value` | There is no usable observation for the period. | Ingest the observation. |

Rules that survive unchanged:
- **A manually approved `ReviewPillarStatus` stays authoritative.** The view shows
  "Not configured" only when a gap exists *and* no one has approved a status; an
  approved status still wins over every calculated one.
- **Direction rules are preserved**: higher-is-better, lower-is-better, and *not
  stated* is neutral (never green).
- FY27 budget/stretch remain visible as context in the measure editor, labelled
  "context only, not the October yardstick".

Regression tests added: 17 in the earlier pass plus 12 in this one
(`review-format`, `kpi-measure-mapping`, `review-report`, `review-data`,
`october-primary-measures`), including: a reviewed measure becomes the primary
once linked and mapped; two active mappings go neutral; an FY27-labelled goal is
refused; a count is never rated against a percentage; a missing goal, an
unparseable goal, a missing basis and a missing direction each yield "Not
configured" with the right gap name; and an approved status survives a gap.

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

### 4.1 The reviewed configuration, as code (dry run by default; not applied)

The change is expressed as explicit configuration, not as a name heuristic, in
`src/lib/october-primary-measures.ts`, and executed by
`prisma/configure-october-2026-primary-measures.ts`:

```
npx tsx prisma/configure-october-2026-primary-measures.ts                     # dry run
npx tsx prisma/configure-october-2026-primary-measures.ts --apply --snapshot before.json
npx tsx prisma/configure-october-2026-primary-measures.ts --revert --snapshot before.json
```

Why it is safe to hand to engineering:

| Property | How it is guaranteed |
| --- | --- |
| Dry run by default | Nothing is written without `--apply`. The default prints a plan summary and the human-readable change lines. |
| Identity by key, never by name/position | Pillars are loaded by `StrategicArea.code`; definitions by `metricKey`. A missing reviewed definition aborts with "Create the reviewed definition first; this script never invents one." |
| Exactly one active primary per driver | The planner proves the end state, and the executor re-checks inside the transaction: `if (active > 1) throw`. Two active mappings would render a pillar *ambiguous*, so the script refuses rather than guessing. |
| Old primary switched off in the same pass | Deactivating `FY27:GROW / RETENTION / TREVPAR / MARGIN` is a planned change, so there is no window in which two primaries are active. |
| FY27 figures untouched | `set-mapping` never writes `targetBudget` / `targetStretch` on update, and the M&A identity keeps its mapping (so no mapping write at all for M&A). The HTML's ~$33M is **not** written — that is D2, FP&A's decision (§12). |
| No observation, rename or publication | The script writes only definition→area links, mapping rows and target *wording*; it never touches `KpiObservation`, never renames a KPI, never publishes. |
| Idempotent | Running it on its own output yields "Already configured: nothing to write." A target already stating the same goal is left alone. |
| Rollback | `--apply --snapshot` records the prior definition/mapping state; `--revert --snapshot` restores it. |

Exact planned target wording, taken from the tests (the 2026 goal is **prefixed** to
wording the business already has — no existing figure is rewritten):

| Definition | Before (production wording) | After |
| --- | --- | --- |
| `FY27:M&A` | `$26M total` | `2026 goal $23M · $26M total` |
| `user_review:annualized_unit_churn` | (none) | `2026 goal <12%` |
| `user_review:trevpar_growth_reported` | (none) | `2026 goal +3.3% reported` |
| `user_review:shop_noi_margin_delta_py_ex_ota` | (none) | `2026 goal +0.7 pt ex-OTA` |
| `user_review:bd_unit_adds` | (none) | **no goal written** — see below |

**Grow is deliberately goal-less.** The reference's Grow goal is a growth percentage
(23%) while the October primary is a BD Master unit count (3,340 YTD). Writing one
beside the other would recreate exactly the bug §3 removed. The script records
`GROW: no 2026 goal written` in its notes; the pillar shows "Not configured" until
an owner supplies a count-based 2026 goal or approves a `ReviewPillarStatus`. That is
the honest state, not a gap in the script.

Dry-run evidence on the local dev seed: the script aborts and writes nothing, because
the reviewed definitions are absent from the seeded local database
(`KPI user_review:bd_unit_adds (GROW primary) does not exist…`). The plan itself is
covered by 12 unit tests against a production-shaped fixture. **The production run
remains pending engineering approval.**

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

### 6.0 Reconciliation — 37 reference observations, not 26 rows to import

The earlier pass reported "26 historical rows". That number was the sum of two of
the three series and omitted the Base Business line entirely. The reference page
carries **37** monthly observations. The arithmetic and the per-series split:

| # | Series | Expected | Present in production | Missing | Conflicting | Needs a new definition | Blocked by unresolved basis | Rows proposed for import |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: |
| A | LTM Pro Forma Lender EBITDA (`user_review:ltm_pf_lender_ebitda`) | 11 | 1 (Oct-26 $136.0M) | 10 | 1 (Sep-26: holds $133.4M rev 1; reference $135.4M) | 0 | 0 | 11 |
| B | Base Business Adjusted EBITDA, chart series | 11 | 0 as its own series | 11 | 0 | 11 | 11 | 0 |
| C | AwayDNA PMS TRevPAR (`user_review:trevpar_awaydna_pms`) | 15 | 1 (Oct-26 $90.7) | 14 | 1 (Sep-26: holds $121.9; reference $129.4) | 0 | 0 | 15 |
| — | **Total** | **37** | **2** | **35** | **2** | **11** | **11** | **26** |

Arithmetic, stated plainly:

- Expected: 11 + 11 + 15 = **37**.
- Present: 1 + 0 + 1 = **2** (the two October observations production already
  holds).
- Missing: 10 + 11 + 14 = **35**. Check: 2 present + 35 missing = 37 expected.
- Of the missing, **11** (series B) need a *new* definition before any row can be
  written, because the Base Business line is a different fact from the lender line.
- Of those 11, **all 11** are also blocked pending Finance naming the series'
  accounting basis — so B contributes **0** rows proposed today.
- Rows proposed now: 11 (A) + 0 (B) + 15 (C) = **26**. This is where the earlier
  "26" came from: 37 reference observations − 11 blocked Base Business points =
  26 importable rows. The figure was right; the label ("26 historical rows") was
  wrong because it silently dropped series B.

Two reconciliations that must not be collapsed:

1. **Series B's Oct-26 point is $77.3M; the October YTD Adjusted EBITDA headline is
   $79.9M.** They are different reported facts — a rolling chart point versus a
   year-to-date total. Neither may be substituted for the other, and the app never
   derives one from the other.
2. **The two "conflicting" rows are restatements, not edits.** Sep-26 lender
   $133.4M → $135.4M and Sep-26 AwayDNA $121.9 → $129.4. They are published as
   **revision 2** (superseding revision 1), so the September review's published
   history is preserved rather than overwritten. The chart marks a revised point.

Production existence caveat: the "present in production" column records the two
October rows an earlier read-only query reported. The identity export in
`.reference/` holds `KpiDefinition` rows only — no observations — so presence is
**NOT VERIFIED from this bundle** and no additional presence is assumed. The count
that matters for review is the right-hand column: 26 importable rows, 11 blocked.

The three arrays were re-read from the page's own script this session:

```js
var lender=[86.4,86.9,104.0,104.1,109.1,111.4,118.8,120.8,123.3,135.4,136.0];   // 11
var base  =[69.4,69.5,68.9,68.0,67.7,69.0,71.6,75.8,77.3,78.5,77.3];           // 11
var v     =[193.7,106.5,90.4,60.3,100.6,98.5,133.9,168.5,119.5,148.6,282.7,
            333.4,194.5,129.4,90.7];                                            // 15
```

11 + 11 + 15 = **37**, and the page's own caption confirms the restatement:
*"September is restated to $135.4M."*

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
excluding), this series must not be published. **Flagged, not guessed.** It
therefore shows **11 expected / 11 missing / 11 needing a new definition / 11
blocked / 0 rows proposed** in §6.0. Sep-26 lender $135.4M is itself a
**restatement** of the September review's $133.4M and is published as revision 2,
not as an edit; the same is true of Sep-26 AwayDNA $129.4 (was $121.9).

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

The reference page carries **8 commentary sections and 33 items**: the executive
summary (4), the financial bridge (4), the five pillars (4 each) and Guest
Experience (5). Verified against the HTML this session.

**What is stored today:** 29 rows in `ReviewSoWhat` for the DRAFT October period —
the executive summary, five pillars and Guest Experience. Their headlines and bodies
match the page **exactly**, with one typographic difference: the page's bold headline
ends in a full stop that the stored `headline` omits (the renderer prints headline and
body separately, so this is the only visual difference). The gap is therefore precise
and small: **4 missing bridge rows and 33 missing tones**, not 33 missing items.

The commentary is Strategy's content, read by the review page from the database and
edited only through the existing `ReviewSoWhat` editor; nothing in this branch
generates, rewrites or re-orders it, and no Anthropic credential, endpoint, prompt or
job was added.

Both limits recorded in the previous pass are now closed, with the smallest additive
change that keeps existing rows valid:

**A. Per-item tone is stored (optional).** `ReviewSoWhat` gained a nullable
`tone` column typed by a new `SoWhatTone` enum — `POSITIVE`, `WARNING`, `NEGATIVE`,
`NEUTRAL`. Persisted values are semantic, **never CSS class names**; the renderer
maps them to presentation tones (`soWhatToneFromStored`). Backward compatibility:
absent or unrecognised tone renders neutrally and *inherits the section's tone*, so
every pre-existing row keeps exactly the presentation it had. No default, no
backfill, no row rewritten. The editor gained an optional per-item select
("Inherit the section" plus the four values), `set_so_whats` accepts the same enum
through the existing MCP tool, and tone changes are written to the audit trail
alongside the headline.

**B. The bridge commentary has a dedicated scope.** `FINANCIALS` is now a
first-class scope, grouped separately from the area so-whats and rendered by a
dedicated `FinancialSoWhats` block under the financial bridge. It is *reserved*
safely: `reviewSoWhatScopes()` returns `financials: null` if an area of the active
plan already uses the code `FINANCIALS`, so a stored row can never be attributed to
the wrong section. The local plan's finance area is coded `FINANCE`, so the scope is
available here.

**The tone is the page's own colour, not an inference.** The page marks each item
with a CSS class — `up` (good news), `down` (bad news), `flag` (watch item) — and
those classes are presentation, so they are mapped to semantic values rather than
stored:

| Page class | Stored `SoWhatTone` | Items on the page |
| --- | --- | ---: |
| `up` | `POSITIVE` | 10 |
| `down` | `NEGATIVE` | 17 |
| `flag` | `WARNING` | 6 |
| — | `NEUTRAL` | 0 |

The complete, exact transcription of all 33 items — scope, order, headline, body and
tone — is `docs/october-2026-so-what-content-preview.md`. It is a **preview**: no row
was inserted, updated or deleted in any database.

**What is not done — deliberately.** The four bridge items and the 33 tones are not
written anywhere: writing them is a content import, and this phase is preview-only.
Equally: no Claude/Anthropic integration, no generated commentary, no background job,
no auto-publishing, no model credentials — that remains the separate future feature
described in `docs/claude-so-what-generation-design.md`.

Everything else — the wording, the numbers quoted inside the sentences, the order,
and the red/green/yellow intent — is preserved because it lives in the database and
is untouched by this branch; nothing is hardcoded in a component.

### 8.1 Proposed schema change (applied to local dev only)

`prisma/migrations/20261119044941_review_so_what_tone/migration.sql`:

```sql
CREATE TYPE "SoWhatTone" AS ENUM ('POSITIVE', 'WARNING', 'NEGATIVE', 'NEUTRAL');
ALTER TABLE "ReviewSoWhat" ADD COLUMN "tone" "SoWhatTone";
```

Additive and backward-compatible: the column is nullable with no default, so all
existing rows (29 in the local DRAFT period, all `NULL`) remain valid and unchanged.
Applied **only** to the local `awayday_si_dev` database in this session; not applied
to staging or production. Verified afterwards: the column type is `USER-DEFINED`,
`is_nullable = YES`, no default, and `prisma migrate status` reports the schema up to
date.

### 8.2 Content-import preview for the bridge commentary (not executed)

| Field | Value |
| --- | --- |
| Metric identity | Not a metric. Rows in `ReviewSoWhat` with `scope = 'FINANCIALS'`, `periodId = '2026-10'`. |
| Reporting period | `2026-10` (DRAFT). |
| Reporting scope | `FINANCIALS`. |
| Comparison basis | n/a (commentary). |
| Time basis | n/a (commentary) — the block is headed "October vs budget". |
| Entity scope / ID | Tenant's own review; `entityId = null`. |
| Source document | `Awayday October 2026 Strategy Review(2).html` (held in `.reference/`, gitignored). |
| Source location | Financials section, `<h4>So what in the bridge (October vs budget)</h4>`, immediately below the bridge table. |
| Value | **4 items, transcribed exactly** in `docs/october-2026-so-what-content-preview.md` rows 5–8: "Rent was under budget, fees held revenue up." · "OTA and maintenance margins missed." · "Support and BD spend took EBITDA below zero." · "Regions vs budget, YTD Adj. EBITDA (Ares pack):" — all four `NEGATIVE` on the page. |
| Publication state | Would be authored in DRAFT and approved with the period; not published here. |
| Revision policy | Replace-within-period (the existing `set_so_whats` semantics), audited. |
| Validation / rollback | Preview, then user-confirmed write through the authenticated editor or MCP tool; rollback = re-save prior rows (captured in the audit trail). |
| Status | **Ready for approval — content now verified. Not executed (preview only).** |

---

## 8A. Import register — the ten required fields, per proposed import

Every proposed production import is recorded here against the same ten fields, so
engineering can review a row without re-deriving its meaning. **Nothing in this
register has been executed.** Presence claims about production come from the
read-only handoff extraction; anything it does not show is **NOT VERIFIED**.

| Field | (1) Base Business comparisons | (2) LTM lender + Base Business history | (3) AwayDNA TRevPAR history | (4) 49-brand churn | (5) Missing So-What content/tones |
| --- | --- | --- | --- | --- | --- |
| Metric identity | `user_review:base_*` (8 existing definitions, §5) | `user_review:ltm_pf_lender_ebitda`; Base Business needs a **new** definition | `user_review:trevpar_awaydna_pms` | 5 new definitions (§7) | `ReviewSoWhat` rows, not metrics |
| Reporting period | `2026-10` | Dec-25 … Oct-26 (11 months each) | Aug-25 … Oct-26 (15 months) | `2026-10` (LTM columns cover Nov-25→Oct-26) | `2026-10` |
| Reporting scope | `BASE_BUSINESS` | lender: `REPORTED`; Base Business: `BASE_BUSINESS` | `AWAYDNA_PMS` | `AWAYDNA_PMS` | `SUMMARY`, area codes, `FINANCIALS` |
| Comparison basis | `BUDGET`, `PRIOR_YEAR` | `ACTUAL` | `ACTUAL` | `ACTUAL` | n/a |
| Time basis | `MONTHLY`, `YTD` | `LTM` (lender); **unstated → BLOCKED** (Base Business) | `MONTHLY` | `POINT_IN_TIME` (16 Nov 26), `MONTHLY`, `LTM` per column | n/a |
| Entity scope / ID | `BASE_BUSINESS` / `null` | `BASE_BUSINESS` / `null` | `AWAYDNA_PMS` / `null` | `BRAND` / brand name in `entityId` | tenant review / `null` |
| Source document | *Awayday 2026-10 Results (Internal), Flash EBITDA Final 11 Nov* | same pack + *Reporting Pack vFinal (Ares & LightBay)* | *AwayDNA dbt Semantic Layer* (queried 16 Nov) | AwayDNA dbt | `Awayday October 2026 Strategy Review(2).html` |
| Source location | P&L tab, budget & PY columns | EBITDA bridge / chart tab | TRevPAR tab | brand churn table | "So what in the bridge" block |
| Value | 32 values from the pack (**not** back-solved from printed variances) | 22 chart values (§6.1, verified from the HTML) | 15 chart values (§6.2, verified) | 245 values (§7.1, verified) | **exact** — 4 bridge items + 33 tones (`docs/october-2026-so-what-content-preview.md`) |
| Publication state | `APPROVED` on import, revision 1 | `APPROVED`, revision 1; Sep-26 as **revision 2** | `APPROVED`, revision 1; Sep-26 **revision 2** | `APPROVED`, revision 1 | DRAFT, approved with the period |
| Revision / restatement policy | New period observations; no edits to history | Restatements supersede by revision; never overwrite | Same | One row per brand per column per population; never merged | Replace-within-period, audited |
| Validation / rollback | Reconcile totals to the pack; rollback = delete the period's rows by id | Reconcile totals to $136.0M / $77.3M; rollback by id | Reconcile Oct $90.7; rollback by id | Totals 15,324 / 169 / 1,868 must tie; rollback by id | Re-save prior rows (audit trail) |
| Rows proposed now | 32 | **11** (lender); 0 Base Business (**blocked**) | 15 | 245 | 4 new items + 33 tones (**ready, preview only**) |

Reading the register: only sets (2) and (3) are importable without a business
decision, and only after the §12 decisions below are answered; (1) needs the pack
and D4; (4) needs D5 and the Beach Retreats / Rent Branson exceptions; (5) needs the
reference HTML is now present, so set (5) is ready but still unexecuted. **No set is
authorised to run from this branch.**

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

### 9.1 The So-What tone migration (applied to local dev only)

`prisma/migrations/20261119044941_review_so_what_tone/` — `CREATE TYPE "SoWhatTone"`
plus `ALTER TABLE "ReviewSoWhat" ADD COLUMN "tone" "SoWhatTone"` (see §8.1).

| Check | Result |
| --- | --- |
| Additive only | Creates an enum and one nullable column. No `DROP`, no type change, no data migration. |
| Existing rows stay valid | Nullable with no default, so the 29 local DRAFT rows were untouched (`tone = NULL` verified by query afterwards). |
| Old code keeps working | The column is optional on read; the renderer treats absent/unknown tone as neutral, inheriting the section tone. |
| Unknown values rejected at the boundary | `normalizeSoWhatTone()` accepts only the four semantic values (case-insensitive) and rejects CSS class names and non-strings — tested. |
| No arbitrary presentation strings stored | Values are `POSITIVE/WARNING/NEGATIVE/NEUTRAL`; the presentation tone is derived, never stored. |
| Applied where | Local `awayday_si_dev` only. `npx prisma migrate status` → 19 migrations, schema up to date. Staging and production untouched. |
| Rollback | `DROP COLUMN "tone"` then `DROP TYPE "SoWhatTone"`; lossless for existing rows because no row's other fields change. |

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

### 10.1 Second-pass self-review (this session)

| Area | Finding | Action |
| --- | --- | --- |
| Status colouring | The FY27-fallback path still produced a confident colour when a 2026 goal was absent — the exact defect Finding #1 names. | Removed by construction: `mappingRag` requires a goal, so no path runs from FY27 to a colour. Pillar shows "Not configured". Tests added. |
| Status colouring (2) | Production target text `$26M total` is the FY27 budget without a label; it parsed as a goal and would still have coloured the pillar. | `isPlanningFigure()` refuses an unlabelled goal that equals the mapping's FY27 budget/stretch. Tests: `$26M total` → `no-goal`; `$47M stretch` → `no-goal`; `$20M goal` still rates; `2026 goal $23M · $26M total` judges against $23M. |
| Status display | The "Not configured" state was only proven at the helper level, not shown to render. | `MeasureStatus` exported and covered by 7 render tests: each gap prints "Not configured" plus its explanation, an approved status still wins, and no verdict word leaks. |
| Reference fidelity | Earlier passes summarised the reference from notes, because the HTML was not in the working copy. | The bundle was located and copied to gitignored `.reference/`; the chart arrays (11/11/15), brand totals (15,324/169/1,868), FY27 figures, the 2026 goals and all 33 So-What items were re-read **from the HTML**, and the docs corrected: 8 sections not 7, 33 items not 29, tones POSITIVE 10 / NEGATIVE 17 / WARNING 6. |
| Production evidence | §2 inferred that the reviewed definitions are unlinked, from the mapping table. | Confirmed directly from the 61-row identity export (8 FY27 + 53 reviewed): all 53 `user_review:*` definitions have `area = null` and `mapping_id = null`. |
| Provenance of "present in production" | The reconciliation's presence column could look bundle-derived. | Stated explicitly: the bundle holds definitions only (no observations), so presence is **NOT VERIFIED** from it and rests on the earlier read-only query. |
| 2026 / FY27 selection | `statusGap()` was receiving the *accepted* reference instead of the *parsed* goal, so a count-vs-percentage case named `no-goal` rather than `goal-not-comparable`. | Fixed: pass the parsed goal to `statusGap`, the accepted reference only to `mappingRag`. Test asserts `goal-not-comparable`. |
| Metric identity | "Owner unit churn" was classified as a **count** because of the word "unit", so the measure refused its own percentage goal and went grey. | Fixed in `metricKind`: "churned units"/"units churned" match *before* the percent list. Test added (primary chosen by mapping, not list position). |
| Scorecard vs pillar agreement | `statusAgainstTarget` silently used the *first number in the target text* when no comparable goal existed — it rated 3,340 units against 23%. | Fixed: returns `no_data` unless a comparable 2026 goal exists. LOI fixture given an explicit `displayFormat`. Test kept. |
| % vs percentage point | Margin primaries are `points`, growth primaries are `percent`; `formatDelta` prints `pp` for point deltas. | Verified unchanged; no regression. |
| Reporting-scope / time basis mixing | Retention's stored FY27 mapping is **LTM** while the October primary is **YTD** annualized; TRevPAR/Margin have reported vs ex-OTA populations. | The reviewed primaries declare `timeBasis: YTD` explicitly; `mappingRag` returns `GREY` when a mapping declares no basis. Test for `no-basis`. |
| Missing chart periods | Charts keep missing months as gaps and never interpolate; a single point is not drawn as a trend. | No change; reconciliation in §6.0 adds counts, not code. |
| Restatements | Sep-26 lender/AwayDNA corrections are revisions, not edits. | Unchanged; documented as revision 2 in §6.0 and §8A. |
| Brand double counting | Rows keyed by population + brand; totals sum counts and derive percentages. | Unchanged; import preview keeps one row per brand per column. |
| Commentary XSS | `SoWhatList` renders stored text as text. | Re-verified with new tone tests; escaping tests retained. |
| So-What ordering / tone | Adding tone risked reordering or overriding sections. | Tone is per item and optional; item tone beats section tone only when set; order preserved by `order`. Tests assert mixed section and exact wording. |
| Authorization | So-What writes must reject unknown scopes and require the existing edit entitlement. | `setSoWhats` validates against `reviewSoWhatScopeList` (accepts `FINANCIALS`, refuses anything else); editor/API path unchanged. Test added. |
| Migration compatibility | A non-null column or default would break existing rows. | Nullable, no default, no backfill; verified on local DB. |
| Duplicate active primaries | Activating a reviewed mapping without switching off the FY27 one yields two actives. | Script plans deactivation in the same pass and refuses if `active > 1`. Test asserts one active per driver. |
| Production database access | Risk of the config script or tests touching production. | Script reads `DATABASE_URL` (local `.env` only) and is dry-run by default; no test connects to a database; no production credential exists in the repo. |
| Hardcoded financial observations | Risk of embedding figures in components/docs as data. | Figures appear only in documentation and test fixtures, never in app components; So-What content is DB-only. |
| Protected auth paths | Risk of touching Entra/Better Auth/session/roles. | Diff touches none of `src/lib/auth.ts`, `sso.ts`, `session.ts`, `roles.ts`, `api-tokens.ts`, `mfa-policy.ts`, `audit.ts` (only *calls* `audit`), `dev-auth.ts`. Verified by file list. |
| React render warning | A `<title>` with an array of children warned during chart render. | Fixed in `trend-chart.tsx` (single template string). |

---

## 11. Validation

| Gate | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass (0 problems) |
| `npm test` | **65 files, 803 tests, all pass** (was 762 two passes ago; +41) |
| `npm run build` | pass |
| `npx prisma validate` | "The schema at prisma/schema.prisma is valid" |
| `npx prisma migrate status` | 19 migrations found; "Database schema is up to date!" |
| `prisma/migrations/20261119044941_review_so_what_tone` | applied to local `awayday_si_dev` only; column verified nullable, no default |
| Local preview | `http://127.0.0.1:3000`, loopback only, local Postgres `awayday_si_dev`; `/`, `/review/2026-10`, `/review/2026-10/edit`, `/scorecard`, `/reporting` all 200 |

---

## 12. Decisions still needed

| # | Decision | Owner | Blocks |
| --- | --- | --- | --- |
| D1 | **Resolved to a runnable plan.** Link `user_review:bd_unit_adds` / `annualized_unit_churn` / `trevpar_growth_reported` / `shop_noi_margin_delta_py_ex_ota` to their pillars, activate their mappings and switch the FY27 mappings off — now encoded in `configure-october-2026-primary-measures.ts` (§4.1). Approval to *run it* is still required. | Engineering (run) | The five-pillar identity match |
| D1a | **Grow's 2026 goal is a percentage, the primary is a unit count.** Supply a count-based 2026 goal, or approve a `ReviewPillarStatus` for Grow. | Grow owner / FP&A | Grow's status colour |
| D2 | FY27 targets in production are the earlier set; the board pre-read differs for four pillars (M&A ~$33M vs $26M stored; Grow 22/30 vs 23/28; Retention 12/11 vs 11/9; TRevPAR 1/3 vs 1/5). Refresh the mappings? | FP&A + owners | FY27 markers, **never** the October status |
| D3 | Base Business line basis for the chart series ($77.3M October) — name it before publishing the series. | Finance | Historical chart (11 blocked points) |
| D4 | Publish the 32 Base Business comparison observations from the Finance pack. | FP&A | P&L "vs Bud / vs PY" columns |
| D5 | Approve the 26 importable historical rows (11 lender + 15 AwayDNA) and 245 brand-churn rows. Base Business history waits on D3. | Finance + Strategy | Charts and the brand table |
| D6 | **Schema implemented; content ready.** Per-item So-What tone + `FINANCIALS` scope (migration `20261119044941_review_so_what_tone`), and the exact 4 bridge items + 33 tones are transcribed in `docs/october-2026-so-what-content-preview.md`. Remaining action: approve loading them through the editor/MCP. | Strategy (content) + engineering (migration to release) | Exact page parity for commentary |

### Execution order

1. Engineering review + merge decisions for PR #25 → #26 (stacked, unchanged).
2. Apply the two migrations (`kpi_mapping_direction_optional`, `review_so_what_tone`) through the approved release process.
3. D1 configuration: run the reviewed script with `--apply --snapshot` (per pillar: link → activate → switch off → target text).
4. D1a Grow goal decision, then re-run the script (idempotent).
5. D2 FY27 target refresh, if approved.
6. D3/D4/D5 approved imports, published as revision 1 (restatements as revision 2).
7. D6 load the four bridge items and the 33 tones through the editor/MCP (content only, no code change), previewing section by section against `docs/october-2026-so-what-content-preview.md`.
8. Re-check the strategy house and the October page against the reference; then deploy.
