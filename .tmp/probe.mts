import { db } from "../src/db/client.ts";
import { generateSuggestion, SuggestError } from "../src/features/ai/service.ts";
const user = await db.user.findFirst({ where: { email: { startsWith: "e2e-" } }, include: { careerProfile: { include: { resumes: { where: { deletedAt: null }, take: 1 } } } } });
const ctx = { userId: user!.id, email: user!.email, profileId: user!.careerProfile!.id, isPremium: false, ip: "127.0.0.1" } as never;
await fetch("http://127.0.0.1:8787/mode?m=inflate");
try {
  await generateSuggestion(ctx, { resumeId: user!.careerProfile!.resumes[0].id, sectionKind: "EXPERIENCE", itemIndex: 0, intent: "tighten" });
} catch (e: any) {
  console.log("name:", e?.constructor?.name, "| code:", e?.code, "| instanceof:", e instanceof SuggestError);
  console.log("message:", String(e?.message).slice(0, 120));
}
