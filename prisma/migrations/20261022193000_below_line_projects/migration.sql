CREATE TABLE "BelowLineProject" (
    "id" TEXT NOT NULL,
    "strategicAreaId" TEXT NOT NULL,
    "initiativeId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "team" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "dueAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BelowLineProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BelowLineProject_strategicAreaId_status_idx"
ON "BelowLineProject"("strategicAreaId", "status");

CREATE INDEX "BelowLineProject_initiativeId_idx"
ON "BelowLineProject"("initiativeId");

ALTER TABLE "BelowLineProject"
ADD CONSTRAINT "BelowLineProject_strategicAreaId_fkey"
FOREIGN KEY ("strategicAreaId") REFERENCES "StrategicArea"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BelowLineProject"
ADD CONSTRAINT "BelowLineProject_initiativeId_fkey"
FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
