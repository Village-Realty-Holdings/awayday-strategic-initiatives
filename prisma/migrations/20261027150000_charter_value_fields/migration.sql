-- Charter template fields (one page per SI): Value's baseline, EBITDA value and
-- investment cost, and a free-text "by when" for dependencies. Additive and nullable.

-- AlterTable
ALTER TABLE "Initiative" ADD COLUMN "baseline" TEXT,
ADD COLUMN "ebitdaValue" TEXT,
ADD COLUMN "investmentCost" TEXT;

-- AlterTable
ALTER TABLE "InitiativeActionItem" ADD COLUMN "byWhen" TEXT;
