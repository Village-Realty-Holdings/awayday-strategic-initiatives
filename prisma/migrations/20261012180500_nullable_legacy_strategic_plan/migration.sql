-- Older databases retained a required StrategicPlan relation on Initiative.
-- The current model uses PlanVersion instead. Make the legacy column nullable
-- when it exists, while allowing newer databases without that column to pass.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Initiative'
      AND column_name = 'strategicPlanId'
  ) THEN
    ALTER TABLE "Initiative" ALTER COLUMN "strategicPlanId" DROP NOT NULL;
  END IF;
END
$$;
