import type { SectionItem } from "@/lib/resume/document";

/** Pure conversions between career-library rows and document section items.
 *  Used by the editor (attach-from-library), profile page and repository smoke. */

export type LibraryRow = Record<string, unknown> & { id: string };

export type LibraryKindKey =
  | "experience"
  | "education"
  | "project"
  | "skill"
  | "certification"
  | "award"
  | "publication"
  | "language"
  | "volunteer"
  | "custom";

const MODEL: Record<LibraryKindKey, SectionItem["ref"]["model"]> = {
  experience: "EXPERIENCE",
  education: "EDUCATION",
  project: "PROJECT",
  skill: "SKILL",
  certification: "CERTIFICATION",
  award: "AWARD",
  publication: "PUBLICATION",
  language: "LANGUAGE",
  volunteer: "VOLUNTEER",
  custom: "CUSTOM_SECTION",
};

export function rowToItem(kind: LibraryKindKey, row: LibraryRow, order: number): SectionItem {
  const ref = { model: MODEL[kind]!, id: row.id } as SectionItem["ref"];
  const base = { ref, visible: true, order, origin: "USER" as const };
  const nz = (v: unknown) => (v === null ? undefined : v);
  switch (kind) {
    case "experience":
      return {
        kind: "experience",
        employer: String(row.employer ?? ""),
        title: String(row.title ?? ""),
        employmentType: (row.employmentType as never) ?? "FULL_TIME",
        location: nz(row.location) as never,
        startDate: nz(row.startDate) as never,
        endDate: nz(row.endDate) as never,
        current: Boolean(row.current),
        companyUrl: nz(row.companyUrl) as never,
        description: nz(row.description) as never,
        bullets: (row.bullets as string[]) ?? [],
        achievements: (row.achievements as string[]) ?? [],
        technologies: (row.technologies as string[]) ?? [],
        skillsUsed: (row.skillsUsed as string[]) ?? [],
        ...base,
      } as SectionItem;
    case "education":
      return {
        kind: "education",
        institution: String(row.institution ?? ""),
        degree: nz(row.degree) as never,
        field: nz(row.field) as never,
        location: nz(row.location) as never,
        startDate: nz(row.startDate) as never,
        endDate: nz(row.endDate) as never,
        current: Boolean(row.current),
        gpa: nz(row.gpa) as never,
        honors: nz(row.honors) as never,
        coursework: (row.coursework as string[]) ?? [],
        activities: (row.activities as string[]) ?? [],
        description: nz(row.description) as never,
        ...base,
      } as SectionItem;
    case "project":
      return {
        kind: "project",
        name: String(row.name ?? ""),
        role: nz(row.role) as never,
        url: nz(row.url) as never,
        startDate: nz(row.startDate) as never,
        endDate: nz(row.endDate) as never,
        description: nz(row.description) as never,
        bullets: (row.bullets as string[]) ?? [],
        technologies: (row.technologies as string[]) ?? [],
        skillsUsed: (row.skillsUsed as string[]) ?? [],
        ...base,
      } as SectionItem;
    case "skill":
      return {
        kind: "skill",
        name: String(row.name ?? ""),
        category: (row.category as never) ?? "OTHER",
        level: (row.level as number | null) ?? undefined,
        keywords: (row.keywords as string[]) ?? [],
        ...base,
      } as SectionItem;
    case "certification":
      return {
        kind: "certification",
        name: String(row.name ?? ""),
        issuer: nz(row.issuer) as never,
        credentialId: nz(row.credentialId) as never,
        url: nz(row.url) as never,
        issueDate: nz(row.issueDate) as never,
        expiryDate: nz(row.expiryDate) as never,
        inProgress: Boolean(row.inProgress),
        ...base,
      } as SectionItem;
    case "award":
      return {
        kind: "award",
        title: String(row.title ?? ""),
        issuer: nz(row.issuer) as never,
        date: nz(row.date) as never,
        blurb: nz(row.blurb) as never,
        ...base,
      } as SectionItem;
    case "publication":
      return {
        kind: "publication",
        title: String(row.title ?? ""),
        publisher: nz(row.publisher) as never,
        url: nz(row.url) as never,
        date: nz(row.date) as never,
        authors: (row.authors as string[]) ?? [],
        citationStyle: nz(row.citationStyle) as never,
        blurb: nz(row.blurb) as never,
        ...base,
      } as SectionItem;
    case "language":
      return {
        kind: "language",
        name: String(row.name ?? ""),
        proficiency: nz(row.proficiency) as never,
        ...base,
      } as SectionItem;
    case "volunteer":
      return {
        kind: "volunteer",
        organization: String(row.organization ?? ""),
        role: String(row.role ?? ""),
        location: nz(row.location) as never,
        startDate: nz(row.startDate) as never,
        endDate: nz(row.endDate) as never,
        current: Boolean(row.current),
        description: nz(row.description) as never,
        bullets: (row.bullets as string[]) ?? [],
        ...base,
      } as SectionItem;
    case "custom":
      return {
        kind: "custom",
        title: String(row.title ?? ""),
        sectionKindTag: String(row.kind ?? "generic"),
        items: (row.items as string[]) ?? [],
        ...base,
      } as SectionItem;
  }
}

export function itemTitle(kind: SectionItem["kind"], item: SectionItem): string {
  const i = item as Record<string, unknown>;
  switch (kind) {
    case "experience":
      return `${i.title}${i.employer ? ` — ${i.employer}` : ""}`;
    case "education":
      return [i.institution, [i.degree, i.field].filter(Boolean).join(" in ")]
        .filter(Boolean)
        .join(" · ");
    case "project":
      return String(i.name ?? "");
    case "skill":
      return String(i.name ?? "");
    case "certification":
      return String(i.name ?? "");
    case "award":
      return String(i.title ?? "");
    case "publication":
      return String(i.title ?? "");
    case "language":
      return [i.name, i.proficiency].filter(Boolean).join(" — ");
    case "volunteer":
      return `${i.role} — ${i.organization}`;
    case "custom":
      return String(i.title ?? "");
    default:
      return "Item";
  }
}
