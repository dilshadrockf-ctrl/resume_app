import type {
  ResumeDocument,
  ResumeSectionDoc,
  SectionItem,
  SectionKind,
  TemplateConfig,
} from "@/lib/resume/document";

/**
 * Pure document editing helpers shared by the editor UI (and tests). Every
 * mutation returns a new document; ordering stays dense (0..n) and section
 * presence is normalized so saves are deterministic.
 */

export function newTempId(): string {
  const rnd = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `tmp:${rnd}`;
}

export const DEFAULT_SECTION_TITLES: Record<SectionKind, string> = {
  SUMMARY: "Summary",
  EXPERIENCE: "Experience",
  EDUCATION: "Education",
  SKILLS: "Skills",
  PROJECTS: "Projects",
  CERTIFICATIONS: "Certifications",
  AWARDS: "Awards",
  PUBLICATIONS: "Publications",
  LANGUAGES: "Languages",
  VOLUNTEER: "Volunteer",
  CUSTOM: "Custom",
};

export function sectionFor(doc: ResumeDocument, kind: SectionKind): ResumeSectionDoc {
  let section = doc.sections.find((s) => s.kind === kind);
  if (!section) {
    const order = doc.sections.reduce((a, s) => Math.max(a, s.order), -1) + 1;
    section = { id: kind.toLowerCase(), kind, visible: true, order, items: [] };
    doc = { ...doc, sections: [...doc.sections, section] };
  }
  return section;
}

function replaceSection(doc: ResumeDocument, next: ResumeSectionDoc): ResumeDocument {
  const exists = doc.sections.some((s) => s.kind === next.kind);
  return {
    ...doc,
    sections: exists
      ? doc.sections.map((s) => (s.kind === next.kind ? next : s))
      : [...doc.sections, next],
  };
}

export function updateItem(
  doc: ResumeDocument,
  sectionKind: SectionKind,
  index: number,
  patch: Partial<SectionItem>,
): ResumeDocument {
  const section = sectionFor(doc, sectionKind);
  const items = section.items.map((it, i) =>
    i === index ? ({ ...it, ...patch } as SectionItem) : it,
  );
  return replaceSection(doc, { ...section, items });
}

export function removeItem(
  doc: ResumeDocument,
  sectionKind: SectionKind,
  index: number,
): ResumeDocument {
  const section = sectionFor(doc, sectionKind);
  const items = section.items.filter((_, i) => i !== index);
  return replaceSection(doc, { ...section, items: reindex(items) });
}

export function addItem(
  doc: ResumeDocument,
  sectionKind: SectionKind,
  item: SectionItem,
): ResumeDocument {
  const section = sectionFor(doc, sectionKind);
  const items = reindex([
    ...section.items,
    { ...item, order: section.items.length } as SectionItem,
  ]);
  return replaceSection(doc, { ...section, items, visible: true });
}

export function moveItem(
  doc: ResumeDocument,
  sectionKind: SectionKind,
  from: number,
  to: number,
): ResumeDocument {
  const section = sectionFor(doc, sectionKind);
  const items = [...section.items];
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return doc;
  const [it] = items.splice(from, 1);
  items.splice(to, 0, it!);
  return replaceSection(doc, { ...section, items: reindex(items) });
}

export function setSectionVisible(
  doc: ResumeDocument,
  kind: SectionKind,
  visible: boolean,
): ResumeDocument {
  return replaceSection(doc, { ...sectionFor(doc, kind), visible });
}

export function setSectionTitle(
  doc: ResumeDocument,
  kind: SectionKind,
  title: string | undefined,
): ResumeDocument {
  return replaceSection(doc, {
    ...sectionFor(doc, kind),
    title: title?.trim() ? title.trim() : undefined,
  });
}

export function moveSection(doc: ResumeDocument, from: number, to: number): ResumeDocument {
  const ordered = [...doc.sections].sort((a, b) => a.order - b.order);
  if (from < 0 || from >= ordered.length || to < 0 || to >= ordered.length) return doc;
  const [sec] = ordered.splice(from, 1);
  ordered.splice(to, 0, sec!);
  const reindexed = ordered.map((s, i) => ({ ...s, order: i }));
  return { ...doc, sections: reindexed };
}

export function setConfig(doc: ResumeDocument, patch: Partial<TemplateConfig>): ResumeDocument {
  return { ...doc, meta: { ...doc.meta, config: { ...doc.meta.config, ...patch } } };
}

export function setSummary(doc: ResumeDocument, summary: string): ResumeDocument {
  return { ...doc, summary, sections: ensureSummarySection(doc.sections) };
}

function ensureSummarySection(sections: ResumeSectionDoc[]): ResumeSectionDoc[] {
  if (!sections.some((s) => s.kind === "SUMMARY")) {
    return [...sections, { id: "summary", kind: "SUMMARY", visible: true, order: -1, items: [] }];
  }
  return sections;
}

export function blankItem(kind: SectionItem["kind"], sectionKind: SectionKind): SectionItem {
  const ref = { id: newTempId() } as { model: never; id: string };
  const base = { ref, visible: true, order: 0, origin: "USER" as const };
  switch (kind) {
    case "experience":
      return {
        kind,
        employer: "Company",
        title: "Role",
        employmentType: "FULL_TIME",
        bullets: [],
        achievements: [],
        technologies: [],
        skillsUsed: [],
        current: false,
        ...base,
      } as SectionItem;
    case "education":
      return {
        kind,
        institution: "School",
        coursework: [],
        activities: [],
        current: false,
        ...base,
      } as SectionItem;
    case "project":
      return {
        kind,
        name: "Project",
        bullets: [],
        technologies: [],
        skillsUsed: [],
        ...base,
      } as SectionItem;
    case "skill":
      return { kind, name: "Skill", category: "OTHER", keywords: [], ...base } as SectionItem;
    case "certification":
      return { kind, name: "Certification", inProgress: false, ...base } as SectionItem;
    case "award":
      return { kind, title: "Award", ...base } as SectionItem;
    case "publication":
      return { kind, title: "Publication", authors: [], ...base } as SectionItem;
    case "language":
      return { kind, name: "Language", ...base } as SectionItem;
    case "volunteer":
      return {
        kind,
        organization: "Organization",
        role: "Role",
        bullets: [],
        current: false,
        ...base,
      } as SectionItem;
    case "custom":
      return {
        kind,
        title: DEFAULT_SECTION_TITLES[sectionKind] ?? "Custom",
        sectionKindTag: "generic",
        items: [],
        ...base,
      } as SectionItem;
  }
}

export function reindex(items: SectionItem[]): SectionItem[] {
  return items.map((it, i) => ({ ...it, order: i }));
}

/** Section order normalized dense by presentation order. */
export function normalizeDoc(doc: ResumeDocument): ResumeDocument {
  const sorted = [...doc.sections].sort((a, b) => a.order - b.order);
  return {
    ...doc,
    sections: sorted.map((s, i) => ({ ...s, order: i, items: reindex(s.items) })),
  };
}
