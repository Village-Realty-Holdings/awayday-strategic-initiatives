-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InitiativeStatus" AS ENUM ('NOT_STARTED', 'PLANNING', 'IN_PROGRESS', 'AT_RISK', 'DONE');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DmaicStage" AS ENUM ('DEFINE', 'MEASURE', 'ANALYZE', 'IMPROVE', 'CONTROL');

-- CreateEnum
CREATE TYPE "Quadrant" AS ENUM ('BIG_BET', 'QUICK_WIN', 'FILL_IN', 'AVOID');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('FILE', 'LINK');

-- CreateEnum
CREATE TYPE "AiModule" AS ENUM ('INITIATIVES', 'PLATFORM');

-- CreateEnum
CREATE TYPE "AiOutcome" AS ENUM ('OK', 'ERROR', 'TIMEOUT', 'RATE_LIMITED', 'FALLBACK');

-- CreateEnum
CREATE TYPE "AiAcceptance" AS ENUM ('ACCEPTED', 'EDITED', 'DISMISSED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cimDriver" TEXT,
    "cimItemCode" TEXT,
    "valueType" TEXT NOT NULL DEFAULT 'VALUE',
    "boardTheme" TEXT,
    "teamLead" TEXT,
    "secondaryLead" TEXT,
    "supports" TEXT,
    "problem" TEXT,
    "valueWhenComplete" TEXT,
    "workRequired" TEXT,
    "scopeOut" TEXT,
    "plan" TEXT,
    "value" INTEGER NOT NULL,
    "lift" INTEGER NOT NULL,
    "quadrant" "Quadrant" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "InitiativeStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "stage" "DmaicStage",
    "pctComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualImpact" "ImpactLevel",
    "quantMetric" TEXT,
    "quantTarget" TEXT,
    "progressActual" DOUBLE PRECISION,
    "progressTarget" DOUBLE PRECISION,
    "estEbitdaImpact" DECIMAL(14,2),
    "actualEbitdaImpact" DECIMAL(14,2),
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubInitiative" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owner" TEXT,
    "status" "InitiativeStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "pctComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubInitiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeRisk" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "mitigation" TEXT,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeMilestone" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owner" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeActionItem" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ACTION',
    "title" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeEltRequest" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SUPPORT',
    "amount" DECIMAL(14,2),
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "decidedNote" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeEltRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeComment" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InitiativeComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScorecardGoal" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "ltm" TEXT,
    "ytdBud" TEXT,
    "status" TEXT,
    "color" TEXT NOT NULL DEFAULT 'grey',
    "owner" TEXT,
    "cim" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CimRisk" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "owner" TEXT,
    "targetDate" TIMESTAMP(3),
    "prize" TEXT,
    "prizeNum" DOUBLE PRECISION,
    "currentState" TEXT,
    "targetState" TEXT,
    "focus" BOOLEAN NOT NULL DEFAULT false,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CimRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskInitiative" (
    "cimRiskId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,

    CONSTRAINT "RiskInitiative_pkey" PRIMARY KEY ("cimRiskId","initiativeId")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "contentType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_invocation" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module" "AiModule" NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costUsd" DECIMAL(10,6),
    "outcome" "AiOutcome" NOT NULL,
    "errorClass" TEXT,
    "userId" TEXT,
    "sessionKey" TEXT,
    "acceptance" "AiAcceptance",
    "downstreamAction" TEXT,

    CONSTRAINT "ai_invocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "role" TEXT,
    "appAccess" TEXT[] DEFAULT ARRAY['initiatives']::TEXT[],
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT true,
    "failedVerificationCount" INTEGER DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_InitiativeToInitiativeGroup" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InitiativeToInitiativeGroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Initiative_code_key" ON "Initiative"("code");

-- CreateIndex
CREATE INDEX "Initiative_status_idx" ON "Initiative"("status");

-- CreateIndex
CREATE INDEX "Initiative_cimDriver_idx" ON "Initiative"("cimDriver");

-- CreateIndex
CREATE INDEX "Initiative_ownerUserId_idx" ON "Initiative"("ownerUserId");

-- CreateIndex
CREATE INDEX "SubInitiative_initiativeId_idx" ON "SubInitiative"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeRisk_initiativeId_idx" ON "InitiativeRisk"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeMilestone_initiativeId_idx" ON "InitiativeMilestone"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeActionItem_initiativeId_idx" ON "InitiativeActionItem"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeEltRequest_initiativeId_idx" ON "InitiativeEltRequest"("initiativeId");

-- CreateIndex
CREATE INDEX "InitiativeComment_initiativeId_idx" ON "InitiativeComment"("initiativeId");

-- CreateIndex
CREATE INDEX "ScorecardGoal_order_idx" ON "ScorecardGoal"("order");

-- CreateIndex
CREATE UNIQUE INDEX "CimRisk_code_key" ON "CimRisk"("code");

-- CreateIndex
CREATE INDEX "CimRisk_category_idx" ON "CimRisk"("category");

-- CreateIndex
CREATE INDEX "RiskInitiative_initiativeId_idx" ON "RiskInitiative"("initiativeId");

-- CreateIndex
CREATE INDEX "Attachment_initiativeId_idx" ON "Attachment"("initiativeId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Position_name_key" ON "Position"("name");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ai_invocation_occurredAt_idx" ON "ai_invocation"("occurredAt");

-- CreateIndex
CREATE INDEX "ai_invocation_module_feature_idx" ON "ai_invocation"("module", "feature");

-- CreateIndex
CREATE INDEX "ai_invocation_userId_idx" ON "ai_invocation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor"("secret");

-- CreateIndex
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- CreateIndex
CREATE INDEX "_InitiativeToInitiativeGroup_B_index" ON "_InitiativeToInitiativeGroup"("B");

-- AddForeignKey
ALTER TABLE "SubInitiative" ADD CONSTRAINT "SubInitiative_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeRisk" ADD CONSTRAINT "InitiativeRisk_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeMilestone" ADD CONSTRAINT "InitiativeMilestone_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeActionItem" ADD CONSTRAINT "InitiativeActionItem_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeEltRequest" ADD CONSTRAINT "InitiativeEltRequest_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeComment" ADD CONSTRAINT "InitiativeComment_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskInitiative" ADD CONSTRAINT "RiskInitiative_cimRiskId_fkey" FOREIGN KEY ("cimRiskId") REFERENCES "CimRisk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskInitiative" ADD CONSTRAINT "RiskInitiative_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InitiativeToInitiativeGroup" ADD CONSTRAINT "_InitiativeToInitiativeGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InitiativeToInitiativeGroup" ADD CONSTRAINT "_InitiativeToInitiativeGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "InitiativeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

