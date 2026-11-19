# October 2026 primary KPI mapping audit

**Superseded for implementation detail by**
[`october-2026-parity-corrections.md`](october-2026-parity-corrections.md), which
records the code corrections, the production identities supplied in the handoff
JSON, and the import previews. This document remains the record of the read-only
audit and its production-access blocker.

**Status:** read-only audit, documentation only. Nothing in production Neon was
read or written during this session (see §2). No mapping, KPI definition,
observation, publication state, schema or infrastructure was changed.
**Branch / PR:** `feat/review-visual-parity` → PR #26 (open, not merged).
**Authorities used:** the brief's October 2026 expectations, the repository's own
record of the reviewed October report
(`docs/october-2026-neon-parity-audit.md`, `docs/strategy-review-parity.md`),
the FY27 plan source (`src/lib/fy27-plan.ts`, from
`260930 Awayday SI Refresh_v1.pdf`), and the local preview database
`awayday_si_dev`.

Every fact below is labelled either **VERIFIED** (observed directly, with the
command or file that shows it) or **NOT VERIFIED** (cannot be established in this
environment). Recommendations are labelled **PROPOSED**.

---

## 1. Executive summary

* **CONDITIONAL PASS.** The proposed migration
  (`20261118220000_kpi_mapping_direction_optional`) is safe to run in the
  approved release process and needs no further application changes. It cannot
  be signed off as *deployed-correct*, because the production mapping state and
  the user's `Awayday October 2026 Strategy Review(2).html` are **both
  inaccessible here** (§2). Everything that depends on them is marked
  **NOT VERIFIED**.
* **Directions are coherent for all five pillars** in the only data set that
  could be inspected (the local preview database): M&A higher, Grow higher,
  Owner Retention lower, TRevPAR higher, Margin higher. **No direction
  mismatch was found**, but a stored `true` cannot be proven deliberate for
  rows written before this change, because the old schema default supplied
  `true` (§5).
* **The real problem is KPI identity and reporting basis, not direction.**
  Three of the five pillar measures carry an identity/basis that differs from
  the October report, while the *value* attached to them already looks like the
  October figure:

  | Pillar | Pillar definition says | October report / brief says | Shape of the defect |
  | --- | --- | --- | --- |
  | Grow New Units | `Gross unit adds`, percent mapping, targets 23 / 28 | BD unit adds (BD **Master**), YTD count 3,340 | identity + unit of measure |
  | Owner Retention | `Owner unit churn (TTM)`, mapping time basis **LTM** | Annualized unit churn (Finance), **YTD** | time basis / label |
  | TRevPAR Expansion | `TRevPAR growth (YoY)`, basis not stated | TRevPAR growth vs prior year, **reported** | undeclared basis |
  | Margin Expansion | `Shop NOI margin vs PY`, basis not stated | Shop NOI margin vs PY, **ex-OTA** | undeclared basis |
  | M&A | `Acquired EBITDA closed`, YTD currency | Acquired EBITDA closed, YTD | matches |

* **No pillar has zero or multiple active mappings** in the local data set.
  Three enablers have a KPI but no mapping, and two enablers have no KPI at all.
