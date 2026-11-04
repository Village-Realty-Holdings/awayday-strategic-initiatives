-- CreateTable
CREATE TABLE "ReviewPillarStatus" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "strategicAreaId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewPillarStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewPillarStatus_periodId_strategicAreaId_key" ON "ReviewPillarStatus"("periodId", "strategicAreaId");

-- CreateIndex
CREATE INDEX "ReviewPillarStatus_strategicAreaId_idx" ON "ReviewPillarStatus"("strategicAreaId");

-- AddForeignKey
ALTER TABLE "ReviewPillarStatus" ADD CONSTRAINT "ReviewPillarStatus_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ReviewPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPillarStatus" ADD CONSTRAINT "ReviewPillarStatus_strategicAreaId_fkey" FOREIGN KEY ("strategicAreaId") REFERENCES "StrategicArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
