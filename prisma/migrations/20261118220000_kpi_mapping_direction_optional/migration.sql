-- A measure's direction is a business statement, so an unstated direction must
-- stay unstated instead of defaulting to "higher is better".
--
-- The previous default silently declared that higher was better for every new
-- mapping, which colours a rise in a lower-is-better measure (owner churn, CAC,
-- operating expenses, units lost, cancellations) green.
--
-- Additive and non-destructive: existing true/false values are preserved
-- exactly. This migration does not backfill or reinterpret them, because a
-- stored `true` cannot be told apart from one the old default supplied.
ALTER TABLE "KpiMeasureMapping" ALTER COLUMN "higherIsBetter" DROP DEFAULT;
ALTER TABLE "KpiMeasureMapping" ALTER COLUMN "higherIsBetter" DROP NOT NULL;
