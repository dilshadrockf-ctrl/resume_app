/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

/**
 * Prisma configuration.
 *
 * Default (any machine with internet): classic engine, standard workflow —
 * `prisma migrate dev`, `db push`, `studio`, `seed`.
 *
 * Set `PRISMA_OFFLINE=1` to switch the CLI to the Rust-free WASM schema
 * engine + `pg` driver adapter: validate/generate/migrate run with zero
 * native engine downloads, for air-gapped or restricted networks. The
 * generated client already uses the WASM query compiler (engineType "client"
 * in schema.prisma), so the *runtime* never needs native binaries either way.
 */

// Prisma skips .env loading when a config file is present — load it ourselves.
for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]!]) {
      process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
}

const url = process.env.DATABASE_URL ?? "postgresql://resume:resume@localhost:5432/resumebuilder";
const offline = process.env.PRISMA_OFFLINE === "1" || process.env.PRISMA_OFFLINE === "true";

const common = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
};

async function build() {
  if (!offline) return defineConfig(common);
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return defineConfig({
    ...common,
    experimental: { adapter: true },
    engine: "js",
    adapter: async () => new PrismaPg({ connectionString: url }) as never,
  });
}

export default build();
