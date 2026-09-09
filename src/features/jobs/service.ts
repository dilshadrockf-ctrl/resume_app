import { db } from "@/db/client";
import { ForbiddenError, type Ctx } from "@/server/context";
import {
  extractJdSignals,
  scoreMatch,
  buildMatchRecommendations,
  type JdSignals,
} from "@/lib/matching";
import { loadResumeDocument } from "@/features/resume/repository";

/**
 * Job descriptions + local matching (§21/§38-§41). Everything here runs on
 * the server against the user's own data; AI is an optional extension, never
 * a dependency.
 */

export async function createJob(
  ctx: Ctx,
  input: {
    title: string;
    company?: string;
    location?: string;
    url?: string;
    salary?: string;
    text: string;
  },
) {
  const signals = extractJdSignals(input.text, input.title);
  const job = await db.jobDescription.create({
    data: {
      userId: ctx.userId,
      title: input.title.slice(0, 160),
      company: input.company?.slice(0, 160) ?? null,
      location: input.location?.slice(0, 160) ?? null,
      url: input.url?.slice(0, 500) ?? null,
      salary: input.salary?.slice(0, 120) ?? null,
      rawText: input.text.slice(0, 200_000),
      parsed: signals as unknown as never,
    },
  });
  return job;
}

export async function listJobs(ctx: Ctx) {
  const jobs = await db.jobDescription.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      matches: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { resumeVersion: { include: { resume: { select: { id: true, name: true } } } } },
      },
      applications: { select: { id: true, status: true } },
    },
  });
  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    createdAt: j.createdAt,
    bestMatch: j.matches[0]
      ? {
          score: j.matches[0].score,
          resumeId: j.matches[0].resumeVersion?.resume.id ?? null,
          resumeName: j.matches[0].resumeVersion?.resume.name ?? "",
          versionId: j.matches[0].resumeVersionId,
        }
      : null,
    applications: j.applications.map((a) => ({ id: a.id, status: a.status })),
  }));
}

export async function getJobDetail(ctx: Ctx, jobId: string) {
  const job = await db.jobDescription.findFirst({
    where: { id: jobId, userId: ctx.userId },
    include: {
      matches: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          resumeVersion: { include: { resume: { select: { id: true, name: true } } } },
          recommendations: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!job) throw new ForbiddenError("NOT_FOUND");
  return job;
}

export async function deleteJob(ctx: Ctx, jobId: string) {
  const res = await db.jobDescription.deleteMany({ where: { id: jobId, userId: ctx.userId } });
  if (!res.count) throw new ForbiddenError("NOT_FOUND");
}

export async function matchJobAgainstResume(
  ctx: Ctx,
  jobId: string,
  resumeId: string,
): Promise<string> {
  const job = await db.jobDescription.findFirst({ where: { id: jobId, userId: ctx.userId } });
  if (!job) throw new ForbiddenError("NOT_FOUND");
  const { doc } = await loadResumeDocument(ctx.userId, resumeId);
  const signals = (job.parsed as JdSignals | null) ?? extractJdSignals(job.rawText, job.title);
  const result = scoreMatch(doc, signals);

  // snapshot doc first so the match (and its recos) point at immutable state
  const version = await db.resumeVersion.create({
    data: {
      resumeId,
      label: `Matched against ${job.company ?? job.title}`,
      source: "MANUAL",
      jobDescriptionId: jobId,
      snapshot: doc as unknown as never,
      atsScore: result.score,
    },
  });

  const match = await db.jobMatch.create({
    data: {
      userId: ctx.userId,
      jobDescriptionId: jobId,
      resumeVersionId: version.id,
      score: result.score,
      breakdown: result.breakdown as unknown as never,
      gaps: {
        requiredMissing: result.breakdown.keywordCoverage.requiredMissing,
        suggestedSections: result.breakdown.structureFit.suggested,
      },
    },
  });

  // recommendations: surface library facts, never fabricate (§16)
  const profile = await db.careerProfile.findUnique({
    where: { userId: ctx.userId },
    include: {
      experiences: true,
      projects: true,
      skills: true,
      certifications: true,
      awards: true,
      publications: true,
      volunteers: true,
      customSections: true,
    },
  });
  const libraryText = profile ? JSON.stringify(profile) : JSON.stringify(doc);
  const drafts = buildMatchRecommendations(signals, doc, libraryText);
  if (drafts.length) {
    await db.recommendation.createMany({
      data: drafts.map((d) => ({
        userId: ctx.userId,
        jobMatchId: match.id,
        resumeVersionId: version.id,
        sectionKind: d.sectionKind as never,
        entryRef: d.entryRef ?? null,
        action: d.action as never,
        rationale: d.rationale,
        original: d.original ?? null,
        suggested: d.suggested ?? null,
      })),
    });
  }
  return match.id;
}
