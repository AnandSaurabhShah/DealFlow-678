const test = require("node:test");
const assert = require("node:assert/strict");
const { enumValue, publicConfigOptions } = require("../src/constants/configEnums");

test("configuration enum parsing accepts canonical values and legacy display labels", () => {
  assert.equal(enumValue("HARDWARE", "category", "productCategories"), "HARDWARE");
  assert.equal(enumValue("Fulfillment Demo", "category", "productCategories"), "FULFILLMENT_DEMO");
  assert.equal(enumValue("seat/month", "unit", "productUnits"), "SEAT_PER_MONTH");
  assert.equal(enumValue("gold", "customerTier", "customerTiers"), "GOLD");
});

test("configuration enum parsing rejects values outside the published options", () => {
  assert.throws(
    () => enumValue("PLATINUM", "customerTier", "customerTiers"),
    (error) => error.status === 400 && error.code === "VALIDATION_ERROR",
  );
});

test("published configuration options use value and label pairs", () => {
  const options = publicConfigOptions();
  assert.deepEqual(options.currencies, [{ value: "USD", label: "USD" }]);
  assert(options.productCategories.some((option) => option.value === "SOFTWARE"));
});
