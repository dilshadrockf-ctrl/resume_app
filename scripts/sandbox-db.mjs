#!/usr/bin/env node
/**
 * No-Docker local database helper (development / sandboxes only).
 *
 * If your machine cannot run `docker compose`, this script boots a real
 * PostgreSQL server from the `@embedded-postgres/*` npm packages into
 * `.dev/postgres`, with the exact credentials `.env.example` expects.
 *
 *   npm run db:local            # start  (idempotent)
 *   npm run db:local -- stop    # stop
 *
 * Not a production tool — production should use your real PostgreSQL.
 */
import { spawnSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(process.cwd(), ".dev", "postgres");
const dataDir = join(root, "data");
const logFile = join(root, "postgres.log");

const user = process.env.POSTGRES_USER || "resume";
const password = process.env.POSTGRES_PASSWORD || "resume";
const dbName = process.env.POSTGRES_DB || "resumebuilder";
const port = Number(process.env.POSTGRES_PORT || 5432);

function binDir() {
  const candidates = [
    join(process.cwd(), "node_modules", "@embedded-postgres", "linux-x64", "native", "bin"),
    join(process.cwd(), "..", "node_modules", "@embedded-postgres", "linux-x64", "native", "bin"),
  ];
  const found = candidates.find((c) => existsSync(join(c, "initdb")));
  if (!found) {
    console.error(
      "Missing @embedded-postgres/linux-x64. Install dev deps, or use docker compose:\n" +
        "  docker compose up -d postgres",
    );
    process.exit(1);
  }
  return found;
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", ...opts });
}

function isUp() {
  const r = run(join(binDir(), "pg_ctl"), ["-D", dataDir, "status"]);
  return r.status === 0;
}

function start() {
  mkdirSync(root, { recursive: true });
  if (!existsSync(join(dataDir, "PG_VERSION"))) {
    console.log(`initializing postgres in ${dataDir}`);
    const pwFile = join(root, "pwfile");
    writeFileSync(pwFile, password);
    const init = run(join(binDir(), "initdb"), [
      "-D", dataDir, "-U", user, "--pwfile", pwFile, "-E", "UTF8", "--auth-local=trust", "--auth-host=scram-sha-256",
    ]);
    if (init.status !== 0) {
      console.error(init.stdout + init.stderr);
      process.exit(1);
    }
  }
  if (!isUp()) {
    const cfg = join(dataDir, "postgresql.conf");
    let conf = readFileSync(cfg, "utf8");
    if (!/^port\s*=/m.test(conf)) conf += `\nport = ${port}\n`;
    conf += "\nlisten_addresses = 'localhost'\nunix_socket_directories = '" + root + "'\n";
    writeFileSync(cfg, conf);
    const up = run(join(binDir(), "pg_ctl"), [
      "-D", dataDir, "-l", logFile, "-o", `-p ${port}`, "start", "-w", "-t", "30",
    ]);
    if (up.status !== 0) {
      console.error(up.stdout + up.stderr);
      process.exit(1);
    }
    console.log("postgres started");
  } else {
    console.log("postgres already running");
  }
  // create database idempotently over the trust-auth unix socket
  const nodeRun = run(process.execPath, [
    join(process.cwd(), "scripts", "sandbox-db-create.mjs"),
    JSON.stringify({ host: join(root), port, user, dbName }),
  ]);
  process.stdout.write(nodeRun.stdout ?? "");
  if (nodeRun.status !== 0) process.stderr.write(nodeRun.stderr ?? "");
}

function stop() {
  if (isUp()) run(join(binDir(), "pg_ctl"), ["-D", dataDir, "stop", "-m", "fast"]);
  console.log("stopped");
}

const cmd = process.argv[2] || "start";
if (cmd === "start") start();
else if (cmd === "stop") stop();
else if (cmd === "status") console.log(isUp() ? "running" : "stopped");
else {
  console.error("usage: sandbox-db.mjs [start|stop|status]");
  process.exit(2);
}
