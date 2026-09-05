const dotenv = require("dotenv");

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const jwtSecret = required("JWT_SECRET");
const clientOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret,
  customerJwtSecret: process.env.CUSTOMER_JWT_SECRET || jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  port: Number(process.env.PORT || 4000),
  clientOrigins,
  customerPortalUrl: process.env.CUSTOMER_PORTAL_URL || clientOrigins[0] || "http://localhost:5173",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
    from: process.env.MAIL_FROM || "DealFlow360 <no-reply@dealflow360.local>",
  },
};
