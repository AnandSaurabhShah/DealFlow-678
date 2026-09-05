require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { proposeFulfillmentSplits } = require("../src/services/fulfillmentSplitter");
const { buildBackorderCheck } = require("../src/services/fulfillmentService");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadSuggestion(quotationId) {
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    include: { lines: true },
  });
  const stockLevels = await prisma.stockLevel.findMany({
    where: { productId: { in: quotation.lines.map((line) => line.productId) } },
  });
  return proposeFulfillmentSplits(quotation, stockLevels);
}

async function main() {
  expect(process.env.DATABASE_URL, "DATABASE_URL is required");

  const single = await loadSuggestion("00000000-0000-4000-8000-000000000401");
  expect(single.length === 1 && single[0].qtyFulfilled === 10, "Single-warehouse seed failed");

  const split = await loadSuggestion("00000000-0000-4000-8000-000000000402");
  expect(
    split.length === 2 && split[0].qtyFulfilled === 25 && split[1].qtyFulfilled === 5,
    "Two-warehouse seed failed",
  );

  const shortage = await loadSuggestion("00000000-0000-4000-8000-000000000403");
  expect(
    shortage.reduce((sum, row) => sum + row.qtyFulfilled, 0) === 40 &&
      shortage.reduce((sum, row) => sum + row.qtyBackordered, 0) === 10,
    "Insufficient-stock seed failed",
  );

  const backorderQuotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: "00000000-0000-4000-8000-000000000404" },
    include: { fulfillmentSplits: true },
  });
  const backorderStock = await prisma.stockLevel.findMany({
    where: { productId: "00000000-0000-4000-8000-000000000601" },
  });
  const backorderCheck = buildBackorderCheck(
    backorderQuotation.id,
    backorderQuotation.fulfillmentSplits,
    backorderStock,
  );
  expect(
    backorderQuotation.status === "FULFILLED" &&
      backorderCheck.canConsolidate === false &&
      backorderCheck.outstandingBackorders[0].qtyBackordered === 10,
    "Awaiting-restock seed failed",
  );

  console.log("MVP 3 seed verified: single warehouse, split, shortage, and awaiting restock");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
