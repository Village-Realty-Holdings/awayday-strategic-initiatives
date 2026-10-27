# Strategy Review: data the database doesn't hold yet

The Strategy Review at `/` (with My SIs, Inbox, Asks by leader, Timeline, Below
the line and Metric definitions) reads only from the database. Where a figure or
note has nowhere to live yet, the section shows an empty state or is left out.
This is the list of what's missing and what each gap leaves empty.

Checked against the schema after migration `20261027120000_review_period_so_whats`.
Review periods (draft/published, prepared by, meeting and updates-due dates,
data-as-of override) and the summary and per-area so-whats are now stored, and
Strategy (admins) writes them on `/review/[period]/edit`.

## Missing tables and columns

| Missing | Leaves empty or hidden |
| --- | --- |
| **So-what tone** (up / down / flag on `ReviewSoWhat`) | The MVP colours each so-what by direction; stored so-whats render in one neutral style. |
| **Update state** (draft / submitted) on `InitiativeUpdate` | Every saved update counts as final; there's no "x of 31 submitted" tracking. The status scale itself (`reviewStatus`: Ahead / On track / At risk / Behind) now exists. |
| **Non-SI milestones** (`InitiativeMilestone.initiativeId` is required) | SI-process steps and company events (Summit, Vrbo change, board update) in Next 60 days and the timeline. |
| **ELT ask details** ("raised by" and due date on `InitiativeEltRequest`) | Who raised an ask and when it's due, on Inbox and Asks by leader. |
| **Area owners as people** (`StrategicArea.owner` is one string mixing ELT owners and SI leads); no link between `user` and `RosterMember` | ELT owner vs SI lead can't be told apart per area. Asks by leader groups by each SI's sponsor and lead instead. "My SIs" matches the signed-in user by the lead's name, because no SI has `ownerUserId` set (0 of 31). |

## Missing data (rows, not schema)

These fit the existing KPI tables (`KpiDefinition` + `KpiObservation`) but haven't
been published by the ingestion yet.

| Missing | Leaves empty |
| --- | --- |
| Values for the 8 area measures (`FY27:<AREA>`: acquired EBITDA, gross unit adds, churn, TRevPAR growth, shop NOI margin, guest satisfaction, direct GBV growth, properties per FTE) | Pillar values and pillar status (shown as "No data yet"). The ingested metrics use different keys (`total_revenue`, `adjusted_ebitda`, …) and aren't linked to an area. |
| P&L lines (cost of sales, shop opex, shop NOI, SupportCo, BD, interest income), take rate, GBV, average units, unit adds, churn, CAC, TRevPAR ex-OTA | Most rows of the MVP's P&L and KPI tables. Today the financial table shows total revenue, adjusted EBITDA, ADR, occupancy, RevPAR and TRevPAR for 2026-09. |
| LTM lender EBITDA series | The LTM chart and bridge, and so the bridge's so-whats (the review has no bridge section to hang them on). The EBITDA build the AI board update quotes is typed in by an admin on **Admin → Strategy reference**, not ingested. |
| Region and shop figures (`entityScope` REGION / SHOP) | Regions behind / ahead and shops under NOI budget. |
| TRevPAR monthly series, brand-level churn, unit adds and market comparisons | The MVP's brand lists and TRevPAR monthly chart. |
| Guest review score | The Guest Experience measure. |
| EBITDA basis | Ingested adjusted EBITDA is consolidated ($77.2M YTD for 2026-09); the MVP shows base business ($81.0M). |
| Definition write-ups and a data-source catalogue (owner, cadence) | The MVP's 8 definition notes. `/definitions` and **Admin → Data sources** list what's in `KpiDefinition` and `KpiObservation`. |
