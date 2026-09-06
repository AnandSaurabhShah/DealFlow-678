const ApiError = require("./apiError");

const MAX_SEARCH_LENGTH = 100;

function parseSearch(value) {
  if (value == null) return "";
  const search = String(value).trim();
  if (search.length > MAX_SEARCH_LENGTH) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `search cannot exceed ${MAX_SEARCH_LENGTH} characters`,
    );
  }
  return search;
}

function combineWhere(...conditions) {
  const active = conditions.filter((condition) => condition && Object.keys(condition).length);
  if (!active.length) return undefined;
  return active.length === 1 ? active[0] : { AND: active };
}

module.exports = { combineWhere, parseSearch, MAX_SEARCH_LENGTH };
