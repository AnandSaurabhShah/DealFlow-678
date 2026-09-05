require("dotenv").config();

const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const {
  calculateBlendedRiskScore,
  calculateLineTotal,
  calculateQuotationTotals,
} = require("../src/services/quotationCalculator");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to seed the database");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const [adminPasswordHash, repPasswordHash, managerPasswordHash, financePasswordHash] = await Promise.all([
    bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "Admin123!", 12),
    bcrypt.hash(process.env.SEED_REP_PASSWORD || "Rep12345!", 12),
    bcrypt.hash(process.env.SEED_MANAGER_PASSWORD || "Manager123!", 12),
    bcrypt.hash(process.env.SEED_FINANCE_PASSWORD || "Finance123!", 12),
  ]);

  await prisma.user.upsert({
    where: { email: "admin@dealflow360.test" },
    update: { name: "Demo Admin", role: "ADMIN", passwordHash: adminPasswordHash },
    create: {
      name: "Demo Admin",
      email: "admin@dealflow360.test",
      role: "ADMIN",
      passwordHash: adminPasswordHash,
    },
  });
  const manager = await prisma.user.upsert({
    where: { email: "manager@dealflow360.test" },
    update: { name: "Demo Sales Manager", role: "MANAGER", passwordHash: managerPasswordHash },
    create: {
      name: "Demo Sales Manager",
      email: "manager@dealflow360.test",
      role: "MANAGER",
      passwordHash: managerPasswordHash,
    },
  });
  const finance = await prisma.user.upsert({
    where: { email: "finance@dealflow360.test" },
    update: { name: "Demo Finance Approver", role: "FINANCE", passwordHash: financePasswordHash },
    create: {
      name: "Demo Finance Approver",
      email: "finance@dealflow360.test",
      role: "FINANCE",
      passwordHash: financePasswordHash,
    },
  });
  const rep = await prisma.user.upsert({
    where: { email: "rep@dealflow360.test" },
    update: { name: "Demo Sales Rep", role: "REP", passwordHash: repPasswordHash },
    create: {
      name: "Demo Sales Rep",
      email: "rep@dealflow360.test",
      role: "REP",
      passwordHash: repPasswordHash,
    },
  });

  const laptop = await findOrCreateProduct({
    name: "ProBook 14 Laptop",
    category: "Hardware",
    price: "1299.00",
    unit: "unit",
    tax: "18.00",
    description: "Business laptop with three-year warranty",
  });
  const setup = await findOrCreateProduct({
    name: "On-site Setup Service",
    category: "Service",
    price: "350.00",
    unit: "service",
    tax: "18.00",
    description: "Installation and onboarding at the customer site",
  });
  const backorderUnit = await prisma.product.upsert({
    where: { id: "00000000-0000-4000-8000-000000000601" },
    update: {
      name: "MVP3 Backorder Demo Unit",
      category: "Fulfillment Demo",
      price: "100.00",
      unit: "unit",
      tax: "0.00",
      description: "Dedicated zero-stock product for the MVP 3 restock demonstration",
    },
    create: {
      id: "00000000-0000-4000-8000-000000000601",
      name: "MVP3 Backorder Demo Unit",
      category: "Fulfillment Demo",
      price: "100.00",
      unit: "unit",
      tax: "0.00",
      description: "Dedicated zero-stock product for the MVP 3 restock demonstration",
    },
  });

  await prisma.priceList.upsert({
    where: { id: "00000000-0000-4000-8000-000000000101" },
    update: { name: "Standard USD", customerTier: "STANDARD", currency: "USD" },
    create: {
      id: "00000000-0000-4000-8000-000000000101",
      name: "Standard USD",
      customerTier: "STANDARD",
      currency: "USD",
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { id: "00000000-0000-4000-8000-000000000201" },
    update: { name: "Central Warehouse", location: "Bengaluru" },
    create: {
      id: "00000000-0000-4000-8000-000000000201",
      name: "Central Warehouse",
      location: "Bengaluru",
    },
  });

  const westWarehouse = await prisma.warehouse.upsert({
    where: { id: "00000000-0000-4000-8000-000000000202" },
    update: { name: "West Warehouse", location: "Mumbai" },
    create: {
      id: "00000000-0000-4000-8000-000000000202",
      name: "West Warehouse",
      location: "Mumbai",
    },
  });

  await Promise.all([
    prisma.stockLevel.upsert({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: laptop.id } },
      update: { qty: 25 },
      create: { warehouseId: warehouse.id, productId: laptop.id, qty: 25 },
    }),
    prisma.stockLevel.upsert({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: setup.id } },
      update: { qty: 100 },
      create: { warehouseId: warehouse.id, productId: setup.id, qty: 100 },
    }),
    prisma.stockLevel.upsert({
      where: { warehouseId_productId: { warehouseId: westWarehouse.id, productId: laptop.id } },
      update: { qty: 15 },
      create: { warehouseId: westWarehouse.id, productId: laptop.id, qty: 15 },
    }),
    prisma.stockLevel.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: backorderUnit.id,
        },
      },
      update: { qty: 0 },
      create: { warehouseId: warehouse.id, productId: backorderUnit.id, qty: 0 },
    }),
    prisma.stockLevel.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: westWarehouse.id,
          productId: backorderUnit.id,
        },
      },
      update: { qty: 0 },
      create: { warehouseId: westWarehouse.id, productId: backorderUnit.id, qty: 0 },
    }),
  ]);

  const standardTier = await prisma.discountTier.upsert({
    where: { tierName: "Standard" },
    update: { maxDiscountPercent: "15.00" },
    create: { tierName: "Standard", maxDiscountPercent: "15.00" },
  });
  await prisma.categoryDiscountOverride.upsert({
    where: {
      discountTierId_category: {
        discountTierId: standardTier.id,
        category: "Service",
      },
    },
    update: { maxDiscountPercent: "10.00" },
    create: {
      discountTierId: standardTier.id,
      category: "Service",
      maxDiscountPercent: "10.00",
    },
  });

  const approvalTier = await prisma.discountTier.findUniqueOrThrow({
    where: { id: standardTier.id },
    include: { categoryOverrides: true },
  });

  const mvp2Scenarios = [
    {
      id: "00000000-0000-4000-8000-000000000301",
      customerName: "Acme Manager Approval",
      status: "PENDING_MANAGER_APPROVAL",
      lines: [{ product: setup, qty: 1, discountPercent: "18.00" }],
      logs: [],
    },
    {
      id: "00000000-0000-4000-8000-000000000302",
      customerName: "Northstar Two-Level Approval",
      status: "PENDING_FINANCE_APPROVAL",
      lines: [
        { product: laptop, qty: 2, discountPercent: "30.00" },
        { product: setup, qty: 1, discountPercent: "18.00" },
      ],
      logs: [],
    },
    {
      id: "00000000-0000-4000-8000-000000000303",
      customerName: "Globex Finance Review",
      status: "PENDING_FINANCE_APPROVAL",
      lines: [
        { product: laptop, qty: 1, discountPercent: "30.00" },
        { product: setup, qty: 1, discountPercent: "18.00" },
      ],
      logs: [{ actorId: manager.id, action: "APPROVED", reason: null }],
    },
    {
      id: "00000000-0000-4000-8000-000000000304",
      customerName: "Initech Approved Deal",
      status: "APPROVED",
      lines: [
        { product: laptop, qty: 1, discountPercent: "30.00" },
        { product: setup, qty: 1, discountPercent: "18.00" },
      ],
      logs: [
        { actorId: manager.id, action: "APPROVED", reason: null },
        { actorId: finance.id, action: "APPROVED", reason: null },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000305",
      customerName: "Umbrella Rejected Deal",
      status: "REJECTED",
      lines: [{ product: setup, qty: 2, discountPercent: "20.00" }],
      logs: [{
        actorId: manager.id,
        action: "REJECTED",
        reason: "Discount is not commercially viable.",
      }],
    },
    {
      id: "00000000-0000-4000-8000-000000000306",
      customerName: "Wayne Revision Requested",
      status: "DRAFT",
      lines: [{ product: setup, qty: 1, discountPercent: "18.00" }],
      logs: [{
        actorId: manager.id,
        action: "RETURNED",
        reason: "Please revise the service discount.",
      }],
      currentRiskScore: "0",
    },
  ];

  for (const scenario of mvp2Scenarios) {
    await seedMvp2Quotation({ ...scenario, repId: rep.id, discountTier: approvalTier });
  }

  const mvp3Scenarios = [
    {
      id: "00000000-0000-4000-8000-000000000401",
      customerName: "MVP3 Single Warehouse Demo",
      status: "APPROVED",
      lines: [{ product: laptop, qty: 10, discountPercent: "0.00" }],
      splits: [],
    },
    {
      id: "00000000-0000-4000-8000-000000000402",
      customerName: "MVP3 Two Warehouse Split Demo",
      status: "APPROVED",
      lines: [{ product: laptop, qty: 30, discountPercent: "0.00" }],
      splits: [],
    },
    {
      id: "00000000-0000-4000-8000-000000000403",
      customerName: "MVP3 Insufficient Stock Demo",
      status: "APPROVED",
      lines: [{ product: laptop, qty: 50, discountPercent: "0.00" }],
      splits: [],
    },
    {
      id: "00000000-0000-4000-8000-000000000404",
      customerName: "MVP3 Awaiting Restock Demo",
      status: "FULFILLED",
      lines: [{ product: backorderUnit, qty: 15, discountPercent: "0.00" }],
      splits: [{
        warehouse,
        product: backorderUnit,
        qtyFulfilled: 5,
        qtyBackordered: 10,
      }],
    },
  ];

  for (const scenario of mvp3Scenarios) {
    await seedMvp3Quotation({ ...scenario, repId: rep.id, discountTier: approvalTier });
  }

  console.log(
    `Seeded demo users, catalog, discount rules, ${mvp2Scenarios.length} MVP 2 scenarios, and ${mvp3Scenarios.length} MVP 3 fulfillment scenarios`,
  );
}

