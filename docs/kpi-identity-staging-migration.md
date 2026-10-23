# KPI observation identity — staging migration and September publication

Applied to the Neon **staging** branch (`br-ancient-silence-b45v39zu`, project
`frosty-resonance-20920085`) on 2026-10-23. Production was not touched.

## 1. Why `prisma migrate deploy` was not used

The staging `_prisma_migrations` table held four applied migrations; the directory held six.

| migration | staging before |
| --- | --- |
| `0_init` | applied |
| `20261012130000_fy27_plan_model` | applied |
| `20261012180500_nullable_legacy_strategic_plan` | applied |
| `20261022120000_consolidated_kpi_ingestion` | applied |
| `20261022193000_below_line_projects` | **not applied** |
| `20261023140000_kpi_observation_identity` | not applied (this work) |

`prisma migrate deploy` applies every pending migration in lexicographic order, so it would
have applied `20261022193000_below_line_projects` first — another developer's feature, on a
branch whose Prisma model is missing (see §4). The reviewed migration was therefore applied on
its own, in a single transaction, together with its own `_prisma_migrations` row.

### Procedure (reproducible)

```sql
BEGIN;
\i prisma/migrations/20261023140000_kpi_observation_identity/migration.sql
INSERT INTO "_prisma_migrations"
       (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, :'checksum', now(),
        '20261023140000_kpi_observation_identity', NULL, NULL, now(), 1);
COMMIT;
```

`checksum` is the sha256 of `migration.sql` as Prisma computes it:
`29a79db86c8e13a3ecd6f80aeb08af910978d06aad477cb59baf61e66ba3e3a4`. Nothing was faked: the
recorded checksum is the digest of the file that was executed, and the statements ran in the
same transaction that recorded them.

### Pre-flight (all zero rows before applying)

* duplicate row identities under the canonicalised key — `0`
* duplicate `APPROVED` logical identities — `0`

### Result

* `LOCK TABLE`, `DO` (duplicate refusal), two `DROP INDEX`, three `CREATE INDEX`, `UPDATE 0`,
  one `_prisma_migrations` row, `COMMIT`.
* `UPDATE 0`: no pre-existing row was demoted. Nothing was deleted, no observation id or
  `sourceRef` changed.
* Data snapshot before/after is byte-identical for `KpiObservation`,
  `KpiObservationRevision`, `KpiDefinition`, `KpiOverride` and every constraint.
* Indexes after: `KpiObservation_row_identity_key` (8 columns, `COALESCE`-canonicalised) and
  `KpiObservation_one_approved_per_identity_idx` (7 columns, partial on `APPROVED`, now
  including `entityScope`/`entityId`). The old
  `KpiObservation_kpiId_reportingPeriod_sourceRef_key` is gone, replaced by a non-unique
  lookup index of the same shape.

### Ordering note for the responsible developer

This branch now has a later migration recorded while
`20261022193000_below_line_projects` remains pending. `prisma migrate deploy` will still apply
that migration when it runs (Prisma applies pending migrations in order regardless of what is
already recorded), and it applies cleanly — verified below. Until it is applied,
`prisma migrate status` will report one migration not yet applied. That is an accurate
statement of the staging branch, not drift.

## 2. September publication

Published from the already-archived, already-approved replay report
`var/reports/20261023T165737Z_replay.json` (manifest
`man_017L2LGMVCNW7SX4AAPRG3K26Y3MYJSB74_9bf5c18db7fd`, report sha256
`9bf5c18db7fd471a3694381ace9f8d891c6a048fa749c767e8bac016eba74328`, created
2026-10-23T16:57Z). No workbook was re-extracted and no SharePoint discovery was run.

| fact | value | cell | result |
| --- | --- | --- | --- |
| ACTUAL / MONTHLY | 31415017.89 | `sheet:PF REV!E20` | inserted `adi832fa3…` |
| BUDGET / MONTHLY | 26369842.05 | `sheet:PF REV!F20` | inserted `adi4ec920…` |
| PRIOR_YEAR / MONTHLY | 21866387.09 | `sheet:PF REV!G20` | inserted `adi51f7cd…` |

All three are `2026-09`, `AWAYDAY_CONSOLIDATED`, `CONSOLIDATED` /
`AWAYDAY_CONSOLIDATED`, authority rank 15, revision 1, from document
`017L2LGMVCNW7SX4AAPRG3K26Y3MYJSB74` v1.

The existing `ACTUAL / YTD` observation (`adi7b0a5660…`, 328545736.74, `sheet:PF REV!O20`)
was **not modified**: still `revision = 5`, `APPROVED`, same value, same cell, same revisions
2–4 in history.

Rerunning the same publication returned `inserted=0, unchanged=3, revisions=0`.

Staging now holds 8 observations and 12 revisions, up from 5 and 9; `KpiOverride` is
untouched (0 rows before and after).

## 3. Resolver changes in this branch

`observationIdentity` now mirrors the index exactly — period, comparison basis, time basis,
reporting scope, **entity scope, entity id** — so two entities are never collapsed onto one
fact. `compareIdentities` orders consolidated entities first, then by entity id, so a series
is stable. `KpiObservationFilter` gained `entityScope` / `entityId`.

`DEFAULT_TIME_BASIS = "YTD"` is now an explicit, exported contract rather than a consequence of
sort order: a caller that names no time basis gets `YTD` when the period carries it, and the
strongest available basis otherwise (unchanged behaviour for the four ratio observations).
`{ requireExplicitTimeBasis: true }` makes `resolveKpi` throw `AmbiguousTimeBasisError` instead
of guessing; `resolveKpiSeries` returns every identity side by side either way.

## 4. Upstream issue for the responsible team — not fixed here

`20261022193000_below_line_projects` (commit `1ea5318` "update v2", Jesus Cadena) creates
`"BelowLineProject"` in SQL but the Prisma schema has no `model BelowLineProject`. No branch
in the repository has it. Consequences, all reproduced today:

* `src/app/(app)/v2/actions.ts` calls `prisma.belowLineProject.create` →
  `tsc --noEmit` fails with `Property 'belowLineProject' does not exist on type 'PrismaClient'`,
  and around 36 further implicit-`any` errors in `src/app/(app)/v2/**` cascade from the
  untyped result.
* `src/lib/v2-data.ts` includes `belowLineProjects`, so the read path is broken too.
* `src/lib/audit-coverage.test.ts` fails on `toggleV2ActionItem`, `toggleV2Milestone` and
  `createBelowLineProject` (mutating actions without audit entries) — a pre-existing failure
  in someone else's in-flight feature, left untouched.

The migration SQL itself is valid: applying the full chain to an empty database succeeds.
The defect is the missing Prisma model (and the missing audit calls), not the migration.

## 5. Verification performed

* `vitest` — 252 passed, 1 failed (only the pre-existing audit-coverage failure above); 30 of
  them in `src/lib/kpi.test.ts`, including the new entity-identity and time-basis contract
  suites.
* `tsc --noEmit` — no errors in `src/lib/kpi.ts`; the 40 reported errors are all in the v2/UI
  files listed in §4 and pre-date this branch.
* Resolver output against the real staging rows: `ACTUAL/MONTHLY 31415017.89`,
  `ACTUAL/YTD 328545736.74`, `PRIOR_YEAR/MONTHLY 21866387.09`, `BUDGET/MONTHLY 26369842.05`,
  plus the four untouched ratio observations. Default = YTD, `timeBasis: "MONTHLY"` selectable,
  strict mode raises.
* SQL: 0 duplicate approved identities, both identity indexes present,
  `20261022193000_below_line_projects` still unapplied and `"BelowLineProject"` still absent.
