const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { requireFields, decimalString, integer, uuid } = require("../utils/validation");
const {
  calculateLineTotal,
  calculateQuotationTotals,
} = require("../services/quotationCalculator");
const { evaluateGovernance } = require("../services/governanceService");
const {
  getRequiredApproverRole,
  getStatusAfterApproval,
} = require("../services/approvalService");
const { proposeFulfillmentSplits } = require("../services/fulfillmentSplitter");
const { parsePagination, paginationMeta } = require("../utils/pagination");
const { combineWhere, parseSearch } = require("../utils/search");
const {
  buildBackorderCheck,
  buildFulfillmentRecords,
} = require("../services/fulfillmentService");

const quotationInclude = {
  rep: { select: { id: true, name: true, email: true, role: true } },
  customer: { select: { id: true, name: true, email: true } },
  lines: { include: { product: true }, orderBy: { id: "asc" } },
};

const approvalContextInclude = {
  ...quotationInclude,
  approvalLogs: {
    include: { actor: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  },
};

const quotationSummarySelect = {
  id: true,
  customerName: true,
  repId: true,
  customerId: true,
  status: true,
  subtotal: true,
  totalDiscount: true,
  grandTotal: true,
  blendedRiskScore: true,
  approvalRound: true,
  sentToCustomerAt: true,
  createdAt: true,
  updatedAt: true,
  rep: { select: { id: true, name: true, email: true, role: true } },
  customer: { select: { id: true, name: true, email: true } },
  _count: { select: { lines: true } },
};

const fulfillmentInclude = {
  ...quotationInclude,
  fulfillmentSplits: {
    include: { warehouse: true, product: true },
    orderBy: [{ productId: "asc" }, { createdAt: "asc" }],
  },
};

const QUOTATION_STATUSES = new Set([
  "DRAFT",
  "PENDING_MANAGER_APPROVAL",
  "PENDING_FINANCE_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CONFIRMED",
  "FULFILLED",
  "SENT_TO_CUSTOMER",
  "UNDER_NEGOTIATION",
]);

function statusFilter(value) {
  if (!value) return undefined;
  const statuses = String(value).split(",").map((status) => status.trim().toUpperCase()).filter(Boolean);
  if (!statuses.length || statuses.some((status) => !QUOTATION_STATUSES.has(status))) {
    throw new ApiError(400, "VALIDATION_ERROR", "status contains an unsupported quotation status");
  }
  return statuses.length === 1 ? statuses[0] : { in: statuses };
}

function canManage(user, quotation) {
  return user.role === "ADMIN" || quotation.repId === user.id;
}

function assertCanView(user, quotation) {
  if (user.role === "REP" && quotation.repId !== user.id) {
    throw new ApiError(403, "FORBIDDEN", "You cannot access another rep's quotation");
  }
}

async function listQuotations(req, res) {
  const pagination = parsePagination(req.query);
  const search = parseSearch(req.query.search);
  const where = combineWhere({
    ...(req.user.role === "REP" ? { repId: req.user.id } : {}),
    ...(req.query.status ? { status: statusFilter(req.query.status) } : {}),
  }, search ? {
    OR: [
      { id: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { rep: { is: { name: { contains: search, mode: "insensitive" } } } },
      { rep: { is: { email: { contains: search, mode: "insensitive" } } } },
    ],
  } : undefined);
  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      select: quotationSummarySelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.quotation.count({ where }),
  ]);
  res.json({ data: quotations, pagination: paginationMeta(total, pagination) });
}

async function getQuotation(req, res) {
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: req.params.id },
    include: quotationInclude,
  });
  assertCanView(req.user, quotation);
  res.json({ data: quotation });
}

async function getQuotationHistory(req, res) {
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { repId: true },
  });
  assertCanView(req.user, quotation);

  const history = await prisma.approvalLog.findMany({
    where: { quotationId: req.params.id },
    include: {
      actor: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  res.json({ data: history });
}

async function createQuotation(req, res) {
  requireFields(req.body, ["customerId"]);
  const customerId = uuid(req.body.customerId, "customerId");
  const repId = req.user.role === "ADMIN"
    ? uuid(req.body.repId, "repId")
    : req.user.id;
  const [customer, owner] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({ where: { id: repId }, select: { id: true, role: true } }),
  ]);
  if (!customer) {
    throw new ApiError(400, "INVALID_REFERENCE", "The selected customer does not exist");
  }
  if (!owner || owner.role !== "REP") {
    throw new ApiError(400, "INVALID_REFERENCE", "The quotation owner must be a sales rep");
  }

  const quotation = await prisma.quotation.create({
    data: { customerId: customer.id, customerName: customer.name, repId: owner.id },
    include: quotationInclude,
  });
  res.status(201).json({ data: quotation });
}