async function findOrCreateProduct(data) {
  const existing = await prisma.product.findFirst({ where: { name: data.name } });
  if (existing) return prisma.product.update({ where: { id: existing.id }, data });
  return prisma.product.create({ data });
}

async function seedMvp2Quotation({
  id,
  customerName,
  repId,
  status,
  lines,
  logs,
  discountTier,
  currentRiskScore,
}) {
  const calculatedLines = lines.map((line) => ({
    productId: line.product.id,
    product: line.product,
    qty: line.qty,
    unitPrice: line.product.price,
    discountPercent: line.discountPercent,
  }));
  const totals = calculateQuotationTotals(calculatedLines);
  const calculatedRiskScore = calculateBlendedRiskScore(calculatedLines, discountTier);

  await prisma.$transaction(async (tx) => {
    await tx.fulfillmentSplit.deleteMany({ where: { quotationId: id } });
    await tx.approvalLog.deleteMany({ where: { quotationId: id } });
    await tx.quotationLine.deleteMany({ where: { quotationId: id } });
    await tx.quotation.upsert({
      where: { id },
      update: {
        customerName,
        repId,
        status,
        ...totals,
        blendedRiskScore: currentRiskScore ?? calculatedRiskScore,
      },
      create: {
        id,
        customerName,
        repId,
        status,
        ...totals,
        blendedRiskScore: currentRiskScore ?? calculatedRiskScore,
      },
    });
    await tx.quotationLine.createMany({
      data: calculatedLines.map((line) => ({
        quotationId: id,
        productId: line.productId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        lineTotal: calculateLineTotal(line).lineTotal,
      })),
    });
    if (logs.length) {
      const now = Date.now();
      await tx.approvalLog.createMany({
        data: logs.map((log, index) => ({
          quotationId: id,
          ...log,
          createdAt: new Date(now - (logs.length - index) * 60_000),
        })),
      });
    }
  });
}

