-- One status per SI: Complete / On-track / At-risk / Off-track, or none yet.
-- Replaces the lifecycle values and folds the monthly review status into it.
-- Not started and Planning have no equivalent, so they become NULL ("No status").

-- CreateEnum
ALTER TYPE "InitiativeStatus" RENAME TO "InitiativeStatus_old";
CREATE TYPE "InitiativeStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETE');

-- AlterTable
ALTER TABLE "Initiative" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Initiative" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "Initiative" ALTER COLUMN "status" TYPE "InitiativeStatus" USING (
  CASE "status"::text
    WHEN 'IN_PROGRESS' THEN 'ON_TRACK'
    WHEN 'AT_RISK' THEN 'AT_RISK'
    WHEN 'DONE' THEN 'COMPLETE'
  END
)::"InitiativeStatus";

ALTER TABLE "SubInitiative" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SubInitiative" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "SubInitiative" ALTER COLUMN "status" TYPE "InitiativeStatus" USING (
  CASE "status"::text
    WHEN 'IN_PROGRESS' THEN 'ON_TRACK'
    WHEN 'AT_RISK' THEN 'AT_RISK'
    WHEN 'DONE' THEN 'COMPLETE'
  END
)::"InitiativeStatus";

-- An update's review status wins over the lifecycle status it copied.
ALTER TABLE "InitiativeUpdate" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "InitiativeUpdate" ALTER COLUMN "status" TYPE "InitiativeStatus" USING (
  CASE
    WHEN "reviewStatus" IN ('AHEAD', 'ON_TRACK') THEN 'ON_TRACK'
    WHEN "reviewStatus" = 'AT_RISK' THEN 'AT_RISK'
    WHEN "reviewStatus" = 'BEHIND' THEN 'OFF_TRACK'
    WHEN "status"::text = 'IN_PROGRESS' THEN 'ON_TRACK'
    WHEN "status"::text = 'AT_RISK' THEN 'AT_RISK'
    WHEN "status"::text = 'DONE' THEN 'COMPLETE'
  END
)::"InitiativeStatus";

-- Keep statuses leads already set: each SI takes its newest review status.
UPDATE "Initiative" AS i
SET "status" = latest."status"
FROM (
  SELECT DISTINCT ON ("initiativeId") "initiativeId", "status"
  FROM "InitiativeUpdate"
  WHERE "reviewStatus" IS NOT NULL
  ORDER BY "initiativeId", "reportingPeriod" DESC NULLS LAST, "createdAt" DESC
) AS latest
WHERE i."id" = latest."initiativeId";

-- DropColumn
ALTER TABLE "InitiativeUpdate" DROP COLUMN "reviewStatus";

-- DropEnum
DROP TYPE "SiReviewStatus";
DROP TYPE "InitiativeStatus_old";