async function replaceQuotationLines(req, res) {
  if (!Array.isArray(req.body?.lines)) {
    throw new ApiError(400, "VALIDATION_ERROR", "lines must be an array");
  }

  const quotation = await prisma.quotation.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!canManage(req.user, quotation)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot edit another rep's quotation");
  }
  if (quotation.status !== "DRAFT") {
    throw new ApiError(409, "QUOTATION_NOT_EDITABLE", "Only a draft quotation can be edited");
  }

  const normalizedLines = req.body.lines.map((line, index) => {
    requireFields(line, ["productId", "qty"]);
    return {
      productId: String(line.productId),
      qty: integer(line.qty, `lines[${index}].qty`, { min: 1 }),
      discountPercent: decimalString(
        line.discountPercent ?? 0,
        `lines[${index}].discountPercent`,
        { min: 0, max: 100 },
      ),
    };
  });

  const productIds = normalizedLines.map((line) => line.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new ApiError(400, "VALIDATION_ERROR", "Each product may appear only once in a quotation");
  }

  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length) {
    throw new ApiError(400, "INVALID_REFERENCE", "One or more products do not exist");
  }
  const productsById = new Map(products.map((product) => [product.id, product]));
  const lines = normalizedLines.map((line) => ({
    ...line,
    unitPrice: productsById.get(line.productId).price,
  }));
  const totals = calculateQuotationTotals(lines);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.quotationLine.deleteMany({ where: { quotationId: quotation.id } });
    if (lines.length) {
      await tx.quotationLine.createMany({
        data: lines.map((line) => ({
          quotationId: quotation.id,
          productId: line.productId,
          qty: line.qty,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent,
          lineTotal: calculateLineTotal(line).lineTotal,
          billingType: productsById.get(line.productId).billingType,
          billingCycle: productsById.get(line.productId).billingCycle,
        })),
      });
    }
    return tx.quotation.update({
      where: { id: quotation.id },
      data: { ...totals, blendedRiskScore: 0 },
      include: quotationInclude,
    });
  });

  res.json({ data: updated });
}

async function confirmQuotation(req, res) {
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: req.params.id },
    include: quotationInclude,
  });
  if (!canManage(req.user, quotation)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot confirm another rep's quotation");
  }
  if (!quotation.lines.length) {
    throw new ApiError(400, "EMPTY_QUOTATION", "Add at least one line before confirming");
  }
  if (quotation.status !== "DRAFT") {
    throw new ApiError(409, "INVALID_QUOTATION_STATUS", "Only a draft quotation can be submitted");
  }

  const { blendedRiskScore, status } = await evaluateGovernance(quotation.lines, prisma);

  const confirmed = await prisma.quotation.update({
    where: { id: quotation.id },
    data: {
      status,
      blendedRiskScore,
      approvalRound: quotation.approvalRound + 1,
    },
    include: quotationInclude,
  });
  res.json({ data: confirmed });
}

