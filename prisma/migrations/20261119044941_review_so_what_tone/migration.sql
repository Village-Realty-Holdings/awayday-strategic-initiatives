-- An optional, explicit tone per so-what item ("positive", "warning",
-- "negative", "neutral"), so the review can show that one pillar's commentary
-- is mixed — "Behind · October beat budget" — instead of colouring every item in
-- a section with the section's own status.
--
-- Additive and backward compatible:
--   * the column is nullable and has no default, so every existing row remains
--     valid and reads as neutral;
--   * nothing is backfilled, because a row written before this column carries no
--     authored tone and inferring one from its wording is exactly the judgement
--     that must stay with a human;
--   * the values are the meaning, not CSS class names, and the database rejects
--     anything else.
-- No row is rewritten, no access control or publication rule changes.

-- CreateEnum
CREATE TYPE "SoWhatTone" AS ENUM ('POSITIVE', 'WARNING', 'NEGATIVE', 'NEUTRAL');

-- AlterTable
ALTER TABLE "ReviewSoWhat" ADD COLUMN     "tone" "SoWhatTone";
