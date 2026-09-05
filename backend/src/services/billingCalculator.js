const { Prisma } = require("@prisma/client");

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHLY_CYCLE_DAYS = 30;
const DEFAULT_SCHEDULE_ENTRY_COUNT = 4;

function assertRecurringMonthlyLine(line) {
  if (!line?.id) throw new TypeError("line.id is required");
  if (line.billingType !== "RECURRING") {
    throw new TypeError("Billing schedules require a recurring line");
  }
  if (line.billingCycle !== "MONTHLY") {
    throw new TypeError("Only monthly billing is supported");
  }
}

function addUtcMonths(date, months) {
  const source = new Date(date);
  if (Number.isNaN(source.getTime())) throw new TypeError("A valid schedule date is required");

  const year = source.getUTCFullYear();
  const month = source.getUTCMonth() + months;
  const day = source.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    year,
    month,
    Math.min(day, lastDay),
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ));
}

function generateMonthlyScheduleEntries(
  line,
  { startDate = line?.subscriptionStartDate || new Date(), count = DEFAULT_SCHEDULE_ENTRY_COUNT } = {},
) {
  assertRecurringMonthlyLine(line);
  if (!Number.isInteger(count) || count < 1) {
    throw new TypeError("Schedule entry count must be a positive integer");
  }

  const amount = new Prisma.Decimal(line.lineTotal);
  return Array.from({ length: count }, (_, index) => ({
    quotationLineId: line.id,
    billingDate: addUtcMonths(startDate, index),
    amount,
    status: "PENDING",
  }));
}

function getDaysRemainingInCycle(now, nextBillingDate) {
  const current = new Date(now);
  const next = new Date(nextBillingDate);
  if (Number.isNaN(current.getTime()) || Number.isNaN(next.getTime())) {
    throw new TypeError("Valid current and next billing dates are required");
  }
  const days = Math.ceil((next.getTime() - current.getTime()) / MILLISECONDS_PER_DAY);
  return Math.min(MONTHLY_CYCLE_DAYS, Math.max(0, days));
}

function calculateProrationAmount({
  oldQty,
  newQty,
  unitPrice,
  daysRemainingInCycle,
  totalDaysInCycle = MONTHLY_CYCLE_DAYS,
}) {
  if (!Number.isInteger(oldQty) || oldQty < 0 || !Number.isInteger(newQty) || newQty < 0) {
    throw new TypeError("oldQty and newQty must be non-negative integers");
  }
  if (!Number.isInteger(daysRemainingInCycle) || daysRemainingInCycle < 0) {
    throw new TypeError("daysRemainingInCycle must be a non-negative integer");
  }
  if (!Number.isInteger(totalDaysInCycle) || totalDaysInCycle < 1) {
    throw new TypeError("totalDaysInCycle must be a positive integer");
  }

  return new Prisma.Decimal(newQty - oldQty)
    .mul(unitPrice)
    .mul(daysRemainingInCycle)
    .div(totalDaysInCycle);
}

function buildQuantityProration({ line, newQty, now, nextBillingDate }) {
  assertRecurringMonthlyLine(line);
  const daysRemainingInCycle = getDaysRemainingInCycle(now, nextBillingDate);
  const signedAmount = calculateProrationAmount({
    oldQty: line.qty,
    newQty,
    unitPrice: line.unitPrice,
    daysRemainingInCycle,
  });

  if (signedAmount.isZero()) {
    return { type: "NONE", amount: signedAmount, daysRemainingInCycle };
  }
  return {
    type: signedAmount.isPositive() ? "SCHEDULE_ENTRY" : "CREDIT_NOTE",
    amount: signedAmount.abs(),
    signedAmount,
    daysRemainingInCycle,
  };
}

function buildCancellation({ line, scheduleEntries, now }) {
  assertRecurringMonthlyLine(line);
  if (!Array.isArray(scheduleEntries)) throw new TypeError("scheduleEntries must be an array");

  const currentDate = new Date(now);
  if (Number.isNaN(currentDate.getTime())) throw new TypeError("A valid cancellation date is required");
  const futurePending = scheduleEntries
    .filter((entry) => entry.status === "PENDING" && new Date(entry.billingDate) > currentDate)
    .sort((left, right) => new Date(left.billingDate) - new Date(right.billingDate));
  const nextBillingDate = futurePending[0]?.billingDate;
  const credit = nextBillingDate
    ? buildQuantityProration({ line, newQty: 0, now: currentDate, nextBillingDate })
    : { type: "NONE", amount: new Prisma.Decimal(0), daysRemainingInCycle: 0 };

  return {
    cancelledEntryIds: futurePending.map((entry) => entry.id),
    creditNote: credit.type === "CREDIT_NOTE"
      ? { quotationLineId: line.id, amount: credit.amount, reason: "Subscription cancelled" }
      : null,
  };
}

module.exports = {
  MONTHLY_CYCLE_DAYS,
  DEFAULT_SCHEDULE_ENTRY_COUNT,
  addUtcMonths,
  generateMonthlyScheduleEntries,
  getDaysRemainingInCycle,
  calculateProrationAmount,
  buildQuantityProration,
  buildCancellation,
};
