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
 * By default the data directory is `.dev/postgres/data`. If your checkout
 * lives inside a cloud-synced folder (OneDrive, Dropbox, Google Drive, …) or
 * a network share, PostgreSQL and the sync engine fight over file locks and
 * `initdb`/startup can hang or corrupt data. Point the data directory at a
 * local, non-synced folder instead:
 *
 *   Windows (cmd):    set POSTGRES_DATA_DIR=C:\resumeforge-data && npm run setup
 *   PowerShell:       $env:POSTGRES_DATA_DIR="C:\resumeforge-data"; npm run setup
 *   macOS/Linux:      POSTGRES_DATA_DIR=~/resumeforge-data npm run setup
 *
 * Not a production tool — production should use your real PostgreSQL.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = resolve(process.env.POSTGRES_DATA_DIR || join(process.cwd(), ".dev", "postgres"));
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
  return spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

function isUp() {
  const r = run(join(binDir(), binName("pg_ctl")), ["-D", dataDir, "status"]);
  return r.status === 0;
}

// Cloud-sync / network-drive detection. PostgreSQL requires byte-level file
// locking and streaming writes; synced folders lock files behind its back,
// which makes initdb/startup hang (or corrupts the cluster).
const SYNC_SEGMENTS = [
  "onedrive",
  "dropbox",
  "google drive",
  "icloud",
  "skydrive",
  "box",
  "box drive",
  "mega",
  "nextcloud",
  "owncloud",
  "pcloud",
  "nutstore",
  "synology drive",
];
function isSyncedPath(p) {
  const segments = p.split(/[\\/]+/).filter(Boolean);
  return segments.some((s) => {
    const t = s.toLowerCase();
    return SYNC_SEGMENTS.some((pref) => t === pref || t.startsWith(`${pref} `));
  });
}

function warnIfSynced(dir) {
  const onNetworkShare = process.platform === "win32" && /^\\\\/.test(dir);
  if (!isSyncedPath(dir) && !onNetworkShare) return;
  console.warn(
    `\n\x1b[33m⚠ PostgreSQL data directory is inside a synced/network folder:\x1b[0m\n   ${dir}\n` +
      "   Cloud-sync (OneDrive, Dropbox, …) and network drives lock files while\n" +
      "   PostgreSQL writes to them — `initdb` or server startup can hang, and the\n" +
      "   data directory can be corrupted. Move it to a local, non-synced folder:\n\n" +
      (process.platform === "win32"
        ? "     set POSTGRES_DATA_DIR=C:\\resumeforge-data && npm run setup\n"
        : "     POSTGRES_DATA_DIR=~/resumeforge-data npm run setup\n") +
      "   (or move the whole project out of the synced folder).\n",
  );
}

function start() {
  warnIfSynced(dataDir);
  mkdirSync(root, { recursive: true });
  if (!existsSync(join(dataDir, "PG_VERSION"))) {
    console.log(`initializing postgres in ${dataDir}`);
    const pwFile = join(root, "pwfile");
    writeFileSync(pwFile, password);
    // Stream initdb output so a slow (or stuck) init is visible, not silent.
    // A 10-minute cap guards against infinite hangs on locked/synced storage.
    const init = run(
      join(binDir(), binName("initdb")),
      ["-D", dataDir, "-U", user, "--pwfile", pwFile, "-E", "UTF8", "--auth-local=trust", "--auth-host=scram-sha-256"],
      { stdio: "inherit", timeout: 10 * 60 * 1000 },
    );
    if (init.status !== 0) {
      console.error(`\n\x1b[31minitdb failed\x1b[0m (exit ${init.status ?? "killed"})`);
      if (init.error) console.error(`  ${init.error.message}`);
      console.error(
        "  Common causes:\n" +
        `  • the data directory is on a synced/network drive — see warning above, or delete ${dataDir} and retry\n` +
        "  • antivirus/Defender blocking writes — add an exclusion for the data directory\n" +
        "  • a leftover/partial cluster — remove the data directory and re-run setup\n",
      );
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
    const up = run(
      join(binDir(), binName("pg_ctl")),
      ["-D", dataDir, "-l", logFile, "-o", `-p ${port}`, "start", "-w", "-t", "30"],
      { stdio: "inherit", timeout: 120 * 1000 },
    );
    if (up.status !== 0) {
      console.error(`\n\x1b[31mpostgres failed to start\x1b[0m (exit ${up.status ?? "killed"})`);
      if (up.error) console.error(`  ${up.error.message}`);
      console.error(`  See ${logFile} for the server log.`);
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
