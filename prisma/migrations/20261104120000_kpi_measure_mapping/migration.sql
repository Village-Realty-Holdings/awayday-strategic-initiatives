-- CreateTable
CREATE TABLE "KpiMeasureMapping" (
    "id" TEXT NOT NULL,
    "measureKpiId" TEXT NOT NULL,
    "calculation" TEXT NOT NULL,
    "inputMetricKey" TEXT,
    "denominatorMetricKey" TEXT,
    "timeBasis" TEXT NOT NULL,
    "displayFormat" TEXT NOT NULL,
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
    "targetBudget" DOUBLE PRECISION,
    "targetStretch" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiMeasureMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KpiMeasureMapping_measureKpiId_key" ON "KpiMeasureMapping"("measureKpiId");

-- AddForeignKey
ALTER TABLE "KpiMeasureMapping" ADD CONSTRAINT "KpiMeasureMapping_measureKpiId_fkey" FOREIGN KEY ("measureKpiId") REFERENCES "KpiDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
