const app = require("./app");
const prisma = require("./config/prisma");
const env = require("./config/env");

const server = app.listen(env.port, () => {
  console.log(`DealFlow360 API listening on port ${env.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
