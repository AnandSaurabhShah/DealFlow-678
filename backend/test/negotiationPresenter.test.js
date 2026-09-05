const test = require("node:test");
const assert = require("node:assert/strict");
const { shapePortalQuotation } = require("../src/services/negotiationPresenter");

test("portal quotation exposes only the explicit customer-safe DTO", () => {
  const quotation = {
    id: "quote-1",
    customerName: "Customer A",
    status: "UNDER_NEGOTIATION",
    subtotal: "100",
    totalDiscount: "15",
    grandTotal: "85",
    blendedRiskScore: "99",
    rep: { id: "internal-user", email: "private@example.test" },
    approvalLogs: [{ reason: "internal-only" }],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    lines: [{
      id: "line-1",
      product: { id: "product-1", name: "Product", category: "Hardware", unit: "each", price: "100", description: "internal" },
      qty: 1,
      unitPrice: "100",
      discountPercent: "15",
      lineTotal: "85",
      billingScheduleEntries: [{ id: "private" }],
    }],
  };
  const comments = [{
    id: "comment-1",
    quotationLineId: null,
    authorType: "CUSTOMER",
    authorId: "customer-1",
    content: "Please review",
    createdAt: new Date("2026-01-01T01:00:00Z"),
  }];
  const result = shapePortalQuotation(
    quotation,
    comments,
    new Map([["CUSTOMER:customer-1", "Customer A"]]),
  );

  assert.equal(result.blendedRiskScore, undefined);
  assert.equal(result.rep, undefined);
  assert.equal(result.approvalLogs, undefined);
  assert.equal(result.lines[0].product.price, undefined);
  assert.equal(result.lines[0].billingScheduleEntries, undefined);
  assert.equal(result.comments[0].authorDisplayName, "Customer A");
});
