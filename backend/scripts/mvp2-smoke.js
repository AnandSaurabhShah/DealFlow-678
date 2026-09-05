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

async function login(email, password) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  expect(response.status === 200, `Login failed for ${email}`);
  return response.body.token;
}

const auth = (token) => ({ authorization: `Bearer ${token}` });

async function createSubmittedQuote(repToken, products, discounts, customerName) {
  const created = await request("/api/quotations", {
    method: "POST",
    headers: auth(repToken),
    body: JSON.stringify({ customerName }),
  });
  expect(created.status === 201, `Could not create ${customerName}`);

  const updated = await request(`/api/quotations/${created.body.data.id}`, {
    method: "PUT",
    headers: auth(repToken),
    body: JSON.stringify({
      lines: products.map((product, index) => ({
        productId: product.id,
        qty: 1,
        discountPercent: discounts[index],
      })),
    }),
  });
  expect(updated.status === 200, `Could not add lines to ${customerName}`);

  const submitted = await request(`/api/quotations/${created.body.data.id}/confirm`, {
    method: "POST",
    headers: auth(repToken),
  });
  expect(submitted.status === 200, `Could not submit ${customerName}`);
  return submitted.body.data;
}

async function main() {
  expect(process.env.DATABASE_URL, "DATABASE_URL is required");
  const [repToken, managerToken, financeToken] = await Promise.all([
    login("rep@dealflow360.test", process.env.SEED_REP_PASSWORD || "Rep12345!"),
    login("manager@dealflow360.test", process.env.SEED_MANAGER_PASSWORD || "Manager123!"),
    login("finance@dealflow360.test", process.env.SEED_FINANCE_PASSWORD || "Finance123!"),
  ]);

  const catalog = await request("/api/products", { headers: auth(repToken) });
  const hardware = catalog.body.data.find((product) => product.category === "HARDWARE");
  const service = catalog.body.data.find((product) => product.category === "SERVICE");
  expect(hardware && service, "Seeded Hardware and Service products are required");

  const moderate = await createSubmittedQuote(
    repToken,
    [hardware, service],
    [15, 18],
    `MVP2 moderate ${Date.now()}`,
  );
  expect(moderate.status === "PENDING_MANAGER_APPROVAL", "PS example did not route to Manager");
  expect(Number(moderate.blendedRiskScore) === 8, "PS example risk score was not 8");

  const managerPending = await request(`/api/quotations/pending?quotationId=${moderate.id}`, { headers: auth(managerToken) });
  const financePendingBefore = await request(`/api/quotations/pending?quotationId=${moderate.id}`, { headers: auth(financeToken) });
  expect(managerPending.body.data.some((quote) => quote.id === moderate.id), "Manager cannot see pending quote");
  expect(!financePendingBefore.body.data.some((quote) => quote.id === moderate.id), "Finance saw manager-only quote");

  const wrongRole = await request(`/api/quotations/${moderate.id}/approve`, {
    method: "POST",
    headers: auth(financeToken),
  });
  expect(wrongRole.status === 403, "Finance could approve a manager-pending quotation");

  const managerApproval = await request(`/api/quotations/${moderate.id}/approve`, {
    method: "POST",
    headers: auth(managerToken),
  });
  expect(managerApproval.body.data.status === "APPROVED", "Manager approval did not complete moderate risk");

  const high = await createSubmittedQuote(
    repToken,
    [hardware, service],
    [30, 18],
    `MVP2 high ${Date.now()}`,
  );
  expect(high.status === "PENDING_FINANCE_APPROVAL", "High risk did not route toward Finance");
  const financeBeforeManager = await request(`/api/quotations/pending?quotationId=${high.id}`, { headers: auth(financeToken) });
  expect(!financeBeforeManager.body.data.some((quote) => quote.id === high.id), "Finance saw high risk before Manager");

  const highManagerApproval = await request(`/api/quotations/${high.id}/approve`, {
    method: "POST",
    headers: auth(managerToken),
  });
  expect(highManagerApproval.body.data.status === "PENDING_FINANCE_APPROVAL", "High risk skipped Finance");
  const financeAfterManager = await request(`/api/quotations/pending?quotationId=${high.id}`, { headers: auth(financeToken) });
  expect(financeAfterManager.body.data.some((quote) => quote.id === high.id), "Finance cannot see manager-approved high risk");

  const financeApproval = await request(`/api/quotations/${high.id}/approve`, {
    method: "POST",
    headers: auth(financeToken),
  });
  expect(financeApproval.body.data.status === "APPROVED", "Finance approval did not complete high risk");

  const returned = await createSubmittedQuote(repToken, [service], [18], `MVP2 return ${Date.now()}`);
  const missingReason = await request(`/api/quotations/${returned.id}/return`, {
    method: "POST",
    headers: auth(managerToken),
    body: JSON.stringify({}),
  });
  expect(missingReason.status === 400, "Return accepted a missing reason");
  const returnAction = await request(`/api/quotations/${returned.id}/return`, {
    method: "POST",
    headers: auth(managerToken),
    body: JSON.stringify({ reason: "Please revise the service discount" }),
  });
  expect(returnAction.body.data.status === "DRAFT", "Return did not restore draft status");

  const rejected = await createSubmittedQuote(repToken, [service], [18], `MVP2 reject ${Date.now()}`);
  const rejectAction = await request(`/api/quotations/${rejected.id}/reject`, {
    method: "POST",
    headers: auth(managerToken),
    body: JSON.stringify({ reason: "Discount is not commercially viable" }),
  });
  expect(rejectAction.body.data.status === "REJECTED", "Reject did not set rejected status");

  const logs = await prisma.approvalLog.findMany({
    where: { quotationId: { in: [moderate.id, high.id, returned.id, rejected.id] } },
    include: { actor: true },
  });
  expect(logs.length === 5, `Expected 5 approval logs, found ${logs.length}`);
  expect(logs.some((log) => log.action === "RETURNED" && log.reason), "Return log is missing");
  expect(logs.some((log) => log.action === "REJECTED" && log.reason), "Reject log is missing");

  const history = await request(`/api/quotations/${high.id}/history`, {
    headers: auth(repToken),
  });
  expect(history.status === 200 && history.body.data.length === 2, "History did not return both approvals");
  expect(
    history.body.data[0].actor.role === "MANAGER" &&
      history.body.data[1].actor.role === "FINANCE",
    "History is not in Manager-to-Finance order",
  );
  expect(
    history.body.data.every((log) => log.actor.name && !("passwordHash" in log.actor)),
    "History actor shape is unsafe or incomplete",
  );

  const otherRep = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "Other Smoke Rep",
      email: `other-rep-${Date.now()}@dealflow360.test`,
      password: "OtherRep123!",
      role: "REP",
    }),
  });
  const forbiddenHistory = await request(`/api/quotations/${high.id}/history`, {
    headers: auth(otherRep.body.token),
  });
  expect(forbiddenHistory.status === 403, "A rep could read another rep's approval history");

  console.log("MVP 2 smoke checks passed: risk routing, actions, logs, and history access");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
