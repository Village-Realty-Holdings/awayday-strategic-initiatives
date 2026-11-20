-- The reviewed executive-summary comparison lines, per month and per headline
-- card: what the report printed ("$1.8M under the $0.6M budget") and the colour
-- it gave each line.
--
-- Why a table rather than an observation: the report compares a figure with a
-- budget or prior-year value the application does not hold for that population.
-- Writing a synthetic KpiObservation to stand in for it would fabricate a
-- measurement; storing the printed comparison as reviewed presentation data
-- reproduces the report without inventing financial records. The plain text and
-- the tone are the reviewer's, and nothing is inferred from the wording.
--
-- Additive and backward compatible:
--   * a new table; no existing table, column, row or constraint is touched;
--   * every month without rows falls back to the calculated comparison;
--   * cascade delete follows the review period, like the other review tables.
-- No access control or publication rule changes.

-- CreateTable
CREATE TABLE "ReviewExecComparison" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "cardKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "tone" "SoWhatTone",
    "sourceDocumentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewExecComparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewExecComparison_periodId_cardKey_order_key" ON "ReviewExecComparison"("periodId", "cardKey", "order");

-- CreateIndex
CREATE INDEX "ReviewExecComparison_periodId_cardKey_order_idx" ON "ReviewExecComparison"("periodId", "cardKey", "order");

-- AddForeignKey
ALTER TABLE "ReviewExecComparison" ADD CONSTRAINT "ReviewExecComparison_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ReviewPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
