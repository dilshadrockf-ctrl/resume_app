"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { ok, withValidation, type ActionResult } from "@/server/action-utils";
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
