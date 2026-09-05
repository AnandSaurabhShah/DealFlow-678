require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const baseUrl = process.env.API_BASE_URL || "http://localhost:4000";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const quoteAOver = "00000000-0000-4000-8000-000000000701";
const quoteAWithin = "00000000-0000-4000-8000-000000000702";
const quoteB = "00000000-0000-4000-8000-000000000703";
const lineAOver = "00000000-0000-4000-8000-000000000711";
const lineAWithin = "00000000-0000-4000-8000-000000000712";
const lineB = "00000000-0000-4000-8000-000000000713";

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

async function login(path, email, password) {
  const response = await request(path, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  expect(response.status === 200, `Login failed for ${email}: ${response.status}`);
  return response.body.token;
}

function auth(token) {
  return { authorization: `Bearer ${token}` };
}

async function main() {
  const signupEmail = `mvp5.signup.${Date.now()}@dealflow360.test`;
  const signup = await request("/api/customer-auth/signup", {
    method: "POST",
    body: JSON.stringify({ name: "MVP5 Signup", email: signupEmail, password: "Signup123!" }),
  });
  expect(signup.status === 201 && signup.body.customer.email === signupEmail, "Customer signup failed");
  expect(!("passwordHash" in signup.body.customer), "Customer signup exposed passwordHash");
  const duplicateSignup = await request("/api/customer-auth/signup", {
    method: "POST",
    body: JSON.stringify({ name: "Duplicate", email: signupEmail, password: "Signup123!" }),
  });
  expect(duplicateSignup.status === 409 && duplicateSignup.body.error.code === "EMAIL_IN_USE", "Duplicate customer email was accepted");

  const [repToken, managerToken, financeToken, customerAToken, customerBToken] = await Promise.all([
    login("/api/auth/login", "rep@dealflow360.test", process.env.SEED_REP_PASSWORD || "Rep12345!"),
    login("/api/auth/login", "manager@dealflow360.test", process.env.SEED_MANAGER_PASSWORD || "Manager123!"),
    login("/api/auth/login", "finance@dealflow360.test", process.env.SEED_FINANCE_PASSWORD || "Finance123!"),
    login("/api/customer-auth/login", "customer.a@dealflow360.test", process.env.SEED_CUSTOMER_PASSWORD || "Customer123!"),
    login("/api/customer-auth/login", "customer.b@dealflow360.test", process.env.SEED_CUSTOMER_B_PASSWORD || "CustomerB123!"),
  ]);

  const internalOnPortal = await request(`/api/portal/quotations/${quoteB}`, { headers: auth(repToken) });
  expect(internalOnPortal.status === 401, "Internal token reached a customer-only endpoint");
  const customerOnInternal = await request("/api/quotations", { headers: auth(customerAToken) });
  expect(customerOnInternal.status === 401, "Customer token reached an internal endpoint");
  const malformed = await request(`/api/portal/quotations/${quoteB}`, { headers: auth("malformed") });
  expect(malformed.status === 401, "Malformed customer token was accepted");
  await prisma.customer.delete({ where: { email: signupEmail } });
  const deletedCustomer = await request(`/api/portal/quotations/${quoteB}`, { headers: auth(signup.body.token) });
  expect(deletedCustomer.status === 401, "Token for a deleted customer was accepted");

  const customerA = await prisma.customer.findUniqueOrThrow({ where: { email: "customer.a@dealflow360.test" } });
  const otherRep = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "MVP5 Other Rep",
      email: `mvp5.rep.${Date.now()}@dealflow360.test`,
      password: "OtherRep123!",
      role: "REP",
    }),
  });
  const otherRepDenied = await request(`/api/quotations/${quoteAOver}/send-to-customer`, {
    method: "POST",
    headers: auth(otherRep.body.token),
    body: JSON.stringify({ customerId: customerA.id }),
  });
  expect(otherRepDenied.status === 403, "A REP sent another REP's quotation");
  const billingBlocked = await request("/api/quotations/00000000-0000-4000-8000-000000000502/send-to-customer", {
    method: "POST",
    headers: auth(repToken),
    body: JSON.stringify({ customerId: customerA.id }),
  });
  expect(billingBlocked.status === 409 && billingBlocked.body.error.code === "BILLING_ALREADY_GENERATED", "Generated billing entered negotiation");
  const sent = await request(`/api/quotations/${quoteAOver}/send-to-customer`, {
    method: "POST",
    headers: auth(repToken),
    body: JSON.stringify({ customerId: customerA.id }),
  });
  expect(sent.status === 200 && sent.body.data.status === "SENT_TO_CUSTOMER", "Rep could not send approved quotation");
  expect(
    ["SENT", "SKIPPED"].includes(sent.body.emailDelivery?.status),
    "Quotation send did not report email delivery status",
  );

  const portalQuote = await request(`/api/portal/quotations/${quoteAOver}`, { headers: auth(customerAToken) });
  expect(portalQuote.status === 200 && portalQuote.body.data.lines.length === 1, "Customer A could not fetch own quotation");
  expect(!("blendedRiskScore" in portalQuote.body.data), "Portal exposed blended risk score");
  expect(!("rep" in portalQuote.body.data), "Portal exposed internal rep data");
  const portalList = await request("/api/portal/quotations", { headers: auth(customerAToken) });
  expect(
    portalList.status === 200 && portalList.body.data.some((quotation) => quotation.id === quoteAOver),
    "Customer quotation list does not contain the newly shared quotation",
  );

  for (const [method, path, body] of [
    ["GET", `/api/portal/quotations/${quoteB}`],
    ["POST", `/api/portal/quotations/${quoteB}/comments`, { content: "Unauthorized comment" }],
    ["PUT", `/api/portal/quotations/${quoteB}/lines/${lineB}/discount`, { discountPercent: 20 }],
    ["POST", `/api/portal/quotations/${quoteB}/confirm`, {}],
  ]) {
    const denied = await request(path, { method, headers: auth(customerAToken), body: method === "GET" ? undefined : JSON.stringify(body) });
    expect(denied.status === 404, `Customer A crossed Customer B boundary on ${method} ${path}`);
  }

  const orderComment = await request(`/api/portal/quotations/${quoteAOver}/comments`, {
    method: "POST",
    headers: auth(customerAToken),
    body: JSON.stringify({ content: "Please review the overall commercial terms." }),
  });
  expect(orderComment.status === 201 && orderComment.body.data.quotationLineId === null, "Order comment failed");
  const lineComment = await request(`/api/portal/quotations/${quoteAOver}/comments`, {
    method: "POST",
    headers: auth(customerAToken),
    body: JSON.stringify({ content: "Can this line be discounted?", quotationLineId: lineAOver }),
  });
  expect(lineComment.status === 201 && lineComment.body.data.quotationLineId === lineAOver, "Line comment failed");
  const wrongLine = await request(`/api/portal/quotations/${quoteAOver}/comments`, {
    method: "POST",
    headers: auth(customerAToken),
    body: JSON.stringify({ content: "Wrong line", quotationLineId: lineB }),
  });
  expect(wrongLine.status === 400, "Cross-quotation comment line was accepted");

  const internalThread = await request(`/api/quotations/${quoteAOver}/comments`, { headers: auth(repToken) });
  expect(internalThread.status === 200 && internalThread.body.data.comments.length === 2, "Internal user cannot see customer comments");
  const reply = await request(`/api/quotations/${quoteAOver}/comments`, {
    method: "POST",
    headers: auth(repToken),
    body: JSON.stringify({ content: "We can review the requested discount.", quotationLineId: lineAOver }),
  });
  expect(reply.status === 201 && reply.body.data.authorType === "INTERNAL", "Internal reply failed");
  const portalWithReply = await request(`/api/portal/quotations/${quoteAOver}`, { headers: auth(customerAToken) });
  expect(portalWithReply.body.data.comments.some((comment) => comment.authorType === "INTERNAL"), "Customer cannot see internal reply");

  for (const invalidDiscount of [-1, 101]) {
    const invalid = await request(`/api/portal/quotations/${quoteAOver}/lines/${lineAOver}/discount`, {
      method: "PUT",
      headers: auth(customerAToken),
      body: JSON.stringify({ discountPercent: invalidDiscount }),
    });
    expect(invalid.status === 400, `Invalid discount ${invalidDiscount} was accepted`);
  }
  for (const boundaryDiscount of [0, 100]) {
    const boundary = await request(`/api/portal/quotations/${quoteAOver}/lines/${lineAOver}/discount`, {
      method: "PUT",
      headers: auth(customerAToken),
      body: JSON.stringify({ discountPercent: boundaryDiscount }),
    });
    expect(boundary.status === 200, `Valid boundary discount ${boundaryDiscount} was rejected`);
  }

  const changed = await request(`/api/portal/quotations/${quoteAOver}/lines/${lineAOver}/discount`, {
    method: "PUT",
    headers: auth(customerAToken),
    body: JSON.stringify({ discountPercent: 18 }),
  });
  expect(changed.status === 200 && changed.body.data.status === "UNDER_NEGOTIATION", "Discount did not enter negotiation");
  expect(Number(changed.body.data.grandTotal) === 574, "Quotation totals were not recalculated");

  const confirmed = await request(`/api/portal/quotations/${quoteAOver}/confirm`, {
    method: "POST",
    headers: auth(customerAToken),
    body: JSON.stringify({}),
  });
  expect(confirmed.status === 200 && confirmed.body.data.status === "PENDING_MANAGER_APPROVAL", "Over-limit request did not re-enter Manager approval");
  const duplicate = await request(`/api/portal/quotations/${quoteAOver}/confirm`, {
    method: "POST",
    headers: auth(customerAToken),
    body: JSON.stringify({}),
  });
  expect(duplicate.status === 409, "Duplicate confirmation was processed");
  const pending = await request(`/api/quotations/pending?quotationId=${quoteAOver}`, { headers: auth(managerToken) });
  expect(pending.body.data.some((quotation) => quotation.id === quoteAOver), "Manager cannot see re-entered approval");
  const approved = await request(`/api/quotations/${quoteAOver}/approve`, {
    method: "POST",
    headers: auth(managerToken),
    body: JSON.stringify({}),
  });
  expect(approved.status === 200 && approved.body.data.status === "APPROVED", "Manager could not approve customer request");

  const sentWithin = await request(`/api/quotations/${quoteAWithin}/send-to-customer`, {
    method: "POST",
    headers: auth(repToken),
    body: JSON.stringify({ customerId: customerA.id }),
  });
  expect(sentWithin.status === 200, "Within-limit quotation could not be sent");
  const withinChanged = await request(`/api/portal/quotations/${quoteAWithin}/lines/${lineAWithin}/discount`, {
    method: "PUT",
    headers: auth(customerAToken),
    body: JSON.stringify({ discountPercent: 9 }),
  });
  expect(withinChanged.status === 200, "Within-limit discount update failed");
  const withinConfirmed = await request(`/api/portal/quotations/${quoteAWithin}/confirm`, {
    method: "POST",
    headers: auth(customerAToken),
    body: JSON.stringify({}),
  });
  expect(withinConfirmed.status === 200 && withinConfirmed.body.data.status === "APPROVED", "Within-limit request entered unnecessary approval");

  const serviceProduct = await prisma.product.findFirstOrThrow({ where: { name: "On-site Setup Service" } });
  const highCreated = await request("/api/quotations", {
    method: "POST",
    headers: auth(repToken),
    body: JSON.stringify({ customerName: "MVP5 high-risk manager-first" }),
  });
  const highUpdated = await request(`/api/quotations/${highCreated.body.data.id}`, {
    method: "PUT",
    headers: auth(repToken),
    body: JSON.stringify({ lines: [{ productId: serviceProduct.id, qty: 1, discountPercent: 0 }] }),
  });
  const highLineId = highUpdated.body.data.lines[0].id;
  await request(`/api/quotations/${highCreated.body.data.id}/confirm`, { method: "POST", headers: auth(repToken) });
  const missingCustomer = await request(`/api/quotations/${highCreated.body.data.id}/send-to-customer`, {
    method: "POST",
    headers: auth(repToken),
    body: JSON.stringify({}),
  });
  expect(missingCustomer.status === 400 && missingCustomer.body.error.code === "CUSTOMER_REQUIRED", "Quotation was sent without customer linkage");
  await request(`/api/quotations/${highCreated.body.data.id}/send-to-customer`, {
    method: "POST",
    headers: auth(repToken),
    body: JSON.stringify({ customerEmail: customerA.email }),
  });
  await request(`/api/portal/quotations/${highCreated.body.data.id}/lines/${highLineId}/discount`, {
    method: "PUT",
    headers: auth(customerAToken),
    body: JSON.stringify({ discountPercent: 30 }),
  });
  const concurrentConfirms = await Promise.all([1, 2].map(() =>
    request(`/api/portal/quotations/${highCreated.body.data.id}/confirm`, {
      method: "POST",
      headers: auth(customerAToken),
      body: JSON.stringify({}),
    })));
  expect(
    concurrentConfirms.map((response) => response.status).sort().join(",") === "200,409",
    "Concurrent confirmation did not produce one success and one safe conflict",
  );
  const highConfirmed = concurrentConfirms.find((response) => response.status === 200);
  expect(highConfirmed.body.data.status === "PENDING_FINANCE_APPROVAL", "High-risk request did not retain Finance destination");
  const [managerBeforeFinance, financeBeforeManager] = await Promise.all([
    request(`/api/quotations/pending?quotationId=${highCreated.body.data.id}`, { headers: auth(managerToken) }),
    request(`/api/quotations/pending?quotationId=${highCreated.body.data.id}`, { headers: auth(financeToken) }),
  ]);
  expect(managerBeforeFinance.body.data.some((quote) => quote.id === highCreated.body.data.id), "Manager did not own first high-risk step");
  expect(!financeBeforeManager.body.data.some((quote) => quote.id === highCreated.body.data.id), "Finance saw high-risk request before Manager");
  const highManagerApproval = await request(`/api/quotations/${highCreated.body.data.id}/approve`, {
    method: "POST",
    headers: auth(managerToken),
    body: JSON.stringify({}),
  });
  expect(highManagerApproval.body.data.status === "PENDING_FINANCE_APPROVAL", "Manager approval skipped Finance");
  const financeAfterManager = await request(`/api/quotations/pending?quotationId=${highCreated.body.data.id}`, { headers: auth(financeToken) });
  expect(financeAfterManager.body.data.some((quote) => quote.id === highCreated.body.data.id), "Finance did not receive Manager-approved high-risk request");
  const highFinanceApproval = await request(`/api/quotations/${highCreated.body.data.id}/approve`, {
    method: "POST",
    headers: auth(financeToken),
    body: JSON.stringify({}),
  });
  expect(highFinanceApproval.body.data.status === "APPROVED", "Finance could not complete high-risk request");

  const events = await prisma.negotiationEvent.findMany({ where: { quotationId: quoteAOver } });
  expect(events.some((event) => event.action === "DISCOUNT_UPDATED"), "Discount audit event is missing");
  expect(events.some((event) => event.action === "APPROVAL_REENTRY"), "Approval re-entry audit event is missing");
  const approvalLog = await prisma.approvalLog.findFirst({ where: { quotationId: quoteAOver } });
  expect(approvalLog?.approvalRound === 1, "Approval action was not attached to the current round");

  const bOwnQuote = await request(`/api/portal/quotations/${quoteB}`, { headers: auth(customerBToken) });
  expect(bOwnQuote.status === 200, "Customer B cannot access own quotation");
  console.log("MVP 5 smoke checks passed: auth isolation, BOLA, comments, negotiation, re-entry, and audit");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
