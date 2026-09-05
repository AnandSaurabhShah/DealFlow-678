const ApiError = require("./apiError");

function requireFields(body, fields) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "VALIDATION_ERROR", "A JSON request body is required");
  }
  const missing = fields.filter(
    (field) => body[field] === undefined || body[field] === null || body[field] === "",
  );
  if (missing.length) {
    throw new ApiError(400, "VALIDATION_ERROR", "Missing required fields", { missing });
  }
}

function decimalString(value, field, options = {}) {
  const normalized = String(value);
  const number = Number(normalized);
  if (
    !Number.isFinite(number) ||
    (options.min !== undefined && number < options.min) ||
    (options.max !== undefined && number > options.max)
  ) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be a valid number`, {
      field,
    });
  }
  return normalized;
}

function integer(value, field, options = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || (options.min !== undefined && number < options.min)) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be an integer`, { field });
  }
  return number;
}

function uuid(value, field = "id") {
  const normalized = String(value || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be a valid UUID`, { field });
  }
  return normalized;
}

module.exports = { requireFields, decimalString, integer, uuid };
