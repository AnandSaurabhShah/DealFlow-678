require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const queries = {
    User: prisma.user.count(),
    Customer: prisma.customer.count(),
    Product: prisma.product.count(),
    PriceList: prisma.priceList.count(),
    Warehouse: prisma.warehouse.count(),
    StockLevel: prisma.stockLevel.count(),
    DiscountTier: prisma.discountTier.count(),
    CategoryDiscountOverride: prisma.categoryDiscountOverride.count(),
    Quotation: prisma.quotation.count(),
    QuotationLine: prisma.quotationLine.count(),
    ApprovalLog: prisma.approvalLog.count(),
    NegotiationComment: prisma.negotiationComment.count(),
    NegotiationEvent: prisma.negotiationEvent.count(),
    FulfillmentSplit: prisma.fulfillmentSplit.count(),
    BillingScheduleEntry: prisma.billingScheduleEntry.count(),
    Invoice: prisma.invoice.count(),
    CreditNote: prisma.creditNote.count(),
  };
  const values = await Promise.all(Object.values(queries));
  const counts = Object.fromEntries(
    Object.keys(queries).map((model, index) => [model, values[index]]),
  );
  for (const [model, count] of Object.entries(counts)) {
    expect(count >= 150, `${model} requires at least 150 rows; found ${count}`);
  }

  const [
    quotationStatuses,
    commentAuthors,
    eventActions,
    scheduleStatuses,
    invoiceTypes,
    paidInvoices,
    unpaidInvoices,
    backorders,
    demoRep,
  ] = await Promise.all([
    prisma.quotation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.negotiationComment.groupBy({ by: ["authorType"], _count: { _all: true } }),
    prisma.negotiationEvent.groupBy({ by: ["action"], _count: { _all: true } }),
    prisma.billingScheduleEntry.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.invoice.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.invoice.count({ where: { paid: true } }),
    prisma.invoice.count({ where: { paid: false } }),
    prisma.fulfillmentSplit.count({ where: { qtyBackordered: { gt: 0 } } }),
    prisma.user.findUnique({ where: { email: "rep@dealflow360.test" } }),
  ]);
  const demoRepQuotationCount = await prisma.quotation.count({ where: { repId: demoRep.id } });

  for (const status of [
    "DRAFT",
    "PENDING_MANAGER_APPROVAL",
    "PENDING_FINANCE_APPROVAL",
    "APPROVED",
    "REJECTED",
    "FULFILLED",
    "SENT_TO_CUSTOMER",
    "UNDER_NEGOTIATION",
  ]) {
    expect(quotationStatuses.some((item) => item.status === status), `Missing ${status} quotation`);
  }
  expect(commentAuthors.length === 2, "Negotiation comments require customer and internal authors");
  expect(eventActions.length === 4, "Negotiation events require all MVP5 action types");
  expect(scheduleStatuses.length === 3, "Billing schedules require pending, billed, and cancelled states");
  expect(invoiceTypes.length === 2, "Invoices require one-time and recurring types");
  expect(paidInvoices > 0 && unpaidInvoices > 0, "Invoices require paid and unpaid examples");
  expect(backorders > 0, "Fulfillment requires a backorder example");
  expect(demoRepQuotationCount >= 150, "Demo rep must be able to browse the full load set");

  const portalReady = await prisma.quotation.findFirst({
    where: {
      status: "SENT_TO_CUSTOMER",
      customerId: { not: null },
      negotiationComments: { some: {} },
      negotiationEvents: { some: {} },
    },
    include: { customer: true, negotiationComments: true, negotiationEvents: true },
  });
  expect(portalReady?.customer, "Portal-ready quotation must have a customer");
  expect(portalReady.negotiationComments.length > 0, "Portal-ready quotation needs comments");
  expect(portalReady.negotiationEvents.length > 0, "Portal-ready quotation needs audit events");

  console.log("Final seed verified: every Prisma model has at least 150 rows");
  console.table(counts);
  console.log(`Demo rep quotation rows: ${demoRepQuotationCount}`);
  console.log("Workflow coverage verified through MVP 5");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
