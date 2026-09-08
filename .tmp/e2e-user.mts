import { db } from "../src/db/client.ts";
import { hashPassword } from "../src/lib/password.ts";

const email = process.env.E2E_EMAIL ?? `e2e-${Date.now()}@local.test`;
const password = "correct-horse-battery-9";

let user = await db.user.findUnique({ where: { email } });
if (!user) {
  user = await db.user.create({
    data: {
      email,
      name: "E2E Tester",
      passwordHash: await hashPassword(password),
      emailVerified: new Date(),
      profile: { create: { displayName: "E2E Tester", email, headline: "Platform Engineer", location: "Remote", linkedin: "linkedin.com/in/e2e", website: "e2e.dev" } },
      careerProfile: { create: { summary: "Reliability-minded platform engineer with 6 years shipping internal developer platforms." } },
      subscription: { create: { planId: "free", provider: "none" } },
    },
  });
  const cp = await db.careerProfile.findUnique({ where: { userId: user.id } });
  await db.experience.create({
    data: { careerProfileId: cp!.id, employer: "Northwind Labs", title: "Senior Platform Engineer", startDate: "2021-03", current: true, bullets: ["Cut deploy time 70% by containerizing build pipeline", "Led migration of 40 services to Kubernetes"], order: 0 },
  });
  await db.experience.create({
    data: { careerProfileId: cp!.id, employer: "Datawise", title: "Platform Engineer", startDate: "2019-01", endDate: "2021-02", bullets: ["Built CI templates reused by 12 teams"], order: 1 },
  });
  await db.skill.create({ data: { careerProfileId: cp!.id, name: "Kubernetes", category: "TECHNICAL", keywords: ["k8s", "helm", "operators"] } });
  await db.skill.create({ data: { careerProfileId: cp!.id, name: "TypeScript", category: "PROGRAMMING", keywords: ["node", "react"] } });
  await db.education.create({ data: { careerProfileId: cp!.id, institution: "State University", degree: "BSc", field: "Computer Science", startDate: "2015", endDate: "2019" } });
  console.log("created", user.id);
} else {
  console.log("exists", user.id);
}
console.log(`E2E_CREDENTIALS ${email} ${password}`);
