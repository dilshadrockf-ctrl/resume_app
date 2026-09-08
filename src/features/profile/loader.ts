import { db } from "@/db/client";

/** Server-side loader for the profile page + editor pickers. */
export async function loadCareerLibrary(userId: string) {
  const profile = await db.careerProfile.findUnique({
    where: { userId },
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
      libraryItems: { orderBy: { updatedAt: "desc" } },
    },
  });
  const contact = await db.profile.findUnique({ where: { userId } });
  return { profile, contact };
}
