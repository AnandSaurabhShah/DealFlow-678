const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { decimalString, requireFields, uuid } = require("../utils/validation");
const { calculateLineTotal, calculateQuotationTotals } = require("../services/quotationCalculator");
const { evaluateGovernance } = require("../services/governanceService");
const { sendQuotationEmail } = require("../services/quotationMailer");
const { parsePagination, paginationMeta } = require("../utils/pagination");
const { combineWhere, parseSearch } = require("../utils/search");
const {
  shapeComment,
  shapeInternalEvent,
  shapePortalQuotation,
} = require("../services/negotiationPresenter");

const NEGOTIABLE_STATUSES = ["SENT_TO_CUSTOMER", "UNDER_NEGOTIATION"];
const portalInclude = {
  customer: { select: { id: true, name: true } },
  lines: { include: { product: true }, orderBy: { id: "asc" } },
  negotiationComments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
};

function normalizeContent(body) {
  requireFields(body, ["content"]);
  const content = String(body.content).trim();
  if (!content || content.length > 2000) {
    throw new ApiError(400, "VALIDATION_ERROR", "Comment must contain between 1 and 2000 characters");
  }
  return content;
}

function assertInternalCanView(user, quotation) {
  if (user.role === "REP" && quotation.repId !== user.id) {
    throw new ApiError(403, "FORBIDDEN", "You cannot access another rep's negotiation");
  }
}

function assertInternalCanSend(user, quotation) {
  if (user.role === "REP" && quotation.repId !== user.id) {
    throw new ApiError(403, "FORBIDDEN", "You cannot send another rep's quotation");
  }
}

function assertNegotiable(quotation) {
  if (!NEGOTIABLE_STATUSES.includes(quotation.status)) {
    throw new ApiError(409, "QUOTATION_NOT_NEGOTIABLE", "This quotation is not open for customer negotiation");
  }
}

async function loadPortalQuotation(db, quotationId, customerId) {
  const quotation = await db.quotation.findFirst({
    where: { id: quotationId, customerId, sentToCustomerAt: { not: null } },
    include: portalInclude,
  });
  if (!quotation) {
    console.warn("[portal] quotation access denied", { quotationId, customerId });
    throw new ApiError(404, "CUSTOMER_QUOTATION_NOT_FOUND", "The requested quotation was not found");
  }
  return quotation;
}

async function resolveDisplayNames(db, records) {
  const customerIds = [...new Set(records.filter((record) =>
    (record.authorType || record.actorType) === "CUSTOMER").map((record) => record.authorId || record.actorId))];
  const userIds = [...new Set(records.filter((record) =>
    (record.authorType || record.actorType) === "INTERNAL").map((record) => record.authorId || record.actorId))];
  const [customers, users] = await Promise.all([
    customerIds.length ? db.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } }) : [],
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
  ]);
  return new Map([
    ...customers.map((customer) => [`CUSTOMER:${customer.id}`, customer.name]),
    ...users.map((user) => [`INTERNAL:${user.id}`, user.name]),
  ]);
}

async function presentPortalQuotation(quotationId, customerId) {
  const quotation = await loadPortalQuotation(prisma, quotationId, customerId);
  const names = await resolveDisplayNames(prisma, quotation.negotiationComments);
  return shapePortalQuotation(quotation, quotation.negotiationComments, names);
}

async function runSerializable(work) {
  try {
    return await prisma.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (error.code === "P2034") {
      throw new ApiError(409, "NEGOTIATION_CONFLICT", "The quotation changed. Refresh it and try again.");
    }
    throw error;
  }
}

