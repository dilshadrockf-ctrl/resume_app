#!/usr/bin/env node
// Runs `prisma generate` after install but never fails the install: when the
// schema engine cannot run yet (offline envs, missing .env), `npm run setup`
// will re-run generation with the right configuration.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// A real generated client includes the compiled index and a copy of schema.prisma.
// If Prisma could only write its default "not initialized" stub (e.g. because it
// tried to download engines and had no network), the schema.prisma marker will be
// missing and the app crashes at runtime with:
//   "@prisma/client did not initialize yet. Please run "prisma generate""
const marker = join(process.cwd(), "node_modules", ".prisma", "client", "schema.prisma");
if (existsSync(marker)) process.exit(0);

// Use the same offline-safe generation path as `npm run setup`: with the WASM
// schema engine + driver adapter, generation does not require downloading native
// Prisma engines (works in restricted/air-gapped networks).
const env = {
  ...process.env,
  PRISMA_OFFLINE: "1",
  PRISMA_QUERY_ENGINE_LIBRARY: process.execPath,
  PRISMA_SCHEMA_ENGINE_BINARY: process.execPath,
};

// Windows needs a shell to resolve `npx` (.cmd shims, PATHEXT).
const r = spawnSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env,
});
if (r.status !== 0) {
  // During `npm install`/`npm ci` this must never break the install; the client
  // can be regenerated later with `npm run setup`. When called from a start
  // command (predev/prestart/preworker) there is no point booting an app that
  // would crash with "@prisma/client did not initialize yet", so fail loudly.
  const isInstall = process.env.npm_lifecycle_event === "postinstall";
  console.log(
    "\n(prisma generate did not run" +
      (isInstall ? " during install" : "") +
      " — run `npm run setup`, or `PRISMA_OFFLINE=1 npm run db:generate`, after configuring .env to generate the client.)\n",
  );
  process.exit(isInstall ? 0 : 1);
}
process.exit(0);
