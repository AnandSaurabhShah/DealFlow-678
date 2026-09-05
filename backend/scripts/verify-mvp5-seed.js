require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const [customerA, customerB, quotations] = await Promise.all([
    prisma.customer.findUnique({ where: { email: "customer.a@dealflow360.test" } }),
    prisma.customer.findUnique({ where: { email: "customer.b@dealflow360.test" } }),
    prisma.quotation.findMany({
      where: { id: { in: [
        "00000000-0000-4000-8000-000000000701",
        "00000000-0000-4000-8000-000000000702",
        "00000000-0000-4000-8000-000000000703",
      ] } },
      include: { lines: true, negotiationEvents: true },
    }),
  ]);
  expect(customerA && customerB, "Both MVP5 customers must exist");
  expect(quotations.length === 3, "Expected three MVP5 quotations");
  expect(quotations.every((quotation) => quotation.customerId), "Every MVP5 quotation must be linked");
  expect(quotations.every((quotation) => quotation.lines.length === 1), "Every MVP5 quotation must have one line");
  const customerBQuote = quotations.find((quotation) => quotation.id.endsWith("703"));
  expect(customerBQuote.status === "SENT_TO_CUSTOMER", "Customer B quotation must be portal-ready");
  expect(customerBQuote.negotiationEvents.length === 1, "Customer B send audit must exist");
  console.log("MVP 5 seed verified: two customers, isolation quote, and two approval scenarios");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
