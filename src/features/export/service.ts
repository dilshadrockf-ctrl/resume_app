import { db } from "@/db/client";
import { log } from "@/lib/logger";
import { ForbiddenError, type Ctx } from "@/server/context";
import { enqueue, registerHandler } from "@/services/queue";
import { storage, makeKey } from "@/services/storage";
import type { RenderDoc } from "@/templates/blocks";
import type { ResumeDocument } from "@/lib/resume/document";
import { saveResumeDocument } from "@/features/resume/repository";
import { computeStats } from "@/lib/resume/stats";
import { analyzeResume } from "@/lib/ats-analysis";

/**
 * Export pipeline (§52-§54, §103-§104). Rendering runs in a job so a broken
 * export can never crash or block the editor; the document a user last saved
 * is what gets exported (version snapshot when provided — §176).
 */

const TYPE_MAP = { pdf: "PDF", docx: "DOCX", text: "TXT" } as const;
const MIME: Record<string, string> = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  TXT: "text/plain; charset=utf-8",
};

export async function createExportJob(
  ctx: Ctx,
  resumeId: string,
  format: keyof typeof TYPE_MAP,
  versionId?: string | null,
): Promise<{ exportId: string; jobRunId: string }> {
  const resume = await db.resume.findFirst({
    where: { id: resumeId, careerProfile: { userId: ctx.userId }, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!resume) throw new ForbiddenError("NOT_FOUND");
  let snapshotSource: "current" | string = "current";
  if (versionId) {
    const v = await db.resumeVersion.findFirst({
      where: { id: versionId, resumeId },
      select: { id: true, snapshot: true },
    });
    if (!v) throw new ForbiddenError("NOT_FOUND");
    snapshotSource = v.id;
  }
  const exportRow = await db.export.create({
    data: {
      userId: ctx.userId,
      type: TYPE_MAP[format],
      status: "QUEUED",
      resumeVersionId: versionId ?? null,
      fileName: `${safeName(resume.name)}.${extensionFor(format)}`,
      meta: { resumeId, format, snapshotSource },
    },
  });
  const { jobRunId } = await enqueue("RESUME_EXPORT", ctx.userId, {
    type: "RESUME_EXPORT",
    exportId: exportRow.id,
  });
  return { exportId: exportRow.id, jobRunId };
}

function extensionFor(format: keyof typeof TYPE_MAP) {
  return format === "text" ? "txt" : format;
}
function safeName(n: string) {
  return (
    (n || "resume")
      .replace(/[^\w \-.]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "resume"
  );
}

export async function getExport(ctx: Ctx, exportId: string) {
  const row = await db.export.findFirst({
    where: { id: exportId, userId: ctx.userId },
    select: {
      id: true,
      status: true,
      fileName: true,
      bytes: true,
      error: true,
      type: true,
      finishedAt: true,
      createdAt: true,
    },
  });
  if (!row) throw new ForbiddenError("NOT_FOUND");
  return {
    status: row.status,
    fileName: row.fileName ?? undefined,
    sizeBytes: row.bytes ?? undefined,
    error: row.error ?? undefined,
    type: row.type,
    id: row.id,
  };
}

/** List exports for a user (settings page history). */
export async function listExports(ctx: Ctx, take = 25) {
  return db.export.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      status: true,
      fileName: true,
      bytes: true,
      createdAt: true,
      error: true,
    },
  });
}

// ───────────────────────────── job handler ───────────────────────────────────

async function renderDocumentFor(doc: ResumeDocument): Promise<RenderDoc> {
  const { buildRenderDoc } = await import("@/templates/blocks");
  return buildRenderDoc(doc);
}

