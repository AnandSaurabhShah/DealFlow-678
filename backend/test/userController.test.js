const test = require("node:test");
const assert = require("node:assert/strict");
const { managedRole } = require("../src/controllers/userController");

test("managedRole normalizes roles that an admin may create", () => {
  assert.equal(managedRole("rep"), "REP");
  assert.equal(managedRole(" manager "), "MANAGER");
  assert.equal(managedRole("FINANCE"), "FINANCE");
});

test("managedRole preserves the single system-admin rule", () => {
  assert.throws(
    () => managedRole("ADMIN"),
    (error) => error.status === 400 && error.code === "VALIDATION_ERROR",
  );
});
