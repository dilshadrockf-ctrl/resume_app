import { db } from "@/db/client";
import { ForbiddenError, type Ctx } from "@/server/context";
import { enqueue, registerHandler } from "@/services/queue";
import { storage, makeKey } from "@/services/storage";
import { parseResumeText } from "@/features/import/parsers";
import { createResume } from "@/features/resume/service";
import { saveResumeDocument } from "@/features/resume/repository";
import { log } from "@/lib/logger";

/** Resume import (§56): parse-only. Text extraction is deterministic
 *  (unpdf / mammoth), the parser MOVES existing lines into sections, and the
 *  result always lands in review state — never a silent overwrite. */

export const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
];
export const MAX_BYTES = 10 * 1024 * 1024;

export async function requestImport(
  ctx: Ctx,
  file: { name: string; mime: string; bytes: Buffer },
): Promise<{ importId: string }> {
  if (!ACCEPTED_MIME.includes(file.mime))
    throw new ForbiddenError("unsupported file type — use PDF, DOCX, TXT or MD");
  if (file.bytes.length === 0) throw new ForbiddenError("empty file");
  if (file.bytes.length > MAX_BYTES) throw new ForbiddenError("file too large (10 MB max)");
  const key = makeKey("uploads", ctx.userId, `${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`);
  await (await storage()).put(key, file.bytes, file.mime);
  const job = await db.importJob.create({
    data: {
      userId: ctx.userId,
      fileName: file.name.slice(0, 200),
      mimeType: file.mime,
      bytes: file.bytes.length,
      storageKey: key,
      status: "QUEUED",
    },
  });
  await enqueue("RESUME_IMPORT", ctx.userId, { type: "RESUME_IMPORT", importJobId: job.id });
  return { importId: job.id };
}

async function extractText(mime: string, buf: Buffer): Promise<string> {
  if (mime === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    return (await extractText(pdf, { mergePages: true })).text;
  }
  if (mime.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ buffer: buf });
    return res.value;
  }
  return buf.toString("utf8");
}

export async function runImport(importJobId: string): Promise<{ resumeId: string }> {
  const job = await db.importJob.findUnique({ where: { id: importJobId } });
  if (!job) throw new Error("import job gone");
  if (!job.storageKey) throw new Error("missing file");
  try {
    await db.importJob.update({ where: { id: job.id }, data: { status: "EXTRACTING" } });
    const rec = await (await storage()).get(job.storageKey);
    if (!rec) throw new Error("stored file missing");
    const text = await extractText(job.mimeType, rec.stream);
    if (text.replace(/\s/g, "").length < 80) {
      await db.importJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: "no readable text — scanned image? OCR not included by design",
        },
      });
      throw new Error(
        "no readable text (image-only PDF?). Nothing was created — your data is safe.",
      );
    }
    await db.importJob.update({ where: { id: job.id }, data: { status: "PARSING" } });
    const parsed = parseResumeText(text);
    parsed.doc.meta.name = `Imported — ${job.fileName.replace(/\.[a-z]+$/i, "").slice(0, 40)}`;

    const { resumeId } = await createResume(
      { userId: job.userId } as unknown as Ctx,
      parsed.doc.meta.name,
    );
    parsed.doc.meta.resumeId = resumeId;
    await saveResumeDocument(job.userId, resumeId, parsed.doc, {
      mode: "manual",
      label: "Imported file",
      source: "IMPORT",
      createVersion: true,
    });

    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "NEEDS_REVIEW",
        resumeId,
        result: {
          doc: parsed.doc,
          parse: parsed.sections,
          warnings: parsed.warnings,
          chars: text.length,
        } as never,
      },
    });
    return { resumeId };
  } catch (e) {
    const message = String((e as Error)?.message ?? e).slice(0, 300);
    log.error("import failed", { importJobId, err: message });
    const fresh = await db.importJob.findUnique({
      where: { id: job.id },
      select: { status: true },
    });
    if (fresh && fresh.status !== "NEEDS_REVIEW" && fresh.status !== "FAILED") {
      await db.importJob.update({
        where: { id: job.id },
        data: { status: "FAILED", error: message },
      });
    }
    throw e; // queue retries/backoff; caller UI stays functional (§103)
  }
}

let registered = false;
export function ensureImportHandlers() {
  if (registered) return;
  registered = true;
  registerHandler("RESUME_IMPORT", async (payload) => {
    if (payload.type !== "RESUME_IMPORT") throw new Error("wrong payload");
    return runImport(payload.importJobId);
  });
}
ensureImportHandlers();

export async function importStatus(ctx: Ctx, importId: string) {
  const job = await db.importJob.findFirst({
    where: { id: importId, userId: ctx.userId },
    select: { status: true, resumeId: true, error: true },
  });
  if (!job) throw new ForbiddenError("NOT_FOUND");
  return job;
}
