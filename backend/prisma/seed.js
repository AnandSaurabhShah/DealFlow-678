require("dotenv").config();

const bcrypt = require("bcrypt");
const { Prisma, PrismaClient } = require("@prisma/client");
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
  const [
    adminPasswordHash,
    repPasswordHash,
    managerPasswordHash,
    financePasswordHash,
    customerPasswordHash,
    customerBPasswordHash,
  ] = await Promise.all([
    bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "Admin123!", 12),
    bcrypt.hash(process.env.SEED_REP_PASSWORD || "Rep12345!", 12),
    bcrypt.hash(process.env.SEED_MANAGER_PASSWORD || "Manager123!", 12),
    bcrypt.hash(process.env.SEED_FINANCE_PASSWORD || "Finance123!", 12),
    bcrypt.hash(process.env.SEED_CUSTOMER_PASSWORD || "Customer123!", 12),
    bcrypt.hash(process.env.SEED_CUSTOMER_B_PASSWORD || "CustomerB123!", 12),
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

  const customerA = await prisma.customer.upsert({
    where: { email: "customer.a@dealflow360.test" },
    update: { name: "Demo Customer A", passwordHash: customerPasswordHash },
    create: {
      id: "00000000-0000-4000-8000-000000000801",
      name: "Demo Customer A",
      email: "customer.a@dealflow360.test",
      passwordHash: customerPasswordHash,
    },
  });
  const customerB = await prisma.customer.upsert({
    where: { email: "customer.b@dealflow360.test" },
    update: { name: "Demo Customer B", passwordHash: customerBPasswordHash },
    create: {
      id: "00000000-0000-4000-8000-000000000802",
      name: "Demo Customer B",
      email: "customer.b@dealflow360.test",
      passwordHash: customerBPasswordHash,
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

  const mvp5Scenarios = [
    {
      id: "00000000-0000-4000-8000-000000000701",
      customer: customerA,
      status: "APPROVED",
      sentToCustomerAt: null,
      lines: [{
        id: "00000000-0000-4000-8000-000000000711",
        product: setup,
        qty: 2,
        discountPercent: "8.00",
      }],
    },
    {
      id: "00000000-0000-4000-8000-000000000702",
      customer: customerA,
      status: "APPROVED",
      sentToCustomerAt: null,
      lines: [{
        id: "00000000-0000-4000-8000-000000000712",
        product: setup,
        qty: 3,
        discountPercent: "8.00",
      }],
    },
    {
      id: "00000000-0000-4000-8000-000000000703",
      customer: customerB,
      status: "SENT_TO_CUSTOMER",
      sentToCustomerAt: new Date("2026-09-06T08:00:00.000Z"),
      lines: [{
        id: "00000000-0000-4000-8000-000000000713",
        product: setup,
        qty: 1,
        discountPercent: "5.00",
      }],
    },
  ];
  for (const scenario of mvp5Scenarios) {
    await seedMvp5Quotation({ ...scenario, repId: rep.id, internalActorId: rep.id });
  }

  await seedFinalLoadData({
    passwordHashes: {
      ADMIN: adminPasswordHash,
      REP: repPasswordHash,
      MANAGER: managerPasswordHash,
      FINANCE: financePasswordHash,
    },
    customerPasswordHash,
    demoRepId: rep.id,
    managerId: manager.id,
    financeId: finance.id,
  });

  console.log(
    "Seeded focused MVP 1-5 scenarios plus at least 150 deterministic rows for every table",
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
        customerId: null,
        repId,
        status,
        sentToCustomerAt: null,
        approvalRound: 0,
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
      update: {
        customerName,
        customerId: null,
        repId,
        status,
        sentToCustomerAt: null,
        approvalRound: 0,
        ...totals,
        blendedRiskScore,
      },
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
      update: {
        customerName,
        customerId: null,
        repId,
        status,
        sentToCustomerAt: null,
        approvalRound: 0,
        ...totals,
        blendedRiskScore,
      },
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

async function seedMvp5Quotation({
  id,
  customer,
  repId,
  status,
  sentToCustomerAt,
  lines,
  internalActorId,
}) {
  const calculatedLines = lines.map((line) => ({
    ...line,
    productId: line.product.id,
    unitPrice: line.product.price,
    billingType: line.product.billingType,
    billingCycle: line.product.billingCycle,
  }));
  const totals = calculateQuotationTotals(calculatedLines);
  await prisma.$transaction(async (tx) => {
    await clearQuotationDependents(tx, id);
    await tx.quotation.upsert({
      where: { id },
      update: {
        customerName: customer.name,
        customerId: customer.id,
        repId,
        status,
        sentToCustomerAt,
        approvalRound: 0,
        blendedRiskScore: 0,
        ...totals,
      },
      create: {
        id,
        customerName: customer.name,
        customerId: customer.id,
        repId,
        status,
        sentToCustomerAt,
        approvalRound: 0,
        blendedRiskScore: 0,
        ...totals,
      },
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
      })),
    });
    if (sentToCustomerAt) {
      await tx.negotiationEvent.create({
        data: {
          quotationId: id,
          actorType: "INTERNAL",
          actorId: internalActorId,
          action: "SENT_TO_CUSTOMER",
          details: { customerId: customer.id, seeded: true },
          createdAt: sentToCustomerAt,
        },
      });
    }
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
  await tx.negotiationComment.deleteMany({ where: { quotationId } });
  await tx.negotiationEvent.deleteMany({ where: { quotationId } });
  await tx.invoice.deleteMany({ where: { quotationId } });
  await tx.fulfillmentSplit.deleteMany({ where: { quotationId } });
  await tx.approvalLog.deleteMany({ where: { quotationId } });
  await tx.quotationLine.deleteMany({ where: { quotationId } });
}

async function seedFinalLoadData({
  passwordHashes,
  customerPasswordHash,
  demoRepId,
  managerId,
  financeId,
}) {
  const rowCount = 150;
  const range = Array.from({ length: rowCount }, (_, index) => index + 1);
  const roles = ["REP", "MANAGER", "FINANCE", "ADMIN"];
  const baseDate = new Date();
  baseDate.setUTCHours(12, 0, 0, 0);

  const users = range.map((index) => {
    const role = roles[(index - 1) % roles.length];
    return {
      id: loadId("1", index),
      name: `Load Test ${role} ${pad(index)}`,
      email: `load-${role.toLowerCase()}-${pad(index)}@dealflow360.test`,
      passwordHash: passwordHashes[role],
      role,
    };
  });
  const customers = range.map((index) => ({
    id: loadId("f", index),
    name: `Load Customer ${pad(index)}`,
    email: `load-customer-${pad(index)}@dealflow360.test`,
    passwordHash: customerPasswordHash,
  }));
  const products = range.map((index) => {
    const recurring = index <= 38;
    return {
      id: loadId("2", index),
      name: recurring
        ? `Load Monthly Subscription ${pad(index)}`
        : `Load Business Product ${pad(index)}`,
      category: recurring ? "Software" : index % 3 === 0 ? "Service" : "Hardware",
      price: String(recurring ? 30 + index * 2 : 100 + index * 7),
      unit: recurring ? "seat/month" : index % 3 === 0 ? "service" : "unit",
      tax: index % 2 === 0 ? "18.00" : "12.00",
      description: `Deterministic final-seed product ${index}`,
      billingType: recurring ? "RECURRING" : "ONE_TIME",
      billingCycle: recurring ? "MONTHLY" : null,
    };
  });
  const productById = new Map(products.map((product) => [product.id, product]));
  const priceLists = range.map((index) => ({
    id: loadId("3", index),
    name: `Load Price List ${pad(index)}`,
    customerTier: ["STANDARD", "SILVER", "GOLD"][index % 3],
    currency: "USD",
  }));
  const warehouses = range.map((index) => ({
    id: loadId("4", index),
    name: `Load Warehouse ${pad(index)}`,
    location: `Region ${String((index % 12) + 1).padStart(2, "0")}`,
  }));
  const stockLevels = range.map((index) => ({
    id: loadId("5", index),
    warehouseId: loadId("4", index),
    productId: loadId("2", 39 + ((index - 1) % 112)),
    qty: 100 + (index % 75),
  }));
  const tiers = range.map((index) => ({
    id: loadId("6", index),
    tierName: `Load Tier ${pad(index)}`,
    maxDiscountPercent: String(5 + (index % 21)),
  }));
  const overrides = range.map((index) => ({
    id: loadId("7", index),
    discountTierId: loadId("6", index),
    category: index % 2 === 0 ? "Service" : "Hardware",
    maxDiscountPercent: String(3 + (index % 15)),
  }));

  const quotations = [];
  const quotationLines = [];
  const approvalLogs = [];
  const negotiationComments = [];
  const negotiationEvents = [];
  const fulfillmentSplits = [];
  const schedules = [];
  const invoices = [];
  const creditNotes = [];
  let commentIndex = 1;
  let eventIndex = 1;
  let fulfillmentIndex = 1;
  let scheduleIndex = 1;
  let invoiceIndex = 1;
  let creditIndex = 1;

  for (const index of range) {
    const quotationId = loadId("8", index);
    const lineId = loadId("9", index);
    const customerId = loadId("f", index);
    const product = productById.get(loadId("2", index));
    const status = finalLoadStatus(index);
    const fulfilled = status === "FULFILLED";
    const recurringBilled = index <= 25;
    const qty = fulfilled ? 60 : 1 + (index % 8);
    const discountPercent = finalLoadDiscount(status, index);
    const calculated = calculateLineTotal({
      qty,
      unitPrice: product.price,
      discountPercent,
    });
    const approvalRound = [
      "UNDER_NEGOTIATION",
      "PENDING_MANAGER_APPROVAL",
      "PENDING_FINANCE_APPROVAL",
      "REJECTED",
      "DRAFT",
    ].includes(status) ? 1 : 0;
    const sentToCustomerAt = index > 25 ? addDays(baseDate, -(30 + (index % 20))) : null;

    quotations.push({
      id: quotationId,
      customerName: `Load Customer ${pad(index)}`,
      repId: demoRepId,
      customerId,
      status,
      subtotal: calculated.subtotal,
      totalDiscount: calculated.discount,
      grandTotal: calculated.lineTotal,
      blendedRiskScore: finalLoadRiskScore(status),
      approvalRound,
      sentToCustomerAt,
    });
    quotationLines.push({
      id: lineId,
      quotationId,
      productId: product.id,
      qty,
      unitPrice: product.price,
      discountPercent,
      lineTotal: calculated.lineTotal,
      billingType: product.billingType,
      billingCycle: product.billingCycle,
      subscriptionStartDate: recurringBilled ? addUtcMonths(baseDate, -5) : null,
    });

    const approval = finalLoadApproval(status, approvalRound, managerId, financeId);
    approvalLogs.push({
      id: loadId("a", index),
      quotationId,
      ...approval,
      createdAt: addDays(baseDate, -(index + 5)),
    });

    if (index >= 26 && index <= 75) {
      const comments = [
        {
          authorType: "CUSTOMER",
          authorId: customerId,
          quotationLineId: null,
          content: "Could you review the commercial terms for this quotation?",
        },
        {
          authorType: "INTERNAL",
          authorId: demoRepId,
          quotationLineId: null,
          content: "We reviewed your request and can discuss the line discount.",
        },
        {
          authorType: "CUSTOMER",
          authorId: customerId,
          quotationLineId: lineId,
          content: `Please consider the requested ${discountPercent}% discount on this line.`,
        },
      ];
      for (const [commentOffset, comment] of comments.entries()) {
        negotiationComments.push({
          id: loadId("aa", commentIndex),
          quotationId,
          ...comment,
          createdAt: addDays(baseDate, -(8 - commentOffset)),
        });
        commentIndex += 1;
      }
    }

    if (index >= 26 && index <= 50) {
      negotiationEvents.push({
        id: loadId("ab", eventIndex),
        quotationId,
        quotationLineId: null,
        actorType: "INTERNAL",
        actorId: demoRepId,
        action: "SENT_TO_CUSTOMER",
        details: { customerId, seeded: true },
        createdAt: sentToCustomerAt,
      });
      eventIndex += 1;
    }
    if (index >= 51 && index <= 75) {
      const events = [
        ["INTERNAL", demoRepId, "SENT_TO_CUSTOMER", null],
        ["CUSTOMER", customerId, "DISCOUNT_UPDATED", lineId],
        ["CUSTOMER", customerId, "CUSTOMER_CONFIRMED", null],
        ["CUSTOMER", customerId, "APPROVAL_REENTRY", null],
        ["CUSTOMER", customerId, "DISCOUNT_UPDATED", lineId],
      ];
      for (const [eventOffset, [actorType, actorId, action, quotationLineId]] of events.entries()) {
        negotiationEvents.push({
          id: loadId("ab", eventIndex),
          quotationId,
          quotationLineId,
          actorType,
          actorId,
          action,
          details: action === "DISCOUNT_UPDATED"
            ? { previousDiscountPercent: "10", requestedDiscountPercent: discountPercent }
            : { seeded: true },
          createdAt: addDays(baseDate, -(10 - eventOffset)),
        });
        eventIndex += 1;
      }
    }

    if (fulfilled) {
      for (let warehouseIndex = 1; warehouseIndex <= 6; warehouseIndex += 1) {
        fulfillmentSplits.push({
          id: loadId("b", fulfillmentIndex),
          quotationId,
          warehouseId: loadId("4", warehouseIndex),
          productId: product.id,
          qtyFulfilled: 10,
          qtyBackordered: 0,
        });
        fulfillmentIndex += 1;
      }
    }

    if (recurringBilled) {
      for (let cycle = 0; cycle < 6; cycle += 1) {
        const billingDate = addUtcMonths(baseDate, cycle - 2);
        schedules.push({
          id: loadId("c", scheduleIndex),
          quotationLineId: lineId,
          billingDate,
          amount: calculated.lineTotal,
          status: cycle < 2 ? "BILLED" : "PENDING",
          createdAt: addDays(billingDate, -2),
        });
        scheduleIndex += 1;
        creditNotes.push({
          id: loadId("e", creditIndex),
          quotationLineId: lineId,
          amount: new Prisma.Decimal(product.price).mul((cycle % 3) + 1).div(4),
          reason: `Prorated quantity reduction cycle ${cycle + 1}`,
          createdAt: addDays(billingDate, 1),
        });
        creditIndex += 1;
      }
      for (let cycle = 0; cycle < 5; cycle += 1) {
        invoices.push({
          id: loadId("d", invoiceIndex),
          quotationId,
          amount: calculated.lineTotal,
          type: "RECURRING",
          paid: cycle < 4,
          createdAt: addUtcMonths(baseDate, cycle - 4),
        });
        invoiceIndex += 1;
      }
    }
    if (fulfilled) {
      invoices.push({
        id: loadId("d", invoiceIndex),
        quotationId,
        amount: calculated.lineTotal,
        type: "ONE_TIME",
        paid: index % 3 !== 0,
        createdAt: addDays(baseDate, -20),
      });
      invoiceIndex += 1;
    }
  }

  const ids = finalLoadIds(range);
  await prisma.$transaction(async (tx) => {
    await tx.billingScheduleEntry.deleteMany({ where: { quotationLineId: { in: ids.lines } } });
    await tx.creditNote.deleteMany({ where: { quotationLineId: { in: ids.lines } } });
    await tx.negotiationComment.deleteMany({ where: { quotationId: { in: ids.quotations } } });
    await tx.negotiationEvent.deleteMany({ where: { quotationId: { in: ids.quotations } } });
    await tx.invoice.deleteMany({ where: { quotationId: { in: ids.quotations } } });
    await tx.fulfillmentSplit.deleteMany({ where: { quotationId: { in: ids.quotations } } });
    await tx.approvalLog.deleteMany({ where: { quotationId: { in: ids.quotations } } });
    await tx.quotationLine.deleteMany({ where: { quotationId: { in: ids.quotations } } });
    await tx.quotation.deleteMany({ where: { id: { in: ids.quotations } } });
    await tx.stockLevel.deleteMany({ where: { id: { in: ids.stockLevels } } });
    await tx.categoryDiscountOverride.deleteMany({ where: { id: { in: ids.overrides } } });
    await tx.discountTier.deleteMany({ where: { id: { in: ids.tiers } } });
    await tx.warehouse.deleteMany({ where: { id: { in: ids.warehouses } } });
    await tx.product.deleteMany({ where: { id: { in: ids.products } } });
    await tx.priceList.deleteMany({ where: { id: { in: ids.priceLists } } });
    await tx.customer.deleteMany({ where: { id: { in: ids.customers } } });
    await tx.user.deleteMany({ where: { id: { in: ids.users } } });

    await tx.user.createMany({ data: users });
    await tx.customer.createMany({ data: customers });
    await tx.product.createMany({ data: products });
    await tx.priceList.createMany({ data: priceLists });
    await tx.warehouse.createMany({ data: warehouses });
    await tx.stockLevel.createMany({ data: stockLevels });
    await tx.discountTier.createMany({ data: tiers });
    await tx.categoryDiscountOverride.createMany({ data: overrides });
    await tx.quotation.createMany({ data: quotations });
    await tx.quotationLine.createMany({ data: quotationLines });
    await tx.approvalLog.createMany({ data: approvalLogs });
    await tx.negotiationComment.createMany({ data: negotiationComments });
    await tx.negotiationEvent.createMany({ data: negotiationEvents });
    await tx.fulfillmentSplit.createMany({ data: fulfillmentSplits });
    await tx.billingScheduleEntry.createMany({ data: schedules });
    await tx.invoice.createMany({ data: invoices });
    await tx.creditNote.createMany({ data: creditNotes });
  }, { timeout: 30_000 });
}

function finalLoadIds(range) {
  return {
    users: range.map((index) => loadId("1", index)),
    customers: range.map((index) => loadId("f", index)),
    products: range.map((index) => loadId("2", index)),
    priceLists: range.map((index) => loadId("3", index)),
    warehouses: range.map((index) => loadId("4", index)),
    stockLevels: range.map((index) => loadId("5", index)),
    tiers: range.map((index) => loadId("6", index)),
    overrides: range.map((index) => loadId("7", index)),
    quotations: range.map((index) => loadId("8", index)),
    lines: range.map((index) => loadId("9", index)),
  };
}

function finalLoadStatus(index) {
  if (index <= 25) return "APPROVED";
  if (index <= 50) return "SENT_TO_CUSTOMER";
  if (index <= 75) return "UNDER_NEGOTIATION";
  if (index <= 90) return "PENDING_MANAGER_APPROVAL";
  if (index <= 105) return "PENDING_FINANCE_APPROVAL";
  if (index <= 115) return "REJECTED";
  if (index <= 125) return "DRAFT";
  return "FULFILLED";
}

function finalLoadDiscount(status, index) {
  if (status === "PENDING_MANAGER_APPROVAL") return "18";
  if (status === "PENDING_FINANCE_APPROVAL" || status === "REJECTED") return "30";
  if (status === "UNDER_NEGOTIATION") return String(16 + (index % 10));
  return String(index % 3 === 0 ? 5 : 0);
}

function finalLoadRiskScore(status) {
  if (status === "PENDING_MANAGER_APPROVAL") return "5";
  if (status === "PENDING_FINANCE_APPROVAL" || status === "REJECTED") return "15";
  return "0";
}

function finalLoadApproval(status, approvalRound, managerId, financeId) {
  if (status === "PENDING_MANAGER_APPROVAL") {
    return {
      actorId: managerId,
      action: "RETURNED",
      approvalRound: Math.max(0, approvalRound - 1),
      reason: "Previous customer request was returned for revision",
    };
  }
  if (status === "PENDING_FINANCE_APPROVAL") {
    return {
      actorId: managerId,
      action: "APPROVED",
      approvalRound,
      reason: null,
    };
  }
  if (status === "REJECTED") {
    return {
      actorId: managerId,
      action: "REJECTED",
      approvalRound,
      reason: "Requested discount is not commercially viable",
    };
  }
  if (status === "DRAFT") {
    return {
      actorId: managerId,
      action: "RETURNED",
      approvalRound,
      reason: "Please revise the quotation terms",
    };
  }
  return {
    actorId: status === "FULFILLED" ? financeId : managerId,
    action: "APPROVED",
    approvalRound,
    reason: null,
  };
}

function pad(index) {
  return String(index).padStart(3, "0");
}

function loadId(prefix, index) {
  return `${prefix.padEnd(8, "0")}-0000-4000-8000-${String(index).padStart(12, "0")}`;
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
