const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const env = require("../config/env");
const ApiError = require("../utils/apiError");
const { requireFields } = require("../utils/validation");

const ROLES = ["ADMIN", "REP", "MANAGER", "FINANCE"];
const publicUserSelect = { id: true, name: true, email: true, role: true, createdAt: true };

function issueToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn,
  });
}

async function signup(req, res) {
  requireFields(req.body, ["name", "email", "password", "role"]);
  const name = String(req.body.name).trim();
  const email = String(req.body.email).trim().toLowerCase();
  const role = String(req.body.role).trim().toUpperCase();
  const password = String(req.body.password);

  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new ApiError(400, "VALIDATION_ERROR", "A valid name and email are required");
  }
  if (password.length < 8) {
    throw new ApiError(400, "VALIDATION_ERROR", "Password must be at least 8 characters");
  }
  if (!ROLES.includes(role)) {
    throw new ApiError(400, "VALIDATION_ERROR", `role must be one of: ${ROLES.join(", ")}`);
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new ApiError(409, "EMAIL_IN_USE", "An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
    select: publicUserSelect,
  });
  return res.status(201).json({ token: issueToken(user), user });
}

async function login(req, res) {
  requireFields(req.body, ["email", "password"]);
  const email = String(req.body.email).trim().toLowerCase();
  const userWithPassword = await prisma.user.findUnique({ where: { email } });
  if (!userWithPassword || !(await bcrypt.compare(String(req.body.password), userWithPassword.passwordHash))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }

  const { passwordHash: _passwordHash, ...user } = userWithPassword;
  return res.json({ token: issueToken(user), user });
}

async function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { signup, login, me };
