const { rateLimit } = require("express-rate-limit");
const ApiError = require("../utils/apiError");

function createLimiter({ windowMs, limit, code }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_req, _res, next) {
      next(new ApiError(429, code, "Too many requests. Please try again later."));
    },
  });
}

const customerAuthLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  code: "CUSTOMER_AUTH_RATE_LIMITED",
});

const portalMutationLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 90,
  code: "PORTAL_RATE_LIMITED",
});

module.exports = { customerAuthLimiter, portalMutationLimiter };
