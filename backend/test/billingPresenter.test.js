const test = require("node:test");
const assert = require("node:assert/strict");
const { shapeBillingResponse } = require("../src/services/billingPresenter");

test("separates mixed quotation billing into authoritative frontend sections", () => {
  const oneTimeLine = {
    id: "hardware-line",
    billingType: "ONE_TIME",
    billingScheduleEntries: [],
    creditNotes: [],
  };
  const recurringLine = {
    id: "subscription-line",
    billingType: "RECURRING",
    billingScheduleEntries: [{ id: "schedule-1", status: "PENDING" }],
    creditNotes: [{ id: "credit-1" }],
  };
  const oneTimeInvoice = { id: "invoice-1", type: "ONE_TIME" };
  const recurringInvoice = { id: "invoice-2", type: "RECURRING" };

  const result = shapeBillingResponse({
    id: "quote-1",
    customerName: "Mixed Billing Customer",
    status: "CONFIRMED",
    lines: [recurringLine, oneTimeLine],
    invoices: [recurringInvoice, oneTimeInvoice],
  });

  assert.deepEqual(result.oneTimeLines, [oneTimeLine]);
  assert.deepEqual(result.recurringLines, [recurringLine]);
  assert.deepEqual(result.oneTimeInvoices, [oneTimeInvoice]);
  assert.deepEqual(result.recurringInvoices, [recurringInvoice]);
  assert.equal(result.recurringLines[0].billingScheduleEntries[0].id, "schedule-1");
  assert.equal(result.recurringLines[0].creditNotes[0].id, "credit-1");
});

test("rejects incomplete billing query results instead of returning an ambiguous shape", () => {
  assert.throws(
    () => shapeBillingResponse({ id: "quote-1", lines: [], invoices: null }),
    /quotation\.invoices must be an array/,
  );
});
