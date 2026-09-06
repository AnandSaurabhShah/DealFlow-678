const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { requireFields } = require("../utils/validation");
const { parsePagination, paginationMeta } = require("../utils/pagination");
const { combineWhere, parseSearch } = require("../utils/search");

const MANAGED_ROLES = ["REP", "MANAGER", "FINANCE"];
const USER_ROLES = ["ADMIN", ...MANAGED_ROLES];
const publicUserSelect = { id: true, name: true, email: true, role: true, createdAt: true };

function managedRole(value) {
  const role = String(value || "").trim().toUpperCase();
  if (!MANAGED_ROLES.includes(role)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `role must be one of: ${MANAGED_ROLES.join(", ")}; admins are system-provisioned`,
    );
  }
  return role;
}

function listedRole(value) {
  const role = String(value || "").trim().toUpperCase();
  if (!USER_ROLES.includes(role)) {
    throw new ApiError(400, "VALIDATION_ERROR", `role must be one of: ${USER_ROLES.join(", ")}`);
  }
  return role;
}

async function listUsers(req, res) {
  const pagination = parsePagination(req.query);
  const search = parseSearch(req.query.search);
  const role = req.query.role ? listedRole(req.query.role) : undefined;
  const where = combineWhere(
    role ? { role } : undefined,
    search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    } : undefined,
  );
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.user.count({ where }),
  ]);
  res.json({ data: users, pagination: paginationMeta(total, pagination) });
}

async function createUser(req, res) {
  requireFields(req.body, ["name", "email", "password", "role"]);
  const name = String(req.body.name).trim();
  const email = String(req.body.email).trim().toLowerCase();
  const password = String(req.body.password);
  const role = managedRole(req.body.role);
  if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new ApiError(400, "VALIDATION_ERROR", "A valid name and email are required");
  }
  if (password.length < 8 || password.length > 128) {
    throw new ApiError(400, "VALIDATION_ERROR", "Password must be between 8 and 128 characters");
  }
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new ApiError(409, "EMAIL_IN_USE", "An account with this email already exists");

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12), role },
    select: publicUserSelect,
  });
  res.status(201).json({ data: user });
}

module.exports = { createUser, listUsers, MANAGED_ROLES, managedRole };
