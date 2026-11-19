# October 2026 release runbook — applying the two pending migrations

- **Status:** prepared, not executed. PR #26 is reviewed, green and based on
  `master`, but it is **not merged**, because it must not reach production before
  its two additive migrations exist there.
- **Why this file exists:** PR #25 is merged and deployed. PR #26 changes the
  Prisma schema, and the review page reads the new `ReviewSoWhat.tone` column, so
  deploying it against a database without that column would fail the Strategy
  Review. The repository's documented release order is *migration first, then
  merge* (README → Deploying). The agent that prepared this release had no
  approved Neon credential on the machine, so the migration step is left to an
  engineer with that access.

Nothing in this runbook touches business observations, approved statuses,
publication state or auth. Both migrations are schema-only, additive and
non-destructive.

---

## 1. What production needs

`master` (deployed) carries 17 applied migrations. PR #26 adds exactly two:

| Order | Migration | Statement | Effect on existing rows |
| --- | --- | --- | --- |
| 18 | `20261118220000_kpi_mapping_direction_optional` | `ALTER TABLE "KpiMeasureMapping" ALTER COLUMN "higherIsBetter" DROP DEFAULT;` then `DROP NOT NULL` | None. Stored `true`/`false` are preserved; no backfill. |
| 19 | `20261119044941_review_so_what_tone` | `CREATE TYPE "SoWhatTone" AS ENUM (...)`; `ALTER TABLE "ReviewSoWhat" ADD COLUMN "tone" "SoWhatTone"` | None. Nullable, no default, no backfill. Existing rows read as neutral. |

Both are metadata operations (no table rewrite, no data movement, no delete, no
rename). Expected duration: milliseconds, under a brief `ACCESS EXCLUSIVE` lock on
each table.

Confirm the two are the only difference:

```bash
git diff --name-only origin/master origin/feat/review-visual-parity -- prisma/migrations
```

## 2. Pre-flight, read-only

Run against the Neon **production** branch (`frosty-resonance-20920085`,
`br-silent-wildflower-b438bp7m`, database `neondb`) with the direct, non-pooler
host. Do not print the connection string.

```bash
# 1. Where production actually is.
DIRECT_URL=… npx prisma migrate status
#    Expect: 17 migrations found, and the two above reported as not yet applied.

# 2. The applied history, straight from the bookkeeping table.
psql "$DIRECT_URL" -c 'select migration_name, finished_at from "_prisma_migrations" order by finished_at desc nulls first limit 6;'

# 3. The columns the migrations will change, as they are now.
psql "$DIRECT_URL" -c "select is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='KpiMeasureMapping' and column_name='higherIsBetter';"
psql "$DIRECT_URL" -c "select column_name, is_nullable from information_schema.columns where table_schema='public' and table_name='ReviewSoWhat' order by ordinal_position;"
psql "$DIRECT_URL" -c "select 1 from pg_type where typname = 'SoWhatTone';"   # expect no rows

# 4. Row counts to compare afterwards (nothing should change).
psql "$DIRECT_URL" -c 'select (select count(*) from "KpiMeasureMapping") mappings, (select count(*) from "ReviewSoWhat") sowhats, (select count(*) from "KpiDefinition") definitions, (select count(*) from "KpiObservation") observations;'

# 5. How many mappings state no direction today (should be 0 before the release).
psql "$DIRECT_URL" -c 'select count(*) from "KpiMeasureMapping" where "higherIsBetter" is null;'
```

**Stop if** step 1 shows any migration that is not the two listed above, or if
step 5 returns a non-zero count (that would mean production already contains an
unstated direction, which the earlier release notes say it does not).

## 3. Apply

Use the repository's existing script — not raw DDL:

```bash
DIRECT_URL=… npm run db:migrate:deploy
```

`prisma migrate deploy` applies each pending migration in order, records it in
`_prisma_migrations`, and stops on the first failure. It never resets or drops.

## 4. Post-migration verification, read-only

```bash
DIRECT_URL=… npx prisma migrate status            # 19 migrations, schema up to date
psql "$DIRECT_URL" -c "select is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='KpiMeasureMapping' and column_name='higherIsBetter';"
#   expect: is_nullable = YES, column_default = null
psql "$DIRECT_URL" -c "select e.enumlabel from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typname = 'SoWhatTone' order by e.enumsortorder;"
#   expect: POSITIVE, WARNING, NEGATIVE, NEUTRAL
psql "$DIRECT_URL" -c 'select count(*) from "ReviewSoWhat" where tone is not null;'   # expect 0
psql "$DIRECT_URL" -c 'select (select count(*) from "KpiMeasureMapping") mappings, (select count(*) from "ReviewSoWhat") sowhats, (select count(*) from "KpiDefinition") definitions, (select count(*) from "KpiObservation") observations;'
#   expect: identical to step 4 above
```

## 5. Merge and deploy

Only after §4 passes:

```bash
gh pr merge 26 --merge        # Workers Builds deploys master to production
```

Then confirm the deployment, not just the workflow:

```bash
npx wrangler deployments list --name awayday-strategic-initiatives | tail -12
curl -s -o /dev/null -w '%{http_code}\n' https://awayday-strategic-initiatives.tech-dd8.workers.dev/login
```

## 6. Compatibility while the release is half-applied

| Database | Application | Result |
| --- | --- | --- |
| 17 migrations (today) | `master` (deployed) | Works. Unchanged behaviour. |
| 19 migrations | `master` (deployed) | Works. The old client never selects `tone`, and existing `higherIsBetter` values are untouched. |
| 19 migrations | PR #26 | Works. This is the target state. |
| **17 migrations** | **PR #26** | **Fails.** `getReviewPeriod` selects `ReviewSoWhat.tone`; the column must exist first. This is why the migration precedes the merge. |

Rolling the *application* back to `master` after #26 has run is safe for `tone`
(the old client ignores the column) but **not** for a mapping whose direction was
set to "not stated": `master`'s `mappingRag` read `!higherIsBetter`, so a stored
`null` would be treated as *lower is better*. Clear any such row to an approved
direction before rolling the application back, or stay forward.

## 7. If the migration must be undone

```sql
-- tone: only drops the column added in migration 19. No pre-existing data lives here.
ALTER TABLE "ReviewSoWhat" DROP COLUMN "tone";
DROP TYPE "SoWhatTone";

-- higherIsBetter: restore the old default and constraint ONLY when no row is NULL.
select count(*) from "KpiMeasureMapping" where "higherIsBetter" is null;  -- must be 0
ALTER TABLE "KpiMeasureMapping" ALTER COLUMN "higherIsBetter" SET NOT NULL;
ALTER TABLE "KpiMeasureMapping" ALTER COLUMN "higherIsBetter" SET DEFAULT true;
```

Then delete the corresponding row from `_prisma_migrations` only if the migration
record must be replayed — otherwise leave the history as it is.

## 8. Not part of this release

- No October observation import, no So-What content import, no FY27 target
  rewrite, no `configure-october-2026-primary-measures.ts --apply`.
- The five pillar primaries are still the FY27 plan definitions until that
  reviewed configuration script is run by an engineer (dry run first).
- So-What commentary remains exactly as stored; the 33 reference items are a
  transcription in `docs/october-2026-so-what-content-preview.md`, not an import.
