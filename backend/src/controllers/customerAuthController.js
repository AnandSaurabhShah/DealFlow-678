const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const env = require("../config/env");
const ApiError = require("../utils/apiError");
const { requireFields } = require("../utils/validation");

const publicCustomerSelect = { id: true, name: true, email: true, createdAt: true };

function issueCustomerToken(customer) {
  return jwt.sign(
    { type: "customer", customerId: customer.id },
    env.customerJwtSecret,
    { subject: customer.id, expiresIn: env.jwtExpiresIn },
  );
}

function normalizeSignup(body) {
  requireFields(body, ["name", "email", "password"]);
  const name = String(body.name).trim();
  const email = String(body.email).trim().toLowerCase();
  const password = String(body.password);
  if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new ApiError(400, "VALIDATION_ERROR", "A valid name and email are required");
  }
  if (password.length < 8 || password.length > 128) {
    throw new ApiError(400, "VALIDATION_ERROR", "Password must be between 8 and 128 characters");
  }
  return { name, email, password };
}

async function signup(req, res) {
  const { name, email, password } = normalizeSignup(req.body);
  const existing = await prisma.customer.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new ApiError(409, "EMAIL_IN_USE", "An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  let customer;
  try {
    customer = await prisma.customer.create({
      data: { name, email, passwordHash },
      select: publicCustomerSelect,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new ApiError(409, "EMAIL_IN_USE", "An account with this email already exists");
    }
    throw error;
  }
  return res.status(201).json({ token: issueCustomerToken(customer), customer });
}

async function login(req, res) {
  requireFields(req.body, ["email", "password"]);
  const email = String(req.body.email).trim().toLowerCase();
  const customerWithPassword = await prisma.customer.findUnique({ where: { email } });
  const valid = customerWithPassword &&
    await bcrypt.compare(String(req.body.password), customerWithPassword.passwordHash);
  if (!valid) {
    console.warn("[customer-auth] login failed", { emailHash: Buffer.from(email).toString("base64url").slice(0, 12) });
    throw new ApiError(401, "CUSTOMER_AUTH_FAILED", "Email or password is incorrect");
  }

  const { passwordHash: _passwordHash, ...customer } = customerWithPassword;
  return res.json({ token: issueCustomerToken(customer), customer });
}

module.exports = { signup, login, issueCustomerToken, normalizeSignup };
