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

// OS-specific embedded-postgres package (all are optionalDependencies, so npm
// installs only the one matching the current platform and skips the rest).
function platformPkg() {
  if (process.platform === "win32") return "windows-x64";
  if (process.platform === "darwin") return process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  if (process.platform === "linux") return process.arch === "arm64" ? "linux-arm64" : "linux-x64";
  return null;
}

function binName(n) {
  return process.platform === "win32" ? `${n}.exe` : n;
}

function binDir() {
  const pkg = platformPkg();
  const exe = binName("initdb");
  const candidates = pkg
    ? [
        join(process.cwd(), "node_modules", "@embedded-postgres", pkg, "native", "bin"),
        join(process.cwd(), "..", "node_modules", "@embedded-postgres", pkg, "native", "bin"),
      ]
    : [];
  const found = candidates.find((c) => existsSync(join(c, exe)));
  if (!found) {
    console.error(
      `Missing @embedded-postgres/${pkg ?? "<unsupported platform>"} for ${process.platform}-${process.arch}. ` +
        "Run `npm install` (don't use --no-optional), or use docker compose:\n" +
        "  docker compose up -d db",
    );
    process.exit(1);
  }
  return found;
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", ...opts });
}

function isUp() {
  const r = run(join(binDir(), binName("pg_ctl")), ["-D", dataDir, "status"]);
  return r.status === 0;
}

function start() {
  mkdirSync(root, { recursive: true });
  if (!existsSync(join(dataDir, "PG_VERSION"))) {
    console.log(`initializing postgres in ${dataDir}`);
    const pwFile = join(root, "pwfile");
    writeFileSync(pwFile, password);
    const init = run(join(binDir(), binName("initdb")), [
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
    // Idempotent: only append once (start runs again, e.g. after a reboot).
    // Forward slashes keep Windows paths (backslashes, spaces) valid in the conf file.
    if (!/^listen_addresses\s*=/m.test(conf)) conf += "\nlisten_addresses = 'localhost'\n";
    if (process.platform !== "win32" && !/^unix_socket_directories\s*=/m.test(conf)) {
      conf += "\nunix_socket_directories = '" + root.replace(/\\/g, "/") + "'\n";
    }
    writeFileSync(cfg, conf);
    const up = run(join(binDir(), binName("pg_ctl")), [
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
  // create database idempotently: trust-auth unix socket where available,
  // TCP + password otherwise (Windows has no unix-socket path for node-pg).
  const nodeRun = run(process.execPath, [
    join(process.cwd(), "scripts", "sandbox-db-create.mjs"),
    JSON.stringify({ socketDir: root, port, user, password, dbName }),
  ]);
  process.stdout.write(nodeRun.stdout ?? "");
  if (nodeRun.status !== 0) process.stderr.write(nodeRun.stderr ?? "");
}

function stop() {
  if (isUp()) run(join(binDir(), binName("pg_ctl")), ["-D", dataDir, "stop", "-m", "fast"]);
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
