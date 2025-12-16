import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Cache Prisma Client in globalThis to prevent connection pool exhaustion
// This works in both dev (hot reload) and production (Vercel serverless)
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
