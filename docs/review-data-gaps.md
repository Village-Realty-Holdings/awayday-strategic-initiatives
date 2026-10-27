# Strategy Review: data the database doesn't hold yet

The Strategy Review at `/` (with My SIs, Inbox, Asks by leader, Timeline, Below
the line and Metric definitions) reads only from the database. Where a figure or
note has nowhere to live yet, the section shows an empty state or is left out.
This is the list of what's missing and what each gap leaves empty.

Checked against the schema after migration `20261027064522_si_review_status`.

## Missing tables and columns

| Missing | Leaves empty or hidden |
| --- | --- |
| **Review period** (month, status draft/published, prepared by, meeting date, updates-due date, data-as-of) | Periods are derived from the months that have KPI values or SI updates. There's no "prepared by", publish state, meeting date or "updates due in N days", and no period editor. |
| **So-whats and commentary** (per period, for the summary and each pillar or enabler) | The summary so-whats, pillar commentary and bridge so-whats from the MVP. `KpiCommentary` is per KPI and meant for AI-extracted text, so it isn't a fit. |
| **Update state** (draft / submitted) on `InitiativeUpdate` | Every saved update counts as final; there's no "x of 31 submitted" tracking. The status scale itself (`reviewStatus`: Ahead / On track / At risk / Behind) now exists. |
| **Non-SI milestones** (`InitiativeMilestone.initiativeId` is required) | SI-process steps and company events (Summit, Vrbo change, board update) in Next 60 days and the timeline. |
| **ELT ask details** ("raised by" and due date on `InitiativeEltRequest`) | Who raised an ask and when it's due, on Inbox and Asks by leader. |
| **Area owners as people** (`StrategicArea.owner` is one string mixing ELT owners and SI leads); no link between `user` and `RosterMember` | ELT owner vs SI lead can't be told apart per area. Asks by leader groups by each SI's sponsor and lead instead. "My SIs" matches the signed-in user by the lead's name, because no SI has `ownerUserId` set (0 of 31). |
| **Plan header** (mission, EBITDA goal, budget, BHAG per plan version) | The strategy-house roof comes from `src/lib/plan-headers.ts`, keyed by plan code. |

## Missing data (rows, not schema)

These fit the existing KPI tables (`KpiDefinition` + `KpiObservation`) but haven't
been published by the ingestion yet.

| Missing | Leaves empty |
| --- | --- |
| Values for the 8 area measures (`FY27:<AREA>`: acquired EBITDA, gross unit adds, churn, TRevPAR growth, shop NOI margin, guest satisfaction, direct GBV growth, properties per FTE) | Pillar values and pillar status (shown as "No data yet"). The ingested metrics use different keys (`total_revenue`, `adjusted_ebitda`, …) and aren't linked to an area. |
| P&L lines (cost of sales, shop opex, shop NOI, SupportCo, BD, interest income), take rate, GBV, average units, unit adds, churn, CAC, TRevPAR ex-OTA | Most rows of the MVP's P&L and KPI tables. Today the financial table shows total revenue, adjusted EBITDA, ADR, occupancy, RevPAR and TRevPAR for 2026-09. |
| LTM lender EBITDA series | The LTM chart and bridge. The admin scoreboard that held a hand-typed figure was removed. |
| Region and shop figures (`entityScope` REGION / SHOP) | Regions behind / ahead and shops under NOI budget. |
| TRevPAR monthly series, brand-level churn, unit adds and market comparisons | The MVP's brand lists and TRevPAR monthly chart. |
| Guest review score | The Guest Experience measure. |
| EBITDA basis | Ingested adjusted EBITDA is consolidated ($77.2M YTD for 2026-09); the MVP shows base business ($81.0M). |
| Definition write-ups and a data-source catalogue (owner, cadence) | The MVP's 8 definition notes. `/definitions` and **Admin → Data sources** list what's in `KpiDefinition` and `KpiObservation`. |