* **Targets are drawn from two places** (mapping `targetBudget` for status
  colour, the definition's target *text* for the gauge markers). For Grow New
  Units those two disagree by three orders of magnitude, so the pillar's "Ahead"
  tone is currently right by accident (§8.2).

**Verdict:** migration SAFE PENDING ENGINEERING APPROVAL; mapping corrections
must not be applied until the business owner confirms KPI identity and basis
(§9).

---

## 2. Database access and verification status

### 2.1 Blocker (VERIFIED)

The production branch `br-silent-wildflower-b438bp7m` could not be reached:

| Check | Result |
| --- | --- |
| Approved Neon MCP connection available to this agent | **No.** Only `summarize`, `code_execution`, `chatrecall`, `computercontroller`, `autovisualiser`, `memory`, `tutorial` are offered. |
| `command -v neon` / `command -v neonctl` | Neither is installed. |
| `.env.production.local`, `.dev.vars`, `.neon`, `.neon-project` | All absent from the working tree. |
| Credentials in the repository | None found, and none were sought outside this repository. |

Because the blocker is access, **the production audit was stopped** at this
point and no substitute was used. Per the brief, static analysis was completed;
no statement in this document claims production verification that was not
performed.

### 2.2 Reference HTML (VERIFIED absence)

`Awayday October 2026 Strategy Review(2).html` is not present in the repository
or the usual local download locations, and it is not tracked in git. The
comparison in §4 therefore uses the brief's tabulated expectations plus the
repository's own reviewed-report record
(`docs/october-2026-neon-parity-audit.md` B4 "Pillar tables", which quotes the
October figures and their identity populations). That record is a **reference**,
not the HTML, and is labelled as such.

### 2.3 What was verified, and how

* Repository state: branch `feat/review-visual-parity`, HEAD
  `05e8448543e585c86c63ba6db3102a011ba0ab10`, working tree clean (0 porcelain
  lines), PRs #25 and #26 both `OPEN` and `MERGEABLE`.
* Local preview database `awayday_si_dev` — **a development data set, not
  production** — via read-only `psql` `SELECT`s only (queries reproduced in
  §3.3). Its rows were created 2026-11-18 17:45 by the FY27 import/seed, so
  timestamps are import artefacts, not business edit history.
* Migration SQL, Prisma schema, and every application code path that reads or
  writes `higherIsBetter` (§7).
* The running local preview (`http://127.0.0.1:3000`, `awayday_si_dev`), whose
  strategy house was rendered and read (§8.2).

### 2.4 Sections that are NOT VERIFIED

§3 (production rows), §4 (production match), §5 (whether production `true`
values were deliberate), §6 (production conflicts) and §8.1 (production target
text) are **NOT VERIFIED**. The local equivalents are shown so engineering can
see the expected shape, and are separately labelled.

---

## 3. Current mapping inventory

> **NOT VERIFIED for production.** The table below is the **local preview
> database** `awayday_si_dev`. It is presented only as (a) evidence that the
> read path behaves as documented and (b) a template for the production query
> in §3.3. Do not treat it as production state.

### 3.1 Mappings (VERIFIED locally, 5 rows, all active)

| Mapping ID | Area (ID) | KPI definition ID | KPI name | metricKey | active | higherIsBetter | targetBudget / targetStretch | calculation | timeBasis | displayFormat | input key |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `cmwmewt6u0000ytjd1chog490` | M&A (`cmwmews6b0002xejdb7m35xed`) | `cmwmews6e0003xejd4dxgl859` | Acquired EBITDA closed | `FY27:M&A` | true | **true** | 26,000,000 / 47,000,000 | DIRECT | YTD | currency | — |
| `cmwmewt710001ytjd8kgf5frv` | Grow New Units (`cmwmews6g0004xejd3fox4lw7`) | `cmwmews6j0005xejdl8mihu27` | Gross unit adds | `FY27:GROW` | true | **true** | 23 / 28 | DIRECT | YTD | percent | — |
| `cmwmewt750002ytjduy3v033x` | Owner Retention (`cmwmews6l0006xejdnzma1rmw`) | `cmwmews6m0007xejddw8vkrqw` | Owner unit churn (TTM) | `FY27:RETENTION` | true | **false** | 11 / 9 | DIRECT | **LTM** | percent | — |
| `cmwmewt790003ytjd1yi1blvi` | TRevPAR Expansion (`cmwmews6n0008xejdjex9v8hi`) | `cmwmews6p0009xejdn8oz3vmf` | TRevPAR growth (YoY) | `FY27:TREVPAR` | true | **true** | 1 / 5 | YOY_PCT | YTD | percent | `trevpar_finance` |
| `cmwmewt7d0004ytjdm9xwrr1h` | Margin Expansion (`cmwmews6q000axejduaayyo6l`) | `cmwmews6r000bxejd1jjllrj7` | Shop NOI margin vs PY | `FY27:MARGIN` | true | **true** | 0.25 / 1 | RATIO_DELTA_PY | YTD | percent | — |

Created and updated stamps are identical for every row
(`2026-11-18 17:45:46.18x–.20x`): the import wrote them, no human has edited a
direction since. There is no persisted "reporting scope" column on
`KpiMeasureMapping`; scope lives on the observation (§3.2).

### 3.2 Areas and their measure coverage (VERIFIED locally)

| Area | KPIs | Active mappings | Classification |
| --- | --- | --- | --- |
| M&A | 1 | 1 | exactly one primary |
| Grow New Units | 1 | 1 | exactly one primary |
| Owner Retention | 1 | 1 | exactly one primary |
| TRevPAR Expansion | 1 | 1 | exactly one primary |
| Margin Expansion | 1 | 1 | exactly one primary |
| Tech & AI | 1 (`Properties per FTE…`) | 0 | KPI present, **no primary configured** |
| Marketing | 1 (`Direct GBV growth (YoY)`) | 0 | KPI present, **no primary configured** |
| Guest Experience | 1 (`Guest satisfaction score`) | 0 | KPI present, **no primary configured** |
| Talent | 0 | 0 | **no KPI definition at all** |
| Finance | 0 | 0 | **no KPI definition at all** |

* Areas with **multiple** active mappings: none.
* Mappings referencing a missing KPI definition: none possible — the foreign key
  is `ON DELETE CASCADE` (verified via `\d "KpiMeasureMapping"`), so a dangling
  mapping cannot exist.
* Mappings referencing a KPI whose area is `NULL`: none locally.
* Under the new resolver (`src/lib/primary-measure.ts`) the three unmapped
  enablers resolve to `primary: "missing"`, which the UI renders as "Primary
  measure not configured" with **no status colour** — verified in the running
  preview (6 such notes, §8.2).

### 3.3 Observations behind those mappings (VERIFIED locally)

| KPI | Period | Value | timeBasis | comparisonBasis | reportingScope | quality |
| --- | --- | --- | --- | --- | --- | --- |
| FY27:M&A | 2026-10 | `$34.8M` | YTD | ACTUAL | AWAYDAY_CONSOLIDATED | VALID |
| FY27:GROW | 2026-10 | `3,340` | YTD | ACTUAL | AWAYDAY_CONSOLIDATED | VALID |
| FY27:RETENTION | 2026-10 | `12.4%` | YTD | ACTUAL | AWAYDAY_CONSOLIDATED | VALID |
| FY27:TREVPAR | 2026-10 | `+4.1%` | YTD | ACTUAL | AWAYDAY_CONSOLIDATED | VALID |
| FY27:MARGIN | 2026-10 | `+0.8` | YTD | ACTUAL | AWAYDAY_CONSOLIDATED | VALID |

Each pillar's stored target *text* (on `StrategicArea.kpiTarget`, business data,
edited in the app) is: M&A `$23M goal; $33M budget; $47M stretch` · Grow
`2,608 goal; 3,152 budget` · Owner Retention `<12% goal; 12% budget; 11%
stretch` · TRevPAR `3.3% goal; 1% budget; 3% stretch` · Margin `0.7 goal; 0.25
budget; 1 stretch`.

