CREATE TYPE "BillingType" AS ENUM ('ONE_TIME', 'RECURRING');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY');
CREATE TYPE "ScheduleEntryStatus" AS ENUM ('PENDING', 'BILLED', 'CANCELLED');

ALTER TABLE "Product"
ADD COLUMN "billingType" "BillingType" NOT NULL DEFAULT 'ONE_TIME',
ADD COLUMN "billingCycle" "BillingCycle";

ALTER TABLE "QuotationLine"
ADD COLUMN "billingType" "BillingType" NOT NULL DEFAULT 'ONE_TIME',
ADD COLUMN "billingCycle" "BillingCycle",
ADD COLUMN "subscriptionStartDate" TIMESTAMP(3);

CREATE TABLE "BillingScheduleEntry" (
    "id" TEXT NOT NULL,
    "quotationLineId" TEXT NOT NULL,
    "billingDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" "ScheduleEntryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingScheduleEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "type" "BillingType" NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "quotationLineId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingScheduleEntry_quotationLineId_billingDate_key"
ON "BillingScheduleEntry"("quotationLineId", "billingDate");
CREATE INDEX "BillingScheduleEntry_billingDate_status_idx"
ON "BillingScheduleEntry"("billingDate", "status");
CREATE INDEX "Invoice_quotationId_idx" ON "Invoice"("quotationId");
CREATE INDEX "CreditNote_quotationLineId_idx" ON "CreditNote"("quotationLineId");

ALTER TABLE "BillingScheduleEntry"
ADD CONSTRAINT "BillingScheduleEntry_quotationLineId_fkey"
FOREIGN KEY ("quotationLineId") REFERENCES "QuotationLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_quotationId_fkey"
FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditNote"
ADD CONSTRAINT "CreditNote_quotationLineId_fkey"
FOREIGN KEY ("quotationLineId") REFERENCES "QuotationLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
