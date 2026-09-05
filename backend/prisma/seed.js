require("dotenv").config();

const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to seed the database");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const [adminPasswordHash, repPasswordHash] = await Promise.all([
    bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "Admin123!", 12),
    bcrypt.hash(process.env.SEED_REP_PASSWORD || "Rep12345!", 12),
  ]);

  await prisma.user.upsert({
    where: { email: "admin@dealflow360.test" },
    update: { name: "Demo Admin", role: "ADMIN", passwordHash: adminPasswordHash },
    create: {
      name: "Demo Admin",
      email: "admin@dealflow360.test",
      role: "ADMIN",
      passwordHash: adminPasswordHash,
    },
  });
  await prisma.user.upsert({
    where: { email: "rep@dealflow360.test" },
    update: { name: "Demo Sales Rep", role: "REP", passwordHash: repPasswordHash },
    create: {
      name: "Demo Sales Rep",
      email: "rep@dealflow360.test",
      role: "REP",
      passwordHash: repPasswordHash,
    },
  });

  const laptop = await findOrCreateProduct({
    name: "ProBook 14 Laptop",
    category: "Hardware",
    price: "1299.00",
    unit: "unit",
    tax: "18.00",
    description: "Business laptop with three-year warranty",
  });
  const setup = await findOrCreateProduct({
    name: "On-site Setup Service",
    category: "Service",
    price: "350.00",
    unit: "service",
    tax: "18.00",
    description: "Installation and onboarding at the customer site",
  });

  await prisma.priceList.upsert({
    where: { id: "00000000-0000-4000-8000-000000000101" },
    update: { name: "Standard USD", customerTier: "STANDARD", currency: "USD" },
    create: {
      id: "00000000-0000-4000-8000-000000000101",
      name: "Standard USD",
      customerTier: "STANDARD",
      currency: "USD",
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { id: "00000000-0000-4000-8000-000000000201" },
    update: { name: "Central Warehouse", location: "Bengaluru" },
    create: {
      id: "00000000-0000-4000-8000-000000000201",
      name: "Central Warehouse",
      location: "Bengaluru",
    },
  });

  await Promise.all([
    prisma.stockLevel.upsert({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: laptop.id } },
      update: { qty: 25 },
      create: { warehouseId: warehouse.id, productId: laptop.id, qty: 25 },
    }),
    prisma.stockLevel.upsert({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: setup.id } },
      update: { qty: 100 },
      create: { warehouseId: warehouse.id, productId: setup.id, qty: 100 },
    }),
  ]);

  await prisma.discountTier.upsert({
    where: { tierName: "Standard" },
    update: { maxDiscountPercent: "5.00" },
    create: { tierName: "Standard", maxDiscountPercent: "5.00" },
  });

  console.log("Seeded demo users, products, price list, warehouse stock, and discount tier");
}

async function findOrCreateProduct(data) {
  const existing = await prisma.product.findFirst({ where: { name: data.name } });
  if (existing) return prisma.product.update({ where: { id: existing.id }, data });
  return prisma.product.create({ data });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