**Read-only inventory query** (safe to run against production; no `SELECT *`
into logs, no PII):

```sql
SELECT m.id, a.id AS area_id, a.name AS area_name, k.id AS kpi_id, k.name AS kpi_name,
       k."metricKey", m.active, m."higherIsBetter", m."targetBudget", m."targetStretch",
       m.calculation, m."timeBasis", m."displayFormat", m."inputMetricKey",
       m."createdAt", m."updatedAt", k."strategicAreaId" IS NULL AS orphaned
FROM "KpiMeasureMapping" m
JOIN "KpiDefinition" k ON k.id = m."measureKpiId"
LEFT JOIN "StrategicArea" a ON a.id = k."strategicAreaId"
ORDER BY m.id;

SELECT a.id, a.name,
       count(k.id) AS kpis,
       count(m.id) FILTER (WHERE m.active) AS active_maps
FROM "StrategicArea" a
LEFT JOIN "KpiDefinition" k ON k."strategicAreaId" = a.id
LEFT JOIN "KpiMeasureMapping" m ON m."measureKpiId" = k.id
GROUP BY a.id, a.name ORDER BY a.id;
```

The second query is the one that proves the "exactly one / none / multiple"
classification, from persisted rows rather than from alphabetical order.

---

## 4. HTML-to-mapping comparison

> **NOT VERIFIED for production.** Current-state column = **local preview
> database**. Expected column = the brief's table plus
> `docs/october-2026-neon-parity-audit.md` §B4. The reference HTML itself is not
> available (§2.2).

| Pillar | HTML expected (identity · basis) | Current mapped primary (local) | Match? | Required change |
| --- | --- | --- | --- | --- |
| M&A | Acquired EBITDA closed · YTD | `FY27:M&A` Acquired EBITDA closed · YTD · currency | **Yes** (identity, basis) | None to identity. Target source disagreement only (§8.2). |
| Grow New Units | BD unit adds (**BD Master**) · YTD | `FY27:GROW` **Gross unit adds** · YTD · **percent** | **No** — identity and unit of measure | Re-point the pillar's primary at a BD-Master unit-adds definition measured as a count; correct the mapping's format/targets. See C1. |
| Owner Retention | **Annualized** unit churn (Finance) · **YTD** | `FY27:RETENTION` Owner unit churn **(TTM)** · mapping **LTM** | **No** — time basis and label | Change the mapping time basis LTM → YTD and correct the definition name to the annualized basis. See C2. |
| TRevPAR Expansion | TRevPAR growth vs prior year · **reported** · YTD | `FY27:TREVPAR` TRevPAR growth (YoY) · basis **not declared** · YTD | **Unproven** — growth identity matches, basis is unstated | Declare the reporting basis (reported vs ex-OTA) on the definition/mapping. See C3. |
| Margin Expansion | Shop NOI margin vs PY · **ex-OTA** · YTD | `FY27:MARGIN` Shop NOI margin vs PY · basis **not declared** · YTD | **Unproven** — identity matches, basis is unstated | Declare the basis as ex-OTA. See C4. |

### 4.1 The four distinctions the brief calls out

Verified against the local data and the reference record:

