#!/usr/bin/env npx tsx
/** Prints which optional integrations are configured — nothing else. */
import { readFileSync, existsSync } from "node:fs";
for (const f of [".env", ".env.local"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[1] && m[2] !== undefined && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
import { appConfig, env, envWarnings } from "@/lib/env";
import { storageStatus } from "@/services/storage";

const fmt = (label: string, ok: boolean, detail = "") =>
  console.log(`${ok ? "\x1b[32m✔\x1b[0m" : "\x1b[33m•\x1b[0m"} ${label}${detail ? ` — ${detail}` : ""}`);

const problems = envWarnings() ?? [];
if (problems.length > 0) {
  console.log("\x1b[31menvironment problems:\x1b[0m");
  for (const p of problems) console.log(" " + p);
}

fmt("database", true, env.DATABASE_URL.replace(/:[^:@/]*@/, ":***@"));
fmt("auth secret", Boolean(env.AUTH_SECRET), env.AUTH_SECRET ? `${env.AUTH_SECRET.length} chars` : "missing (dev-only tolerance)");
fmt("redis queue", Boolean(env.REDIS_URL), env.REDIS_URL ? "dedicated worker available" : "in-process queue (single node)");
const st = storageStatus();
fmt("file storage", st.ok, `${st.driver}: ${st.detail.slice(0, 80)}`);
fmt("mail", Boolean(env.MAIL_HOST), env.MAIL_HOST ?? "not set — signup emails disabled, app still works");
const ai = appConfig.aiConfigured ? true : false;
fmt("AI provider", ai, ai ? `${env.AI_PROVIDER}/${env.AI_DEFAULT_MODEL ?? "default"}` : "none — optional by design");
fmt("billing", env.BILLING_ENABLED, env.BILLING_ENABLED ? "ENABLED" : "dormant (architecture ready, no payment flows)");
console.log(`\napp url: ${env.NEXT_PUBLIC_APP_URL}`);
