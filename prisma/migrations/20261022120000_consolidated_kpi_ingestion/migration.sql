-- Consolidated KPI ingestion — reporting scope, provenance, publication state, revisions.
--
-- Owned by the Strategic Initiatives repository: it is the single schema authority.
-- Consumed by awayday-document-intelligence (Layer C publisher). Additive only: no
-- existing column is dropped or rewritten and no row is deleted.
--
-- Pre-flight (safe to run, must return 0 rows before applying the unique index):
--   SELECT "kpiId", "reportingPeriod", "sourceRef", count(*)
--     FROM "KpiObservation" WHERE "sourceRef" IS NOT NULL
--    GROUP BY 1,2,3 HAVING count(*) > 1;

-- 1. Reporting scope + provenance + publication state on the fact table.
--    reportingScope makes the perimeter explicit: a value is only meaningful together with
--    the perimeter it covers. ADI writes 'AWAYDAY_CONSOLIDATED' and nothing else.
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "reportingScope"         TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "comparisonBasis"        TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "timeBasis"              TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "entityScope"            TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "entityId"               TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "sourceDocumentId"       TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "sourceDocumentName"     TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "sourceDocumentVersion"  TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "sourceContentHash"      TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "sourceCategory"         TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "sourceLocation"         TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "evidence"               TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "extractionRunId"        TEXT;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "authorityRank"          INTEGER;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "valueDerivation"        TEXT;
-- APPROVED | SUPERSEDED. Only APPROVED rows are current facts; SUPERSEDED rows are
-- retained history (their value also remains in KpiObservationRevision).
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "publicationState"       TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "revision"               INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "KpiObservation" ADD COLUMN IF NOT EXISTS "supersededAt"           TIMESTAMP(3);

-- 2. Idempotency: one observation per (KPI, period, source document version chain).
CREATE UNIQUE INDEX IF NOT EXISTS "KpiObservation_kpiId_reportingPeriod_sourceRef_key"
  ON "KpiObservation" ("kpiId", "reportingPeriod", "sourceRef");

-- 3. Lookup path for "current approved facts for a period, by perimeter".
CREATE INDEX IF NOT EXISTS "KpiObservation_period_scope_state_idx"
  ON "KpiObservation" ("reportingPeriod", "reportingScope", "publicationState");

-- 4. Append-only revision history. Every value ever approved is retained with the document
--    version, extraction run and evidence that produced it. Draft or failed extractions
--    never reach KpiObservation at all, so an approved value cannot be replaced by one.
CREATE TABLE IF NOT EXISTS "KpiObservationRevision" (
  id                     TEXT PRIMARY KEY,
  "observationId"        TEXT NOT NULL REFERENCES "KpiObservation"(id) ON DELETE CASCADE,
  "revision"             INTEGER NOT NULL,
  value                  TEXT NOT NULL,
  unit                   TEXT,
  "reportingScope"       TEXT NOT NULL,
  "comparisonBasis"      TEXT,
  "timeBasis"            TEXT,
  "entityId"             TEXT,
  "publicationState"     TEXT NOT NULL DEFAULT 'APPROVED',
  "sourceDocumentId"     TEXT NOT NULL,
  "sourceDocumentVersion" TEXT,
  "sourceContentHash"    TEXT,
  "sourceCategory"       TEXT,
  "sourceLocation"       TEXT,
  evidence               TEXT,
  "extractionRunId"      TEXT,
  "authorityRank"        INTEGER,
  "valueDerivation"      TEXT,
  "observedAt"           TIMESTAMP(3) NOT NULL,
  "recordedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "KpiObservationRevision_observationId_revision_key"
  ON "KpiObservationRevision" ("observationId", "revision");
CREATE INDEX IF NOT EXISTS "KpiObservationRevision_sourceDocumentId_idx"
  ON "KpiObservationRevision" ("sourceDocumentId");

-- 5. AI commentary is never authoritative financial data: separate storage, separate table.
CREATE TABLE IF NOT EXISTS "KpiCommentary" (
  id                TEXT PRIMARY KEY,
  "kpiId"           TEXT NOT NULL REFERENCES "KpiDefinition"(id) ON DELETE CASCADE,
  "reportingPeriod" TEXT NOT NULL,
  body              TEXT NOT NULL,
  "modelId"         TEXT,
  "promptVersion"   TEXT,
  "extractionRunId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "KpiCommentary_kpiId_reportingPeriod_idx"
  ON "KpiCommentary" ("kpiId", "reportingPeriod");

-- Rollback: drop the revision/commentary tables, the two indexes and the added columns.
-- No existing row is modified by the rollback.

-- ---------------------------------------------------------------------------------------
-- A7: at most one APPROVED observation per logical identity.
-- Two publishers running concurrently must not both leave an approved value for the same
-- metric/period/basis/scope. Superseded rows are kept (nothing is deleted), so history and
-- the revision trail remain intact; only the "current approved" pointer is unique.
-- Expressed as raw SQL because Prisma has no partial-index syntax; `migrate deploy` will
-- still create it on a fresh database.
-- ---------------------------------------------------------------------------------------
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "kpiId","reportingPeriod","comparisonBasis","timeBasis","reportingScope"
      ORDER BY "authorityRank" ASC NULLS LAST, "refreshedAt" DESC
  ) AS rn
  FROM "KpiObservation"
  WHERE "publicationState" = 'APPROVED'
)
UPDATE "KpiObservation" o
   SET "publicationState" = 'SUPERSEDED', "supersededAt" = now(), quality = 'STALE'
  FROM ranked r
 WHERE o.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "KpiObservation_one_approved_per_identity_idx"
  ON "KpiObservation" ("kpiId","reportingPeriod","comparisonBasis","timeBasis","reportingScope")
  WHERE "publicationState" = 'APPROVED';