1. **BD Master unit adds ≠ Finance gross unit adds.** The reviewed report carries
   both: `BD unit adds (BD Master)` YTD **3,340** (vs 2,608) and
   `Unit adds (Finance, incl. tuck-ins)` YTD **3,546** / `Organic unit adds
   (Finance)` **2,997**. The pillar's stored observation is **3,340**, i.e. the
   *BD Master* figure, attached to a definition named `Gross unit adds`
   (Finance). Identity and value disagree.
2. **Annualized YTD churn ≠ TTM churn.** Reference record: annualized (Finance)
   Oct 12.2% · YTD **12.4%** (budget 11.5%), goal `<12%`; TTM (Ares pack) Oct
   **13.0%**. The pillar stores **12.4%** — the annualized YTD figure — under a
   name and mapping time basis that say TTM/LTM.
3. **Reported TRevPAR ≠ ex-OTA TRevPAR.** Reference record: reported basis Oct
   $99.2 · YTD $177.9; ex-OTA Oct $94.0 · YTD $168.3. The pillar stores
   `+4.1%` growth with **no basis recorded**; whether that is reported or ex-OTA
   cannot be established from the stored row.
4. **Ex-OTA margin ≠ reported margin.** Reference record: ex-OTA Oct 17.1%
   (+0.5 pt) · YTD 36.9% (**+0.8 pt**); reported Oct 15.2% (−0.4 pt) · YTD 33.8%
   (−1.0 pt). The pillar stores **+0.8**, which only matches the **ex-OTA**
   column — so the value is probably right and the *label* is silent.

### 4.2 Missing KPI definitions

`docs/october-2026-neon-parity-audit.md` §F records that the October identities
were loaded as reviewed-report definitions. In the local database they exist:

* `user_review:bd_unit_adds` — "BD unit adds" (330, Oct, `USER_REVIEWED_REPORTED`);
* `user_review:annualized_churn` — "Annualized unit churn" (**definition exists,
  no observation**);
* `user_review:ttm_churn` — "TTM unit churn" (13);
* `user_review:trevpar_reported` (99.2) and `user_review:trevpar_ex_ota` (94.0);
* `user_review:shop_noi_margin` (15.2) and `user_review:shop_noi_margin_ex_ota`
  (17.1).

So the *identities* exist, but they exist as **reviewed-report measures for the
report page**, not as pillar measures. Whether a pillar should point at one of
them, or at a new pillar-scoped definition, is a business decision (§9). No
definition was created, renamed or re-pointed during this audit — the brief
requires that and the rules require engineering review for definition-schema
changes.

---

## 5. Direction audit

> **NOT VERIFIED for production.** Current values are the local rows of §3.1.

| KPI | Stored direction | Business meaning | Verdict | Confidence |
| --- | --- | --- | --- | --- |
| Acquired EBITDA closed | `true` | more acquired EBITDA is better | **Correct, higher** | semantics unambiguous |
| Gross unit adds | `true` | more adds is better | **Correct, higher** | semantics unambiguous |
| Owner unit churn (TTM) | `false` | less churn is better | **Correct, lower** | semantics unambiguous |
| TRevPAR growth (YoY) | `true` | more growth is better | **Correct, higher** | semantics unambiguous |
| Shop NOI margin vs PY | `true` | a bigger positive margin delta is better | **Correct, higher** | semantics unambiguous |

Classification required by the brief:

* **Explicitly confirmed by an owner:** **none.** No audit record, ADR or
  signed-off business statement names these five directions. The only
  declaration is machine-written: `prisma/seed-kpi-mappings.ts` lines 15–19,
  whose comment says "Direction and targets for the five pillar measures, from
  the FY27 plan". That is a developer transcription of a plan document, not an
  owner's confirmation of direction.
* **Inferred from metric semantics:** all five, and all five are
  uncontroversial (EBITDA up, adds up, churn down, TRevPAR growth up, margin
  delta up).
* **Ambiguous, needing owner confirmation:** none of the five. Note that
  `metricDirection()` deliberately keeps genuinely mixed names unknown — `churn
  and retention`, bare `change`/`variance`/`growth`, `business development`,
  `supportco` (§2 of `docs/kpi-direction-audit.md`) — and none of the five
  pillar names falls into that set.
* **Missing (`NULL`):** none locally.
* **Potentially incorrect existing `true`:** all four `true` values are
  *semantically* correct, and that is the limit of what data can show. **A
  stored `true` predating this change cannot be distinguished from one the old
  `DEFAULT true` supplied.** The old column was `BOOLEAN NOT NULL DEFAULT true`
  and the old admin form mapped every non-`LOWER` input — including a blank — to
  `true`. So for any production row created before this branch, the `true` may
  be an artefact. For `Owner Retention` the risk is inverted and more serious:
  had the old form been used, a churn mapping would have defaulted to
  **higher-is-better**, i.e. green for rising churn. Production must be checked
  row by row, not assumed.

