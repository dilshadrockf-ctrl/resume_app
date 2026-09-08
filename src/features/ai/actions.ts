"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { ok, fail, withValidation, type ActionResult } from "@/server/action-utils";
import { audit, requireCtx } from "@/server/context";
import { aiStatus } from "@/services/ai/provider";
import {
  generateSuggestion,
  recordOutcome,
  SuggestError,
  type SuggestionResult,
} from "@/features/ai/service";

/**
 * AI suggestions (§17): generate → PENDING Recommendation row → user reviews
 * Original vs Suggested → accept rewrites ONLY the client-side draft state or
 * reject. The provider can never write to a saved document directly.
 */

export async function aiStatusAction(): Promise<ActionResult<ReturnType<typeof aiStatus>>> {
  return ok(aiStatus());
}

const generateSchema = z.object({
  resumeId: z.string().min(1).max(64),
  sectionKind: z.enum([
    "SUMMARY",
    "EXPERIENCE",
    "PROJECTS",
    "EDUCATION",
    "SKILLS",
    "CERTIFICATIONS",
    "AWARDS",
    "PUBLICATIONS",
    "VOLUNTEER",
    "CUSTOM",
    "LANGUAGES",
  ]),
  itemIndex: z.number().int().min(0).max(99),
  intent: z.enum(["tighten", "action-verbs", "align-job"]),
  jobDescriptionId: z.string().max(64).optional(),
});

export type Suggestion = SuggestionResult;

export async function aiSuggestAction(
  raw: z.input<typeof generateSchema>,
): Promise<ActionResult<Suggestion>> {
  return withValidation(generateSchema, raw, async (input) => {
    const ctx = await requireCtx();
    try {
      const result = await generateSuggestion(ctx, input);
      await audit(ctx, "ai_suggestion_created", {
        recoId: result.recommendationId,
        provider: result.provider,
        intent: input.intent,
      });
      return ok(result);
    } catch (e) {
      if (e instanceof SuggestError) {
        const code =
          e.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : e.code === "BLOCKED" || e.code === "NO_CHANGE"
              ? "CONFLICT"
              : e.code === "TOO_SHORT"
                ? "VALIDATION"
                : "INTERNAL";
        return fail(e.message, code);
      }
      return fail("Unexpected AI error — your text is untouched.", "INTERNAL");
    }
  });
}

const outcomeSchema = z.object({
  recommendationId: z.string().min(1).max(64),
  outcome: z.enum(["ACCEPTED", "REJECTED"]),
  finalText: z.string().max(6000).optional(),
});

export async function aiOutcomeAction(
  raw: z.input<typeof outcomeSchema>,
): Promise<ActionResult<undefined>> {
  return withValidation(outcomeSchema, raw, async (input) => {
    const ctx = await requireCtx();
    const changed = await recordOutcome(
      ctx,
      input.recommendationId,
      input.outcome,
      input.finalText,
    );
    if (!changed) return fail("Already handled", "NOT_FOUND");
    revalidatePath("/resumes");
    return ok(undefined);
  });
}

/** Recent AI activity for the dialog footer — provenance, not marketing. */
export async function recentAiAction(): Promise<
  ActionResult<
    Array<{ action: string; provider: string; model: string; status: string; createdAt: string }>
  >
> {
  const ctx = await requireCtx();
  const rows = await db.aIGeneration.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { action: true, provider: true, model: true, status: true, createdAt: true },
  });
  return ok(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
}

/** Lite job list for the align-job intent. */
export async function aiJobsAction(): Promise<ActionResult<Array<{ id: string; title: string }>>> {
  const ctx = await requireCtx();
  const rows = await db.jobDescription.findMany({
    where: { userId: ctx.userId },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return ok(rows);
}
