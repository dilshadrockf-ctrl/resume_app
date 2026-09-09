"use server";
import { z } from "zod";
import { ok, fail, withValidation, type ActionResult } from "@/server/action-utils";
import { requireCtx } from "@/server/context";
import { latestAnalysis, persistAnalysis } from "@/features/export/service";
import { db } from "@/db/client";

export type AnalysisDto = {
  score: number;
  engineVersion: string;
  breakdown: Record<string, { earned: number; possible: number; note: string }>;
  issues: Array<{
    code: string;
    severity: "high" | "medium" | "low";
    sectionKind?: string;
    itemIndex?: number;
    message: string;
    fix: string;
    evidence?: string;
  }>;
  analyzedAt: string;
  versionLabel: string;
} | null;

function toDto(
  versionLabel: string,
  a: NonNullable<Awaited<ReturnType<typeof latestAnalysis>>>["analysis"],
): AnalysisDto {
  if (!a) return null;
  return {
    score: a.score,
    engineVersion: a.atsEngineVersion,
    breakdown: a.breakdown as never,
    issues: a.issues as never,
    analyzedAt: a.createdAt.toISOString(),
    versionLabel,
  };
}

export async function getAnalysisAction(raw: {
  resumeId: string;
}): Promise<ActionResult<AnalysisDto>> {
  return withValidation(z.object({ resumeId: z.string().min(1).max(64) }), raw, async (input) => {
    const ctx = await requireCtx();
    const res = await latestAnalysis(ctx.userId, input.resumeId);
    if (!res) return fail("Resume not found", "NOT_FOUND");
    return ok(toDto(res.version.label, res.analysis));
  });
}

/** Force a fresh pass against the latest saved state (bypasses the queue). */
export async function runAnalysisNowAction(raw: {
  resumeId: string;
}): Promise<ActionResult<AnalysisDto>> {
  return withValidation(z.object({ resumeId: z.string().min(1).max(64) }), raw, async (input) => {
    const ctx = await requireCtx();
    const version = await db.resumeVersion.findFirst({
      where: { resumeId: input.resumeId, resume: { careerProfile: { userId: ctx.userId } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true },
    });
    if (!version) return fail("Resume not found", "NOT_FOUND");
    try {
      await persistAnalysis(version.id);
    } catch {
      return fail("Analysis failed — your data is untouched.", "INTERNAL");
    }
    const analysis = await db.resumeAnalysis.findFirst({
      where: { resumeVersionId: version.id, userId: ctx.userId },
      orderBy: { createdAt: "desc" },
    });
    return ok(toDto(version.label, analysis));
  });
}
