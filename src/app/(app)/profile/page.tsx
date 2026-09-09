import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { requireCtx } from "@/server/context";
import { CareerLibrary } from "@/features/profile/library-client";
import { ProfileContactCard } from "@/features/profile/contact-card";

export const metadata: Metadata = { title: "Career profile", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  const profile = await db.careerProfile.findUnique({
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
  });
  if (!profile) redirect("/login");
  const contact = await db.profile.findUnique({ where: { userId: ctx.userId } });
  const archivedExperiences = await db.experience.count({
    where: { careerProfileId: profile.id, archivedAt: { not: null } },
  });

  const rows = {
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
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Career profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One place for every career fact. Resumes reference this library — fix a typo once, every
          resume updates. Removing a resume never removes anything here.
        </p>
      </header>
      <div className="mb-6">
        <ProfileContactCard
          initial={{
            displayName: contact?.displayName ?? "",
            headline: contact?.headline ?? "",
            email: contact?.email ?? "",
            phone: contact?.phone ?? "",
            location: contact?.location ?? "",
            website: contact?.website ?? "",
            linkedin: contact?.linkedin ?? "",
            github: contact?.github ?? "",
            targetRole: contact?.targetRole ?? "",
            industry: contact?.industry ?? "",
          }}
          summary={profile.summary ?? ""}
        />
      </div>
      <CareerLibrary rows={rows} archivedCounts={{ experience: archivedExperiences }} />
    </div>
  );
}