async function runExport(
  exportId: string,
): Promise<{ storageKey: string; bytes: number; fileName: string }> {
  const row = await db.export.findUnique({ where: { id: exportId } });
  if (!row) throw new Error("export row missing");
  await db.export.update({ where: { id: exportId }, data: { status: "PROCESSING" } });
  try {
    const meta = (row.meta ?? {}) as { resumeId?: string; snapshotSource?: string };
    let doc: ResumeDocument | null = null;
    if (meta.snapshotSource && meta.snapshotSource !== "current") {
      const v = await db.resumeVersion.findUnique({ where: { id: meta.snapshotSource } });
      if (v) doc = v.snapshot as unknown as ResumeDocument;
    }
    if (!doc && meta.resumeId) {
      const resume = await db.resume.findUnique({
        where: { id: meta.resumeId },
        select: { careerProfileId: true },
      });
      if (resume) {
        const { loadResumeDocument } = await import("@/features/resume/repository");
        const user = await db.careerProfile.findUnique({
          where: { id: resume.careerProfileId },
          select: { userId: true },
        });
        if (user) doc = (await loadResumeDocument(user.userId, meta.resumeId)).doc;
      }
    }
    if (!doc) throw new Error("Resume content is no longer available");

    const render = await renderDocumentFor(doc);
    let data: Uint8Array;
    if (row.type === "PDF") {
      const { renderResumePdf } = await import("@/render/pdf");
      data = (await renderResumePdf(render)).bytes;
    } else if (row.type === "DOCX") {
      const { buildDocx } = await import("@/render/docx");
      data = await buildDocx(render);
    } else {
      const { renderAtsText } = await import("@/render/text");
      data = new TextEncoder().encode(renderAtsText(render));
    }

    const store = await storage();
    const key = makeKey(`exports/${row.userId}`, row.userId, row.fileName ?? "resume");
    const stored = await store.put(key, data, MIME[row.type] ?? "application/octet-stream");
    await db.export.update({
      where: { id: exportId },
      data: {
        status: "READY",
        storageKey: stored.key,
        bytes: stored.bytes,
        finishedAt: new Date(),
        error: null,
      },
    });
    return { storageKey: stored.key, bytes: stored.bytes, fileName: row.fileName ?? "resume" };
  } catch (e) {
    const message = String((e as Error)?.message ?? e).slice(0, 300);
    log.error("export failed", { exportId, err: message });
    await db.export.update({
      where: { id: exportId },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    throw e; // let the queue retry/backoff; editor stays unaffected (§103)
  }
}

let registered = false;
export function ensureExportHandlers() {
  if (registered) return;
  registered = true;
  registerHandler("RESUME_EXPORT", async (payload) => {
    if (payload.type !== "RESUME_EXPORT") throw new Error("wrong payload");
    return runExport(payload.exportId);
  });
  registerHandler("RESUME_ANALYZE", async (payload) => {
    if (payload.type !== "RESUME_ANALYZE") throw new Error("wrong payload");
    return runAnalyze(payload.versionId);
  });
}

async function runAnalyze(versionId: string): Promise<{ score: number }> {
  const result = await persistAnalysis(versionId);
  return { score: result.score };
}

/** Compute + persist an ATS-style analysis for one version. Shared by the
 *  queue handler and the editor's "Run now" button (it's a local
 *  deterministic pass — no AI, no network). */
export async function persistAnalysis(versionId: string) {
  const version = await db.resumeVersion.findUnique({
    where: { id: versionId },
    include: { resume: { select: { careerProfile: { select: { userId: true } } } } },
  });
  if (!version) throw new Error("version missing");
  const doc = version.snapshot as unknown as ResumeDocument;
  const stats = computeStats(doc);
  const analysis = analyzeResume(doc);
  const userId = version.resume.careerProfile.userId;
  await db.resumeAnalysis.deleteMany({
    where: { resumeVersionId: versionId, atsEngineVersion: analysis.engineVersion },
  });
  await db.resumeAnalysis.create({
    data: {
      userId,
      kind: "ATS",
      resumeVersionId: versionId,
      score: analysis.score,
      breakdown: analysis.breakdown as never,
      issues: analysis.issues as never,
      atsEngineVersion: analysis.engineVersion,
    },
  });
  await db.resumeVersion.update({
    where: { id: versionId },
    data: { atsScore: analysis.score, pageEstimate: Math.ceil(stats.estimatedLines / 46) },
  });
  return { score: analysis.score, issues: analysis.issues.length };
}

/** Latest analysis for a resume (any version), computing one if never run. */
export async function latestAnalysis(userId: string, resumeId: string) {
  const version = await db.resumeVersion.findFirst({
    where: { resumeId, resume: { careerProfile: { userId } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true },
  });
  if (!version) return null;
  let analysis = await db.resumeAnalysis.findFirst({
    where: { resumeVersionId: version.id, userId },
    orderBy: { createdAt: "desc" },
  });
  if (!analysis) {
    await persistAnalysis(version.id);
    analysis = await db.resumeAnalysis.findFirst({
      where: { resumeVersionId: version.id, userId },
      orderBy: { createdAt: "desc" },
    });
  }
  return { version, analysis };
}

/** analyze a resume now (used on save + dashboard). */
export async function requestAnalysis(ctx: Ctx, resumeId: string): Promise<string | null> {
  const version = await db.resumeVersion.findFirst({
    where: { resumeId, resume: { careerProfile: { userId: ctx.userId } } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!version) return null;
  const { jobRunId } = await enqueue("RESUME_ANALYZE", ctx.userId, {
    type: "RESUME_ANALYZE",
    versionId: version.id,
  });
  return jobRunId;
}

/** Ensure latest composition is snapshotted so exports/analysis are stable. */
export async function snapshotCurrent(ctx: Ctx, resumeId: string, doc: ResumeDocument) {
  return saveResumeDocument(ctx.userId, resumeId, doc, {
    mode: "manual",
    label: "Snapshot",
    createVersion: true,
  });
}

ensureExportHandlers();
