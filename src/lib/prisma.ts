import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../config/env";
import { PrismaClient } from "../generated/prisma/client";

declare global {
  var __prismaClient__: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prismaClient__ ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaClient__ = prisma;
}
