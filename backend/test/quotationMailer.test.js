const test = require("node:test");
const assert = require("node:assert/strict");
const { buildQuotationEmail, quotationPortalUrl } = require("../src/services/quotationMailer");

test("quotation email contains the direct customer portal URL", () => {
  const quotation = { id: "quote-123", grandTotal: "2499.50" };
  const customer = { name: "Customer A", email: "customer@example.test" };
  const message = buildQuotationEmail({ customer, quotation });

  assert.equal(message.to, customer.email);
  assert.equal(message.url, quotationPortalUrl(quotation.id));
  assert.match(message.url, /\/portal\/quotations\/quote-123$/);
  assert.match(message.text, /Customer A/);
  assert.match(message.text, /2499\.50/);
  assert.match(message.text, new RegExp(message.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
