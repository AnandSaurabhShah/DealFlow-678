const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { requireFields, decimalString, integer } = require("../utils/validation");

async function listProducts(_req, res) {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ data: products });
}

async function getProduct(req, res) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: req.params.id } });
  res.json({ data: product });
}

async function createProduct(req, res) {
  requireFields(req.body, ["name", "category", "price", "unit"]);
  const billingType = String(req.body.billingType || "ONE_TIME").toUpperCase();
  if (!["ONE_TIME", "RECURRING"].includes(billingType)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "billingType must be ONE_TIME or RECURRING",
    );
  }
  const billingCycle = billingType === "RECURRING"
    ? String(req.body.billingCycle || "MONTHLY").toUpperCase()
    : null;
  if (billingCycle && billingCycle !== "MONTHLY") {
    throw new ApiError(400, "VALIDATION_ERROR", "Only MONTHLY billing is supported");
  }
  const product = await prisma.product.create({
    data: {
      name: String(req.body.name).trim(),
      category: String(req.body.category).trim(),
      price: decimalString(req.body.price, "price", { min: 0 }),
      unit: String(req.body.unit).trim(),
      tax: decimalString(req.body.tax ?? 0, "tax", { min: 0 }),
      description: req.body.description == null ? null : String(req.body.description).trim(),
      billingType,
      billingCycle,
    },
  });
  res.status(201).json({ data: product });
}

async function listPriceLists(_req, res) {
  res.json({ data: await prisma.priceList.findMany({ orderBy: { createdAt: "desc" } }) });
}

async function getPriceList(req, res) {
  res.json({ data: await prisma.priceList.findUniqueOrThrow({ where: { id: req.params.id } }) });
}

async function createPriceList(req, res) {
  requireFields(req.body, ["name", "customerTier"]);
  const priceList = await prisma.priceList.create({
    data: {
      name: String(req.body.name).trim(),
      customerTier: String(req.body.customerTier).trim(),
      currency: String(req.body.currency || "USD").trim().toUpperCase(),
    },
  });
  res.status(201).json({ data: priceList });
}

const warehouseInclude = { stockLevels: { include: { product: true } } };

async function listWarehouses(_req, res) {
  res.json({
    data: await prisma.warehouse.findMany({ include: warehouseInclude, orderBy: { createdAt: "desc" } }),
  });
}

async function getWarehouse(req, res) {
  res.json({
    data: await prisma.warehouse.findUniqueOrThrow({
      where: { id: req.params.id },
      include: warehouseInclude,
    }),
  });
}

async function createWarehouse(req, res) {
  requireFields(req.body, ["name"]);
  const stockLevels = req.body.stockLevels || [];
  if (!Array.isArray(stockLevels)) {
    const error = new Error("stockLevels must be an array");
    error.status = 400;
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  const warehouse = await prisma.warehouse.create({
    data: {
      name: String(req.body.name).trim(),
      location: req.body.location == null ? null : String(req.body.location).trim(),
      stockLevels: {
        create: stockLevels.map((stock, index) => {
          requireFields(stock, ["productId", "qty"]);
          return {
            productId: String(stock.productId),
            qty: integer(stock.qty, `stockLevels[${index}].qty`, { min: 0 }),
          };
        }),
      },
    },
    include: warehouseInclude,
  });
  res.status(201).json({ data: warehouse });
}

async function restockWarehouse(req, res) {
  requireFields(req.body, ["productId", "qty"]);
  const productId = String(req.body.productId);
  const qty = integer(req.body.qty, "qty", { min: 1 });

  const stockLevel = await prisma.stockLevel.upsert({
    where: {
      warehouseId_productId: {
        warehouseId: req.params.id,
        productId,
      },
    },
    update: { qty: { increment: qty } },
    create: { warehouseId: req.params.id, productId, qty },
    include: { warehouse: true, product: true },
  });

  res.json({ data: stockLevel });
}

const tierInclude = { categoryOverrides: true };

async function listDiscountTiers(_req, res) {
  res.json({
    data: await prisma.discountTier.findMany({ include: tierInclude, orderBy: { createdAt: "desc" } }),
  });
}

async function getDiscountTier(req, res) {
  res.json({
    data: await prisma.discountTier.findUniqueOrThrow({
      where: { id: req.params.id },
      include: tierInclude,
    }),
  });
}

async function createDiscountTier(req, res) {
  requireFields(req.body, ["tierName", "maxDiscountPercent"]);
  const overrides = req.body.categoryOverrides || [];
  if (!Array.isArray(overrides)) {
    const error = new Error("categoryOverrides must be an array");
    error.status = 400;
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  const tier = await prisma.discountTier.create({
    data: {
      tierName: String(req.body.tierName).trim(),
      maxDiscountPercent: decimalString(req.body.maxDiscountPercent, "maxDiscountPercent", { min: 0 }),
      categoryOverrides: {
        create: overrides.map((override, index) => {
          requireFields(override, ["category", "maxDiscountPercent"]);
          return {
            category: String(override.category).trim(),
            maxDiscountPercent: decimalString(
              override.maxDiscountPercent,
              `categoryOverrides[${index}].maxDiscountPercent`,
              { min: 0 },
            ),
          };
        }),
      },
    },
    include: tierInclude,
  });
  res.status(201).json({ data: tier });
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  listPriceLists,
  getPriceList,
  createPriceList,
  listWarehouses,
  getWarehouse,
  createWarehouse,
  restockWarehouse,
  listDiscountTiers,
  getDiscountTier,
  createDiscountTier,
};
