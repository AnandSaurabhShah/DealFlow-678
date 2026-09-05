const baseUrl = process.env.API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const body = await response.json();
  return { status: response.status, body };
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function nearlyEqual(actual, expected) {
  return Math.abs(Number(actual) - expected) < 0.001;
}

async function login(email, password) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  expect(response.status === 200, `Login failed for ${email}: ${JSON.stringify(response.body)}`);
  expect(response.body.token, `Login did not return a token for ${email}`);
  expect(!("passwordHash" in response.body.user), "Login exposed passwordHash");
  return response.body.token;
}

async function main() {
  const health = await request("/health");
  expect(health.status === 200 && health.body.database === "connected", "Health check failed");

  const unauthenticated = await request("/api/products");
  expect(unauthenticated.status === 401, "Protected route did not return 401 without a token");

  const adminToken = await login(
    "admin@dealflow360.test",
    process.env.SEED_ADMIN_PASSWORD || "Admin123!",
  );
  const repToken = await login("rep@dealflow360.test", process.env.SEED_REP_PASSWORD || "Rep12345!");

  const forbidden = await request("/api/products", {
    method: "POST",
    headers: { authorization: `Bearer ${repToken}` },
    body: JSON.stringify({ name: "Forbidden", category: "HARDWARE", price: "1", unit: "UNIT" }),
  });
  expect(forbidden.status === 403, "Admin mutation did not return 403 for REP");

  const repCatalog = await request("/api/products", {
    headers: { authorization: `Bearer ${repToken}` },
  });
  expect(repCatalog.status === 200, "REP cannot read the product catalog");

  const authHeaders = { authorization: `Bearer ${adminToken}` };
  const products = await request("/api/products", { headers: authHeaders });
  expect(products.status === 200 && products.body.data.length >= 2, "Seed products are missing");
  expect(new Set(products.body.data.map((product) => product.category)).size >= 2, "Seed categories are missing");

  const product = await request("/api/products", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: `Smoke Test Product ${Date.now()}`,
      category: "HARDWARE",
      price: "49.99",
      unit: "UNIT",
      tax: "18",
    }),
  });
  expect(product.status === 201 && product.body.data.id, "Product creation failed");

  for (const path of ["/api/pricelists", "/api/warehouses", "/api/discount-tiers"]) {
    const response = await request(path, { headers: authHeaders });
    expect(response.status === 200 && response.body.data.length >= 1, `${path} seed data is missing`);
  }

  const priceList = await request("/api/pricelists", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name: `Smoke USD ${Date.now()}`, customerTier: "GOLD", currency: "USD" }),
  });
  expect(priceList.status === 201 && priceList.body.data.currency === "USD", "Price list creation failed");

  const warehouse = await request("/api/warehouses", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: `Smoke Warehouse ${Date.now()}`,
      location: "Test",
      stockLevels: [{ productId: product.body.data.id, qty: 3 }],
    }),
  });
  expect(warehouse.status === 201 && warehouse.body.data.stockLevels.length === 1, "Warehouse creation failed");

  const discountTier = await request("/api/discount-tiers", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      tierName: `Smoke ${Date.now()}`,
      maxDiscountPercent: "12.5",
      categoryOverrides: [{ category: "SERVICE", maxDiscountPercent: "8" }],
    }),
  });
  expect(
    discountTier.status === 201 && discountTier.body.data.categoryOverrides.length === 1,
    "Discount tier creation failed",
  );

  const signup = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "Smoke Test Rep",
      email: `smoke-${Date.now()}@dealflow360.test`,
      password: "SmokePass123!",
      role: "rep",
    }),
  });
  expect(signup.status === 201 && signup.body.user.role === "REP", "Signup failed");
  expect(!("passwordHash" in signup.body.user), "Signup exposed passwordHash");

  const quotation = await request("/api/quotations", {
    method: "POST",
    headers: { authorization: `Bearer ${repToken}` },
    body: JSON.stringify({ customerName: "Smoke Test Customer", repId: "ignored" }),
  });
  expect(
    quotation.status === 201 && quotation.body.data.rep.email === "rep@dealflow360.test",
    "Draft quotation creation failed or trusted client repId",
  );

  const quoteProducts = products.body.data.slice(0, 2);
  const updatedQuotation = await request(`/api/quotations/${quotation.body.data.id}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${repToken}` },
    body: JSON.stringify({
      subtotal: "0",
      grandTotal: "0",
      lines: [
        { productId: quoteProducts[0].id, qty: 2, discountPercent: "10", unitPrice: "0" },
        { productId: quoteProducts[1].id, qty: 1, discountPercent: "5", unitPrice: "0" },
      ],
    }),
  });
  expect(updatedQuotation.status === 200, "Quotation line update failed");
  expect(
    updatedQuotation.body.data.lines.every(
      (line) => line.unitPrice === quoteProducts.find((item) => item.id === line.productId).price,
    ),
    "Quotation trusted a client-sent unit price",
  );
  const expectedSubtotal = Number(quoteProducts[0].price) * 2 + Number(quoteProducts[1].price);
  const expectedDiscount = Number(quoteProducts[0].price) * 2 * 0.1 + Number(quoteProducts[1].price) * 0.05;
  expect(
    nearlyEqual(updatedQuotation.body.data.subtotal, expectedSubtotal) &&
      nearlyEqual(updatedQuotation.body.data.totalDiscount, expectedDiscount) &&
      nearlyEqual(updatedQuotation.body.data.grandTotal, expectedSubtotal - expectedDiscount),
    "Server quotation totals are incorrect",
  );

  const confirmed = await request(`/api/quotations/${quotation.body.data.id}/confirm`, {
    method: "POST",
    headers: { authorization: `Bearer ${repToken}` },
  });
  expect(confirmed.status === 200 && confirmed.body.data.status === "APPROVED", "Submission failed");

  const editConfirmed = await request(`/api/quotations/${quotation.body.data.id}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${repToken}` },
    body: JSON.stringify({ lines: [] }),
  });
  expect(editConfirmed.status === 409, "Submitted quotation remained editable");

  console.log("Smoke checks passed: MVP 1 flow, including server-owned totals and direct approval");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
