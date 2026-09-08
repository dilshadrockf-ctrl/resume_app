"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard, ok, fail, withValidation, type ActionResult } from "@/server/action-utils";
import { audit, requireCtx } from "@/server/context";
import { resumeDocumentSchema, type ResumeDocument } from "@/lib/resume/document";
import * as service from "@/features/resume/service";
import { rateLimit } from "@/services/rate-limit";

/**
 * Resume server actions (§155: authenticate → authorize → validate →
 * execute; typed envelopes; never stack traces, never silent data loss).
 */

const resumeIdSchema = z.object({ resumeId: z.string().min(1).max(64) });
const idDocSchema = z.object({
  resumeId: z.string().min(1).max(64),
  mode: z.enum(["autosave", "manual"]),
  label: z.string().max(120).optional(),
  doc: resumeDocumentSchema,
});

export type SavePayload = { resumeId: string; mode: "autosave" | "manual"; label?: string; doc: ResumeDocument };

export async function createResumeAction(raw: { name: string }): Promise<ActionResult<{ resumeId: string }>> {
  return withValidation(z.object({ name: z.string().trim().min(1).max(120) }), raw, async (input) => {
    const ctx = await requireCtx();
    const { resumeId } = await service.createResume(ctx, input.name);
    await audit(ctx, "resume_created", { resumeId });
    revalidatePath("/resumes");
    revalidatePath("/dashboard");
    return ok({ resumeId });
  });
}

export async function saveResumeAction(raw: SavePayload): Promise<ActionResult<{ savedAt: string; versionCreated: boolean }>> {
  return guard(async () => {
    const parsed = idDocSchema.safeParse(raw);
    if (!parsed.success) return fail("This document failed validation and was not saved.", "VALIDATION");
    const ctx = await requireCtx();
    try {
      const result = await service.saveDoc(ctx, parsed.data.resumeId, parsed.data.doc, {
        mode: parsed.data.mode,
        label: parsed.data.label,
      });
      revalidatePath("/resumes");
      return ok({ savedAt: result.savedAt, versionCreated: result.versionCreated });
    } catch (e) {
      // Never lose the client's state: surface a retryable error verbatim.
      if (e instanceof Error && (e.message === "NOT_FOUND" || e.name === "ForbiddenError")) {
        return fail("This resume no longer exists (it may have been deleted in another tab).", "NOT_FOUND");
      }
      throw e;
    }
  });
}

export async function renameResumeAction(raw: { resumeId: string; name: string }): Promise<ActionResult<undefined>> {
  return withValidation(
    z.object({ resumeId: z.string().min(1).max(64), name: z.string().trim().min(1).max(120) }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      await service.renameResume(ctx, input.resumeId, input.name);
      revalidatePath("/resumes");
      return ok(undefined);
    },
  );
}

export async function duplicateResumeAction(raw: { resumeId: string }): Promise<ActionResult<{ resumeId: string }>> {
  return withValidation(resumeIdSchema, raw, async (input) => {
    const ctx = await requireCtx();
    const id = await service.duplicateResume(ctx, input.resumeId);
    await audit(ctx, "resume_duplicated", { resumeId: input.resumeId, newId: id });
    revalidatePath("/resumes");
    return ok({ resumeId: id });
  });
}

export async function deleteResumeAction(raw: { resumeId: string }): Promise<ActionResult<undefined>> {
  return withValidation(resumeIdSchema, raw, async (input) => {
    const ctx = await requireCtx();
    await service.softDeleteResume(ctx, input.resumeId);
    await audit(ctx, "resume_deleted", { resumeId: input.resumeId });
    revalidatePath("/resumes");
    revalidatePath("/dashboard");
    return ok(undefined);
  });
}

export async function restoreResumeAction(raw: { resumeId: string }): Promise<ActionResult<undefined>> {
  return withValidation(resumeIdSchema, raw, async (input) => {
    const ctx = await requireCtx();
    await service.restoreResume(ctx, input.resumeId);
    revalidatePath("/resumes");
    return ok(undefined);
  });
}

export async function archiveResumeAction(raw: { resumeId: string; archived: boolean }): Promise<ActionResult<undefined>> {
  return withValidation(resumeIdSchema.extend({ archived: z.boolean() }), raw, async (input) => {
    const ctx = await requireCtx();
    await service.setArchived(ctx, input.resumeId, input.archived);
    revalidatePath("/resumes");
    return ok(undefined);
  });
}

