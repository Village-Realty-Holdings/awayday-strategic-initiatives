-- Stored review periods (draft/published, prepared by, meeting and updates-due dates,
-- data-as-of override) and the so-whats Strategy writes per period. Additive.
-- CreateEnum
CREATE TYPE "ReviewPeriodStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "ReviewPeriod" (
    "id" TEXT NOT NULL,
    "status" "ReviewPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "preparedBy" TEXT,
    "meetingDate" DATE,
    "updatesDueDate" DATE,
    "dataAsOf" DATE,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSoWhat" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "headline" TEXT NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewSoWhat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewSoWhat_periodId_scope_order_idx" ON "ReviewSoWhat"("periodId", "scope", "order");

-- AddForeignKey
ALTER TABLE "ReviewSoWhat" ADD CONSTRAINT "ReviewSoWhat_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ReviewPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

