import { db } from "@/db/client";
import { type Ctx } from "@/server/context";
import { enqueue, registerHandler } from "@/services/queue";
import { storage, makeKey } from "@/services/storage";
import { log } from "@/lib/logger";

/**
 * Account data portability (§ GDPR-style export). Two paths, same payload:
 * a synchronous download (/api/account/data) and a queued build for big
 * accounts (ACCOUNT_DATA_EXPORT) that lands as a normal Export download.
 */

export async function buildAccountDataJson(userId: string): Promise<object> {
  const [user, profile, career, resumes, jobs, applications, coverLetters, exports, aiGenerations] =
    await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.profile.findUnique({ where: { userId } }),
      db.careerProfile.findUnique({
        where: { userId },
        include: {
          experiences: true,
          educations: true,
          projects: true,
          skills: true,
          certifications: true,
          awards: true,
          publications: true,
          languages: true,
          volunteers: true,
          customSections: true,
          libraryItems: true,
        },
      }),
      db.resume.findMany({
        where: { careerProfile: { userId } },
        include: { versions: true, sections: { include: { items: true } } },
      }),
      db.jobDescription.findMany({ where: { userId } }),
      db.application.findMany({ where: { userId }, include: { notesList: true } }),
      db.coverLetter.findMany({ where: { userId } }),
      db.export.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          status: true,
          fileName: true,
          bytes: true,
          createdAt: true,
          finishedAt: true,
        },
      }),
      db.aIGeneration.findMany({ where: { userId } }),
    ]);
  return {
    exportedAt: new Date().toISOString(),
    format: "resumeforge-account-export-v1",
    user,
    profile,
    careerProfile: career,
    resumes,
    jobDescriptions: jobs,
    applications,
    coverLetters,
    exports,
    aiGenerations,
  };
}

export async function requestQueuedExport(ctx: Ctx): Promise<{ exportId: string }> {
  const row = await db.export.create({
    data: {
      userId: ctx.userId,
      type: "DATA_JSON",
      status: "QUEUED",
      fileName: `resumeforge-account-${new Date().toISOString().slice(0, 10)}.json`,
    },
  });
  await enqueue("ACCOUNT_DATA_EXPORT", ctx.userId, {
    type: "ACCOUNT_DATA_EXPORT",
    exportId: row.id,
    userId: ctx.userId,
  });
  return { exportId: row.id };
}

export async function runAccountDataExport(
  exportId: string,
  userId: string,
): Promise<{ bytes: number }> {
  const row = await db.export.findUnique({ where: { id: exportId } });
  if (!row) throw new Error("export row missing");
  try {
    const payload = await buildAccountDataJson(userId);
    const json = JSON.stringify(payload, null, 2);
    const key = makeKey("exports", userId, `${exportId}.json`);
    const stored = await (await storage()).put(key, Buffer.from(json, "utf8"), "application/json");
    await db.export.update({
      where: { id: exportId },
      data: {
        status: "READY",
        storageKey: stored.key,
        bytes: Buffer.byteLength(json),
        finishedAt: new Date(),
        meta: { kind: "account-data", format: "resumeforge-account-export-v1" } as never,
      },
    });
    return { bytes: Buffer.byteLength(json) };
  } catch (e) {
    const message = String((e as Error)?.message ?? e).slice(0, 300);
    log.error("account export failed", { exportId, err: message });
    await db.export.update({ where: { id: exportId }, data: { status: "FAILED", error: message } });
    throw e;
  }
}

let registered = false;
export function ensureAccountExportHandlers() {
  if (registered) return;
  registered = true;
  registerHandler("ACCOUNT_DATA_EXPORT", async (payload) => {
    if (payload.type !== "ACCOUNT_DATA_EXPORT") throw new Error("wrong payload");
    return runAccountDataExport(payload.exportId, payload.userId);
  });
}
ensureAccountExportHandlers();
