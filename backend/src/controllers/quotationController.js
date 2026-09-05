const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { requireFields, decimalString, integer } = require("../utils/validation");
const {
  calculateBlendedRiskScore,
  calculateLineTotal,
  calculateQuotationTotals,
} = require("../services/quotationCalculator");
const {
  getInitialApprovalStatus,
  getRequiredApproverRole,
  getStatusAfterApproval,
} = require("../services/approvalService");
const { proposeFulfillmentSplits } = require("../services/fulfillmentSplitter");
const {
  buildBackorderCheck,
  buildFulfillmentRecords,
} = require("../services/fulfillmentService");

const quotationInclude = {
  rep: { select: { id: true, name: true, email: true, role: true } },
  lines: { include: { product: true }, orderBy: { id: "asc" } },
};

const approvalContextInclude = {
  ...quotationInclude,
  approvalLogs: {
    include: { actor: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  },
};

const fulfillmentInclude = {
  ...quotationInclude,
  fulfillmentSplits: {
    include: { warehouse: true, product: true },
    orderBy: [{ productId: "asc" }, { createdAt: "asc" }],
  },
};

function canManage(user, quotation) {
  return user.role === "ADMIN" || quotation.repId === user.id;
}

function assertCanView(user, quotation) {
  if (user.role === "REP" && quotation.repId !== user.id) {
    throw new ApiError(403, "FORBIDDEN", "You cannot access another rep's quotation");
  }
}

async function listQuotations(req, res) {
  const where = req.user.role === "REP" ? { repId: req.user.id } : {};
  const quotations = await prisma.quotation.findMany({
    where,
    include: quotationInclude,
    orderBy: { updatedAt: "desc" },
  });
  res.json({ data: quotations });
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
  requireFields(req.body, ["customerName"]);
  const customerName = String(req.body.customerName).trim();
  if (!customerName) throw new ApiError(400, "VALIDATION_ERROR", "customerName is required");

  const quotation = await prisma.quotation.create({
    data: { customerName, repId: req.user.id },
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

  const discountTier = await prisma.discountTier.findUnique({
    where: { tierName: "Standard" },
    include: { categoryOverrides: true },
  });
  const activeTier = discountTier || await prisma.discountTier.findFirst({
    include: { categoryOverrides: true },
    orderBy: { createdAt: "asc" },
  });
  if (!activeTier) {
    throw new ApiError(
      409,
      "DISCOUNT_TIER_REQUIRED",
      "Configure one discount tier before submitting quotations",
    );
  }
  const score = calculateBlendedRiskScore(quotation.lines, activeTier);
  const status = getInitialApprovalStatus(score);

  const confirmed = await prisma.quotation.update({
    where: { id: quotation.id },
    data: { status, blendedRiskScore: score },
    include: quotationInclude,
  });
  res.json({ data: confirmed });
}

async function listPendingApprovals(req, res) {
  const pending = await prisma.quotation.findMany({
    where: {
      status: { in: ["PENDING_MANAGER_APPROVAL", "PENDING_FINANCE_APPROVAL"] },
    },
    include: approvalContextInclude,
    orderBy: { updatedAt: "asc" },
  });
  const data = pending
    .filter((quotation) => getRequiredApproverRole(quotation) === req.user.role)
    .map(({ approvalLogs: _approvalLogs, ...quotation }) => quotation);
  res.json({ data });
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
      data: { quotationId, actorId: actor.id, action, reason },
    });
    return tx.quotation.update({
      where: { id: quotationId },
      data: {
        status,
        ...(action === "RETURNED" ? { blendedRiskScore: 0 } : {}),
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
