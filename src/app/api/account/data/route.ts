import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { requireCtx } from "@/server/context";

/** GDPR-style full data export (§ right-to-portability), synchronous JSON. */
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireCtx();
  const [user, profile, career, resumes, jobs, applications, coverLetters, exports, aiGenerations] = await Promise.all([
    db.user.findUnique({ where: { id: ctx.userId }, select: { id: true, email: true, name: true, image: true, emailVerified: true, createdAt: true, updatedAt: true } }),
    db.profile.findUnique({ where: { userId: ctx.userId } }),
    db.careerProfile.findUnique({
      where: { userId: ctx.userId },
      include: {
        experiences: true, educations: true, projects: true, skills: true,
        certifications: true, awards: true, publications: true, languages: true,
        volunteers: true, customSections: true, libraryItems: true,
      },
    }),
    db.resume.findMany({ where: { careerProfile: { userId: ctx.userId } }, include: { versions: true, sections: { include: { items: true } } } }),
    db.jobDescription.findMany({ where: { userId: ctx.userId } }),
    db.application.findMany({ where: { userId: ctx.userId }, include: { notesList: true } }),
    db.coverLetter.findMany({ where: { userId: ctx.userId } }),
    db.export.findMany({ where: { userId: ctx.userId }, select: { id: true, type: true, status: true, fileName: true, bytes: true, createdAt: true, finishedAt: true } }),
    db.aIGeneration.findMany({ where: { userId: ctx.userId } }),
  ]);
  const payload = {
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
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="resumeforge-account-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
