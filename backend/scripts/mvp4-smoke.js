require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const baseUrl = process.env.API_BASE_URL || "http://localhost:4000";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  return { status: response.status, body: await response.json() };
}

async function main() {
  expect(process.env.DATABASE_URL, "DATABASE_URL is required");
  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "rep@dealflow360.test",
      password: process.env.SEED_REP_PASSWORD || "Rep12345!",
    }),
  });
  expect(login.status === 200, "Rep login failed");
  const headers = { authorization: `Bearer ${login.body.token}` };

  const [oneTimeProduct, recurringProduct] = await Promise.all([
    prisma.product.findFirst({ where: { billingType: "ONE_TIME", category: "Hardware" } }),
    prisma.product.findFirst({ where: { billingType: "RECURRING", billingCycle: "MONTHLY" } }),
  ]);
  expect(oneTimeProduct, "A seeded one-time product is required");
  expect(recurringProduct, "A seeded monthly recurring product is required");

  const created = await request("/api/quotations", {
    method: "POST",
    headers,
    body: JSON.stringify({ customerName: `MVP4 Mixed Billing ${Date.now()}` }),
  });
  expect(created.status === 201, "Mixed quotation creation failed");
  const quotationId = created.body.data.id;

  const updated = await request(`/api/quotations/${quotationId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      lines: [
        { productId: oneTimeProduct.id, qty: 1, discountPercent: 0 },
        { productId: recurringProduct.id, qty: 2, discountPercent: 0 },
      ],
    }),
  });
  expect(updated.status === 200, "Could not add mixed billing lines");
  const recurringLine = updated.body.data.lines.find((line) => line.billingType === "RECURRING");
  expect(recurringLine?.billingCycle === "MONTHLY", "Recurring billing snapshot was not saved");

  const approved = await request(`/api/quotations/${quotationId}/confirm`, {
    method: "POST",
    headers,
  });
  expect(approved.status === 200 && approved.body.data.status === "APPROVED", "Quote was not approved");

  const generated = await request(`/api/quotations/${quotationId}/billing/generate`, {
    method: "POST",
    headers,
  });
  expect(generated.status === 201, "Billing generation failed");
  expect(generated.body.data.oneTimeLines.length === 1, "One-time line was not separated");
  expect(generated.body.data.recurringLines.length === 1, "Recurring line was not separated");
  expect(
    generated.body.data.oneTimeLines.every((line) => line.billingType === "ONE_TIME"),
    "One-time section contains a recurring line",
  );
  expect(
    generated.body.data.recurringLines.every((line) => line.billingType === "RECURRING"),
    "Recurring section contains a one-time line",
  );
  expect(generated.body.data.oneTimeInvoices.length === 1, "One-time invoice was not created");
  expect(
    generated.body.data.oneTimeInvoices.every((invoice) => invoice.type === "ONE_TIME"),
    "One-time invoice section contains the wrong invoice type",
  );
  expect(
    generated.body.data.recurringLines[0].billingScheduleEntries.length === 4,
    "Four monthly schedule entries were not created",
  );

  const duplicate = await request(`/api/quotations/${quotationId}/billing/generate`, {
    method: "POST",
    headers,
  });
  expect(
    duplicate.status === 409 && duplicate.body.error.code === "BILLING_ALREADY_GENERATED",
    "Duplicate billing generation was not rejected",
  );

  const increased = await request(
    `/api/quotations/${quotationId}/lines/${recurringLine.id}/quantity`,
    { method: "PUT", headers, body: JSON.stringify({ qty: 3 }) },
  );
  expect(increased.status === 200, "Recurring quantity increase failed");
  expect(increased.body.data.proration.type === "SCHEDULE_ENTRY", "Increase did not create a charge");
  expect(increased.body.data.scheduleEntry, "Prorated schedule entry was not persisted");

  const decreased = await request(
    `/api/quotations/${quotationId}/lines/${recurringLine.id}/quantity`,
    { method: "PUT", headers, body: JSON.stringify({ qty: 1 }) },
  );
  expect(decreased.status === 200, "Recurring quantity decrease failed");
  expect(decreased.body.data.proration.type === "CREDIT_NOTE", "Decrease did not create a credit");
  expect(decreased.body.data.creditNote, "Prorated credit note was not persisted");

  const invoiceId = generated.body.data.oneTimeInvoices[0].id;
  const payment = await request(`/api/invoices/${invoiceId}/pay`, { method: "POST", headers });
  expect(payment.status === 200 && payment.body.data.paid, "Invoice was not marked paid");

  const cancelled = await request(
    `/api/quotations/${quotationId}/lines/${recurringLine.id}/cancel`,
    { method: "POST", headers },
  );
  expect(cancelled.status === 200, "Recurring cancellation failed");
  expect(cancelled.body.data.line.qty === 0, "Cancellation did not zero the recurring quantity");
  expect(cancelled.body.data.cancelledEntries.length === 3, "Future monthly entries were not cancelled");
  expect(cancelled.body.data.creditNote, "Cancellation credit note was not created");

  const billing = await request(`/api/quotations/${quotationId}/billing`, { headers });
  expect(billing.status === 200, "Billing read failed");
  expect(billing.body.data.oneTimeInvoices[0].paid, "Paid state was not returned");
  expect(
    billing.body.data.recurringLines[0].billingScheduleEntries
      .filter((entry) => entry.status === "CANCELLED").length === 3,
    "Cancelled schedule state was not returned",
  );

  console.log("MVP 4 smoke checks passed: hybrid billing, proration, cancellation, and payment");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
