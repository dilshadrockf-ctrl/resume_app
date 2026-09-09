import { createHash } from "node:crypto";
import { db } from "@/db/client";
import { type Ctx } from "@/server/context";
import { loadResumeDocument } from "@/features/resume/repository";
import {
  complete,
  aiStatus,
  hashInput,
  FACTS_SYSTEM_PROMPT,
  PROMPT_VERSION,
  evaluateOutput,
} from "@/services/ai/provider";
import type { ResumeDocument } from "@/lib/resume/document";

/** Core AI-suggestion flow, kept out of the server-action wrapper so it is
 * runnable/testable outside a request context. */

export type SuggestInput = {
  resumeId: string;
  sectionKind: string;
  itemIndex: number;
  intent: "tighten" | "action-verbs" | "align-job";
  jobDescriptionId?: string;
};

export class SuggestError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "TOO_SHORT" | "NO_CHANGE" | "BLOCKED" | "UNREACHABLE",
  ) {
    super(message);
  }
}

export type SuggestionResult = {
  recommendationId: string;
  original: string;
  suggested: string;
  sectionKind: string;
  itemIndex: number;
  provider: string;
  model: string;
};

export async function generateSuggestion(ctx: Ctx, input: SuggestInput): Promise<SuggestionResult> {
  if (!aiStatus().configured)
    throw new SuggestError(
      "AI provider not configured — set AI_PROVIDER in .env (optional).",
      "UNREACHABLE",
    );

  const { doc } = await loadResumeDocument(ctx.userId, input.resumeId);
  const sec = doc.sections.find((s) => s.kind === input.sectionKind);
  const item = sec?.items[input.itemIndex];
  if (!sec || !item)
    throw new SuggestError(
      "That section or item no longer exists — refresh the editor.",
      "NOT_FOUND",
    );

  const isSummary = input.sectionKind === "SUMMARY";
  const bullets: string[] = Array.isArray((item as { bullets?: string[] }).bullets)
    ? (item as { bullets: string[] }).bullets
    : [];
  const original = isSummary ? (doc.summary ?? "") : bullets.join("\n");
  if (original.trim().length < 25)
    throw new SuggestError(
      "Not enough text there yet — the assistant only rewrites what you already wrote.",
      "TOO_SHORT",
    );

  const userPrompt = await buildPrompt(ctx, doc, input, {
    isSummary,
    secTitle: sec.title ?? "Section",
    original,
  });
  const promptKey = `resume.suggest.${input.intent}`;

  const gen = await db.aIGeneration.create({
    data: {
      userId: ctx.userId,
      action: "improve_bullet",
      status: "SUCCESS",
      provider: aiStatus().provider,
      model: aiStatus().model ?? "unknown",
      promptKey,
      promptVersion: PROMPT_VERSION,
      inputHash: hashInput(userPrompt),
    },
  });
  const t0 = Date.now();
  let result;
  try {
    result = await complete({
      promptKey,
      promptVersion: PROMPT_VERSION,
      system: FACTS_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: isSummary ? 320 : 400,
    });
  } catch (e) {
    await db.aIGeneration.update({
      where: { id: gen.id },
      data: {
        status: "FAILED",
        durationMs: Date.now() - t0,
        error: String(e instanceof Error ? e.message : e).slice(0, 500),
      },
    });
    throw new SuggestError(
      "The AI provider could not be reached. Your text is untouched — everything else in the app works without AI.",
      "UNREACHABLE",
    );
  }

  const verdict = evaluateOutput(original, result.text);
  if (verdict !== "ok") {
    await db.aIGeneration.update({
      where: { id: gen.id },
      data:
        verdict === "no_change"
          ? {
              status: "INVALID_OUTPUT",
              durationMs: Date.now() - t0,
              output: { note: "NO_CHANGE" } as never,
            }
          : {
              status: "BLOCKED_QUOTA",
              durationMs: Date.now() - t0,
              error: "output inflated beyond input — blocked",
            },
    });
    throw new SuggestError(
      verdict === "no_change"
        ? "The provider found nothing factual to improve. That's an honest answer — consider adding specifics yourself instead."
        : "The suggestion tried to add more than it rewrote, so it was blocked. Nothing was changed.",
      verdict === "no_change" ? "NO_CHANGE" : "BLOCKED",
    );
  }

  await db.aIGeneration.update({
    where: { id: gen.id },
    data: {
      status: "SUCCESS",
      durationMs: Date.now() - t0,
      tokensIn: result.tokensIn ?? null,
      tokensOut: result.tokensOut ?? null,
      provider: result.provider,
      model: result.model,
      fallbackUsed: result.fallbackUsed,
      output: { text: result.text.slice(0, 4000) } as never,
    },
  });

  const reco = await db.recommendation.create({
    data: {
      userId: ctx.userId,
      sectionKind: (isSummary ? "SUMMARY" : sec.kind) as never,
      entryRef: `${sec.kind.toLowerCase()}:${input.itemIndex}`,
      action: isSummary ? "REWRITE_SUMMARY" : "REWRITE_BULLET",
      rationale: `AI (${result.provider}/${result.model}) · ${input.intent} · original kept for side-by-side review`,
      original,
      suggested: result.text.slice(0, 4000),
      snapshotBefore: { item, summary: doc.summary } as never,
      promptKey,
      promptVersion: String(PROMPT_VERSION),
      provider: result.provider,
      model: result.model,
    },
  });

  return {
    recommendationId: reco.id,
    original,
    suggested: result.text.slice(0, 4000),
    sectionKind: isSummary ? "SUMMARY" : sec.kind,
    itemIndex: input.itemIndex,
    provider: result.provider,
    model: result.model,
  };
}

async function buildPrompt(
  ctx: Ctx,
  _doc: ResumeDocument,
  input: SuggestInput,
  part: { isSummary: boolean; secTitle: string; original: string },
): Promise<string> {
  let jdBlock = "";
  if (input.intent === "align-job" && input.jobDescriptionId) {
    const job = await db.jobDescription.findFirst({
      where: { id: input.jobDescriptionId, userId: ctx.userId },
      select: { title: true, rawText: true },
    });
    if (job)
      jdBlock = `\n\nTarget role: ${job.title}\nJob excerpt (for emphasis only — do not claim anything new):\n${job.rawText.slice(0, 2500)}`;
  }
  const instruction =
    input.intent === "tighten"
      ? "Make it tighter: cut filler and redundancy, keep every fact."
      : input.intent === "action-verbs"
        ? "Rewrite lines to begin with a strong past-tense action verb; keep all facts and numbers identical."
        : "Rephrase emphasis toward the target role's language, but ONLY using facts already present below." +
          jdBlock;
  return `Text (${part.isSummary ? "professional summary" : `${part.secTitle} entry`}):\n"""\n${part.original}\n"""${part.isSummary ? "" : "\n(Rewrite these bullet lines only.)"}\n\nTask: ${instruction}`;
}

export async function recordOutcome(
  ctx: Ctx,
  recommendationId: string,
  outcome: "ACCEPTED" | "REJECTED",
  finalText?: string,
): Promise<boolean> {
  const res = await db.recommendation.updateMany({
    where: { id: recommendationId, userId: ctx.userId, status: "PENDING" },
    data: { status: outcome, ...(finalText ? { edited: finalText } : {}) },
  });
  return res.count > 0;
}

export { hashInput, evaluateOutput };
