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

async function loadScenario(id) {
  return prisma.quotation.findUnique({
    where: { id },
    include: {
      lines: {
        include: { billingScheduleEntries: true, creditNotes: true },
      },
      invoices: true,
    },
  });
}

async function main() {
  const [ready, active, cancelled] = await Promise.all([
    loadScenario("00000000-0000-4000-8000-000000000501"),
    loadScenario("00000000-0000-4000-8000-000000000502"),
    loadScenario("00000000-0000-4000-8000-000000000503"),
  ]);

  expect(ready?.lines.length === 2, "Ready-to-generate scenario must have two lines");
  expect(ready.invoices.length === 0, "Ready-to-generate scenario must not have an invoice yet");
  expect(
    ready.lines.every((line) => line.billingScheduleEntries.length === 0),
    "Ready-to-generate scenario must not have schedule entries yet",
  );

  const activeRecurring = active?.lines.find((line) => line.billingType === "RECURRING");
  expect(active?.lines.some((line) => line.billingType === "ONE_TIME"), "Active scenario needs a one-time line");
  expect(activeRecurring, "Active scenario needs a recurring line");
  expect(active.invoices.length === 1 && !active.invoices[0].paid, "Active invoice must be unpaid");
  expect(activeRecurring.billingScheduleEntries.length === 4, "Active schedule must have four entries");
  expect(activeRecurring.creditNotes.length === 1, "Active scenario must show a proration credit");

  const cancelledRecurring = cancelled?.lines.find((line) => line.billingType === "RECURRING");
  expect(cancelledRecurring?.qty === 0, "Cancelled subscription quantity must be zero");
  expect(cancelled.invoices.length === 1 && cancelled.invoices[0].paid, "Cancelled example invoice must be paid");
  expect(
    cancelledRecurring.billingScheduleEntries.filter((entry) => entry.status === "BILLED").length === 1,
    "Cancelled example needs one billed schedule entry",
  );
  expect(
    cancelledRecurring.billingScheduleEntries.filter((entry) => entry.status === "CANCELLED").length === 3,
    "Cancelled example needs three cancelled schedule entries",
  );
  expect(cancelledRecurring.creditNotes.length === 1, "Cancelled example needs a cancellation credit");

  console.log("MVP 4 seed verified: ready, active, adjusted, paid, and cancelled billing states");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
