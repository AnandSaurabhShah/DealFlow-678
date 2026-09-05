require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const baseUrl = process.env.API_BASE_URL || "http://localhost:4000";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  return { status: response.status, body: await response.json() };
}

async function login(email, password) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  expect(response.status === 200, `Login failed for ${email}`);
  return response.body.token;
}

async function createApprovedQuotation(token, productId, qty, label) {
  const headers = { authorization: `Bearer ${token}` };
  const created = await request("/api/quotations", {
    method: "POST",
    headers,
    body: JSON.stringify({ customerName: `${label} ${Date.now()}` }),
  });
  expect(created.status === 201, `Could not create ${label} quotation`);

  const updated = await request(`/api/quotations/${created.body.data.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ lines: [{ productId, qty, discountPercent: 0 }] }),
  });
  expect(updated.status === 200, `Could not add the ${label} line`);

  const submitted = await request(`/api/quotations/${created.body.data.id}/confirm`, {
    method: "POST",
    headers,
  });
  expect(submitted.status === 200, `Could not submit the ${label} quotation`);
  expect(submitted.body.data.status === "APPROVED", `${label} quotation was not approved`);
  return submitted.body.data;
}

async function main() {
  expect(process.env.DATABASE_URL, "DATABASE_URL is required");
  const [token, adminToken] = await Promise.all([
    login("rep@dealflow360.test", process.env.SEED_REP_PASSWORD || "Rep12345!"),
    login("admin@dealflow360.test", process.env.SEED_ADMIN_PASSWORD || "Admin123!"),
  ]);
  const headers = { authorization: `Bearer ${token}` };
  const product = await prisma.product.findFirst({ where: { category: "Hardware" } });
  expect(product, "A seeded Hardware product is required");

  const centralId = "00000000-0000-4000-8000-000000000201";
  const westId = "00000000-0000-4000-8000-000000000202";
  await Promise.all([
    prisma.stockLevel.update({
      where: { warehouseId_productId: { warehouseId: centralId, productId: product.id } },
      data: { qty: 25 },
    }),
    prisma.stockLevel.update({
      where: { warehouseId_productId: { warehouseId: westId, productId: product.id } },
      data: { qty: 15 },
    }),
  ]);

  const quotation = await createApprovedQuotation(token, product.id, 30, "MVP3 split");
  const suggestion = await request(`/api/quotations/${quotation.id}/fulfillment/suggest`, { headers });
  expect(suggestion.status === 200, "Fulfillment suggestion failed");
  expect(suggestion.body.data.length === 2, "Suggestion did not split across two warehouses");
  expect(
    suggestion.body.data.reduce((sum, split) => sum + split.qtyFulfilled, 0) === 30,
    "Suggested quantities do not cover the quotation line",
  );

  const confirmation = await request(`/api/quotations/${quotation.id}/fulfillment/confirm`, {
    method: "POST",
    headers,
    body: JSON.stringify(suggestion.body.data.map(({ warehouseId, productId, qtyFulfilled }) => ({
      warehouseId,
      productId,
      qtyFulfilled,
    }))),
  });
  expect(confirmation.status === 200, "Fulfillment confirmation failed");
  expect(confirmation.body.data.status === "FULFILLED", "Quotation did not become FULFILLED");
  expect(confirmation.body.data.fulfillmentSplits.length === 2, "Split rows were not persisted");

  const remainingStock = await prisma.stockLevel.findMany({
    where: { productId: product.id, warehouseId: { in: [centralId, westId] } },
  });
  expect(
    remainingStock.reduce((sum, stock) => sum + stock.qty, 0) === 10,
    "Confirmed fulfillment did not decrement stock by 30",
  );

  const overAllocated = await createApprovedQuotation(token, product.id, 2, "MVP3 over-allocation");
  const overAllocationResponse = await request(
    `/api/quotations/${overAllocated.id}/fulfillment/confirm`,
    {
      method: "POST",
      headers,
      body: JSON.stringify([{ warehouseId: westId, productId: product.id, qtyFulfilled: 3 }]),
    },
  );
  expect(
    overAllocationResponse.status === 409 &&
      overAllocationResponse.body.error.code === "FULFILLMENT_OVER_ALLOCATION",
    "Ordered-quantity over-allocation was not rejected",
  );

  const insufficient = await createApprovedQuotation(token, product.id, 15, "MVP3 stock conflict");
  const insufficientResponse = await request(`/api/quotations/${insufficient.id}/fulfillment/confirm`, {
    method: "POST",
    headers,
    body: JSON.stringify([{ warehouseId: westId, productId: product.id, qtyFulfilled: 15 }]),
  });
  expect(
    insufficientResponse.status === 409 && insufficientResponse.body.error.code === "INSUFFICIENT_STOCK",
    "Current-stock over-allocation was not rejected",
  );

  const backordered = await createApprovedQuotation(token, product.id, 20, "MVP3 backorder");
  const backorderSuggestion = await request(
    `/api/quotations/${backordered.id}/fulfillment/suggest`,
    { headers },
  );
  expect(backorderSuggestion.status === 200, "Backorder suggestion failed");
  expect(
    backorderSuggestion.body.data.reduce((sum, split) => sum + split.qtyFulfilled, 0) === 10 &&
      backorderSuggestion.body.data.reduce((sum, split) => sum + split.qtyBackordered, 0) === 10,
    "Suggestion did not identify the expected 10-unit backorder",
  );
  const backorderConfirmation = await request(
    `/api/quotations/${backordered.id}/fulfillment/confirm`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(
        backorderSuggestion.body.data
          .filter((split) => split.warehouseId)
          .map(({ warehouseId, productId, qtyFulfilled }) => ({
            warehouseId,
            productId,
            qtyFulfilled,
          })),
      ),
    },
  );
  expect(backorderConfirmation.status === 200, "Backordered fulfillment could not be finalized");

  const beforeRestock = await request(
    `/api/quotations/${backordered.id}/fulfillment/backorder-check`,
    { headers },
  );
  expect(
    beforeRestock.status === 200 && beforeRestock.body.data.canConsolidate === false,
    "Backorder incorrectly appeared coverable before restocking",
  );

  const restocked = await request(`/api/warehouses/${westId}/restock`, {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ productId: product.id, qty: 10 }),
  });
  expect(restocked.status === 200 && restocked.body.data.qty === 10, "Restock did not increment inventory");

  const afterRestock = await request(
    `/api/quotations/${backordered.id}/fulfillment/backorder-check`,
    { headers },
  );
  expect(afterRestock.status === 200, "Backorder check failed after restocking");
  expect(afterRestock.body.data.canConsolidate, "Restocked backorder was not marked consolidatable");
  expect(afterRestock.body.data.fullyCoverable, "Restocked backorder was not fully coverable");
  expect(
    afterRestock.body.data.suggestedAllocations.reduce(
      (sum, allocation) => sum + allocation.qtyFulfilled,
      0,
    ) === 10,
    "Backorder check did not suggest the newly available 10 units",
  );

  console.log("MVP 3 smoke checks passed: fulfillment, conflicts, restock, and backorder consolidation");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
