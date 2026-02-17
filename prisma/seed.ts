import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../src/config/env.js";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Seed is intentionally minimal for this API template.
  await prisma.$queryRaw`SELECT 1`;
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
