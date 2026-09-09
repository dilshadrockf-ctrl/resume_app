"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { ok, fail, withValidation, type ActionResult } from "@/server/action-utils";
import { requireCtx } from "@/server/context";
import * as service from "@/features/coverletters/service";

const createSchema = z.object({
  company: z.string().trim().min(1).max(160),
  role: z.string().trim().min(1).max(160),
  hiringManager: z.string().trim().max(120).optional(),
  tone: z
    .enum(["PROFESSIONAL", "CONCISE", "TRADITIONAL", "TECHNICAL", "EXECUTIVE", "FRIENDLY"])
    .default("PROFESSIONAL"),
  length: z.enum(["SHORT", "STANDARD", "DETAILED"]).default("STANDARD"),
  jobId: z.string().max(64).optional(),
  resumeId: z.string().max(64).optional(),
});

export async function createLetterAction(
  raw: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withValidation(createSchema, raw, async (input) => {
    const ctx = await requireCtx();
    const id = await service.createLetter(ctx, {
      company: input.company,
      role: input.role,
      hiringManager: input.hiringManager,
      tone: input.tone ?? "PROFESSIONAL",
      length: input.length ?? "STANDARD",
      jobId: input.jobId || null,
      resumeId: input.resumeId || null,
    });
    revalidatePath("/cover-letters");
    return ok({ id });
  });
}

export async function saveLetterAction(raw: {
  id: string;
  content?: string;
  status?: "DRAFT" | "FINAL" | "SENT";
}): Promise<ActionResult<undefined>> {
  return withValidation(
    z.object({
      id: z.string().min(1).max(64),
      content: z.string().max(20_000).optional(),
      status: z.enum(["DRAFT", "FINAL", "SENT"]).optional(),
    }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      await service.saveLetter(ctx, input.id, { content: input.content, status: input.status });
      revalidatePath(`/cover-letters/${input.id}`);
      revalidatePath("/cover-letters");
      return ok(undefined);
    },
  );
}

export async function deleteLetterAction(raw: { id: string }): Promise<ActionResult<undefined>> {
  return withValidation(z.object({ id: z.string().min(1).max(64) }), raw, async (input) => {
    const ctx = await requireCtx();
    await db.coverLetter.deleteMany({ where: { id: input.id, userId: ctx.userId } });
    revalidatePath("/cover-letters");
    return ok(undefined);
  });
}

/** Queue a deterministic re-scaffold of a DRAFT letter from its job (never
 *  applied to FINAL/SENT). The queue handler enforces that too. */
export async function queueLetterRebuildAction(raw: {
  id: string;
}): Promise<ActionResult<{ queued: boolean }>> {
  return withValidation(z.object({ id: z.string().min(1).max(64) }), raw, async (input) => {
    const ctx = await requireCtx();
    const letter = await db.coverLetter.findFirst({
      where: { id: input.id, userId: ctx.userId },
      select: { id: true, status: true },
    });
    if (!letter) return fail("Not found", "NOT_FOUND");
    if (letter.status !== "DRAFT") return fail("Only drafts can be rebuilt.", "FORBIDDEN");
    const { enqueue } = await import("@/services/queue");
    await enqueue(
      "COVER_LETTER_GENERATE",
      ctx.userId,
      { type: "COVER_LETTER_GENERATE", coverLetterId: letter.id },
      { maxAttempts: 1 },
    );
    return ok({ queued: true });
  });
}
