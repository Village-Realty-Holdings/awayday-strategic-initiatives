ALTER TABLE "Initiative"
  ADD COLUMN "planVersionId" TEXT,
  ADD COLUMN "strategicAreaId" TEXT,
  ADD COLUMN "sourceKey" TEXT,
  ADD COLUMN "sourceManaged" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PlanVersion" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sourceFileName" TEXT,
  "sourceHash" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategicArea" (
  "id" TEXT NOT NULL,
  "planVersionId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "goal" TEXT,
  "kpiName" TEXT,
  "kpiTarget" TEXT,
  "owner" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StrategicArea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InitiativeUpdate" (
  "id" TEXT NOT NULL,
  "initiativeId" TEXT NOT NULL,
  "status" "InitiativeStatus" NOT NULL,
  "update" TEXT,
  "pathForward" TEXT,
  "nextMilestone" TEXT,
  "milestoneDueAt" TIMESTAMP(3),
  "reportingPeriod" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InitiativeUpdate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KpiDefinition" (
  "id" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT,
  "displayFormat" TEXT,
  "target" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceIdentifier" TEXT,
  "strategicAreaId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KpiObservation" (
  "id" TEXT NOT NULL,
  "kpiId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "reportingPeriod" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quality" TEXT NOT NULL DEFAULT 'VALID',
  "sourceRef" TEXT,
  CONSTRAINT "KpiObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KpiOverride" (
  "id" TEXT NOT NULL,
  "kpiId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "reportingPeriod" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "editorUserId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "KpiOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRun" (
  "id" TEXT NOT NULL,
  "planVersionId" TEXT NOT NULL,
  "sourceFileName" TEXT NOT NULL,
  "sourceHash" TEXT,
  "status" TEXT NOT NULL,
  "summary" JSONB,
  "warnings" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanVersion_code_key" ON "PlanVersion"("code");
CREATE UNIQUE INDEX "StrategicArea_planVersionId_code_key" ON "StrategicArea"("planVersionId", "code");
CREATE UNIQUE INDEX "KpiDefinition_metricKey_key" ON "KpiDefinition"("metricKey");
CREATE INDEX "Initiative_planVersionId_idx" ON "Initiative"("planVersionId");
CREATE INDEX "Initiative_strategicAreaId_idx" ON "Initiative"("strategicAreaId");
CREATE INDEX "PlanVersion_active_idx" ON "PlanVersion"("active");
CREATE INDEX "StrategicArea_planVersionId_kind_order_idx" ON "StrategicArea"("planVersionId", "kind", "order");
CREATE INDEX "InitiativeUpdate_initiativeId_createdAt_idx" ON "InitiativeUpdate"("initiativeId", "createdAt");
CREATE INDEX "KpiObservation_kpiId_observedAt_idx" ON "KpiObservation"("kpiId", "observedAt");
CREATE INDEX "KpiOverride_kpiId_active_createdAt_idx" ON "KpiOverride"("kpiId", "active", "createdAt");
CREATE INDEX "ImportRun_planVersionId_createdAt_idx" ON "ImportRun"("planVersionId", "createdAt");

ALTER TABLE "Initiative"
  ADD CONSTRAINT "Initiative_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Initiative_strategicAreaId_fkey" FOREIGN KEY ("strategicAreaId") REFERENCES "StrategicArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StrategicArea"
  ADD CONSTRAINT "StrategicArea_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InitiativeUpdate"
  ADD CONSTRAINT "InitiativeUpdate_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KpiDefinition"
  ADD CONSTRAINT "KpiDefinition_strategicAreaId_fkey" FOREIGN KEY ("strategicAreaId") REFERENCES "StrategicArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KpiObservation"
  ADD CONSTRAINT "KpiObservation_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "KpiDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KpiOverride"
  ADD CONSTRAINT "KpiOverride_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "KpiDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRun"
  ADD CONSTRAINT "ImportRun_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