To make that check possible without guessing, the audit records the direction
each row *should* carry and adds a read-only query to find rows whose direction
disagrees with the expected value:

```sql
SELECT k."metricKey", k.name, m."higherIsBetter", m."createdAt", m."updatedAt"
FROM "KpiMeasureMapping" m JOIN "KpiDefinition" k ON k.id = m."measureKpiId"
WHERE k."metricKey" IN ('FY27:M&A','FY27:GROW','FY27:RETENTION','FY27:TREVPAR','FY27:MARGIN')
ORDER BY k."metricKey";
```

Expected: `FY27:RETENTION` = `false`; the other four = `true`. Anything else is a
direction defect; anything `NULL` is an unfinished configuration and will render
neutral (which is the safe failure mode this branch introduces).

---

## 6. Missing or conflicting mappings

Verified locally; **production NOT VERIFIED**.

| Category | Local result | Action |
| --- | --- | --- |
| Exactly one active mapping | 5 of 5 pillars | none |
| No active mapping, KPI exists | Tech & AI, Marketing, Guest Experience | configure a primary when the owner is ready (neutral meanwhile) |
| No active mapping, no KPI | Talent, Finance | no KPI definition exists; do not invent one |
| Multiple active mappings | **none** | the admin action now refuses a second active mapping per area (`error=primary-exists`) |
| Mapping → missing/inactive definition | none possible (FK cascade) | none |
| Ambiguous direction | none | see §5 |
| **Configuration conflict: target vs measurement** | Grow New Units: mapping `displayFormat = percent`, `targetBudget 23` / `targetStretch 28`, but the observation is a **count** (3,340) and the stored pillar target text is a count (2,608 / 3,152) | C1 |
| **Configuration conflict: time basis vs observation** | Owner Retention: mapping `timeBasis = LTM`, observation `timeBasis = YTD` | C2 |
| **Configuration conflict: two target sources** | Status colour uses `mapping.targetBudget`; the gauge markers use the definition's target *text*. For M&A these are $26M (mapping) vs $23M goal / $33M budget / $47M stretch (text) | business decision D4 |
| **Business-data conflict: target text** | Grow stored target text `2,608 goal; 3,152 budget` — in the reference record **2,608 is the prior-year/versus figure** (3,340 is +28% vs 2,608), not a goal | D3 |

---

## 7. Migration safety assessment

### 7.1 The change (VERIFIED)

`prisma/migrations/20261118220000_kpi_mapping_direction_optional/migration.sql`:

```sql
ALTER TABLE "KpiMeasureMapping" ALTER COLUMN "higherIsBetter" DROP DEFAULT;
ALTER TABLE "KpiMeasureMapping" ALTER COLUMN "higherIsBetter" DROP NOT NULL;
```

`prisma/schema.prisma` matches: `higherIsBetter Boolean?` with no `@default`.
Two catalogue-only `ALTER`s, no table rewrite, no data read/write, no backfill,
no index change.

### 7.2 Checks

| Check | Result |
| --- | --- |
| Prisma schema compatibility | `npx prisma validate` → "The schema at prisma/schema.prisma is valid". Generated client has `higherIsBetter: boolean \| null` in create/update inputs (verified in `src/generated/prisma/models/KpiMeasureMapping.ts`). |
| Existing true/false preserved | `DROP DEFAULT` and `DROP NOT NULL` do not touch stored values. Local `\d "KpiMeasureMapping"` after applying shows `higherIsBetter \| boolean \|` (nullable, no default) and all five original values intact (t/t/f/t/t). |
| Write paths that relied on the default | Two only: `src/app/(app)/admin/measure-mappings/actions.ts` (always supplies `true`/`false`/`null`) and `prisma/seed-kpi-mappings.ts` (always supplies a boolean). Neither can insert an unset direction, so removing the default breaks nothing. |
| Read paths | `review-data.ts`, `review-edits.ts`, `review-report-data.ts`, `kpi-measure-mapping.ts` all treat the field as `boolean \| null`; `undefined` (no mapping) still falls back to the name heuristic, `null` (mapping, no direction) stays neutral. Covered by tests. |
| Admin form | `NativeSelect` offers Higher / Lower / **Not stated (no status colour)**; blank → `null`; an unknown value is rejected with `error=direction`. |
| Nullable handling in status | `mappingRag()` returns `GREY` for a null direction before any comparison, so an unstated direction can never be green. `measureOrigin()` says "no direction is stated, so no status is claimed". Gauge `direction: "unknown"` renders neutral with aria text "Direction not stated". |
| Migration ordering | `20261118220000` sorts after `20261109180000_mcp_oauth`; it is the 18th and last migration. `npx prisma migrate status` reports "Database schema is up to date!" locally. |
| Existing data preservation | Nullable widening is lossless; no row is rewritten. |
| Rollback | Re-add `DEFAULT true` in a new migration is trivial. Re-adding `NOT NULL` is **not** safe on its own: any row created after this change with "not stated" would hold `NULL`, so a rollback must first decide those rows explicitly (set them to `true`/`false` or delete them) — a business decision, not a mechanical one. Recorded as a rollback caution. |
| Startup before/after | Read-only startup queries do not reference the column's nullability. The local preview started and served normally **after** the migration was applied. Deploying the application before the migration would show `higherIsBetter` non-null (old schema) which the nullable-aware code handles fine; deploying the migration first is also fine because the old code only ever wrote booleans. Either order is safe; the release should still run migration → app, per the existing deployment order. |
| Additional application changes required | **None.** |

