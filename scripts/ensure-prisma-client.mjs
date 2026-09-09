#!/usr/bin/env node
// Runs `prisma generate` after install but never fails the install: when the
// schema engine cannot run yet (offline envs, missing .env), `npm run setup`
// will re-run generation with the right configuration.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const marker = join(process.cwd(), "node_modules", ".prisma", "client", "index.js");
if (existsSync(marker)) process.exit(0);

// Windows needs a shell to resolve `npx` (.cmd shims, PATHEXT).
const r = spawnSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (r.status !== 0) {
  console.log(
    "\n(prisma generate did not run during install — that's OK; run `npm run setup` " +
      "after configuring .env to generate the client.)\n",
  );
}
process.exit(0);
