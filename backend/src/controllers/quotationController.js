const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { requireFields, decimalString, integer } = require("../utils/validation");
const {
  calculateLineTotal,
  calculateQuotationTotals,
} = require("../services/quotationCalculator");

const quotationInclude = {
  rep: { select: { id: true, name: true, email: true, role: true } },
  lines: { include: { product: true }, orderBy: { id: "asc" } },
};

function canManage(user, quotation) {
  return user.role === "ADMIN" || quotation.repId === user.id;
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
  if (req.user.role === "REP" && quotation.repId !== req.user.id) {
    throw new ApiError(403, "FORBIDDEN", "You cannot access another rep's quotation");
  }
  res.json({ data: quotation });
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
    throw new ApiError(409, "QUOTATION_CONFIRMED", "A confirmed quotation cannot be edited");
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
        })),
      });
    }
    return tx.quotation.update({
      where: { id: quotation.id },
      data: totals,
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
  if (quotation.status === "CONFIRMED") return res.json({ data: quotation });

  const confirmed = await prisma.quotation.update({
    where: { id: quotation.id },
    data: { status: "CONFIRMED" },
    include: quotationInclude,
  });
  res.json({ data: confirmed });
}

module.exports = {
  listQuotations,
  getQuotation,
  createQuotation,
  replaceQuotationLines,
  confirmQuotation,
};
