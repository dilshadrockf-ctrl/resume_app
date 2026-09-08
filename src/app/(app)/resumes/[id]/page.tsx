import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db/client";
import { requireCtx } from "@/server/context";
import { loadDoc } from "@/features/resume/service";
import { ResumeEditor } from "@/features/resume/editor";
import { profileToContact } from "@/features/resume/contact-form";
import { ensureExportHandlers } from "@/features/export/service";
import { startQueueSweeper } from "@/services/queue";

export const metadata: Metadata = { title: "Editor", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ResumeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");

  ensureExportHandlers();
  startQueueSweeper();

  const loaded = await loadDoc(ctx, id).catch(() => null);
  if (!loaded) notFound();

  const [profile, envMod] = await Promise.all([
    db.careerProfile.findUnique({
      where: { userId: ctx.userId },
      include: {
        experiences: { where: { archivedAt: null }, orderBy: { order: "asc" } },
        educations: { where: { archivedAt: null }, orderBy: { order: "asc" } },
        projects: { where: { archivedAt: null }, orderBy: { order: "asc" } },
        skills: { where: { archivedAt: null }, orderBy: { name: "asc" } },
        certifications: { where: { archivedAt: null }, orderBy: { order: "asc" } },
        awards: { where: { archivedAt: null }, orderBy: { order: "asc" } },
        publications: { where: { archivedAt: null }, orderBy: { order: "asc" } },
        languages: { where: { archivedAt: null }, orderBy: { order: "asc" } },
        volunteers: { where: { archivedAt: null }, orderBy: { order: "asc" } },
        customSections: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      },
    }),
    import("@/lib/env"),
  ]);

  const library = profile
    ? {
        experience: profile.experiences,
        education: profile.educations,
        project: profile.projects,
        skill: profile.skills,
        certification: profile.certifications,
        award: profile.awards,
        publication: profile.publications,
        language: profile.languages,
        volunteer: profile.volunteers,
        custom: profile.customSections,
      }
    : {};

  const contact = await db.profile.findUnique({ where: { userId: ctx.userId } });

  return (
    <ResumeEditor
      resumeId={id}
      initialDoc={loaded.doc}
      library={library}
      contact={profileToContact(contact)}
      aiConfigured={envMod.appConfig.aiConfigured}
    />
  );
}
