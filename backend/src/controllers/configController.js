const prisma = require("../config/prisma");
const { requireFields, decimalString, integer } = require("../utils/validation");
const { parsePagination, paginationMeta } = require("../utils/pagination");
const { combineWhere, parseSearch } = require("../utils/search");
const { enumValue, matchingValues, publicConfigOptions } = require("../constants/configEnums");

async function getConfigOptions(_req, res) {
  res.json({ data: publicConfigOptions() });
}

async function paginatedList(req, res, model, options = {}) {
  const pagination = parsePagination(req.query);
  const search = parseSearch(req.query.search);
  const { searchFields = [], enumSearch = {}, ...queryOptions } = options;
  const searchConditions = searchFields.map((field) => ({
    [field]: { contains: search, mode: "insensitive" },
  }));
  Object.entries(enumSearch).forEach(([field, definition]) => {
    const values = matchingValues(definition, search);
    if (values.length) searchConditions.push({ [field]: { in: values } });
  });
  const where = combineWhere(
    queryOptions.where,
    search ? { OR: searchConditions } : undefined,
  );
  const [data, total] = await Promise.all([
    model.findMany({
      ...queryOptions,
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: queryOptions.orderBy || [{ createdAt: "desc" }, { id: "desc" }],
    }),
    model.count({ where }),
  ]);
  res.json({ data, pagination: paginationMeta(total, pagination) });
}

async function listProducts(req, res) {
  return paginatedList(req, res, prisma.product, {
    searchFields: ["name", "description"],
    enumSearch: { category: "productCategories", unit: "productUnits" },
  });
}

async function getProduct(req, res) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: req.params.id } });
  res.json({ data: product });
}

async function createProduct(req, res) {
  requireFields(req.body, ["name", "category", "price", "unit"]);
  const billingType = enumValue(req.body.billingType || "ONE_TIME", "billingType", "billingTypes");
  const billingCycle = billingType === "RECURRING"
    ? enumValue(req.body.billingCycle || "MONTHLY", "billingCycle", "billingCycles")
    : null;
  const product = await prisma.product.create({
    data: {
      name: String(req.body.name).trim(),
      category: enumValue(req.body.category, "category", "productCategories"),
      price: decimalString(req.body.price, "price", { min: 0 }),
      unit: enumValue(req.body.unit, "unit", "productUnits"),
      tax: decimalString(req.body.tax ?? 0, "tax", { min: 0 }),
      description: req.body.description == null ? null : String(req.body.description).trim(),
      billingType,
      billingCycle,
    },
  });
  res.status(201).json({ data: product });
}

async function listPriceLists(req, res) {
  return paginatedList(req, res, prisma.priceList, {
    searchFields: ["name"],
    enumSearch: { customerTier: "customerTiers", currency: "currencies" },
  });
}

async function getPriceList(req, res) {
  res.json({ data: await prisma.priceList.findUniqueOrThrow({ where: { id: req.params.id } }) });
}

async function createPriceList(req, res) {
  requireFields(req.body, ["name", "customerTier"]);
  const priceList = await prisma.priceList.create({
    data: {
      name: String(req.body.name).trim(),
      customerTier: enumValue(req.body.customerTier, "customerTier", "customerTiers"),
      currency: enumValue(req.body.currency || "USD", "currency", "currencies"),
    },
  });
  res.status(201).json({ data: priceList });
}

const warehouseInclude = { stockLevels: { include: { product: true } } };

async function listWarehouses(req, res) {
  return paginatedList(req, res, prisma.warehouse, {
    searchFields: ["name", "location"],
    select: {
      id: true,
      name: true,
      location: true,
      createdAt: true,
      _count: { select: { stockLevels: true } },
    },
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

async function listDiscountTiers(req, res) {
  return paginatedList(req, res, prisma.discountTier, { searchFields: ["tierName"] });
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
            category: enumValue(
              override.category,
              `categoryOverrides[${index}].category`,
              "productCategories",
            ),
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
  getConfigOptions,
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
