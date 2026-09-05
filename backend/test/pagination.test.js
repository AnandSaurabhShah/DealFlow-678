const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePagination, paginationMeta } = require("../src/utils/pagination");

test("pagination parses defaults and calculates database offsets", () => {
  assert.deepEqual(parsePagination({}), { page: 1, pageSize: 20, skip: 0, take: 20 });
  assert.deepEqual(parsePagination({ page: "3", pageSize: "25" }), {
    page: 3,
    pageSize: 25,
    skip: 50,
    take: 25,
  });
});

test("pagination rejects invalid and excessive values", () => {
  assert.throws(() => parsePagination({ page: "0" }), /positive integer/);
  assert.throws(() => parsePagination({ pageSize: "101" }), /cannot exceed 100/);
});

test("pagination metadata handles empty and final pages", () => {
  assert.deepEqual(paginationMeta(0, { page: 1, pageSize: 20 }), {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  assert.equal(paginationMeta(41, { page: 3, pageSize: 20 }).hasNextPage, false);
});
