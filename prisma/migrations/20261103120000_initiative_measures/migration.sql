-- CreateTable
CREATE TABLE "InitiativeMeasure" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'KPI',
    "unit" TEXT NOT NULL DEFAULT 'NUMBER',
    "baseline" DOUBLE PRECISION,
    "target" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeMeasureReading" (
    "id" TEXT NOT NULL,
    "measureId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InitiativeMeasureReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InitiativeMeasure_initiativeId_idx" ON "InitiativeMeasure"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeMeasureReading_measureId_asOf_idx" ON "InitiativeMeasureReading"("measureId", "asOf");

-- AddForeignKey
ALTER TABLE "InitiativeMeasure" ADD CONSTRAINT "InitiativeMeasure_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeMeasureReading" ADD CONSTRAINT "InitiativeMeasureReading_measureId_fkey" FOREIGN KEY ("measureId") REFERENCES "InitiativeMeasure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
