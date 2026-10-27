-- Strategy-house roof (mission, goal, values) per plan version, previously
-- hardcoded in src/lib/plan-headers.ts. Additive; the backfill carries the text
-- that was shown so the review reads the same after deploy.

-- AlterTable
ALTER TABLE "PlanVersion" ADD COLUMN "mission" TEXT,
ADD COLUMN "goal" TEXT,
ADD COLUMN "values" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill
UPDATE "PlanVersion" SET
  "mission" = 'To Perfect the Vacation Rental Experience',
  "goal" = '$300M EBITDA by 12/31/28 · FY27 budget $180M, BHAG $200M',
  "values" = ARRAY['Servant Leadership', 'Ownership Mentality', 'Local', 'Excellence']
WHERE "code" = 'FY27';

UPDATE "PlanVersion" SET
  "mission" = 'To Perfect the Vacation Rental Experience',
  "goal" = '$150M EBITDA by 12/31/27 · Guest CSAT > 4.65',
  "values" = ARRAY['Servant Leadership', 'Ownership Mentality', 'Local', 'Excellence']
WHERE "code" = 'FY26';
