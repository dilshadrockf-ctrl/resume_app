"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { ok, fail, withValidation, type ActionResult } from "@/server/action-utils";
import { audit, requireCtx } from "@/server/context";
import * as service from "@/features/jobs/service";

const jdSchema = z.object({
  title: z.string().trim().min(2).max(160),
  company: z.string().trim().max(160).optional(),
  location: z.string().trim().max(160).optional(),
  url: z.string().url().max(500).optional().or(z.literal("")),
  salary: z.string().trim().max(120).optional(),
  text: z
    .string()
    .trim()
    .min(120, "Paste at least a paragraph of the posting so keyword analysis means something.")
    .max(200_000),
});

export async function createJobAction(
  raw: z.input<typeof jdSchema>,
): Promise<ActionResult<{ jobId: string }>> {
  return withValidation(jdSchema, raw, async (input) => {
    const ctx = await requireCtx();
    const job = await service.createJob(ctx, input);
    await audit(ctx, "job_created", { jobId: job.id });
    revalidatePath("/jobs");
    return ok({ jobId: job.id });
  });
}

export async function matchJobAction(raw: {
  jobId: string;
  resumeId: string;
}): Promise<ActionResult<{ matchId: string }>> {
  return withValidation(
    z.object({ jobId: z.string().min(1).max(64), resumeId: z.string().min(1).max(64) }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      const matchId = await service.matchJobAgainstResume(ctx, input.jobId, input.resumeId);
      await audit(ctx, "job_matched", input);
      revalidatePath(`/jobs/${input.jobId}`);
      return ok({ matchId });
    },
  );
}

export async function deleteJobAction(raw: { jobId: string }): Promise<ActionResult<undefined>> {
  return withValidation(z.object({ jobId: z.string().min(1).max(64) }), raw, async (input) => {
    const ctx = await requireCtx();
    await service.deleteJob(ctx, input.jobId);
    revalidatePath("/jobs");
    return ok(undefined);
  });
}

/** Accept a factual surfacing recommendation: reveal a hidden item or attach
 *  the matching library entry. Never writes new claims (§16/§17). */
export async function applyRecommendationAction(raw: {
  recommendationId: string;
}): Promise<ActionResult<{ applied: string }>> {
  return withValidation(
    z.object({ recommendationId: z.string().min(1).max(64) }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      const reco = await db.recommendation.findFirst({
        where: { id: input.recommendationId, userId: ctx.userId, status: "PENDING" },
        include: { resumeVersion: { select: { resumeId: true } } },
      });
      if (!reco) return fail("Recommendation not found (maybe already handled).", "NOT_FOUND");
      const resumeId = reco.resumeVersion?.resumeId;
      if (!resumeId) return fail("The matched resume version is gone.", "NOT_FOUND");
      const { loadResumeDocument, saveResumeDocument } =
        await import("@/features/resume/repository");
      const { doc } = await loadResumeDocument(ctx.userId, resumeId);

      let applied = "surfaced";
      if (reco.action === "ADD_KEYWORD") {
        const profile = await db.careerProfile.findUnique({
          where: { userId: ctx.userId },
          include: {
            experiences: { where: { archivedAt: null } },
            projects: { where: { archivedAt: null } },
            skills: { where: { archivedAt: null } },
          },
        });
        const termMatch = reco.rationale?.match(/“([^”]+)”/);
        const term = (termMatch?.[1] ?? "").toLowerCase();
        let done = false;
        if (profile && term) {
          // 1) hidden link in this resume? reveal it
          for (const sec of doc.sections) {
            for (const item of sec.items) {
              if (!item.visible && JSON.stringify(item).toLowerCase().includes(term)) {
                item.visible = true;
                done = true;
                break;
              }
            }
            if (done) break;
          }
          // 2) else attach a library skill carrying that term
          if (!done) {
            const skill = profile.skills.find(
              (s) =>
                s.name.toLowerCase().includes(term) ||
                s.keywords.some((k) => k.toLowerCase().includes(term)),
            );
            if (skill) {
              const { rowToItem } = await import("@/features/profile/entry-map");
              const { addItem } = await import("@/features/resume/editor-model");
              const next = addItem(doc, "SKILLS", rowToItem("skill", skill as never, 999));
              doc.sections = next.sections;
              done = true;
              applied = "attached a skill from your library";
            }
          }
        }
        if (!done)
          return fail(
            "Nothing factual to attach for that term — only add it if it is genuinely yours.",
            "CONFLICT",
          );
      } else if (reco.action === "REWRITE_SUMMARY") {
        const top = doc.sections.find((s) => s.kind === "EXPERIENCE")?.items.find((i) => i.visible);
        const headline = doc.contact.headline ?? "Professional";
        if (!doc.summary) {
          doc.summary = top
            ? `${headline} with recent experience at ${String((top as { employer?: string }).employer ?? "recent roles")}. Details below.`
            : headline;
          applied = "drafted a summary from your own data";
        } else {
          return fail(
            "You already have a summary — refine it yourself or with AI (reviewed).",
            "CONFLICT",
          );
        }
      } else {
        return fail(
          "This suggestion is advice, not an automatic change — apply it manually.",
          "VALIDATION",
        );
      }

      await saveResumeDocument(ctx.userId, resumeId, doc, {
        mode: "manual",
        label: "Applied match suggestion",
        createVersion: true,
      });
      await db.recommendation.update({ where: { id: reco.id }, data: { status: "ACCEPTED" } });
      await audit(ctx, "recommendation_applied", { id: reco.id, applied });
      revalidatePath("/jobs");
      revalidatePath(`/resumes/${resumeId}`);
      return ok({ applied });
    },
  );
}

export async function dismissRecommendationAction(raw: {
  recommendationId: string;
}): Promise<ActionResult<undefined>> {
  return withValidation(
    z.object({ recommendationId: z.string().min(1).max(64) }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      await db.recommendation.updateMany({
        where: { id: input.recommendationId, userId: ctx.userId },
        data: { status: "REJECTED" },
      });
      revalidatePath("/jobs");
      return ok(undefined);
    },
  );
}

/** "Keep this version for the job" — snapshot current state (§21). */
export async function createTailoredVersionAction(raw: {
  jobId: string;
  resumeId: string;
  label?: string;
}): Promise<ActionResult<{ versionId: string }>> {
  return withValidation(
    z.object({
      jobId: z.string().min(1).max(64),
      resumeId: z.string().min(1).max(64),
      label: z.string().max(120).optional(),
    }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      const job = await db.jobDescription.findFirst({
        where: { id: input.jobId, userId: ctx.userId },
        select: { id: true, title: true, company: true },
      });
      if (!job) return fail("Job not found", "NOT_FOUND");
      const { loadResumeDocument, saveResumeDocument } =
        await import("@/features/resume/repository");
      const { doc } = await loadResumeDocument(ctx.userId, input.resumeId);
      const res = await saveResumeDocument(ctx.userId, input.resumeId, doc, {
        mode: "manual",
        label: input.label?.slice(0, 120) || `For ${job.company ?? job.title}`,
        source: "MANUAL",
        jobDescriptionId: job.id,
        createVersion: true,
      });
      await audit(ctx, "version_tailored", { jobId: job.id, resumeId: input.resumeId });
      revalidatePath(`/resumes/${input.resumeId}`);
      return ok({ versionId: res.versionId ?? "" });
    },
  );
}
