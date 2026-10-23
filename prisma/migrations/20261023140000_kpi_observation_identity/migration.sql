-- KPI observation identity — replace (kpiId, reportingPeriod, sourceRef) with the full
-- logical identity of a financial measurement.
--
-- Why: a single financial source (one workbook, one sourceRef) legitimately holds several
-- observations for the same KPI and period, distinguished by comparison basis and time
-- basis — September ACTUAL/MONTHLY 31 415 017.89, ACTUAL/YTD 328 545 736.74,
-- BUDGET/MONTHLY 26 369 842.05 and PRIOR_YEAR/MONTHLY 21 866 387.09 are four facts, not one
-- fact revised four times. The old unique key allowed exactly one of them, so publishing the
-- monthly figures collapsed all three onto the row that held the YTD actual and revised a
-- different approved fact into place (staging incident, 2026-10-23: observation
-- adi7b0a5660ee604cc699c3e9aee6db8d0b, revisions 2-4). The producer refuses that collision
-- today; this migration is what lets the refusal be lifted safely.
--
-- Two keys, deliberately different, because they answer different questions:
--
--   * Row identity (unconditional) — one row per (kpi, period, source document, comparison
--     basis, time basis, reporting scope, entity scope, entity id). Two different documents
--     may each own a row for the same logical fact; that is how provenance and the revision
--     trail survive a change of source document.
--
--   * Logical identity (partial, APPROVED only) — exactly one *authoritative* APPROVED value
--     per (kpi, period, comparison basis, time basis, reporting scope, entity scope, entity
--     id), regardless of which document supplied it. Superseding marks the loser SUPERSEDED
--     and nothing is deleted.
--
-- NULL semantics: PostgreSQL treats NULLs as distinct in a unique index, so a plain
-- composite index would silently permit duplicate approved facts whenever a basis, scope or
-- entity id is NULL — the exact defect this migration exists to close. Every nullable
-- identity column is therefore canonicalised with COALESCE(...,'') *inside the index
-- expression*: NULL and '' are the same identity ("unknown"), and no column is rewritten,
-- no NOT NULL constraint is added, and no existing value is reinterpreted.
--
-- Additive and forward-only: no column added or dropped, no row deleted, no observation id
-- or sourceRef changed, no KpiOverride touched, no revision history rewritten. The only rows
-- this migration may modify are ones that would *already* violate the stricter partial index
-- (duplicate APPROVED values for one logical identity); the weaker duplicates are demoted to
-- SUPERSEDED — never deleted — using the same ranking the previous migration established.
--
-- Pre-flight, all must return 0 rows (the migration raises instead of proceeding):
--
--   -- 1. duplicate row identities (the NULL-sourceRef case the old key could not see)
--   SELECT "kpiId","reportingPeriod","sourceRef","comparisonBasis","timeBasis",
--          "reportingScope","entityScope","entityId", count(*)
--     FROM "KpiObservation"
--    GROUP BY 1,2,3,4,5,6,7,8 HAVING count(*) > 1;
--
--   -- 2. duplicate approved logical identities
--   SELECT "kpiId","reportingPeriod","comparisonBasis","timeBasis","reportingScope",
--          "entityScope","entityId", count(*)
--     FROM "KpiObservation" WHERE "publicationState" = 'APPROVED'
--    GROUP BY 1,2,3,4,5,6,7 HAVING count(*) > 1;

-- Serialise against concurrent publishers while the keys change. Reads stay available;
-- writers wait for the transaction to commit and the migration runs in one transaction, so
-- there is no window in which neither key is enforced.
LOCK TABLE "KpiObservation" IN SHARE ROW EXCLUSIVE MODE;

-- ---------------------------------------------------------------------------------------
-- 1. Refuse to proceed on duplicate row identities. Widen nothing silently.
-- ---------------------------------------------------------------------------------------
DO $$
DECLARE
  duplicates bigint;
