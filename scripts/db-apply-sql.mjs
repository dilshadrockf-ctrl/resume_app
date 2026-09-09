#!/usr/bin/env node
/**
 * Offline-friendly migration applier.
 *
 * In environments where the Prisma CLI cannot download its native schema
 * engine (air-gapped / restricted networks) and the WASM schema engine cannot
 * be used for `migrate deploy` (older Prisma), you can apply the SQL files in
 * `prisma/migrations` directly with this script. It records state in
 * `_prisma_migrations` exactly like `prisma migrate deploy` does, so the two
 * approaches remain interchangeable and `prisma migrate status` stays true.
 *
 *   node scripts/db-apply-sql.mjs
 *
 * Normal local setup uses `npm run db:migrate` — you should not need this.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Client } from "pg";

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (see .env.example)");
  process.exit(1);
}

const dir = "prisma/migrations";
const names = existsSync(dir) ? readdirSync(dir).filter((n) => !n.startsWith(".")).sort() : [];
const client = new Client({ connectionString: url });
await client.connect();

// Canonical Prisma migrations table (same shape prisma creates).
await client.query(`
  CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" timestamptz,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" timestamptz,
    "started_at" timestamptz NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
  );
`);

let applied = 0;
for (const name of names) {
  const file = join(dir, name, "migration.sql");
  if (!existsSync(file)) continue;
  const sql = readFileSync(file, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const row = await client.query('SELECT "checksum", "finished_at" FROM "_prisma_migrations" WHERE "migration_name" = $1', [name]);
  if (row.rowCount && row.rows[0].finished_at) {
    if (row.rows[0].checksum !== checksum) {
      console.warn(`warning: checksum differs for ${name} (migration file edited after being applied)`);
    }
    continue;
  }
  console.log(`applying ${name} ...`);
  await client.query("BEGIN");
  try {
    await client.query(sql);
    if (row.rowCount === 0) {
      await client.query(
        `INSERT INTO "_prisma_migrations" ("migration_name", "checksum", "finished_at", "applied_steps_count") VALUES ($1, $2, now(), 1)`,
        [name, checksum],
      );
    } else {
      await client.query(
        `UPDATE "_prisma_migrations" SET "checksum" = $2, "finished_at" = now(), "applied_steps_count" = "applied_steps_count" + 1 WHERE "migration_name" = $1`,
        [name, checksum],
      );
    }
    await client.query("COMMIT");
    applied++;
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`failed applying ${name}: ${e.message}`);
    process.exit(1);
  }
}
console.log(applied ? `done (${applied} migration(s) applied)` : "database is up to date");
await client.end();
