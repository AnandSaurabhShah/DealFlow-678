const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { requireFields } = require("../utils/validation");
const { parsePagination, paginationMeta } = require("../utils/pagination");
const { parseSearch } = require("../utils/search");

const customerSelect = { id: true, name: true, email: true, createdAt: true };

async function listCustomers(req, res) {
  const pagination = parsePagination(req.query);
  const search = parseSearch(req.query.search);
  const where = search ? {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ],
  } : undefined;
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: customerSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.customer.count({ where }),
  ]);
  res.json({ data: customers, pagination: paginationMeta(total, pagination) });
}

async function createCustomer(req, res) {
  requireFields(req.body, ["name", "email", "password"]);
  const name = String(req.body.name).trim();
  const email = String(req.body.email).trim().toLowerCase();
  const password = String(req.body.password);
  if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new ApiError(400, "VALIDATION_ERROR", "A valid name and email are required");
  }
  if (password.length < 8 || password.length > 128) {
    throw new ApiError(400, "VALIDATION_ERROR", "Password must be between 8 and 128 characters");
  }
  const existing = await prisma.customer.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new ApiError(409, "EMAIL_IN_USE", "A customer with this email already exists");

  const customer = await prisma.customer.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12) },
    select: customerSelect,
  });
  res.status(201).json({ data: customer });
}

module.exports = { createCustomer, listCustomers };