### 7.3 Local validation evidence (VERIFIED, disposable dev DB only)

Applied to `awayday_si_dev` only, with `npx prisma migrate deploy` → "18
migrations found … All migrations have been successfully applied". Nothing was
applied to staging or production; no production connection string exists in this
environment.

### 7.4 Verdict

**SAFE PENDING ENGINEERING APPROVAL.** The migration is additive in effect
(nullability widening), non-destructive, backfill-free and covered by tests. It
requires engineering sign-off because `prisma/migrations/**` is engineering-owned
under this repository's rules.

---

## 8. Proposed configuration corrections

**None of these are applied.** Each is a business-data change on
`KpiMeasureMapping` / `KpiDefinition` / `StrategicArea` to be made by an
authorised user through the existing admin surface (or an explicitly approved
migration), and each needs owner sign-off because it changes which number the
executive dashboard calls the pillar's result.

### 8.1 Correction preview

| # | Field | Required | Strategic area | Current primary KPI | Proposed primary KPI | Existing definition ID | Expected basis | Expected direction | Reason | Approval required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | KPI identity + unit + targets | Yes | Grow New Units (`cmwmews6g0004xejd3fox4lw7`) | `FY27:GROW` "Gross unit adds" (`cmwmews6j0005xejdl8mihu27`), percent, 23/28 | BD unit adds (**BD Master**) as the pillar primary, measured as a **count** | `user_review:bd_unit_adds` exists locally (no ID captured here because it is a local-only row); the pillar-scoped definition may not exist in production | YTD, BD Master population | Higher (`true`) | The October report's Grow primary is BD Master adds (YTD 3,340). Finance gross adds (3,546) / organic adds (2,997) / Finance unit adds (310 Oct) are different populations and must not be substituted. Also the mapping's percent format and 23/28 targets contradict a count observation. | Business owner (Grow) + engineering for any new definition |
| C2 | Mapping time basis + definition label | Yes | Owner Retention (`cmwmews6l0006xejdnzma1rmw`) | `FY27:RETENTION` "Owner unit churn (TTM)" (`cmwmews6m0007xejddw8vkrqw`), `timeBasis = LTM` | Same measure re-stated as **Annualized unit churn (Finance)**, `timeBasis = YTD` | definition `user_review:annualized_churn` exists locally (no observation) | YTD, Finance annualized basis | Lower (`false`) — unchanged | The stored value 12.4% is the reviewed annualized **YTD** figure; TTM is a different series (13.0%). Keeping `LTM` on the mapping contradicts the observation's `YTD` basis and the report's label. | Business owner (Retention) |
| C3 | Declare reporting basis | Yes | TRevPAR Expansion (`cmwmews6n0008xejdjex9v8hi`) | `FY27:TREVPAR` "TRevPAR growth (YoY)" (`cmwmews6p0009xejdn8oz3vmf`) | Same growth measure, basis explicitly **reported** (not ex-OTA) | none needed if the name/carries the basis; otherwise `user_review:trevpar_reported` is the reported series | YTD, reported basis | Higher (`true`) — unchanged | The brief's TRevPAR primary is reported-basis growth; the stored growth carries no basis, so a reader cannot tell it from ex-OTA. Reported YTD $177.9 vs ex-OTA $168.3 are materially different. | Business owner (Revenue) |
| C4 | Declare reporting basis | Yes | Margin Expansion (`cmwmews6q000axejduaayyo6l`) | `FY27:MARGIN` "Shop NOI margin vs PY" (`cmwmews6r000bxejd1jjllrj7`) | Same delta, basis explicitly **ex-OTA** | none needed if declared in the name; otherwise `user_review:shop_noi_margin_ex_ota` is the ex-OTA series | YTD, ex-OTA basis | Higher (`true`) — unchanged | `+0.8` matches the ex-OTA YTD delta; the reported basis is −1.0 pt. A silent basis means the dashboard can be read as either. | Business owner (Margin) |
| C5 | Target source reconciliation | Yes | M&A (`cmwmews6b0002xejdb7m35xed`) | `FY27:M&A`, mapping `targetBudget 26,000,000` | align the mapping target with the approved FY27 target set ($23M goal · $33M budget · $47M stretch, or $26M total per the plan file) | existing definition sufficient | YTD, currency | Higher (`true`) — unchanged | Status colour uses the mapping target ($26M) while the gauge and the house card show the definition text; two different "targets" for one number. | Business owner (M&A) + engineering if the target model changes |