async function sendToCustomer(req, res) {
  const quotationId = uuid(req.params.id, "quotationId");
  const sent = await runSerializable(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: quotationId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        invoices: { select: { id: true }, take: 1 },
        lines: {
          include: { billingScheduleEntries: { select: { id: true }, take: 1 }, product: true },
          orderBy: { id: "asc" },
        },
      },
    });
    assertInternalCanSend(req.user, quotation);
    if (quotation.status !== "APPROVED") {
      throw new ApiError(409, "INVALID_QUOTATION_STATUS", "Only an approved quotation can be sent to a customer");
    }
    if (quotation.sentToCustomerAt) {
      throw new ApiError(409, "NEGOTIATION_CONFLICT", "This quotation has already been sent to a customer");
    }
    if (quotation.invoices.length || quotation.lines.some((line) => line.billingScheduleEntries.length)) {
      throw new ApiError(409, "BILLING_ALREADY_GENERATED", "A quotation with generated billing cannot enter negotiation");
    }

    const requestedCustomerId = quotation.customerId || req.body?.customerId;
    const requestedCustomerEmail = req.body?.customerEmail
      ? String(req.body.customerEmail).trim().toLowerCase()
      : null;
    if (!requestedCustomerId && !requestedCustomerEmail) {
      throw new ApiError(
        400,
        "CUSTOMER_REQUIRED",
        "A linked customer, customerId, or customerEmail is required before sending a quotation",
      );
    }
    if (requestedCustomerEmail && !/^\S+@\S+\.\S+$/.test(requestedCustomerEmail)) {
      throw new ApiError(400, "VALIDATION_ERROR", "customerEmail must be a valid email address");
    }
    const customer = await tx.customer.findUnique({
      where: requestedCustomerId
        ? { id: uuid(requestedCustomerId, "customerId") }
        : { email: requestedCustomerEmail },
      select: { id: true, name: true, email: true },
    });
    if (!customer) {
      throw new ApiError(
        400,
        "INVALID_REFERENCE",
        "No customer portal account exists for that customer",
      );
    }

    const now = new Date();
    const updated = await tx.quotation.update({
      where: { id: quotation.id },
      data: {
        customerId: customer.id,
        customerName: customer.name,
        sentToCustomerAt: now,
        status: "SENT_TO_CUSTOMER",
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        rep: { select: { id: true, name: true, email: true, role: true } },
        lines: { include: { product: true }, orderBy: { id: "asc" } },
      },
    });
    await tx.negotiationEvent.create({
      data: {
        quotationId: quotation.id,
        actorType: "INTERNAL",
        actorId: req.user.id,
        action: "SENT_TO_CUSTOMER",
        details: { customerId: customer.id },
      },
    });
    console.info("[negotiation] quotation sent", { quotationId: quotation.id, actorId: req.user.id });
    return updated;
  });
  const emailDelivery = await sendQuotationEmail({ customer: sent.customer, quotation: sent });
  res.json({ data: sent, emailDelivery });
}

