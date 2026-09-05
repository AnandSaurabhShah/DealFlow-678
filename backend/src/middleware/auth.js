const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const env = require("../config/env");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");

const authenticate = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "UNAUTHENTICATED", "A valid Bearer token is required");
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (_error) {
    throw new ApiError(401, "UNAUTHENTICATED", "Token is invalid or expired");
  }

  if (payload.type !== "internal") {
    throw new ApiError(401, "UNAUTHENTICATED", "An internal access token is required");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Token user no longer exists");
  }

  req.user = user;
  next();
});

function authorize(...roles) {
  return function authorizeRole(req, _res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action"));
    }
    return next();
  };
}

module.exports = { authenticate, authenticateInternal: authenticate, authorize };