**If the expected definition does not exist in production**, the definition
needed is:

* **C1:** a pillar-scoped KPI definition for *BD unit adds*, source population
  **BD Master**, cumulative **YTD**, unit of measure *units*, approved source the
  October 2026 Strategy Review's Grow pillar table (BD Master unit adds). Its
  current series 330 (Oct) / 3,340 (YTD) already exists in the reviewed-report
  layer. No metric identity or reporting scope beyond that is invented here.
* **C2:** a pillar-scoped KPI definition for *Annualized unit churn*, source
  **Finance**, cumulative **YTD**, percent, approved source the reviewed report's
  Retention pillar table (12.2% Oct, 12.4% YTD, budget 11.5%, goal `<12%`).

Both require business approval of identity/population, and engineering review if
a new `KpiDefinition` row or schema constraint is needed.

### 8.2 Downstream behaviour per proposed change

Verified on the running local preview (`http://127.0.0.1:3000/review` and `/`,
`awayday_si_dev`) — **local, not production**.

Current rendered state of the strategy house (5 pillar cards):

| Pillar | Rendered primary | Rendered value | Gauge/card targets (from definition text) | Rendered tone |
| --- | --- | --- | --- | --- |
| M&A | Acquired EBITDA closed | `$34.8M` | `$23M goal; $33M budget; $47M stretch` | ahead |
| Grow New Units | Gross unit adds | `3,340` | `2,608 goal; 3,152 budget` | ahead |
| Owner Retention | Owner unit churn (TTM) | `12.4%` | `<12% goal; 12% budget; 11% stretch` | behind |
| TRevPAR Expansion | TRevPAR growth (YoY) | `+4.1%` | `3.3% goal; 1% budget; 3% stretch` | on track |
| Margin Expansion | Shop NOI margin vs PY | `+0.8` | `0.7 goal; 0.25 budget; 1 stretch` | on track |

Also verified in that render: 6 "Primary measure not configured" notes (the three
unmapped enablers, appearing on more than one panel), and no pillarbox shows a
status claim for an unmapped measure.

Behaviour that each proposed change would produce:

| Change | Primary KPI shown | Observation selected | Period | Scope | Status colour | Gauge target placement | FY27 targets | Supporting rows | Other areas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 Grow | the newly designated BD-Master definition (single active mapping) | latest `VALID` observation for **that** KPI and period | 2026-10 (YTD) unchanged | observation's own scope (`AWAYDAY_CONSOLIDATED` locally; BD Master is the *population* the value describes) | computed from the new mapping's `targetBudget` — currently 23 (percent) against 3,340 (count) yields GREEN for the wrong reason; once the target is a count the colour becomes meaningful | markers come from the definition target *text*, so they move with the definition, not with the mapping | target text now reads as the approved Grow targets | the previous definition becomes supporting only if its mapping stays active — it must be set inactive, or the area becomes `ambiguous` and shows **no** primary | none: mapping is per-KPI and per-area |
| C2 Retention | same KPI, renamed/re-based | unchanged row (12.4%, YTD) | unchanged | unchanged | unchanged (`false` → RED at 12.4 vs 11) | markers unchanged | unchanged | none | none |
| C3 TRevPAR | same | unchanged (+4.1%) | unchanged | basis becomes explicit in the label/origin line | unchanged (`true`, GREEN vs 1) | unchanged | unchanged | none | none |
| C4 Margin | same | unchanged (+0.8) | unchanged | basis becomes explicit | unchanged (`true`, GREEN vs 0.25) | unchanged | unchanged | none | none |
| C5 M&A | same | unchanged ($34.8M) | unchanged | unchanged | may change if `targetBudget` moves from 26M to 23M/33M | unchanged | unchanged | none | none |

What would **break** if a correction were done naively (configuration risk, not a
code defect):

* Leaving the old Grow mapping active *and* activating a BD-Master mapping makes
  the area **ambiguous** → the resolver deliberately shows no primary and no
  status (verified by `review-data.test.ts` "ambiguous" cases and the neutral
  note in `review-view.tsx`). Correct behaviour, but it means C1 must switch the
  old mapping **off** in the same edit.
* Editing only the definition *name* changes nothing about which row is primary;
  identity changes need the mapping's `measureKpiId` re-pointed (a new mapping row
  plus deactivating the old one), because `measureKpiId` is unique.
