const { Prisma } = require("@prisma/client");

function notFound(req, res) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.originalUrl} was not found` },
  });
}

function errorHandler(error, _req, res, _next) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: { code: "CONFLICT", message: "A record with that unique value already exists" },
      });
    }
    if (error.code === "P2025") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "The requested record was not found" },
      });
    }
    if (error.code === "P2003") {
      return res.status(400).json({
        error: { code: "INVALID_REFERENCE", message: "A related record does not exist" },
      });
    }
  }

  const status = error.status || 500;
  const body = {
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: status === 500 ? "An unexpected error occurred" : error.message,
    },
  };
  if (error.details) body.error.details = error.details;
  if (status === 500) console.error(error);
  return res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
