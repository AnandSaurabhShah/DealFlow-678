const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const env = require("../config/env");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");

const authenticateCustomer = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "CUSTOMER_UNAUTHENTICATED", "A valid customer Bearer token is required");
  }

  let payload;
  try {
    payload = jwt.verify(token, env.customerJwtSecret);
  } catch (_error) {
    throw new ApiError(401, "CUSTOMER_UNAUTHENTICATED", "Customer token is invalid or expired");
  }
  if (payload.type !== "customer" || !payload.customerId) {
    throw new ApiError(401, "CUSTOMER_UNAUTHENTICATED", "A customer access token is required");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: payload.customerId },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!customer) {
    throw new ApiError(401, "CUSTOMER_UNAUTHENTICATED", "Token customer no longer exists");
  }

  req.customer = customer;
  next();
});

module.exports = { authenticateCustomer };