async function listPendingApprovals(req, res) {
  const pagination = parsePagination(req.query);
  const search = parseSearch(req.query.search);
  const quotationId = req.query.quotationId
    ? uuid(req.query.quotationId, "quotationId")
    : undefined;
  const candidates = await prisma.quotation.findMany({
    where: combineWhere({
      status: { in: ["PENDING_MANAGER_APPROVAL", "PENDING_FINANCE_APPROVAL"] },
      ...(quotationId ? { id: quotationId } : {}),
    }, search ? {
      OR: [
        { id: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { rep: { is: { name: { contains: search, mode: "insensitive" } } } },
      ],
    } : undefined),
    select: {
      id: true,
      status: true,
      approvalRound: true,
      approvalLogs: {
        where: { action: "APPROVED" },
        select: { approvalRound: true, action: true, actor: { select: { role: true } } },
      },
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
  });
  const assignedIds = candidates
    .filter((quotation) => getRequiredApproverRole(quotation) === req.user.role)
    .map((quotation) => quotation.id);
  const pageIds = assignedIds.slice(pagination.skip, pagination.skip + pagination.take);
  const records = pageIds.length
    ? await prisma.quotation.findMany({ where: { id: { in: pageIds } }, select: quotationSummarySelect })
    : [];
  const recordsById = new Map(records.map((quotation) => [quotation.id, quotation]));
  const data = pageIds.map((id) => recordsById.get(id));
  res.json({ data, pagination: paginationMeta(assignedIds.length, pagination) });
}

async function approveQuotation(req, res) {
  const updated = await applyApprovalAction({
    quotationId: req.params.id,
    actor: req.user,
    action: "APPROVED",
  });
  res.json({ data: updated });
}

async function rejectQuotation(req, res) {
  const reason = requireReason(req.body);
  const updated = await applyApprovalAction({
    quotationId: req.params.id,
    actor: req.user,
    action: "REJECTED",
    reason,
  });
  res.json({ data: updated });
}

async function returnQuotation(req, res) {
  const reason = requireReason(req.body);
  const updated = await applyApprovalAction({
    quotationId: req.params.id,
    actor: req.user,
    action: "RETURNED",
    reason,
  });
  res.json({ data: updated });
}

function requireReason(body) {
  requireFields(body, ["reason"]);
  const reason = String(body.reason).trim();
  if (!reason) throw new ApiError(400, "VALIDATION_ERROR", "reason is required");
  return reason;
}

async function applyApprovalAction({ quotationId, actor, action, reason }) {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: quotationId },
      include: approvalContextInclude,
    });
    const requiredRole = getRequiredApproverRole(quotation);
    if (!requiredRole) {
      throw new ApiError(
        409,
        "INVALID_QUOTATION_STATUS",
        "This quotation is not awaiting approval",
      );
    }
    if (actor.role !== requiredRole) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        `This quotation currently requires ${requiredRole} approval`,
      );
    }

    const status = action === "APPROVED"
      ? getStatusAfterApproval(quotation, actor.role)
      : action === "REJECTED" ? "REJECTED" : "DRAFT";

    await tx.approvalLog.create({
      data: {
        quotationId,
        actorId: actor.id,
        action,
        reason,
        approvalRound: quotation.approvalRound,
      },
    });
    return tx.quotation.update({
      where: { id: quotationId },
      data: {
        status,
        ...(action === "RETURNED" ? {
          blendedRiskScore: 0,
          sentToCustomerAt: null,
        } : {}),
      },
      include: quotationInclude,
    });
  });
}

async function suggestFulfillment(req, res) {
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: req.params.id },
    include: quotationInclude,
  });
  if (!canManage(req.user, quotation)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot fulfill another rep's quotation");
  }
  assertApprovedForFulfillment(quotation);

  const productIds = quotation.lines.map((line) => line.productId);
  const stockLevels = await prisma.stockLevel.findMany({
    where: { productId: { in: productIds } },
    include: { warehouse: true },
  });
  const warehousesById = new Map(
    stockLevels.map((stock) => [stock.warehouseId, stock.warehouse]),
  );
  const suggestion = proposeFulfillmentSplits(quotation, stockLevels).map((split) => ({
    ...split,
    warehouse: split.warehouseId ? warehousesById.get(split.warehouseId) : null,
  }));

  res.json({ data: suggestion });
}

