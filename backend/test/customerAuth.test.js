const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const env = require("../src/config/env");
const { issueCustomerToken, normalizeSignup } = require("../src/controllers/customerAuthController");

test("customer token has an explicit customer-only identity", () => {
  const customer = { id: "00000000-0000-4000-8000-000000000801" };
  const payload = jwt.verify(issueCustomerToken(customer), env.customerJwtSecret);
  assert.equal(payload.type, "customer");
  assert.equal(payload.customerId, customer.id);
  assert.equal(payload.sub, customer.id);
  assert.equal(payload.role, undefined);
});

test("customer signup normalization validates bounded credentials", () => {
  assert.deepEqual(
    normalizeSignup({ name: " Customer A ", email: "A@Example.Test ", password: "Password1!" }),
    { name: "Customer A", email: "a@example.test", password: "Password1!" },
  );
  assert.throws(
    () => normalizeSignup({ name: "Customer", email: "invalid", password: "Password1!" }),
    /valid name and email/,
  );
  assert.throws(
    () => normalizeSignup({ name: "Customer", email: "a@example.test", password: "short" }),
    /between 8 and 128/,
  );
});
