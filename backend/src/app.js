const express = require("express");
const cors = require("cors");
const prisma = require("./config/prisma");
const env = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const configRoutes = require("./routes/configRoutes");
const quotationRoutes = require("./routes/quotationRoutes");
const asyncHandler = require("./utils/asyncHandler");
const { notFound, errorHandler } = require("./middleware/errors");

const app = express();

app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
      const error = new Error("Origin is not allowed by CORS");
      error.status = 403;
      error.code = "CORS_FORBIDDEN";
      return callback(error);
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const userCount = await prisma.user.count();
    res.json({ status: "ok", database: "connected", userCount });
  }),
);

app.use("/api/auth", authRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api", configRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
