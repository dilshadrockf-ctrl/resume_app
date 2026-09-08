/* Live AI-path verification: stub provider + real service + real DB rows. */
import { db } from "../src/db/client.ts";
import { generateSuggestion, recordOutcome, evaluateOutput, SuggestError } from "../src/features/ai/service.ts";

const user = await db.user.findFirst({ where: { email: { startsWith: "e2e-" } }, include: { careerProfile: { include: { resumes: { where: { deletedAt: null }, take: 1 } } } } });
if (!user?.careerProfile) throw new Error("no user");
const resume = user.careerProfile.resumes[0];
if (!resume) throw new Error("no resume");
const ctx = { userId: user.id, email: user.email, profileId: user.careerProfile.id, isPremium: false, ip: "127.0.0.1" } as never;
await fetch("http://127.0.0.1:8787/mode?m=rewrite");

// guardrail unit checks (pure)
console.log("guardrail no_change:", evaluateOutput("a".repeat(100), "NO_CHANGE"));
console.log("guardrail inflation:", evaluateOutput("a".repeat(100), "b".repeat(600)));
console.log("guardrail ok:", evaluateOutput("Led a team that shipped X", "Shipped X, leading a team"));

// 1) happy path against stub (mode=rewrite)
const sug = await generateSuggestion(ctx, { resumeId: resume.id, sectionKind: "EXPERIENCE", itemIndex: 0, intent: "action-verbs" });
console.log("SUGGESTION ok:", !!sug.recommendationId, "provider:", sug.provider, "model:", sug.model);
console.log("original head:", sug.original.split("\n")[0]?.slice(0, 80));
console.log("suggested head:", sug.suggested.split("\n")[0]?.slice(0, 80));

const reco = await db.recommendation.findUniqueOrThrow({ where: { id: sug.recommendationId } });
console.log("DB reco:", reco.status, reco.action, "provider col:", reco.provider, "has snapshotBefore:", !!reco.snapshotBefore, "has original:", !!reco.original);

const accepted = await recordOutcome(ctx, sug.recommendationId, "ACCEPTED", sug.suggested + " [user edit]");
console.log("outcome recorded:", accepted, "→", (await db.recommendation.findUniqueOrThrow({ where: { id: sug.recommendationId } })).status);

const double = await recordOutcome(ctx, sug.recommendationId, "REJECTED");
console.log("second outcome rejected (idempotent):", !double);

// 2) inflation-blocked path
await fetch("http://127.0.0.1:8787/mode?m=inflate");
try {
  await generateSuggestion(ctx, { resumeId: resume.id, sectionKind: "EXPERIENCE", itemIndex: 0, intent: "tighten" });
  console.log("FAIL: inflation not blocked");
} catch (e) {
  console.log("inflation blocked:", e instanceof SuggestError && e.code === "BLOCKED");
}

// 3) NO_CHANGE honest path
await fetch("http://127.0.0.1:8787/mode?m=nochange");
try {
  await generateSuggestion(ctx, { resumeId: resume.id, sectionKind: "EXPERIENCE", itemIndex: 0, intent: "tighten" });
  console.log("FAIL: no-change passed through");
} catch (e) {
  console.log("no-change surfaces honestly:", e instanceof SuggestError && e.code === "NO_CHANGE");
}
await fetch("http://127.0.0.1:8787/mode?m=rewrite");

const gens = await db.aIGeneration.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4, select: { status: true, action: true, provider: true, durationMs: true, inputHash: true, error: true } });
for (const g of gens) console.log("AIGEN", g.status, g.action, g.provider, `${g.durationMs}ms`, g.inputHash?.slice(0, 8), (g.error ?? "").slice(0, 60));
console.log("AI_TEST_DONE");
