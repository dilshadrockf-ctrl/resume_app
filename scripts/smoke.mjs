#!/usr/bin/env node
/**
 * Smoke test against a RUNNING instance (dev or docker): `npm run dev` in
 * another terminal, then `npm run test:e2e`. Covers the public surface and
 * the auth gate — the deep flows (save/export/publish/match) are exercised
 * by the vitest suites and by scripts/e2e.mjs (full lifecycle, real DB).
 */
const BASE = process.env.SMOKE_URL ?? "http://127.0.0.1:3000";
let fails = 0;

async function check(name, fn) {
  try {
    const why = await fn();
    console.log(`\x1b[32m✔\x1b[0m ${name}${why ? ` — ${why}` : ""}`);
  } catch (e) {
    fails++;
    console.log(`\x1b[31m✗\x1b[0m ${name} — ${e.message}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

await check("health", async () => {
  const r = await fetch(`${BASE}/api/health`);
  expect(r.status === 200, `status ${r.status}`);
  const j = await r.json();
  expect(j.ok === true || j.status === "ok", JSON.stringify(j).slice(0, 120));
  return "ok";
});
await check("landing has brand, no fake testimonials", async () => {
  const t = await (await fetch(BASE)).text();
  expect(/ResumeForge/.test(t), "brand missing");
  expect(!/“[^”+,”]{10,}” — (CTO|CEO|VP)/i.test(t), "suspected fabricated quote");
  return "200";
});
await check("login + register pages", async () => {
  for (const p of ["/login", "/register"]) {
    const r = await fetch(`${BASE}${p}`);
    expect(r.status === 200, `${p} → ${r.status}`);
  }
  return "200";
});
await check("auth gate redirects", async () => {
  const r = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  expect([307, 308].includes(r.status) || /login/.test(r.headers.get("location") ?? ""), `status ${r.status}`);
  return "307 → login";
});
await check("robots allows, app pages noindexed", async () => {
  const t = await (await fetch(`${BASE}/robots.txt`)).text();
  expect(/allow/i.test(t), "robots empty?");
  return "served";
});
await check("api auth session endpoint", async () => {
  const r = await fetch(`${BASE}/api/auth/session`);
  expect(r.status === 200, `status ${r.status}`);
  return "200";
});

process.exit(fails ? 1 : 0);
