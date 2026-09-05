-- CreateEnum
CREATE TYPE "CommentAuthorType" AS ENUM ('CUSTOMER', 'INTERNAL');

-- CreateEnum
CREATE TYPE "NegotiationEventAction" AS ENUM ('SENT_TO_CUSTOMER', 'DISCOUNT_UPDATED', 'CUSTOMER_CONFIRMED', 'APPROVAL_REENTRY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuotationStatus" ADD VALUE 'SENT_TO_CUSTOMER';
ALTER TYPE "QuotationStatus" ADD VALUE 'UNDER_NEGOTIATION';

-- AlterTable
ALTER TABLE "ApprovalLog" ADD COLUMN     "approvalRound" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "approvalRound" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "sentToCustomerAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegotiationComment" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "quotationLineId" TEXT,
    "authorType" "CommentAuthorType" NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiationComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegotiationEvent" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "quotationLineId" TEXT,
    "actorType" "CommentAuthorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "NegotiationEventAction" NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "NegotiationComment_quotationId_createdAt_idx" ON "NegotiationComment"("quotationId", "createdAt");

-- CreateIndex
CREATE INDEX "NegotiationComment_quotationLineId_idx" ON "NegotiationComment"("quotationLineId");

-- CreateIndex
CREATE INDEX "NegotiationComment_authorType_authorId_idx" ON "NegotiationComment"("authorType", "authorId");

-- CreateIndex
CREATE INDEX "NegotiationEvent_quotationId_createdAt_idx" ON "NegotiationEvent"("quotationId", "createdAt");

-- CreateIndex
CREATE INDEX "NegotiationEvent_quotationLineId_idx" ON "NegotiationEvent"("quotationLineId");

-- CreateIndex
CREATE INDEX "NegotiationEvent_actorType_actorId_idx" ON "NegotiationEvent"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "Quotation_customerId_idx" ON "Quotation"("customerId");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationComment" ADD CONSTRAINT "NegotiationComment_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationComment" ADD CONSTRAINT "NegotiationComment_quotationLineId_fkey" FOREIGN KEY ("quotationLineId") REFERENCES "QuotationLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationEvent" ADD CONSTRAINT "NegotiationEvent_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationEvent" ADD CONSTRAINT "NegotiationEvent_quotationLineId_fkey" FOREIGN KEY ("quotationLineId") REFERENCES "QuotationLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
