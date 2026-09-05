const test = require("node:test");
const assert = require("node:assert/strict");
const { requireFields, decimalString, integer } = require("../src/utils/validation");

test("requireFields reports all missing fields", () => {
  assert.throws(
    () => requireFields({ name: "" }, ["name", "email"]),
    (error) =>
      error.status === 400 &&
      error.code === "VALIDATION_ERROR" &&
      error.details.missing.join(",") === "name,email",
  );
  assert.throws(
    () => requireFields(undefined, ["email"]),
    (error) => error.status === 400 && error.code === "VALIDATION_ERROR",
  );
});

test("decimalString preserves decimal input for Prisma", () => {
  assert.equal(decimalString("1299.00", "price", { min: 0 }), "1299.00");
  assert.throws(() => decimalString("nope", "price"), /valid number/);
  assert.throws(() => decimalString(-1, "price", { min: 0 }), /valid number/);
});

test("integer rejects fractional and negative quantities", () => {
  assert.equal(integer("25", "qty", { min: 0 }), 25);
  assert.throws(() => integer(1.5, "qty", { min: 0 }), /integer/);
  assert.throws(() => integer(-1, "qty", { min: 0 }), /integer/);
});