BEGIN
  SELECT count(*) INTO duplicates FROM (
    SELECT 1
      FROM "KpiObservation"
     GROUP BY "kpiId", "reportingPeriod", COALESCE("sourceRef", ''),
              COALESCE("comparisonBasis", ''), COALESCE("timeBasis", ''),
              COALESCE("reportingScope", ''), COALESCE("entityScope", ''),
              COALESCE("entityId", '')
    HAVING count(*) > 1
  ) d;

  IF duplicates > 0 THEN
    RAISE EXCEPTION
      'KpiObservation has % group(s) of duplicate row identities; resolve them before migrating',
      duplicates
      USING HINT = 'Inspect with the pre-flight query in this file: distinct rows now collide '
                   'on the canonicalised identity, most likely because several observations '
                   'share a NULL sourceRef. Give each its own sourceRef rather than deleting '
                   'a measurement.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------
-- 2. Row identity: one observation per document, per logical fact.
-- ---------------------------------------------------------------------------------------
DROP INDEX IF EXISTS "KpiObservation_kpiId_reportingPeriod_sourceRef_key";

CREATE UNIQUE INDEX IF NOT EXISTS "KpiObservation_row_identity_key"
  ON "KpiObservation" (
    "kpiId",
    "reportingPeriod",
    COALESCE("sourceRef", ''),
    COALESCE("comparisonBasis", ''),
    COALESCE("timeBasis", ''),
    COALESCE("reportingScope", ''),
    COALESCE("entityScope", ''),
    COALESCE("entityId", '')
  );

-- The dropped unique index also served the "which rows came from this document" lookup.
-- Keep that path indexed, now without claiming uniqueness.
CREATE INDEX IF NOT EXISTS "KpiObservation_kpiId_reportingPeriod_sourceRef_idx"
  ON "KpiObservation" ("kpiId", "reportingPeriod", "sourceRef");

-- ---------------------------------------------------------------------------------------
-- 3. Logical identity: at most one authoritative APPROVED value per fact, NULL-safe, and
--    now including the entity the fact is about. Two entities under one perimeter must not
--    be collapsed, and one entity must not hold two approved values.
-- ---------------------------------------------------------------------------------------
DROP INDEX IF EXISTS "KpiObservation_one_approved_per_identity_idx";

-- Demote (never delete) any pre-existing duplicate approved values, strongest kept. On a
-- database that has never published a collision this updates zero rows.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "kpiId", "reportingPeriod",
                   COALESCE("comparisonBasis", ''), COALESCE("timeBasis", ''),
                   COALESCE("reportingScope", ''), COALESCE("entityScope", ''),
                   COALESCE("entityId", '')
      ORDER BY "authorityRank" ASC NULLS LAST, "refreshedAt" DESC, id
  ) AS rn
  FROM "KpiObservation"
  WHERE "publicationState" = 'APPROVED'
)
UPDATE "KpiObservation" o
   SET "publicationState" = 'SUPERSEDED',
       "supersededAt" = now(),
       quality = 'STALE'
  FROM ranked r
 WHERE o.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "KpiObservation_one_approved_per_identity_idx"
  ON "KpiObservation" (
    "kpiId",
    "reportingPeriod",
    COALESCE("comparisonBasis", ''),
    COALESCE("timeBasis", ''),
    COALESCE("reportingScope", ''),
    COALESCE("entityScope", ''),
    COALESCE("entityId", '')
  )
  WHERE "publicationState" = 'APPROVED';

-- Rollback (manual, not run by Prisma): drop the two indexes created here and recreate the
-- original keys. Reversing this migration does not restore rows demoted in step 3 — their
-- values remain in KpiObservationRevision, which is append-only.
--
--   DROP INDEX IF EXISTS "KpiObservation_one_approved_per_identity_idx";
--   DROP INDEX IF EXISTS "KpiObservation_row_identity_key";
--   DROP INDEX IF EXISTS "KpiObservation_kpiId_reportingPeriod_sourceRef_idx";
--   CREATE UNIQUE INDEX "KpiObservation_kpiId_reportingPeriod_sourceRef_key"
--     ON "KpiObservation" ("kpiId","reportingPeriod","sourceRef");
--   CREATE UNIQUE INDEX "KpiObservation_one_approved_per_identity_idx"
--     ON "KpiObservation" ("kpiId","reportingPeriod","comparisonBasis","timeBasis",
--                           "reportingScope")
--     WHERE "publicationState" = 'APPROVED';
