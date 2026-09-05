-- Extend the quotation lifecycle once a fulfillment split is finalized.
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'FULFILLED';

CREATE TABLE "FulfillmentSplit" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyFulfilled" INTEGER NOT NULL,
    "qtyBackordered" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FulfillmentSplit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FulfillmentSplit_quotationId_warehouseId_productId_key"
ON "FulfillmentSplit"("quotationId", "warehouseId", "productId");
CREATE INDEX "FulfillmentSplit_warehouseId_idx" ON "FulfillmentSplit"("warehouseId");
CREATE INDEX "FulfillmentSplit_productId_idx" ON "FulfillmentSplit"("productId");

ALTER TABLE "FulfillmentSplit"
ADD CONSTRAINT "FulfillmentSplit_quotationId_fkey"
FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FulfillmentSplit"
ADD CONSTRAINT "FulfillmentSplit_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FulfillmentSplit"
ADD CONSTRAINT "FulfillmentSplit_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
