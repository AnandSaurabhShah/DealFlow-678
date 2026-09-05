const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildBackorderCheck,
  buildFulfillmentRecords,
} = require("../src/services/fulfillmentService");

test("builds persistence rows and assigns the remaining backorder once", () => {
  const records = buildFulfillmentRecords(
    [{ productId: "laptop", qty: 50 }],
    [
      { warehouseId: "central", productId: "laptop", qtyFulfilled: 25 },
      { warehouseId: "west", productId: "laptop", qtyFulfilled: 15 },
    ],
  );

  assert.deepEqual(records, [
    { warehouseId: "central", productId: "laptop", qtyFulfilled: 25, qtyBackordered: 0 },
    { warehouseId: "west", productId: "laptop", qtyFulfilled: 15, qtyBackordered: 10 },
  ]);
});

test("rejects allocation above the quotation line quantity", () => {
  assert.throws(
    () => buildFulfillmentRecords(
      [{ productId: "laptop", qty: 20 }],
      [{ warehouseId: "central", productId: "laptop", qtyFulfilled: 21 }],
    ),
    (error) => error.status === 409 && error.code === "FULFILLMENT_OVER_ALLOCATION",
  );
});

test("rejects products not present on the quotation", () => {
  assert.throws(
    () => buildFulfillmentRecords(
      [{ productId: "laptop", qty: 20 }],
      [{ warehouseId: "central", productId: "monitor", qtyFulfilled: 1 }],
    ),
    (error) => error.status === 400 && error.code === "INVALID_FULFILLMENT_SPLIT",
  );
});

test("requires an allocation row for every quotation product", () => {
  assert.throws(
    () => buildFulfillmentRecords(
      [{ productId: "laptop", qty: 20 }, { productId: "setup", qty: 1 }],
      [{ warehouseId: "central", productId: "laptop", qtyFulfilled: 20 }],
    ),
    (error) => error.status === 400 && error.code === "INVALID_FULFILLMENT_SPLIT",
  );
});

test("reports a fully coverable backorder after stock becomes available", () => {
  const result = buildBackorderCheck(
    "quotation-1",
    [{ productId: "laptop", qtyBackordered: 10 }],
    [{ warehouseId: "west", productId: "laptop", qty: 10 }],
  );

  assert.equal(result.canConsolidate, true);
  assert.equal(result.fullyCoverable, true);
  assert.deepEqual(result.outstandingBackorders, [
    { productId: "laptop", qtyBackordered: 10 },
  ]);
  assert.deepEqual(result.suggestedAllocations, [{
    quotationId: "quotation-1",
    warehouseId: "west",
    productId: "laptop",
    qtyFulfilled: 10,
    qtyBackordered: 0,
  }]);
});

test("reports partial consolidation and the remaining backorder", () => {
  const result = buildBackorderCheck(
    "quotation-1",
    [{ productId: "laptop", qtyBackordered: 10 }],
    [{ warehouseId: "west", productId: "laptop", qty: 4 }],
  );

  assert.equal(result.canConsolidate, true);
  assert.equal(result.fullyCoverable, false);
  assert.equal(result.suggestedAllocations[0].qtyFulfilled, 4);
  assert.equal(result.suggestedAllocations[0].qtyBackordered, 6);
});

test("does not offer consolidation when no backorders or stock exist", () => {
  assert.deepEqual(buildBackorderCheck("quotation-1", [], []), {
    canConsolidate: false,
    fullyCoverable: false,
    outstandingBackorders: [],
    suggestedAllocations: [],
  });

  const unavailable = buildBackorderCheck(
    "quotation-1",
    [{ productId: "laptop", qtyBackordered: 10 }],
    [],
  );
  assert.equal(unavailable.canConsolidate, false);
  assert.equal(unavailable.fullyCoverable, false);
});