async function seedMvp3Quotation({
  id,
  customerName,
  repId,
  status,
  lines,
  splits,
  discountTier,
}) {
  const calculatedLines = lines.map((line) => ({
    productId: line.product.id,
    product: line.product,
    qty: line.qty,
    unitPrice: line.product.price,
    discountPercent: line.discountPercent,
  }));
  const totals = calculateQuotationTotals(calculatedLines);
  const blendedRiskScore = calculateBlendedRiskScore(calculatedLines, discountTier);

  await prisma.$transaction(async (tx) => {
    await tx.fulfillmentSplit.deleteMany({ where: { quotationId: id } });
    await tx.approvalLog.deleteMany({ where: { quotationId: id } });
    await tx.quotationLine.deleteMany({ where: { quotationId: id } });
    await tx.quotation.upsert({
      where: { id },
      update: { customerName, repId, status, ...totals, blendedRiskScore },
      create: { id, customerName, repId, status, ...totals, blendedRiskScore },
    });
    await tx.quotationLine.createMany({
      data: calculatedLines.map((line) => ({
        quotationId: id,
        productId: line.productId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        lineTotal: calculateLineTotal(line).lineTotal,
      })),
    });
    if (splits.length) {
      await tx.fulfillmentSplit.createMany({
        data: splits.map((split) => ({
          quotationId: id,
          warehouseId: split.warehouse.id,
          productId: split.product.id,
          qtyFulfilled: split.qtyFulfilled,
          qtyBackordered: split.qtyBackordered,
        })),
      });
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
