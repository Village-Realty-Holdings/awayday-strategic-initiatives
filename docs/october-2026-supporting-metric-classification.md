# October 2026 supporting-metric classification

_Recorded 2026-11-19. Read-only analysis. **No definition, observation, mapping,
target or pillar status was changed by this classification.**_

## Why this exists

Production holds 72 `KpiDefinition` records. Five are wired to a strategic area
through an active `KpiMeasureMapping` (the five primary pillar measures). 60 are
not assigned to a strategic area at all. The brief for the October parity work
required those 60 to be classified rather than bulk-linked to a pillar, because a
pillar relationship is a statement about the business: linking a finance
definition to Grow would invent a goal and a colour the reviewed report never
gives it.

So the rule applied here is:

- a metric is **linked** only where the October reference page or approved
  configuration supports the relationship;
- everything else stays exactly as it is — unassigned — and is classified by the
  job it actually does in the report;
- no target, direction or status colour is invented for any of them.

Nothing in this document has been applied. It is the proposal the brief asks for
before any relationship is created.

## The classification

Counts below are of the 60 unlinked definitions, read from production on
2026-11-19.

| # | Category | Count | What it means | Action |
| --- | --- | --- | --- | --- |
| A | Primary pillar measure | 0 | A measure the reference page names as the headline for a pillar | none outstanding — all five pillars already have an active primary mapping |
| B | Supporting pillar measure | 11 | Sits inside a pillar's section of the report and explains the pillar's primary figure | stays unassigned (contextual); may be linked later with approval |
| C | Financial reporting | 26 | The Base Business P&L, the bridge and the operating statement | stays unassigned; shown in the financial tables |
| D | Operating KPI table | 17 | Unit, churn, M&A-cycle and guest-review operating detail | stays unassigned; shown in the operating tables |
| E | Context-only | 3 | A level figure that only means something next to another basis | stays unassigned |
| F | Genuine pillar-relationship gap | 3 | The reference gives this metric a pillar role that production does not encode | **proposed**, needs Justin's approval |

### B — supporting pillar measures (11)

| Metric key | Name | Pillar it supports in the reference |
| --- | --- | --- |
| `user_review:cash_cac` | Cash CAC Excluding SMQ and Tuck-ins | Grow — the "CAC off track" half of the approved status |
| `user_review:bd_saves` | BD Saves (Retained Units) | Grow — saved units inside net adds |
| `user_review:unit_adds_finance` | Unit Adds (Finance Including Tuck-ins) | Grow — the adds line behind 3,340 |
| `user_review:organic_unit_adds` | Organic Unit Adds (Finance) | Grow — organic share of adds |
| `user_review:net_unit_adds` | Net Unit Adds (Finance Including Tuck-ins) | Grow — adds less churn |
| `user_review:ending_units_finance` | Ending Units (Finance) | Grow — the book the adds run against |
| `user_review:units_churned_finance` | Units Churned (Finance Base Business) | Retention — the numerator of churn |
| `user_review:awaydna_churn_rate_ltm` | Unit Churn Rate LTM (AwayDNA) | Retention — second churn identity |
| `user_review:ttm_unit_churn_ares` | TTM Unit Churn (Ares Pack) | Retention — lender churn basis |
| `user_review:ma_units_acquired` | M&A Units Acquired | M&A — the units side of acquired EBITDA |
| `user_review:tuckin_ebitda` | Tuck-in EBITDA | M&A — the tuck-in slice of $34.8M |

### C — financial reporting (26)

`adjusted_ebitda`, `ebitda`, `gross_profit`, `net_income`, `operating_expenses`,
`total_revenue`, `revpar`, `adr`, `occupancy_pct`, `trevpar_finance`, `unit_count`,
`user_review:adjusted_ebitda_margin_reported`, `user_review:adr_reported`,
`user_review:base_revenue`, `user_review:base_cost_of_sales`,
`user_review:base_shop_opex`, `user_review:base_shop_noi`,
`user_review:base_supportco`, `user_review:base_interest_income`,
`user_review:base_business_development`, `user_review:base_adjusted_ebitda`,
`user_review:ltm_pf_lender_ebitda`, `user_review:gbv`, `user_review:take_rate`,
`user_review:paid_occupancy`, `user_review:other_fees_per_night`.

These are the Base Business P&L and the operating statement. They carry no
strategic-area goal in the reference; giving them a pillar would be the
"duplicate source of truth" the standards forbid.

### D — operating KPI tables (17)

`user_review:average_units_finance`, `user_review:ma_deals_closed`,
`user_review:ma_multiple_synergized`, `user_review:ma_multiple_total`,
`user_review:tuckin_median_cycle_days`, `user_review:trevpar_awaydna_pms`,
`user_review:awaydna_churned_units`, `user_review:reviews_received`,
`user_review:churn_fired_for_revenue`, `user_review:shop_at_fault_churn`,
`user_review:cleaning_margin`, `user_review:maintenance_margin`,
`user_review:ota_margin`, `user_review:cost_sales_labor_pct`,
`user_review:support_cost_pct_revenue`, `user_review:brands_below_review_floor`,
`user_review:guest_review_score`.

### E — context-only (3)

| Metric key | Why it is context only |
| --- | --- |
| `user_review:trevpar_reported` | A level in dollars; the pillar judges the *growth* against PY, so this only reads next to its ex-OTA pair |
| `user_review:trevpar_ex_ota` | same, opposite basis — must never be blended with the reported level |
| `user_review:shop_noi_margin_ex_ota` | a margin level; the pillar judges the *point change* against PY |

### F — genuine pillar-relationship gap (3) — proposed, not applied

| Metric key | Reference role | Why production cannot express it today |
| --- | --- | --- |
| `user_review:guest_review_score` | Guest Experience primary (4.65 vs 4.65 goal, 4.70 stretch, "Floor breached") | the `GUEST` strategic area has **no active `KpiMeasureMapping`**, so the pillar shows no headline |
| `user_review:brands_below_review_floor` | Guest Experience "Floor breached" evidence | no area relationship |
| `user_review:cash_cac` | Grow supporting measure behind the approved wording "CAC off track" | no area relationship |

Proposed change, if Justin wants it: add **one** active mapping for `GUEST` →
`user_review:guest_review_score` (YTD, number, higher-is-better, goal 4.65 from
the reference) plus a `ReviewPillarStatus` row for October carrying the
reference's "Floor breached". That is a new pillar status and a new mapping, not a
correction, so it is out of scope for this parity pass and is listed as decision
D3 in `docs/october-2026-parity-corrections.md`.

## What this changes in the UI

Nothing is displayed differently because of this document. What *did* change in
this branch is that an unassigned metric with a stored observation is no longer
called "missing data". The scorecard now distinguishes:

- an unassigned definition with no observation — "No observation this month";
- an assigned metric with an observation but no goal — the observation is shown
  normally with a neutral status and the footer says "No target configured";
- an assigned metric whose goal is written in another quantity — "Goal not
  comparable with this measure";
- a metric with only a monthly figure and no period goal — "Month figure only — no
  period goal to judge".

The 60 unlinked definitions therefore appear in the financial and operating
tables as they always did, and are not counted as "not loaded" on a pillar.
