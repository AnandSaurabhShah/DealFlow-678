require("dotenv").config();

const baseUrl = process.env.API_BASE_URL || "http://localhost:4000";

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  return { status: response.status, body: await response.json() };
}

async function login(path, email, password) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  expect(response.status === 200, `Login failed for ${email}`);
  return body.token;
}

function verifyPage(response, expectedSize, label) {
  expect(response.status === 200, `${label} request failed`);
  expect(Array.isArray(response.body.data), `${label} data is not an array`);
  expect(response.body.data.length <= expectedSize, `${label} exceeded pageSize`);
  expect(response.body.pagination.pageSize === expectedSize, `${label} pageSize metadata is wrong`);
  expect(Number.isInteger(response.body.pagination.total), `${label} total is missing`);
}

async function main() {
  const [adminToken, repToken, managerToken, customerToken] = await Promise.all([
    login("/api/auth/login", "admin@dealflow360.test", process.env.SEED_ADMIN_PASSWORD || "Admin123!"),
    login("/api/auth/login", "rep@dealflow360.test", process.env.SEED_REP_PASSWORD || "Rep12345!"),
    login("/api/auth/login", "manager@dealflow360.test", process.env.SEED_MANAGER_PASSWORD || "Manager123!"),
    login("/api/customer-auth/login", "customer.b@dealflow360.test", process.env.SEED_CUSTOMER_B_PASSWORD || "CustomerB123!"),
  ]);

  for (const path of ["products", "pricelists", "warehouses", "discount-tiers"]) {
    const token = path === "products" ? repToken : adminToken;
    const first = await request(`/api/${path}?page=1&pageSize=10`, token);
    const second = await request(`/api/${path}?page=2&pageSize=10`, token);
    verifyPage(first, 10, `${path} first page`);
    verifyPage(second, 10, `${path} second page`);
    expect(first.body.pagination.total >= 150, `${path} total does not include the load dataset`);
    const firstIds = new Set(first.body.data.map((item) => item.id));
    expect(second.body.data.every((item) => !firstIds.has(item.id)), `${path} pages overlap`);
  }

  const approved = await request("/api/quotations?page=1&pageSize=10&status=APPROVED", repToken);
  verifyPage(approved, 10, "approved quotations");
  expect(approved.body.data.every((quotation) => quotation.status === "APPROVED"), "Quotation status filter leaked other states");

  const pending = await request("/api/quotations/pending?page=1&pageSize=10", managerToken);
  verifyPage(pending, 10, "pending approvals");

  const portal = await request("/api/portal/quotations?page=1&pageSize=10", customerToken);
  verifyPage(portal, 10, "portal quotations");
  expect(portal.body.data.every((quotation) => quotation.id.endsWith("703")), "Customer portal list crossed its account boundary");

  const invalid = await request("/api/products?page=0", repToken);
  expect(invalid.status === 400 && invalid.body.error.code === "VALIDATION_ERROR", "Invalid page was accepted");

  console.log("Pagination smoke checks passed for config, quotations, approvals, and customer portal collections");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