async function listPortalQuotations(req, res) {
  const pagination = parsePagination(req.query);
  const search = parseSearch(req.query.search);
  const where = combineWhere(
    { customerId: req.customer.id, sentToCustomerAt: { not: null } },
    search ? {
      OR: [
        { id: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
      ],
    } : undefined,
  );
  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      select: {
        id: true,
        customerName: true,
        status: true,
        grandTotal: true,
        sentToCustomerAt: true,
        updatedAt: true,
        _count: { select: { lines: true, negotiationComments: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.quotation.count({ where }),
  ]);
  res.json({ data: quotations, pagination: paginationMeta(total, pagination) });
}

async function getPortalQuotation(req, res) {
  const quotationId = uuid(req.params.id, "quotationId");
  res.json({ data: await presentPortalQuotation(quotationId, req.customer.id) });
}

async function createCustomerComment(req, res) {
  const quotationId = uuid(req.params.id, "quotationId");
  const content = normalizeContent(req.body);
  const quotationLineId = req.body.quotationLineId
    ? uuid(req.body.quotationLineId, "quotationLineId")
    : null;
  const comment = await runSerializable(async (tx) => {
    const quotation = await loadPortalQuotation(tx, quotationId, req.customer.id);
    assertNegotiable(quotation);
    if (quotationLineId && !quotation.lines.some((line) => line.id === quotationLineId)) {
      throw new ApiError(400, "INVALID_QUOTATION_LINE", "The quotation line does not belong to this quotation");
    }
    return tx.negotiationComment.create({
      data: {
        quotationId,
        quotationLineId,
        authorType: "CUSTOMER",
        authorId: req.customer.id,
        content,
      },
    });
  });
  const names = new Map([[`CUSTOMER:${req.customer.id}`, req.customer.name]]);
  res.status(201).json({ data: shapeComment(comment, names) });
}

async function updateCustomerDiscount(req, res) {
  const quotationId = uuid(req.params.id, "quotationId");
  const lineId = uuid(req.params.lineId, "lineId");
  requireFields(req.body, ["discountPercent"]);
  const discountPercent = decimalString(req.body.discountPercent, "discountPercent", { min: 0, max: 100 });

  await runSerializable(async (tx) => {
    const quotation = await loadPortalQuotation(tx, quotationId, req.customer.id);
    assertNegotiable(quotation);
    const line = quotation.lines.find((item) => item.id === lineId);
    if (!line) {
      throw new ApiError(400, "INVALID_QUOTATION_LINE", "The quotation line does not belong to this quotation");
    }
    const changedLines = quotation.lines.map((item) => item.id === lineId
      ? { ...item, discountPercent }
      : item);
    const totals = calculateQuotationTotals(changedLines);
    await tx.quotationLine.update({
      where: { id: lineId },
      data: {
        discountPercent,
        lineTotal: calculateLineTotal({ ...line, discountPercent }).lineTotal,
      },
    });
    await tx.quotation.update({
      where: { id: quotation.id },
      data: { ...totals, status: "UNDER_NEGOTIATION" },
    });
    await tx.negotiationEvent.create({
      data: {
        quotationId,
        quotationLineId: lineId,
        actorType: "CUSTOMER",
        actorId: req.customer.id,
        action: "DISCOUNT_UPDATED",
        details: {
          previousDiscountPercent: String(line.discountPercent),
          requestedDiscountPercent: String(discountPercent),
        },
      },
    });
    console.info("[negotiation] discount updated", { quotationId, lineId, customerId: req.customer.id });
  });
  res.json({ data: await presentPortalQuotation(quotationId, req.customer.id) });
}

async function confirmCustomerRequest(req, res) {
  const quotationId = uuid(req.params.id, "quotationId");
  await runSerializable(async (tx) => {
    const quotation = await loadPortalQuotation(tx, quotationId, req.customer.id);
    assertNegotiable(quotation);
    if (!quotation.lines.length) {
      throw new ApiError(400, "EMPTY_QUOTATION", "The quotation has no lines to confirm");
    }

    const { totals, blendedRiskScore, status: governanceStatus } = await evaluateGovernance(quotation.lines, tx);
    const status = governanceStatus === "APPROVED" ? "CONFIRMED" : governanceStatus;
    const approvalRound = quotation.approvalRound + 1;
    for (const line of quotation.lines) {
      await tx.quotationLine.update({
        where: { id: line.id },
        data: { lineTotal: calculateLineTotal(line).lineTotal },
      });
    }
    await tx.quotation.update({
      where: { id: quotation.id },
      data: { ...totals, blendedRiskScore, status, approvalRound },
    });
    const events = [{
      quotationId,
      actorType: "CUSTOMER",
      actorId: req.customer.id,
      action: "CUSTOMER_CONFIRMED",
      details: {
        resultingStatus: status,
        blendedRiskScore: blendedRiskScore.toString(),
        approvalRound,
      },
    }];
    if (governanceStatus !== "APPROVED") {
      events.push({
        quotationId,
        actorType: "CUSTOMER",
        actorId: req.customer.id,
        action: "APPROVAL_REENTRY",
        details: { resultingStatus: status, approvalRound },
      });
    }
    await tx.negotiationEvent.createMany({ data: events });
    console.info("[negotiation] customer confirmed", {
      quotationId,
      customerId: req.customer.id,
      status,
      approvalRound,
    });
  });
  res.json({ data: await presentPortalQuotation(quotationId, req.customer.id) });
}

async function getInternalComments(req, res) {
  const quotationId = uuid(req.params.id, "quotationId");
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      lines: { include: { product: { select: { id: true, name: true } } } },
    },
  });
  assertInternalCanView(req.user, quotation);
  const [comments, events] = await Promise.all([
    prisma.negotiationComment.findMany({
      where: { quotationId },
      include: { quotationLine: { include: { product: { select: { id: true, name: true } } } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.negotiationEvent.findMany({
      where: { quotationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);
  const names = await resolveDisplayNames(prisma, [...comments, ...events]);
  res.json({
    data: {
      customer: quotation.customer,
      comments: comments.map((comment) => ({
        ...shapeComment(comment, names),
        quotationLine: comment.quotationLine ? {
          id: comment.quotationLine.id,
          product: comment.quotationLine.product,
        } : null,
      })),
      events: events.map((event) => shapeInternalEvent(event, names)),
    },
  });
}

async function createInternalComment(req, res) {
  const quotationId = uuid(req.params.id, "quotationId");
  const content = normalizeContent(req.body);
  const quotationLineId = req.body.quotationLineId
    ? uuid(req.body.quotationLineId, "quotationLineId")
    : null;
  const comment = await runSerializable(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: quotationId },
      include: { lines: { select: { id: true } } },
    });
    assertInternalCanView(req.user, quotation);
    if (!quotation.sentToCustomerAt) {
      throw new ApiError(409, "QUOTATION_NOT_NEGOTIABLE", "The quotation has not been sent to a customer");
    }
    if (quotationLineId && !quotation.lines.some((line) => line.id === quotationLineId)) {
      throw new ApiError(400, "INVALID_QUOTATION_LINE", "The quotation line does not belong to this quotation");
    }
    return tx.negotiationComment.create({
      data: {
        quotationId,
        quotationLineId,
        authorType: "INTERNAL",
        authorId: req.user.id,
        content,
      },
    });
  });
  const names = new Map([[`INTERNAL:${req.user.id}`, req.user.name]]);
  res.status(201).json({ data: shapeComment(comment, names) });
}

module.exports = {
  sendToCustomer,
  listPortalQuotations,
  getPortalQuotation,
  createCustomerComment,
  updateCustomerDiscount,
  confirmCustomerRequest,
  getInternalComments,
  createInternalComment,
  loadPortalQuotation,
  resolveDisplayNames,
};