* Two target sources: status colour and gauge markers can disagree. If C5 or C1
  changes only one of them, the card will show one target and colour against
  another. Both must be updated together.

### 8.3 Code issues vs configuration issues

* **Code issues found: none that block this audit.** The read path, write path,
  admin action, gauge and status logic all behave as documented under nullable
  direction and single-active-mapping selection; 745 tests pass.
* **Configuration issues found:** C1–C5 above (identity, time basis, declared
  basis, target reconciliation).
* **Code observation worth engineering's eye (not a defect, no change made):**
  `KpiMeasureMapping.targetBudget` drives status colour while
  `StrategicArea.kpiTarget` (free text) drives the gauge markers and the house
  card. That is two sources of truth for "the target", and it is what makes Grow
  look correct today. Consolidating them is an architectural change; it is
  outside this brief and was not made.

---

## 9. Outstanding business decisions

| # | Decision | Owner | Blocks |
| --- | --- | --- | --- |
| D1 | Is the Grow pillar's primary **BD Master unit adds** (count, YTD) or the FY27 plan's **gross unit adds growth %** (23% budget / 28% stretch)? The data implies BD Master counts. | Grow owner | C1 |
| D2 | Is Owner Retention **annualized (Finance) YTD** or **TTM**? The value 12.4% implies annualized YTD; the definition name implies TTM. | Retention owner | C2 |
| D3 | Grow's stored target text reads `2,608 goal; 3,152 budget`, but 2,608 is the prior-year comparison in the reviewed report. Which figures are the approved Grow targets? | Grow owner + FP&A | C1, C5 |
| D4 | Which target is authoritative for status colour and the gauge — the mapping's numeric `targetBudget`, or the definition's target text? | FP&A + engineering | C1, C5 and the two-source-of-truth observation in §8.3 |
| D5 | Confirm the TRevPAR growth figure is **reported** basis (not ex-OTA) for the pillar. | Revenue owner | C3 |
| D6 | Confirm Shop NOI margin vs PY is **ex-OTA** (the stored +0.8 matches ex-OTA). | Margin owner | C4 |
| D7 | Confirm the direction of all five pillar measures in production, given that pre-branch values may have come from the old `DEFAULT true`. | Pillar owners | §5 sign-off |
| D8 | Should the three unmapped enablers (Tech & AI, Marketing, Guest Experience) get a primary measure, and should Talent/Finance get a KPI definition at all? | Enabler owners | §6 |

---

## 10. Recommended execution order

1. **Engineering review of the migration and PR #26** (migration is
   engineering-owned). Approve `20261118220000_kpi_mapping_direction_optional`.
2. **Run the read-only inventory queries of §3.3 against production**
   `br-silent-wildflower-b438bp7m` from a machine with approved Neon access.
   Record the five rows' `higherIsBetter`, `timeBasis`, `displayFormat`,
   `targetBudget` and timestamps. This is the step that converts §3–§6 from
   **NOT VERIFIED** to verified; nothing should be corrected before it.
3. **Direction sign-off (D7).** Any `NULL` or semantically wrong direction on a
   pillar mapping is corrected first, because a wrong direction colours a number
   the wrong way regardless of identity.
4. **Business decisions D1–D3, D5, D6.** Agree identities, populations, time
   bases and targets, in writing.
5. **Apply the migration** through the approved release process (before or with
   the application deploy; same order as every other migration).
6. **Apply the mapping corrections C1–C4** through Admin › Measure mappings by an
   authorised user, one area at a time, switching the superseded mapping off in
   the same edit. Confirm after each: one active mapping, the intended primary
   name, the intended value, a status colour that matches the declared direction.
7. **Reconcile targets (C5 / D4)** and record the outcome in `STATUS.md`.
8. **Re-check the strategy house and the executive summary** against the October
   report: five primaries, five values, five directions, FY27 targets, and the
   neutral state still correct for unmapped enablers.
9. **Only then** merge PR #26. Do not merge or deploy before step 2 has produced
   real production evidence — the corrections in §8 are currently based on a
   local data set.

---

## Appendix — verification commands used

```bash
git rev-parse HEAD                      # 05e8448543e585c86c63ba6db3102a011ba0ab10
git status --porcelain | wc -l          # 0
gh pr list --state open --json number   # 25, 26 open, both MERGEABLE
psql -d awayday_si_dev -c '\d "KpiMeasureMapping"'
psql -d awayday_si_dev -A -F'|' -c '<inventory query §3.3>'
npx prisma validate                     # schema valid
npx prisma migrate status               # up to date (local)
curl -s -b awayday_theme=light http://127.0.0.1:3000/   # strategy house render
```

No production connection string was available or used. Nothing outside
`awayday_si_dev` was queried. Nothing was written anywhere.
