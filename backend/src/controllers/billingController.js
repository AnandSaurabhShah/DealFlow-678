const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { requireFields, integer } = require("../utils/validation");
const {
  buildCancellation,
  buildQuantityProration,
  generateMonthlyScheduleEntries,
} = require("../services/billingCalculator");
const {
  calculateLineTotal,
  calculateQuotationTotals,
} = require("../services/quotationCalculator");
const { shapeBillingResponse } = require("../services/billingPresenter");

const adjustableStatuses = new Set(["APPROVED", "FULFILLED"]);

const billingInclude = {
  lines: {
    include: {
      product: true,
      billingScheduleEntries: { orderBy: [{ billingDate: "asc" }, { createdAt: "asc" }] },
      creditNotes: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { id: "asc" },
  },
  invoices: { orderBy: { createdAt: "asc" } },
};

function canManage(user, quotation) {
  return user.role === "ADMIN" || quotation.repId === user.id;
}

function assertCanView(user, quotation) {
  if (user.role === "REP" && quotation.repId !== user.id) {
    throw new ApiError(403, "FORBIDDEN", "You cannot access another rep's billing");
  }
}

function assertCanManage(user, quotation) {
  if (!canManage(user, quotation)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage another rep's billing");
  }
}

function assertBillingAdjustable(quotation) {
  if (!adjustableStatuses.has(quotation.status)) {
    throw new ApiError(
      409,
      "INVALID_QUOTATION_STATUS",
      "Billing can only be changed for an approved or fulfilled quotation",
    );
  }
}

async function loadBilling(quotationId) {
  return prisma.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    include: billingInclude,
  });
}

async function getQuotationBilling(req, res) {
  const quotation = await loadBilling(req.params.id);
  assertCanView(req.user, quotation);
  res.json({ data: shapeBillingResponse(quotation) });
}

async function generateQuotationBilling(req, res) {
  const generatedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        lines: { include: { billingScheduleEntries: { take: 1 } } },
        invoices: { take: 1 },
      },
    });
    assertCanManage(req.user, quotation);
    if (quotation.status !== "APPROVED") {
      throw new ApiError(
        409,
        "INVALID_QUOTATION_STATUS",
        "Billing must be generated after approval and before fulfillment",
      );
    }
    if (
      quotation.invoices.length ||
      quotation.lines.some((line) => line.billingScheduleEntries.length)
    ) {
      throw new ApiError(409, "BILLING_ALREADY_GENERATED", "Billing was already generated");
    }

    const oneTimeLines = quotation.lines.filter((line) => line.billingType === "ONE_TIME");
    const recurringLines = quotation.lines.filter((line) => line.billingType === "RECURRING");
    if (!oneTimeLines.length && !recurringLines.length) {
      throw new ApiError(409, "NO_BILLABLE_LINES", "The quotation has no billable lines");
    }

    const oneTimeAmount = oneTimeLines.reduce(
      (total, line) => total.plus(line.lineTotal),
      new Prisma.Decimal(0),
    );
    if (oneTimeAmount.greaterThan(0)) {
      await tx.invoice.create({
        data: { quotationId: quotation.id, amount: oneTimeAmount, type: "ONE_TIME" },
      });
    }

    for (const line of recurringLines) {
      if (line.billingCycle !== "MONTHLY") {
        throw new ApiError(
          409,
          "UNSUPPORTED_BILLING_CYCLE",
          `Recurring line ${line.id} must use MONTHLY billing`,
        );
      }
      await tx.quotationLine.update({
        where: { id: line.id },
        data: { subscriptionStartDate: generatedAt },
      });
      await tx.billingScheduleEntry.createMany({
        data: generateMonthlyScheduleEntries(
          { ...line, subscriptionStartDate: generatedAt },
          { startDate: generatedAt },
        ),
      });
    }
  });

  const quotation = await loadBilling(req.params.id);
  res.status(201).json({ data: shapeBillingResponse(quotation) });
}