async function confirmFulfillment(req, res) {
  const allocations = normalizeFulfillmentAllocations(req.body);

  const fulfilled = await prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { lines: true },
    });
    if (!canManage(req.user, quotation)) {
      throw new ApiError(403, "FORBIDDEN", "You cannot fulfill another rep's quotation");
    }
    assertApprovedForFulfillment(quotation);

    const claimed = await tx.quotation.updateMany({
      where: { id: quotation.id, status: "APPROVED" },
      data: { status: "FULFILLED" },
    });
    if (claimed.count !== 1) {
      throw new ApiError(
        409,
        "INVALID_QUOTATION_STATUS",
        "This quotation is no longer available for fulfillment",
      );
    }

    const records = buildFulfillmentRecords(quotation.lines, allocations);
    const warehouseIds = [...new Set(records.map((record) => record.warehouseId))];
    const warehouses = await tx.warehouse.findMany({
      where: { id: { in: warehouseIds } },
      select: { id: true },
    });
    if (warehouses.length !== warehouseIds.length) {
      throw new ApiError(
        400,
        "INVALID_REFERENCE",
        "One or more fulfillment warehouses do not exist",
      );
    }

    for (const record of records) {
      if (record.qtyFulfilled === 0) continue;
      const decremented = await tx.stockLevel.updateMany({
        where: {
          warehouseId: record.warehouseId,
          productId: record.productId,
          qty: { gte: record.qtyFulfilled },
        },
        data: { qty: { decrement: record.qtyFulfilled } },
      });
      if (decremented.count !== 1) {
        throw new ApiError(
          409,
          "INSUFFICIENT_STOCK",
          `Available stock changed for product ${record.productId} at warehouse ${record.warehouseId}`,
          {
            productId: record.productId,
            warehouseId: record.warehouseId,
            requestedQty: record.qtyFulfilled,
          },
        );
      }
    }

    await tx.fulfillmentSplit.createMany({
      data: records.map((record) => ({ ...record, quotationId: quotation.id })),
    });
    return tx.quotation.findUnique({
      where: { id: quotation.id },
      include: fulfillmentInclude,
    });
  });

  res.json({ data: fulfilled });
}

async function checkFulfillmentBackorder(req, res) {
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      fulfillmentSplits: {
        where: { qtyBackordered: { gt: 0 } },
        orderBy: [{ productId: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!canManage(req.user, quotation)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot access another rep's fulfillment");
  }
  if (quotation.status !== "FULFILLED") {
    throw new ApiError(
      409,
      "INVALID_QUOTATION_STATUS",
      "Backorders can only be checked after fulfillment is finalized",
    );
  }

  const productIds = [...new Set(
    quotation.fulfillmentSplits.map((split) => split.productId),
  )];
  const stockLevels = productIds.length
    ? await prisma.stockLevel.findMany({
      where: { productId: { in: productIds } },
      include: { warehouse: true },
    })
    : [];
  const warehousesById = new Map(
    stockLevels.map((stock) => [stock.warehouseId, stock.warehouse]),
  );
  const result = buildBackorderCheck(
    quotation.id,
    quotation.fulfillmentSplits,
    stockLevels,
  );

  res.json({
    data: {
      ...result,
      suggestedAllocations: result.suggestedAllocations.map((allocation) => ({
        ...allocation,
        warehouse: allocation.warehouseId
          ? warehousesById.get(allocation.warehouseId)
          : null,
      })),
    },
  });
}

function assertApprovedForFulfillment(quotation) {
  if (quotation.status !== "APPROVED") {
    throw new ApiError(
      409,
      "INVALID_QUOTATION_STATUS",
      "Only an approved quotation can be fulfilled",
    );
  }
}

function normalizeFulfillmentAllocations(body) {
  if (!Array.isArray(body) || body.length === 0) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "A non-empty array of fulfillment allocations is required",
    );
  }

  const allocations = body.map((allocation, index) => {
    requireFields(allocation, ["warehouseId", "productId", "qtyFulfilled"]);
    return {
      warehouseId: String(allocation.warehouseId),
      productId: String(allocation.productId),
      qtyFulfilled: integer(allocation.qtyFulfilled, `allocations[${index}].qtyFulfilled`, { min: 0 }),
    };
  });
  const keys = allocations.map(({ warehouseId, productId }) => `${warehouseId}:${productId}`);
  if (new Set(keys).size !== keys.length) {
    throw new ApiError(
      400,
      "INVALID_FULFILLMENT_SPLIT",
      "Each warehouse and product pair may appear only once",
    );
  }
  return allocations;
}

module.exports = {
  listQuotations,
  getQuotation,
  getQuotationHistory,
  createQuotation,
  replaceQuotationLines,
  confirmQuotation,
  listPendingApprovals,
  approveQuotation,
  rejectQuotation,
  returnQuotation,
  suggestFulfillment,
  confirmFulfillment,
  checkFulfillmentBackorder,
};
