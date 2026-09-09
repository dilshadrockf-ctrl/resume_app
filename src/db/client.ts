import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

/**
 * Prisma singleton. Works with plain local PostgreSQL — no cloud drivers,
 * no proprietary extensions (§87). Connection retries make `docker compose up`
 * races survivable (§194).
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildClient(): PrismaClient {
  // engineType="client" (query compiler): the driver adapter IS the runtime.
  // Plain local PostgreSQL via node-postgres — no cloud drivers required.
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log:
      env.NODE_ENV === "development"
        ? [{ emit: "event", level: "warn" } as const, { emit: "event", level: "error" } as const]
        : [{ emit: "event", level: "error" } as const],
    errorFormat: env.NODE_ENV === "production" ? "minimal" : "pretty",
  });
  client.$on("error" as never, (e: { message?: string }) => {
    // structured log only — never dump connection strings
    console.error("[db-error]", e?.message ? String(e.message).slice(0, 300) : "db error");
  });
  return client;
}

export const db: PrismaClient = globalForPrisma.prisma ?? buildClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export async function ensureDb(retries = 1): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      await db.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, Math.min(500 * (i + 1), 2000)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Database unavailable");
}
