const ApiError = require("./apiError");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function positiveInteger(value, name, fallback) {
  if (value == null || value === "") return fallback;
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) {
    throw new ApiError(400, "VALIDATION_ERROR", `${name} must be a positive integer`);
  }
  return Number(value);
}

function parsePagination(query = {}, options = {}) {
  const page = positiveInteger(query.page, "page", 1);
  const requestedPageSize = positiveInteger(
    query.pageSize,
    "pageSize",
    options.defaultPageSize || DEFAULT_PAGE_SIZE,
  );
  const maxPageSize = options.maxPageSize || MAX_PAGE_SIZE;
  if (requestedPageSize > maxPageSize) {
    throw new ApiError(400, "VALIDATION_ERROR", `pageSize cannot exceed ${maxPageSize}`);
  }
  return {
    page,
    pageSize: requestedPageSize,
    skip: (page - 1) * requestedPageSize,
    take: requestedPageSize,
  };
}

function paginationMeta(total, { page, pageSize }) {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

module.exports = { parsePagination, paginationMeta, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
