#!/usr/bin/env node
/**
 * One-command local bootstrap, safe to re-run:
 *   1. .env — created from .env.example with a fresh AUTH_SECRET
 *   2. PostgreSQL — embedded dev cluster via scripts/sandbox-db.mjs
 *      (or respects an existing DATABASE_URL pointing elsewhere)
 *   3. schema — offline SQL migration applier (no engine downloads)
 *   4. prisma client — generate (offline placeholders if PRISMA_OFFLINE)
 *   5. seed — plans (+ demo account only with SEED_DEMO=1)
 * No cloud accounts, nothing proprietary (§1/§201).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const log = (m) => console.log(`\x1b[36msetup\x1b[0m ${m}`);
const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: false, ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    console.error(`\x1b[31msetup failed:\x1b[0m ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
};

// 1. env file
if (!existsSync(".env")) {
  if (existsSync(".env.example")) {
    copyFileSync(".env.example", ".env");
    let env = readFileSync(".env", "utf8");
    const secret = randomBytes(32).toString("hex");
    env = /^AUTH_SECRET=.*$/m.test(env) ? env.replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET=${secret}`) : `${env}\nAUTH_SECRET=${secret}\n`;
    writeFileSync(".env", env);
    log("created .env from .env.example (+ generated AUTH_SECRET)");
  } else {
    console.error("no .env and no .env.example — cannot continue");
    process.exit(1);
  }
} else {
  log(".env already present — leaving it alone");
}
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && m[1] && m[2] !== undefined && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

// 2. database
if (process.env.DATABASE_URL) {
  log(`using DATABASE_URL → ${process.env.DATABASE_URL.replace(/:[^:@/]*@/, ":***@")}`);
}
log("ensuring local postgres (skips silently if one already answers on 5432)");
sh("node", ["scripts/sandbox-db.mjs", "start"], { allowFail: true });

// 3. schema
log("applying migrations (offline applier — engine-free)");
sh("node", ["scripts/db-apply-sql.mjs"]);

// 4. client
log("generating prisma client");
const offline = { ...process.env, PRISMA_OFFLINE: "1", PRISMA_QUERY_ENGINE_LIBRARY: process.execPath, PRISMA_SCHEMA_ENGINE_BINARY: process.execPath };
sh("npx", ["prisma", "generate"], { env: offline });

// 5. seed
log("seeding plans");
sh("npx", ["prisma", "db", "seed"], { env: offline });

log("\x1b[32mdone\x1b[0b — next: `npm run dev` (UI) and `npm run worker` (queue) in another terminal");
void execFileSync; // keep import tree-shake-friendly
