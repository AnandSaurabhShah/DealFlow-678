const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
