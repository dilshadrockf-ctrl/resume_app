import { db } from "@/db/client";
import { registerHandler } from "@/services/queue";
import { ForbiddenError, type Ctx } from "@/server/context";
import { scaffoldLetter, type Length, type Tone } from "@/lib/coverletter";
import { loadResumeDocument } from "@/features/resume/repository";

export async function createLetter(
  ctx: Ctx,
  input: {
    company: string;
    role: string;
    hiringManager?: string;
    tone: Tone;
    length: Length;
    jobId?: string | null;
    resumeId?: string | null;
  },
): Promise<string> {
  let content = "";
  if (input.resumeId) {
    const { doc } = await loadResumeDocument(ctx.userId, input.resumeId);
    let jobSnippets: string[] | undefined;
    if (input.jobId) {
      const job = await db.jobDescription.findFirst({
        where: { id: input.jobId, userId: ctx.userId },
        select: { rawText: true },
      });
      if (job)
        jobSnippets = job.rawText
          .split(/\r?\n/)
          .filter((l) => /you (will|have|bring)|responsibilit|ideal candidate/i.test(l))
          .slice(0, 3)
          .map((l) => l.replace(/^\W+/, "").trim());
    }
    content = scaffoldLetter({
      doc,
      company: input.company,
      role: input.role,
      hiringManager: input.hiringManager,
      tone: input.tone,
      length: input.length,
      jobSnippets,
    });
  }
  const row = await db.coverLetter.create({
    data: {
      userId: ctx.userId,
      company: input.company.slice(0, 160),
      role: input.role.slice(0, 160),
      hiringManager: input.hiringManager?.slice(0, 120) ?? null,
      tone: input.tone,
      length: input.length,
      content:
        content ||
        `[Your name]\n\nDear [Hiring Manager],\n\n[Write your letter — no resume selected to pull facts from.]`,
      status: "DRAFT",
      jobDescriptionId: input.jobId ?? null,
    },
  });
  return row.id;
}

export async function listLetters(ctx: Ctx) {
  return db.coverLetter.findMany({
    where: { userId: ctx.userId },
    orderBy: { updatedAt: "desc" },
    include: { jobDescription: { select: { id: true, title: true, company: true } } },
  });
}

export async function getLetter(ctx: Ctx, id: string) {
  const row = await db.coverLetter.findFirst({
    where: { id, userId: ctx.userId },
    include: { jobDescription: { select: { id: true, title: true, rawText: true } } },
  });
  if (!row) throw new ForbiddenError("NOT_FOUND");
  return row;
}

export async function saveLetter(
  ctx: Ctx,
  id: string,
  patch: {
    content?: string;
    status?: "DRAFT" | "FINAL" | "SENT";
    company?: string;
    role?: string;
    hiringManager?: string;
  },
) {
  const row = await db.coverLetter.findFirst({ where: { id, userId: ctx.userId } });
  if (!row) throw new ForbiddenError("NOT_FOUND");
  await db.coverLetter.update({
    where: { id },
    data: {
      ...(patch.content !== undefined ? { content: patch.content.slice(0, 20_000) } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.company !== undefined ? { company: patch.company.slice(0, 160) } : {}),
      ...(patch.role !== undefined ? { role: patch.role.slice(0, 160) } : {}),
      ...(patch.hiringManager !== undefined
        ? { hiringManager: patch.hiringManager.slice(0, 120) }
        : {}),
    },
  });
}

/**
 * Queued rebuild of a DRAFT letter from its linked job (deterministic
 * scaffold refresh — §42). Never touches FINAL/SENT letters.
 */
export async function rebuildLetterForJob(
  letterId: string,
): Promise<{ updated: boolean; reason?: string }> {
  const letter = await db.coverLetter.findUnique({
    where: { id: letterId },
    include: { jobDescription: true },
  });
  if (!letter) return { updated: false, reason: "letter missing" };
  if (letter.status !== "DRAFT")
    return { updated: false, reason: `letter is ${letter.status.toLowerCase()} — drafts only` };
  if (!letter.jobDescription) return { updated: false, reason: "no job linked" };
  const profile = await db.careerProfile.findFirst({
    where: { userId: letter.userId },
    select: { id: true },
  });
  if (!profile) return { updated: false, reason: "profile missing" };
  const resumes = await db.resume.findMany({
    where: { careerProfileId: profile.id, deletedAt: null },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: 1,
  });
  if (!resumes[0]) return { updated: false, reason: "no resume to source facts from" };
  const ctx = { userId: letter.userId } as Ctx;
  const { doc } = await loadResumeDocument(letter.userId, resumes[0].id);
  const job = letter.jobDescription;
  const jobSnippets = job.rawText
    .split(/\r?\n/)
    .filter((line) => /you (will|have|bring)|responsibilit|ideal candidate|what you/i.test(line))
    .slice(0, 3)
    .map((line) => line.replace(/^\W+/, "").trim());
  const built = scaffoldLetter({
    doc,
    company: letter.company,
    role: letter.role,
    hiringManager: letter.hiringManager ?? undefined,
    tone: letter.tone as Tone,
    length: letter.length as Length,
    jobSnippets,
  });
  if (!built || built === letter.content) return { updated: false, reason: "nothing new to add" };
  await db.coverLetter.update({ where: { id: letterId }, data: { content: built } });
  return { updated: true };
}

let letterHandlersRegistered = false;
export function ensureLetterHandlers() {
  if (letterHandlersRegistered) return;
  letterHandlersRegistered = true;
  registerHandler("COVER_LETTER_GENERATE", async (payload) => {
    if (payload.type !== "COVER_LETTER_GENERATE") throw new Error("wrong payload");
    return rebuildLetterForJob(payload.coverLetterId);
  });
}
ensureLetterHandlers();