async function updateRecurringQuantity(req, res) {
  requireFields(req.body, ["qty"]);
  const newQty = integer(req.body.qty, "qty", { min: 1 });
  const changedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const line = await tx.quotationLine.findUniqueOrThrow({
      where: { id: req.params.lineId },
      include: { quotation: true },
    });
    if (line.quotationId !== req.params.id) {
      throw new ApiError(404, "NOT_FOUND", "The quotation line was not found");
    }
    assertCanManage(req.user, line.quotation);
    assertBillingAdjustable(line.quotation);
    if (line.billingType !== "RECURRING") {
      throw new ApiError(409, "NOT_RECURRING", "Quantity proration requires a recurring line");
    }
    if (line.qty === 0) {
      throw new ApiError(409, "SUBSCRIPTION_CANCELLED", "A cancelled subscription cannot be changed");
    }

    const scheduleCount = await tx.billingScheduleEntry.count({
      where: { quotationLineId: line.id },
    });
    if (!scheduleCount) {
      throw new ApiError(409, "BILLING_NOT_GENERATED", "Generate billing before changing quantity");
    }
    if (newQty === line.qty) {
      return {
        line,
        proration: { type: "NONE", amount: new Prisma.Decimal(0), daysRemainingInCycle: 0 },
        scheduleEntry: null,
        creditNote: null,
      };
    }

    const nextEntry = await tx.billingScheduleEntry.findFirst({
      where: {
        quotationLineId: line.id,
        status: "PENDING",
        billingDate: { gt: changedAt },
      },
      orderBy: { billingDate: "asc" },
    });
    if (!nextEntry) {
      throw new ApiError(
        409,
        "NO_PENDING_BILLING_CYCLE",
        "No future monthly billing cycle is available for proration",
      );
    }

    const proration = buildQuantityProration({
      line,
      newQty,
      now: changedAt,
      nextBillingDate: nextEntry.billingDate,
    });
    const newLineTotal = calculateLineTotal({ ...line, qty: newQty }).lineTotal;
    const updatedLine = await tx.quotationLine.update({
      where: { id: line.id },
      data: { qty: newQty, lineTotal: newLineTotal },
    });
    await tx.billingScheduleEntry.updateMany({
      where: {
        quotationLineId: line.id,
        status: "PENDING",
        billingDate: { gt: changedAt },
      },
      data: { amount: newLineTotal },
    });

    let scheduleEntry = null;
    let creditNote = null;
    if (proration.type === "SCHEDULE_ENTRY") {
      scheduleEntry = await tx.billingScheduleEntry.create({
        data: {
          quotationLineId: line.id,
          billingDate: changedAt,
          amount: proration.amount,
        },
      });
    } else if (proration.type === "CREDIT_NOTE") {
      creditNote = await tx.creditNote.create({
        data: {
          quotationLineId: line.id,
          amount: proration.amount,
          reason: `Quantity reduced from ${line.qty} to ${newQty}`,
        },
      });
    }

    await recomputeQuotationTotals(tx, line.quotationId);
    return { line: updatedLine, proration, scheduleEntry, creditNote };
  });

  res.json({ data: result });
}

async function cancelRecurringLine(req, res) {
  const cancelledAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const line = await tx.quotationLine.findUniqueOrThrow({
      where: { id: req.params.lineId },
      include: {
        quotation: true,
        billingScheduleEntries: { orderBy: { billingDate: "asc" } },
      },
    });
    if (line.quotationId !== req.params.id) {
      throw new ApiError(404, "NOT_FOUND", "The quotation line was not found");
    }
    assertCanManage(req.user, line.quotation);
    assertBillingAdjustable(line.quotation);
    if (line.billingType !== "RECURRING") {
      throw new ApiError(409, "NOT_RECURRING", "Only a recurring line can be cancelled");
    }
    if (line.qty === 0) {
      throw new ApiError(409, "SUBSCRIPTION_CANCELLED", "This subscription is already cancelled");
    }
    if (!line.billingScheduleEntries.length) {
      throw new ApiError(409, "BILLING_NOT_GENERATED", "Generate billing before cancellation");
    }

    const cancellation = buildCancellation({
      line,
      scheduleEntries: line.billingScheduleEntries,
      now: cancelledAt,
    });
    if (cancellation.cancelledEntryIds.length) {
      await tx.billingScheduleEntry.updateMany({
        where: { id: { in: cancellation.cancelledEntryIds } },
        data: { status: "CANCELLED" },
      });
    }
    const creditNote = cancellation.creditNote
      ? await tx.creditNote.create({ data: cancellation.creditNote })
      : null;
    const updatedLine = await tx.quotationLine.update({
      where: { id: line.id },
      data: { qty: 0, lineTotal: 0 },
    });
    await recomputeQuotationTotals(tx, line.quotationId);

    const cancelledEntries = cancellation.cancelledEntryIds.length
      ? await tx.billingScheduleEntry.findMany({
        where: { id: { in: cancellation.cancelledEntryIds } },
        orderBy: { billingDate: "asc" },
      })
      : [];
    return { line: updatedLine, cancelledEntries, creditNote };
  });

  res.json({ data: result });
}

async function payInvoice(req, res) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { quotation: { select: { repId: true } } },
  });
  assertCanManage(req.user, invoice.quotation);

  const paid = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { paid: true },
  });
  res.json({ data: paid });
}

async function recomputeQuotationTotals(tx, quotationId) {
  const lines = await tx.quotationLine.findMany({ where: { quotationId } });
  const totals = calculateQuotationTotals(lines);
  await tx.quotation.update({ where: { id: quotationId }, data: totals });
}

module.exports = {
  getQuotationBilling,
  generateQuotationBilling,
  updateRecurringQuantity,
  cancelRecurringLine,
  payInvoice,
};
