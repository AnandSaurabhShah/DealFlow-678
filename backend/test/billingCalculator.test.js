const test = require("node:test");
const assert = require("node:assert/strict");
const {
  addUtcMonths,
  generateMonthlyScheduleEntries,
  calculateProrationAmount,
  buildQuantityProration,
  buildCancellation,
} = require("../src/services/billingCalculator");

const recurringLine = {
  id: "line-1",
  billingType: "RECURRING",
  billingCycle: "MONTHLY",
  qty: 2,
  unitPrice: "90",
  lineTotal: "171",
};

test("generates the current and next three monthly billing entries", () => {
  const schedule = generateMonthlyScheduleEntries(recurringLine, {
    startDate: new Date("2026-01-15T10:00:00.000Z"),
  });

  assert.equal(schedule.length, 4);
  assert.deepEqual(
    schedule.map((entry) => entry.billingDate.toISOString()),
    [
      "2026-01-15T10:00:00.000Z",
      "2026-02-15T10:00:00.000Z",
      "2026-03-15T10:00:00.000Z",
      "2026-04-15T10:00:00.000Z",
    ],
  );
  assert.ok(schedule.every((entry) => entry.amount.toString() === "171"));
  assert.ok(schedule.every((entry) => entry.status === "PENDING"));
});

test("clamps month-end schedule dates to valid calendar dates", () => {
  assert.equal(
    addUtcMonths(new Date("2026-01-31T00:00:00.000Z"), 1).toISOString(),
    "2026-02-28T00:00:00.000Z",
  );
});

test("calculates correctly-signed increase and decrease prorations", () => {
  const increase = calculateProrationAmount({
    oldQty: 2,
    newQty: 4,
    unitPrice: "90",
    daysRemainingInCycle: 15,
  });
  const decrease = calculateProrationAmount({
    oldQty: 4,
    newQty: 1,
    unitPrice: "90",
    daysRemainingInCycle: 15,
  });

  assert.equal(increase.toFixed(2), "90.00");
  assert.equal(decrease.toFixed(2), "-135.00");
});

test("maps quantity increases to charges and decreases to credit notes", () => {
  const charge = buildQuantityProration({
    line: recurringLine,
    newQty: 3,
    now: new Date("2026-01-15T00:00:00.000Z"),
    nextBillingDate: new Date("2026-01-30T00:00:00.000Z"),
  });
  const credit = buildQuantityProration({
    line: recurringLine,
    newQty: 1,
    now: new Date("2026-01-15T00:00:00.000Z"),
    nextBillingDate: new Date("2026-01-30T00:00:00.000Z"),
  });

  assert.equal(charge.type, "SCHEDULE_ENTRY");
  assert.equal(charge.amount.toFixed(2), "45.00");
  assert.equal(credit.type, "CREDIT_NOTE");
  assert.equal(credit.signedAmount.toFixed(2), "-45.00");
  assert.equal(credit.amount.toFixed(2), "45.00");
});

test("cancellation identifies future entries and issues unused-cycle credit", () => {
  const result = buildCancellation({
    line: recurringLine,
    now: new Date("2026-01-15T00:00:00.000Z"),
    scheduleEntries: [
      { id: "current", billingDate: new Date("2026-01-15T00:00:00.000Z"), status: "PENDING" },
      { id: "next", billingDate: new Date("2026-01-30T00:00:00.000Z"), status: "PENDING" },
      { id: "future", billingDate: new Date("2026-02-28T00:00:00.000Z"), status: "PENDING" },
      { id: "billed", billingDate: new Date("2026-02-01T00:00:00.000Z"), status: "BILLED" },
    ],
  });

  assert.deepEqual(result.cancelledEntryIds, ["next", "future"]);
  assert.equal(result.creditNote.amount.toFixed(2), "90.00");
  assert.equal(result.creditNote.reason, "Subscription cancelled");
});
