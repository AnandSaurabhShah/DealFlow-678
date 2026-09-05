-- Extend the existing quotation lifecycle for MVP 2 approval routing.
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'PENDING_MANAGER_APPROVAL';
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'PENDING_FINANCE_APPROVAL';
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- Persist the calculated score so approval views and history do not need to recalculate it.
ALTER TABLE "Quotation"
ADD COLUMN "blendedRiskScore" DECIMAL(65,30) NOT NULL DEFAULT 0;

CREATE TYPE "ApprovalAction" AS ENUM ('APPROVED', 'REJECTED', 'RETURNED');

CREATE TABLE "ApprovalLog" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApprovalLog_quotationId_createdAt_idx" ON "ApprovalLog"("quotationId", "createdAt");
CREATE INDEX "ApprovalLog_actorId_idx" ON "ApprovalLog"("actorId");

ALTER TABLE "ApprovalLog"
ADD CONSTRAINT "ApprovalLog_quotationId_fkey"
FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApprovalLog"
ADD CONSTRAINT "ApprovalLog_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
