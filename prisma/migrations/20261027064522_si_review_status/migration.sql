-- Monthly review status an SI lead sets on an update (Ahead / On track / At risk / Behind).
-- Additive and nullable: existing updates keep a NULL review status ("Status TBD").

-- CreateEnum
CREATE TYPE "SiReviewStatus" AS ENUM ('AHEAD', 'ON_TRACK', 'AT_RISK', 'BEHIND');

-- AlterTable
ALTER TABLE "InitiativeUpdate" ADD COLUMN "reviewStatus" "SiReviewStatus";
