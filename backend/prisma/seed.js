require("dotenv").config();

const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const {
  calculateBlendedRiskScore,
  calculateLineTotal,
  calculateQuotationTotals,
} = require("../src/services/quotationCalculator");
const { addUtcMonths } = require("../src/services/billingCalculator");

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
    billingType: "ONE_TIME",
    billingCycle: null,
  });
  const setup = await findOrCreateProduct({
    name: "On-site Setup Service",
    category: "Service",
    price: "350.00",
    unit: "service",
    tax: "18.00",
    description: "Installation and onboarding at the customer site",
    billingType: "ONE_TIME",
    billingCycle: null,
  });
  const subscription = await findOrCreateProduct({
    name: "DealFlow Cloud Subscription",
    category: "Software",
    price: "89.00",
    unit: "seat/month",
    tax: "18.00",
    description: "Monthly recurring DealFlow Cloud access",
    billingType: "RECURRING",
    billingCycle: "MONTHLY",
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
      billingType: "ONE_TIME",
      billingCycle: null,
    },
    create: {
      id: "00000000-0000-4000-8000-000000000601",
      name: "MVP3 Backorder Demo Unit",
      category: "Fulfillment Demo",
      price: "100.00",
      unit: "unit",
      tax: "0.00",
      description: "Dedicated zero-stock product for the MVP 3 restock demonstration",
      billingType: "ONE_TIME",
      billingCycle: null,
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

  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const activeSubscriptionStart = addDays(today, -10);
  const cancelledCycleStart = addDays(today, -15);
  const cancelledNextBillingDate = addDays(today, 15);
  const mvp4Scenarios = [
    {
      id: "00000000-0000-4000-8000-000000000501",
      customerName: "MVP4 Ready to Generate Billing",
      status: "APPROVED",
      lines: [
        {
          id: "00000000-0000-4000-8000-000000000511",
          product: laptop,
          qty: 1,
          discountPercent: "0.00",
        },
        {
          id: "00000000-0000-4000-8000-000000000512",
          product: subscription,
          qty: 2,
          discountPercent: "0.00",
        },
      ],
      invoices: [],
      schedules: [],
      creditNotes: [],
    },
    {
      id: "00000000-0000-4000-8000-000000000502",
      customerName: "MVP4 Active Hybrid Billing",
      status: "APPROVED",
      lines: [
        {
          id: "00000000-0000-4000-8000-000000000513",
          product: laptop,
          qty: 1,
          discountPercent: "0.00",
        },
        {
          id: "00000000-0000-4000-8000-000000000514",
          product: subscription,
          qty: 5,
          discountPercent: "0.00",
          subscriptionStartDate: activeSubscriptionStart,
        },
      ],
      invoices: [{
        id: "00000000-0000-4000-8000-000000000521",
        amount: "1299.00",
        type: "ONE_TIME",
        paid: false,
      }],
      schedules: [0, 1, 2, 3].map((monthOffset, index) => ({
        id: `00000000-0000-4000-8000-${String(531 + index).padStart(12, "0")}`,
        quotationLineId: "00000000-0000-4000-8000-000000000514",
        billingDate: addUtcMonths(activeSubscriptionStart, monthOffset),
        amount: "445.00",
        status: "PENDING",
      })),
      creditNotes: [{
        id: "00000000-0000-4000-8000-000000000541",
        quotationLineId: "00000000-0000-4000-8000-000000000514",
        amount: "44.50",
        reason: "Quantity reduced from 6 to 5",
      }],
    },
    {
      id: "00000000-0000-4000-8000-000000000503",
      customerName: "MVP4 Cancelled Subscription",
      status: "FULFILLED",
      lines: [
        {
          id: "00000000-0000-4000-8000-000000000515",
          product: setup,
          qty: 1,
          discountPercent: "0.00",
        },
        {
          id: "00000000-0000-4000-8000-000000000516",
          product: subscription,
          qty: 0,
          discountPercent: "0.00",
          subscriptionStartDate: cancelledCycleStart,
        },
      ],
      invoices: [{
        id: "00000000-0000-4000-8000-000000000522",
        amount: "350.00",
        type: "ONE_TIME",
        paid: true,
      }],
      schedules: [
        {
          id: "00000000-0000-4000-8000-000000000535",
          quotationLineId: "00000000-0000-4000-8000-000000000516",
          billingDate: cancelledCycleStart,
          amount: "178.00",
          status: "BILLED",
        },
        ...[0, 1, 2].map((monthOffset, index) => ({
          id: `00000000-0000-4000-8000-${String(536 + index).padStart(12, "0")}`,
          quotationLineId: "00000000-0000-4000-8000-000000000516",
          billingDate: addUtcMonths(cancelledNextBillingDate, monthOffset),
          amount: "178.00",
          status: "CANCELLED",
        })),
      ],
      creditNotes: [{
        id: "00000000-0000-4000-8000-000000000542",
        quotationLineId: "00000000-0000-4000-8000-000000000516",
        amount: "89.00",
        reason: "Subscription cancelled",
      }],
    },
  ];

  for (const scenario of mvp4Scenarios) {
    await seedMvp4Quotation({ ...scenario, repId: rep.id, discountTier: approvalTier });
  }

  console.log(
    `Seeded demo users, catalog, discount rules, ${mvp2Scenarios.length} MVP 2 scenarios, ${mvp3Scenarios.length} MVP 3 scenarios, and ${mvp4Scenarios.length} MVP 4 billing scenarios`,
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
    await clearQuotationDependents(tx, id);
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
    await clearQuotationDependents(tx, id);
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

async function seedMvp4Quotation({
  id,
  customerName,
  repId,
  status,
  lines,
  invoices,
  schedules,
  creditNotes,
  discountTier,
}) {
  const calculatedLines = lines.map((line) => ({
    ...line,
    productId: line.product.id,
    unitPrice: line.product.price,
    billingType: line.product.billingType,
    billingCycle: line.product.billingCycle,
  }));
  const totals = calculateQuotationTotals(calculatedLines);
  const blendedRiskScore = calculateBlendedRiskScore(calculatedLines, discountTier);

  await prisma.$transaction(async (tx) => {
    await clearQuotationDependents(tx, id);
    await tx.quotation.upsert({
      where: { id },
      update: { customerName, repId, status, ...totals, blendedRiskScore },
      create: { id, customerName, repId, status, ...totals, blendedRiskScore },
    });
    await tx.quotationLine.createMany({
      data: calculatedLines.map((line) => ({
        id: line.id,
        quotationId: id,
        productId: line.productId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        lineTotal: calculateLineTotal(line).lineTotal,
        billingType: line.billingType,
        billingCycle: line.billingCycle,
        subscriptionStartDate: line.subscriptionStartDate || null,
      })),
    });
    if (invoices.length) {
      await tx.invoice.createMany({
        data: invoices.map((invoice) => ({ ...invoice, quotationId: id })),
      });
    }
    if (schedules.length) await tx.billingScheduleEntry.createMany({ data: schedules });
    if (creditNotes.length) await tx.creditNote.createMany({ data: creditNotes });
  });
}

async function clearQuotationDependents(tx, quotationId) {
  const lineIds = (await tx.quotationLine.findMany({
    where: { quotationId },
    select: { id: true },
  })).map((line) => line.id);
  if (lineIds.length) {
    await tx.billingScheduleEntry.deleteMany({ where: { quotationLineId: { in: lineIds } } });
    await tx.creditNote.deleteMany({ where: { quotationLineId: { in: lineIds } } });
  }
  await tx.invoice.deleteMany({ where: { quotationId } });
  await tx.fulfillmentSplit.deleteMany({ where: { quotationId } });
  await tx.approvalLog.deleteMany({ where: { quotationId } });
  await tx.quotationLine.deleteMany({ where: { quotationId } });
}

function addDays(date, days) {
  const target = new Date(date);
  target.setUTCDate(target.getUTCDate() + days);
  return target;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
