const test = require("node:test");
const assert = require("node:assert/strict");
const {
  FINANCE_THRESHOLD,
  MANAGER_THRESHOLD,
  calculateBlendedRiskScore,
  calculateLineDiscountExcess,
  calculateLineTotal,
  calculateQuotationTotals,
} = require("../src/services/quotationCalculator");

test("calculates one discounted line with decimal precision", () => {
  const result = calculateLineTotal({ unitPrice: "1299.00", qty: 2, discountPercent: "10" });
  assert.equal(result.subtotal.toFixed(2), "2598.00");
  assert.equal(result.discount.toFixed(2), "259.80");
  assert.equal(result.lineTotal.toFixed(2), "2338.20");
});

test("calculates totals across multiple quotation lines", () => {
  const result = calculateQuotationTotals([
    { unitPrice: "1299.00", qty: 2, discountPercent: "10" },
    { unitPrice: "350.00", qty: 1, discountPercent: "5" },
  ]);
  assert.equal(result.subtotal.toFixed(2), "2948.00");
  assert.equal(result.totalDiscount.toFixed(2), "277.30");
  assert.equal(result.grandTotal.toFixed(2), "2670.70");
});

test("returns zero totals for an empty quotation", () => {
  const result = calculateQuotationTotals([]);
  assert.equal(result.subtotal.toString(), "0");
  assert.equal(result.totalDiscount.toString(), "0");
  assert.equal(result.grandTotal.toString(), "0");
});

test("calculates the PS Gold hardware/service example using category ceilings", () => {
  const goldTier = {
    maxDiscountPercent: "15",
    categoryOverrides: [{ category: "Service", maxDiscountPercent: "10" }],
  };
  const lines = [
    { discountPercent: "15", product: { category: "Hardware" } },
    { discountPercent: "18", product: { category: "Service" } },
  ];

  const score = calculateBlendedRiskScore(lines, goldTier);
  assert.equal(calculateLineDiscountExcess(lines[0], goldTier).toString(), "0");
  assert.equal(calculateLineDiscountExcess(lines[1], goldTier).toString(), "8");
  assert.equal(score.toString(), "8");
  assert.ok(score.greaterThan(MANAGER_THRESHOLD));
  assert.ok(score.lessThanOrEqualTo(FINANCE_THRESHOLD));
});

test("adds several mild overages into one blended risk score", () => {
  const tier = { maxDiscountPercent: "5", categoryOverrides: [] };
  const score = calculateBlendedRiskScore(
    [
      { category: "Hardware", discountPercent: "7" },
      { category: "Service", discountPercent: "8" },
      { category: "Software", discountPercent: "6" },
    ],
    tier,
  );

  assert.equal(score.toString(), "6");
});

test("falls back to the tier ceiling when no category override exists", () => {
  const tier = {
    maxDiscountPercent: "5",
    categoryOverrides: [{ category: "Service", maxDiscountPercent: "10" }],
  };
  const score = calculateBlendedRiskScore(
    [{ category: "Hardware", discountPercent: "7" }],
    tier,
  );

  assert.equal(score.toString(), "2");
});