export async function switchTemplateAction(raw: { resumeId: string; templateId: string }): Promise<ActionResult<undefined>> {
  return withValidation(
    z.object({ resumeId: z.string().min(1).max(64), templateId: z.string().min(1).max(64) }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      await service.switchTemplate(ctx, input.resumeId, input.templateId);
      await audit(ctx, "template_switched", { ...input });
      revalidatePath(`/resumes/${input.resumeId}`);
      revalidatePath("/resumes");
      return ok(undefined);
    },
  );
}

export async function restoreVersionAction(raw: { resumeId: string; versionId: string }): Promise<ActionResult<undefined>> {
  return withValidation(
    z.object({ resumeId: z.string().min(1).max(64), versionId: z.string().min(1).max(64) }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      await service.restoreVersion(ctx, input.resumeId, input.versionId);
      await audit(ctx, "version_restored", { ...input });
      revalidatePath(`/resumes/${input.resumeId}`);
      return ok(undefined);
    },
  );
}

export async function setPrimaryVersionAction(raw: { resumeId: string; versionId: string | null }): Promise<ActionResult<undefined>> {
  return withValidation(
    z.object({ resumeId: z.string().min(1).max(64), versionId: z.string().min(1).max(64).nullable() }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      await service.setPrimaryVersion(ctx, input.resumeId, input.versionId);
      revalidatePath(`/resumes/${input.resumeId}`);
      return ok(undefined);
    },
  );
}

export async function publishResumeAction(raw: {
  resumeId: string;
  published: boolean;
  publicFields?: { showEmail?: boolean; showPhone?: boolean; showPhoto?: boolean };
}): Promise<ActionResult<{ slug: string | null; url: string | null }>> {
  return withValidation(
    resumeIdSchema.extend({
      published: z.boolean(),
      publicFields: z
        .object({ showEmail: z.boolean().optional(), showPhone: z.boolean().optional(), showPhoto: z.boolean().optional() })
        .optional(),
    }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      if (input.published) {
        const { appConfig } = await import("@/lib/env");
        const slug = await service.setPublished(ctx, input.resumeId, true, input.publicFields);
        await audit(ctx, "resume_published", { resumeId: input.resumeId });
        return ok({ slug, url: slug ? `${appConfig.baseUrl}/resume/${slug}` : null });
      }
      await service.setPublished(ctx, input.resumeId, false);
      await audit(ctx, "resume_unpublished", { resumeId: input.resumeId });
      return ok({ slug: null, url: null });
    },
  );
}

/** Export trigger — queued job; failure never affects the editor state (§103). */
export async function requestExportAction(raw: {
  resumeId: string;
  format: "pdf" | "docx" | "text";
  versionId?: string | null;
}): Promise<ActionResult<{ exportId: string; jobRunId: string }>> {
  return withValidation(
    z.object({
      resumeId: z.string().min(1).max(64),
      format: z.enum(["pdf", "docx", "text"]),
      versionId: z.string().max(64).nullable().optional(),
    }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      const limit = await rateLimit("export", ctx.userId);
      if (!limit.ok) return fail("You're exporting very fast — try again in a minute.", "RATE_LIMITED");
      const { createExportJob } = await import("@/features/export/service");
      const res = await createExportJob(ctx, input.resumeId, input.format, input.versionId ?? null);
      return ok(res);
    },
  );
}

export async function getExportStatusAction(raw: { exportId: string }): Promise<
  ActionResult<{ status: string; fileName?: string; sizeBytes?: number; error?: string; errorKind?: string }>
> {
  return withValidation(z.object({ exportId: z.string().min(1).max(64) }), raw, async (input) => {
    const ctx = await requireCtx();
    const { getExport } = await import("@/features/export/service");
    const row = await getExport(ctx, input.exportId);
    return ok(row);
  });
}

export async function loadResumeForEditorAction(raw: { resumeId: string }): Promise<ActionResult<{ doc: ResumeDocument }>> {
  return withValidation(resumeIdSchema, raw, async (input) => {
    const ctx = await requireCtx();
    const loaded = await service.loadDoc(ctx, input.resumeId);
    return ok({ doc: loaded.doc });
  });
}
