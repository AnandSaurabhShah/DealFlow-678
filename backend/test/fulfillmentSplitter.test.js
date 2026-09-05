const test = require("node:test");
const assert = require("node:assert/strict");
const {
  proposeFulfillmentSplits,
  splitQuotationLine,
} = require("../src/services/fulfillmentSplitter");

const stockLevels = [
  { warehouseId: "warehouse-west", productId: "laptop", qty: 15 },
  { warehouseId: "warehouse-central", productId: "laptop", qty: 25 },
  { warehouseId: "warehouse-central", productId: "setup", qty: 100 },
];

test("fulfills a line from one warehouse when one has enough stock", () => {
  const result = splitQuotationLine(
    { productId: "laptop", qty: 20 },
    stockLevels,
    "quotation-1",
  );

  assert.deepEqual(result, [{
    quotationId: "quotation-1",
    warehouseId: "warehouse-central",
    productId: "laptop",
    qtyFulfilled: 20,
    qtyBackordered: 0,
  }]);
});

test("splits a line across warehouses in descending stock order", () => {
  const result = splitQuotationLine(
    { productId: "laptop", qty: 30 },
    stockLevels,
    "quotation-1",
  );

  assert.deepEqual(result, [
    { quotationId: "quotation-1", warehouseId: "warehouse-central", productId: "laptop", qtyFulfilled: 25, qtyBackordered: 0 },
    { quotationId: "quotation-1", warehouseId: "warehouse-west", productId: "laptop", qtyFulfilled: 5, qtyBackordered: 0 },
  ]);
});

test("records the uncovered remainder as one backorder", () => {
  const result = splitQuotationLine(
    { productId: "laptop", qty: 50 },
    stockLevels,
    "quotation-1",
  );

  assert.equal(result.reduce((sum, split) => sum + split.qtyFulfilled, 0), 40);
  assert.equal(result.reduce((sum, split) => sum + split.qtyBackordered, 0), 10);
  assert.equal(result.filter((split) => split.qtyBackordered > 0).length, 1);
});

test("proposes splits for every quotation line without sharing unrelated stock", () => {
  const result = proposeFulfillmentSplits(
    { id: "quotation-1", lines: [{ productId: "laptop", qty: 30 }, { productId: "setup", qty: 2 }] },
    stockLevels,
  );

  assert.equal(result.length, 3);
  assert.equal(result.filter((split) => split.productId === "laptop").length, 2);
  assert.deepEqual(result.find((split) => split.productId === "setup"), {
    quotationId: "quotation-1",
    warehouseId: "warehouse-central",
    productId: "setup",
    qtyFulfilled: 2,
    qtyBackordered: 0,
  });
});

test("returns an unsaved backorder proposal when no warehouse stocks the product", () => {
  const result = splitQuotationLine(
    { productId: "unknown-product", qty: 4 },
    stockLevels,
    "quotation-1",
  );

  assert.deepEqual(result, [{
    quotationId: "quotation-1",
    warehouseId: null,
    productId: "unknown-product",
    qtyFulfilled: 0,
    qtyBackordered: 4,
  }]);
});
