const test = require("node:test");
const assert = require("node:assert/strict");
const { combineWhere, parseSearch } = require("../src/utils/search");

test("parseSearch trims input and accepts an absent search", () => {
  assert.equal(parseSearch("  Acme  "), "Acme");
  assert.equal(parseSearch(undefined), "");
});

test("parseSearch rejects overly long input", () => {
  assert.throws(
    () => parseSearch("x".repeat(101)),
    (error) => error.status === 400 && error.code === "VALIDATION_ERROR",
  );
});

test("combineWhere preserves access filters while adding search filters", () => {
  assert.deepEqual(
    combineWhere({ repId: "rep-1" }, { OR: [{ customerName: { contains: "Acme" } }] }),
    { AND: [{ repId: "rep-1" }, { OR: [{ customerName: { contains: "Acme" } }] }] },
  );
});
