import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync, existsSync } from "node:fs";

/**
 * Development seed. Only reference data (plans + feature flags) is required
 * for the app to boot; a demo account is created solely when SEED_DEMO=1 and
 * never in production (§71/§143).
 */

if (process.env.NODE_ENV === "production") {
  console.error("prisma/seed.ts is for development only — refusing to run in production.");
  process.exit(1);
}

for (const f of ["../.env", ".env"]) {
  if (existsSync(new URL(f, import.meta.url))) {
    for (const line of readFileSync(new URL(f, import.meta.url), "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && m[1] && m[2] !== undefined && !process.env[m[1]])
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://resume:resume@localhost:5432/resumebuilder",
  }),
});

const PLANS = [
  {
    id: "free",
    name: "Free",
    tagline: "Everything you need to finish one great resume",
    priceCentsMonthly: 0,
    priceCentsAnnual: 0,
    limits: { resumes: 3, jobPosts: 10, exportsPerDay: 20, aiRequests: 0 },
    features: [
      "Unlimited edits & autosave",
      "PDF / DOCX / TXT export",
      "Local ATS-style match scoring",
      "Version history",
      "Public link with noindex",
    ],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For an active search",
    priceCentsMonthly: 900,
    priceCentsAnnual: 8400,
    limits: { resumes: 25, jobPosts: 200, exportsPerDay: 200, aiRequests: 500 },
    features: [
      "Everything in Free",
      "Cover letter toolkit",
      "Application pipeline & reminders",
      "AI rewrite suggestions (optional providers)",
    ],
    highlighted: true,
  },
];

async function main() {
  for (const p of PLANS) {
    await db.plan.upsert({ where: { id: p.id }, update: { ...p }, create: p });
  }
  console.log(`seeded ${PLANS.length} plans`);

  if (process.env.SEED_DEMO === "1") {
    const { hash } = await import("@node-rs/argon2")
      .then((m) => ({ hash: m.verify }) as never)
      .catch(() => ({ hash: null }));
    void hash;
    const email = "demo@local.test";
    const passwordHash = "demo-not-for-auth"; // demo login is disabled by default; use /register
    const existing = await db.user.findUnique({ where: { email } });
    if (!existing) {
      await db.user.create({
        data: {
          email,
          name: "Demo Explorer",
          passwordHash,
          emailVerified: new Date(),
          profile: { create: { displayName: "Demo Explorer", email } },
          careerProfile: { create: { summary: "Seed profile — delete freely." } },
          subscription: { create: { planId: "free", provider: "none" } },
        },
      });
      console.log("seeded demo user (register normally for a real account)");
    } else console.log("demo user already present");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
