import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/db/client";
import { ForbiddenError } from "@/server/context";
import {
  resumeDocumentSchema,
  type ResumeDocument,
  type SectionItem,
  type TemplateConfig,
} from "@/lib/resume/document";
import { getTemplate } from "@/templates/catalog";

/**
 * Mapping between the normalized database (career library + composition
 * rows) and the working ResumeDocument (§19, §57, §108).
 *
 * The document is the unit of editing/autosave/export; the DB is the unit of
 * ownership/reuse. Deleting or hiding a resume item NEVER touches the library
 * entry; editing an entry here intentionally updates the shared fact (the
 * editor warns in UI that it syncs to the profile).
 */

export type EntryModelName =
  | "EXPERIENCE"
  | "EDUCATION"
  | "PROJECT"
  | "SKILL"
  | "CERTIFICATION"
  | "AWARD"
  | "PUBLICATION"
  | "LANGUAGE"
  | "VOLUNTEER"
  | "CUSTOM_SECTION";

export const MODEL_TO_SECTION: Record<EntryModelName, string> = {
  EXPERIENCE: "EXPERIENCE",
  EDUCATION: "EDUCATION",
  PROJECT: "PROJECTS",
  SKILL: "SKILLS",
  CERTIFICATION: "CERTIFICATIONS",
  AWARD: "AWARDS",
  PUBLICATION: "PUBLICATIONS",
  LANGUAGE: "LANGUAGES",
  VOLUNTEER: "VOLUNTEER",
  CUSTOM_SECTION: "CUSTOM",
};

export const SECTION_TO_MODELS: Record<string, EntryModelName[]> = {
  EXPERIENCE: ["EXPERIENCE"],
  EDUCATION: ["EDUCATION"],
  PROJECTS: ["PROJECT"],
  SKILLS: ["SKILL"],
  CERTIFICATIONS: ["CERTIFICATION"],
  AWARDS: ["AWARD"],
  PUBLICATIONS: ["PUBLICATION"],
  LANGUAGES: ["LANGUAGE"],
  VOLUNTEER: ["VOLUNTEER"],
  CUSTOM: ["CUSTOM_SECTION"],
  SUMMARY: [],
  OTHER: [],
};

const ENTRY_DELEGATE = {
  EXPERIENCE: () => db.experience,
  EDUCATION: () => db.education,
  PROJECT: () => db.project,
  SKILL: () => db.skill,
  CERTIFICATION: () => db.certification,
  AWARD: () => db.award,
  PUBLICATION: () => db.publication,
  LANGUAGE: () => db.languageEntry,
  VOLUNTEER: () => db.volunteerExperience,
  CUSTOM_SECTION: () => db.customSection,
} as const;

type EntryRow = Record<string, unknown> & { id: string; order: number };

// ─────────────────────────────── load ────────────────────────────────────────

export interface LoadedResume {
  resumeId: string;
  userId: string;
  doc: ResumeDocument;
}

export async function loadResumeDocument(userId: string, resumeId: string): Promise<LoadedResume> {
  const resume = await db.resume.findFirst({
    where: { id: resumeId, deletedAt: null, careerProfile: { userId } },
    include: {
      sections: {
        include: { items: true },
        orderBy: { order: "asc" },
      },
      careerProfile: {
        include: {
          experiences: { where: { archivedAt: null } },
          educations: { where: { archivedAt: null } },
          projects: { where: { archivedAt: null } },
          skills: { where: { archivedAt: null } },
          certifications: { where: { archivedAt: null } },
          awards: { where: { archivedAt: null } },
          publications: { where: { archivedAt: null } },
          languages: { where: { archivedAt: null } },
          volunteers: { where: { archivedAt: null } },
          customSections: { where: { archivedAt: null } },
        },
      },
    },
  });
  if (!resume) throw new ForbiddenError("NOT_FOUND");
  const profile = await db.profile.findUnique({ where: { userId } });

  const entriesById = new Map<string, EntryRow>();
  const PROFILE_KEY_TO_MODEL: Record<string, EntryModelName> = {
    experiences: "EXPERIENCE", educations: "EDUCATION", projects: "PROJECT", skills: "SKILL",
    certifications: "CERTIFICATION", awards: "AWARD", publications: "PUBLICATION",
    languages: "LANGUAGE", volunteers: "VOLUNTEER", customSections: "CUSTOM_SECTION",
  };
  for (const [pk, rows] of Object.entries(resume.careerProfile as unknown as Record<string, unknown>)) {
    const model = PROFILE_KEY_TO_MODEL[pk];
    if (!model || !Array.isArray(rows)) continue;
    for (const r of rows as EntryRow[]) entriesById.set(`${model}:${r.id}`, { ...r, __model: model });
  }

  const itemsBySection = new Map<string, SectionItem[]>();
  for (const section of resume.sections) {
    const out: SectionItem[] = [];
    for (const item of section.items) {
      const entry = entriesById.get(`${item.model}:${item.entryId}`);
      if (!entry) continue; // library entry archived — silently unlinked at save
      const merged = { ...entry, ...((item as { override?: Record<string, unknown> }).override as Record<string, unknown>) };
      const si = entryToSectionItem(item.model, merged, item.visible, item.order);
      if (si) out.push(si);
    }
    itemsBySection.set(section.kind, out);
  }

  const doc = resumeDocumentSchema.parse({
    schemaVersion: 1,
    meta: {
      resumeId: resume.id,
      name: resume.name,
      language: resume.resumeLanguage,
      paperSize: resume.paperSize,
      templateId: resume.templateId,
      templateVersion: 1,
      config: resume.templateConfig as object,
    },
    contact: {
      fullName: profile?.displayName ?? "Your Name",
      headline: profile?.headline ?? undefined,
      email: profile?.email ?? undefined,
      phone: profile?.phone ?? undefined,
      location: profile?.location ?? undefined,
      website: profile?.website ?? undefined,
      linkedin: profile?.linkedin ?? undefined,
      github: profile?.github ?? undefined,
    },
    summary: resume.careerProfile.summary ?? "",
    sections: resume.sections.map((s) => ({
      id: s.kind.toLowerCase(),
      kind: s.kind,
      title: s.title ?? undefined,
      visible: s.visible,
      order: s.order,
      items: itemsBySection.get(s.kind) ?? [],
    })),
  });

  // ensure every renderable section exists (order continues after stored ones)
  const known = new Set(doc.sections.map((s) => s.kind));
  const defaults = defaultSectionsFor(doc);
  let nextOrder = doc.sections.reduce((a, s) => Math.max(a, s.order), -1) + 1;
  for (const s of defaults) {
    if (!known.has(s.kind)) {
      doc.sections.push({ ...s, order: nextOrder++, items: itemsBySection.get(s.kind) ?? [] });
    }
  }
  return { resumeId: resume.id, userId, doc };
}

const EDITABLE_SECTION_KINDS = [
  "SUMMARY",
  "EXPERIENCE",
  "EDUCATION",
  "SKILLS",
  "PROJECTS",
  "CERTIFICATIONS",
  "AWARDS",
  "PUBLICATIONS",
  "LANGUAGES",
  "VOLUNTEER",
  "CUSTOM",
] as const;

export function defaultSectionsFor(doc: ResumeDocument) {
  const present = new Set(doc.sections.map((s) => s.kind));
  return EDITABLE_SECTION_KINDS.filter((k) => !present.has(k)).map((kind, i) => ({
    id: kind.toLowerCase(),
    kind,
    title: undefined as string | undefined,
    visible: kind === "SUMMARY" ? false : true,
    order: 100 + i,
    items: [] as SectionItem[],
  }));
}

function nz(v: unknown): unknown {
  return v === null ? undefined : v;
}

function strip<T extends object>(o: T): T {
  const out = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) out[k] = v;
  }
  return out as T;
}

function entryToSectionItem(model: EntryModelName, e: EntryRow, visible: boolean, order: number): SectionItem | null {
  const ref = { model, id: e.id as string };
  const base = { ref, visible, order, origin: (e.origin as "USER") ?? "USER" };
  switch (model) {
    case "EXPERIENCE":
      return {
        kind: "experience",
        employer: String(e.employer ?? ""),
        title: String(e.title ?? ""),
        employmentType: nz(e.employmentType) as never,
        location: nz(e.location) as never,
        startDate: nz(e.startDate) as never,
        endDate: nz(e.endDate) as never,
        current: Boolean(e.current),
        companyUrl: nz(e.companyUrl) as never,
        description: nz(e.description) as never,
        bullets: (e.bullets as string[]) ?? [],
        achievements: (e.achievements as string[]) ?? [],
        technologies: (e.technologies as string[]) ?? [],
        skillsUsed: (e.skillsUsed as string[]) ?? [],
        projectNote: nz(e.projectNote) as never,
        ...base,
      };
    case "EDUCATION":
      return {
        kind: "education",
        institution: String(e.institution ?? ""),
        degree: nz(e.degree) as never,
        field: nz(e.field) as never,
        location: nz(e.location) as never,
        startDate: nz(e.startDate) as never,
        endDate: nz(e.endDate) as never,
        current: Boolean(e.current),
        gpa: nz(e.gpa) as never,
        honors: nz(e.honors) as never,
        coursework: (e.coursework as string[]) ?? [],
        activities: (e.activities as string[]) ?? [],
        description: nz(e.description) as never,
        ...base,
      };
    case "PROJECT":
      return {
        kind: "project",
        name: String(e.name ?? ""),
        role: nz(e.role) as never,
        url: nz(e.url) as never,
        startDate: nz(e.startDate) as never,
        endDate: nz(e.endDate) as never,
        description: nz(e.description) as never,
        bullets: (e.bullets as string[]) ?? [],
        technologies: (e.technologies as string[]) ?? [],
        skillsUsed: (e.skillsUsed as string[]) ?? [],
        ...base,
      };
    case "SKILL":
      return {
        kind: "skill",
        name: String(e.name ?? ""),
        category: nz(e.category) as never,
        level: (e.level as number | null) ?? undefined,
        keywords: (e.keywords as string[]) ?? [],
        ...base,
      };
    case "CERTIFICATION":
      return {
        kind: "certification",
        name: String(e.name ?? ""),
        issuer: nz(e.issuer) as never,
        credentialId: nz(e.credentialId) as never,
        url: nz(e.url) as never,
        issueDate: nz(e.issueDate) as never,
        expiryDate: nz(e.expiryDate) as never,
        inProgress: Boolean(e.inProgress),
        ...base,
      };
    case "AWARD":
      return {
        kind: "award",
        title: String(e.title ?? ""),
        issuer: nz(e.issuer) as never,
        date: nz(e.date) as never,
        blurb: nz(e.blurb) as never,
        ...base,
      };
    case "PUBLICATION":
      return {
        kind: "publication",
        title: String(e.title ?? ""),
        publisher: nz(e.publisher) as never,
        url: nz(e.url) as never,
        date: nz(e.date) as never,
        authors: (e.authors as string[]) ?? [],
        citationStyle: nz(e.citationStyle) as never,
        blurb: nz(e.blurb) as never,
        ...base,
      };
    case "LANGUAGE":
      return {
        kind: "language",
        name: String(e.name ?? ""),
        proficiency: nz(e.proficiency) as never,
        ...base,
      };
    case "VOLUNTEER":
      return {
        kind: "volunteer",
        organization: String(e.organization ?? ""),
        role: String(e.role ?? ""),
        location: nz(e.location) as never,
        startDate: nz(e.startDate) as never,
        endDate: nz(e.endDate) as never,
        current: Boolean(e.current),
        description: nz(e.description) as never,
        bullets: (e.bullets as string[]) ?? [],
        ...base,
      };
    case "CUSTOM_SECTION":
      return {
        kind: "custom",
        title: String(e.title ?? ""),
        sectionKindTag: String(e.kind ?? "generic"),
        items: (e.items as string[]) ?? [],
        ...base,
      };
  }
}

// ─────────────────────────────── save ────────────────────────────────────────

export interface SaveOptions {
  /** "autosave" | "manual" — drives version creation policy */
  mode: "autosave" | "manual";
  label?: string;
  note?: string;
  source?: "MANUAL" | "AUTOSAVE" | "AI_TAILOR" | "ONE_PAGE" | "IMPORT" | "DUPLICATE" | "RESTORE" | "TEMPLATE";
  jobDescriptionId?: string | null;
  /** when true (default autosave), write entry content back to the career library */
  syncEntries?: boolean;
  createVersion?: boolean;
}

export interface SaveResult {
  savedAt: string;
  versionCreated: boolean;
  versionId?: string;
  contentHash: string;
  /** tempId → created library row id; the editor must adopt these refs */
  idMap: Record<string, string>;
}

/**
 * Sparse-ify config against the template's defaults so a later template
 * switch re-exposes the new template's look (§107: content preserved exactly,
 * only the template identity changes).
 */
function sparseConfig(config: TemplateConfig, templateId: string): Record<string, unknown> {
  let defaults: Record<string, unknown>;
  try {
    defaults = { ...getTemplate(templateId).defaultConfig } as unknown as Record<string, unknown>;
  } catch {
    defaults = {};
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
    if (JSON.stringify(defaults[k]) !== JSON.stringify(v)) out[k] = v;
  }
  return out;
}

function canonicalHash(doc: ResumeDocument): string {
  // content-only hash (config excluded: reformatting shouldn't spawn versions)
  const { meta, ...rest } = doc;
  void meta;
  return createHash("sha256").update(JSON.stringify(stripDoc(rest))).digest("hex");
}

function stripDoc(o: unknown): unknown {
  if (Array.isArray(o)) return o.map(stripDoc);
  if (o && typeof o === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (v === undefined || v === null || v === "") continue;
      out[k] = stripDoc(v);
    }
    return out;
  }
  return o;
}

export async function saveResumeDocument(
  userId: string,
  resumeId: string,
  doc: ResumeDocument,
  opts: SaveOptions,
): Promise<SaveResult> {
  const resume = await db.resume.findFirst({
    where: { id: resumeId, deletedAt: null, careerProfile: { userId } },
  });
  if (!resume) throw new ForbiddenError("NOT_FOUND");
  const profile = await db.careerProfile.findFirst({ where: { id: resume.careerProfileId, userId } });
  if (!profile) throw new ForbiddenError("NOT_FOUND");

  const contentHash = canonicalHash(doc);
  const tx = [] as Array<Promise<unknown>>;

  // 1. shared facts: summary lives on the career profile (§19)
  const summaryText = doc.summary ?? "";
  if (summaryText !== (profile.summary ?? "")) {
    tx.push(db.careerProfile.update({ where: { id: profile.id }, data: { summary: summaryText || null } }));
  }

  // 2a. new items created inside the editor are written into the library
  // (they did not exist before — nothing is modified behind the user's back).
  const createdIds = new Map<string, string>(); // tempId -> real id
  for (const section of doc.sections) {
    for (const item of section.items) {
      const refId = item.ref?.id;
      const isTemp = !refId || refId.startsWith("tmp:");
      if (!isTemp) continue;
      const patch = sectionItemToEntryData(item);
      if (!patch) continue;
      const model = item.ref?.model ?? patch.model;
      const delegate = ENTRY_DELEGATE[model as EntryModelName]() as unknown as {
        create: (a: { data: Record<string, unknown> }) => Promise<{ id: string }>;
      };
      const created = await delegate.create({
        data: { ...patch.data, careerProfileId: profile.id, origin: "USER" },
      });
      createdIds.set(refId ?? `tmp:${section.kind}:${item.order}`, created.id);
    }
  }

  // 2b. entry content edits go back to the library (shared career facts, §19)
  if (opts.syncEntries !== false) {
    for (const section of doc.sections) {
      for (const item of section.items) {
        const refId = item.ref?.id;
        if (!refId || refId.startsWith("tmp:")) continue; // created in 2a
        const patch = sectionItemToEntryData(item);
        if (!patch) continue;
        const delegate = ENTRY_DELEGATE[item.ref.model]() as unknown as {
          updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>;
        };
        tx.push(
          delegate.updateMany({
            where: { id: refId, careerProfileId: profile.id },
            data: patch.data,
          }),
        );
      }
    }
  }

  // 3. composition: sections + item links (delete join rows, never entries §57)
  const wantedKinds = new Map(doc.sections.map((sec) => [sec.kind as string, sec]));
  const existingSections = await db.resumeSection.findMany({ where: { resumeId }, include: { items: true } });
  const existingByKind = new Map(existingSections.map((sec) => [sec.kind as string, sec]));

  for (const [kind, section] of wantedKinds) {
    const prior = existingByKind.get(kind);
    let sectionId: string;
    let linkedItems: Array<{ id: string; model: string; entryId: string; visible: boolean; order: number }>;
    if (!prior) {
      const created = await db.resumeSection.create({
        data: { resumeId, kind: kind as never, title: section.title ?? null, order: section.order, visible: section.visible },
      });
      sectionId = created.id;
      linkedItems = [];
    } else {
      await db.resumeSection.update({
        where: { id: prior.id },
        data: { title: section.title ?? null, order: section.order, visible: section.visible },
      });
      sectionId = prior.id;
      linkedItems = prior.items;
    }
    const existingByKey = new Map(linkedItems.map((i) => [`${i.model}:${i.entryId}`, i]));
    const wantedKeys = new Set<string>();
    for (const item of section.items) {
      const model = item.ref?.model as EntryModelName | undefined;
      let entryId: string | undefined = item.ref?.id;
      if (entryId && createdIds.has(entryId)) entryId = createdIds.get(entryId);
      if (!model || !entryId || entryId.startsWith("tmp:")) continue;
      const key = `${model}:${entryId}`;
      wantedKeys.add(key);
      const override = (item as { override?: Record<string, unknown> }).override ?? {};
      const old = existingByKey.get(key);
      if (old) {
        await db.resumeSectionItem.update({
          where: { id: old.id },
          data: { order: item.order, visible: item.visible, override: override as never },
        });
      } else {
        await db.resumeSectionItem.create({
          data: { sectionId, model: model as never, entryId, order: item.order, visible: item.visible, override: override as never },
        });
      }
    }
    for (const old of linkedItems) {
      if (!wantedKeys.has(`${old.model}:${old.entryId}`)) {
        await db.resumeSectionItem.delete({ where: { id: old.id } });
      }
    }
  }
  for (const [kind, prior] of existingByKind) {
    if (!wantedKinds.has(kind)) {
      await db.resumeSection.delete({ where: { id: prior.id } });
    }
  }

  // 4. resume-level meta
  tx.push(
    db.resume.update({
      where: { id: resumeId },
      data: {
        name: doc.meta.name.slice(0, 120),
        templateId: doc.meta.templateId,
        templateConfig: sparseConfig(doc.meta.config, doc.meta.templateId) as Prisma.InputJsonValue,
        paperSize: doc.meta.paperSize,
        resumeLanguage: doc.meta.language,
      },
    }),
  );
  await Promise.all(tx);

  // 5. version snapshots — autosave is throttled by content hash
  let versionCreated = false;
  let versionId: string | undefined;
  const wantVersion = opts.mode === "manual" || opts.createVersion;
  if (wantVersion) {
    if (opts.mode === "autosave") {
      const lastAuto = await db.resumeVersion.findFirst({
        where: { resumeId, source: "AUTOSAVE" },
        orderBy: { createdAt: "desc" },
        select: { note: true },
      });
      if (lastAuto?.note === `hash:${contentHash}`) {
        return { savedAt: new Date().toISOString(), versionCreated: false, contentHash, idMap: Object.fromEntries(createdIds) };
      }
    }
    const snapshot = await resumeDocumentSchema.parseAsync(doc);
    const version = await db.resumeVersion.create({
      data: {
        resumeId,
        label: opts.label ?? (opts.mode === "autosave" ? "Autosave" : "Manual save"),
        source: opts.source ?? (opts.mode === "autosave" ? "AUTOSAVE" : "MANUAL"),
        note: opts.mode === "autosave" ? `hash:${contentHash}` : opts.note?.slice(0, 500) ?? null,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        jobDescriptionId: opts.jobDescriptionId ?? null,
      },
    });
    versionCreated = true;
    versionId = version.id;
  }
  return { savedAt: new Date().toISOString(), versionCreated, versionId, contentHash, idMap: Object.fromEntries(createdIds) };
}

/** Map a document section item back onto its library entry row (shared edit). */
function sectionItemToEntryData(item: SectionItem): { model: EntryModelName; data: Record<string, unknown> } | null {
  const model = item.ref?.model;
  if (!model) return null;
  const d: Record<string, unknown> = {};
  switch (item.kind) {
    case "experience":
      Object.assign(d, strip({
        employer: item.employer, title: item.title, employmentType: item.employmentType, location: item.location || null,
        startDate: item.startDate || null, endDate: item.endDate || null, current: item.current, companyUrl: item.companyUrl || null,
        description: item.description || null, bullets: item.bullets, achievements: item.achievements, technologies: item.technologies,
        skillsUsed: item.skillsUsed, projectNote: item.projectNote || null,
      }));
      break;
    case "education":
      Object.assign(d, strip({
        institution: item.institution, degree: item.degree || null, field: item.field || null, location: item.location || null,
        startDate: item.startDate || null, endDate: item.endDate || null, current: item.current, gpa: item.gpa || null, honors: item.honors || null,
        coursework: item.coursework, activities: item.activities, description: item.description || null,
      }));
      break;
    case "project":
      Object.assign(d, strip({
        name: item.name, role: item.role || null, url: item.url || null, startDate: item.startDate || null, endDate: item.endDate || null,
        description: item.description || null, bullets: item.bullets, technologies: item.technologies,
        skillsUsed: item.skillsUsed ?? [],
      }));
      break;
    case "skill":
      Object.assign(d, strip({ name: item.name, category: item.category, level: item.level ?? null, keywords: item.keywords }));
      break;
    case "certification":
      Object.assign(d, strip({
        name: item.name, issuer: item.issuer || null, credentialId: item.credentialId || null, url: item.url || null,
        issueDate: item.issueDate || null, expiryDate: item.expiryDate || null, inProgress: item.inProgress,
      }));
      break;
    case "award":
      Object.assign(d, strip({ title: item.title, issuer: item.issuer || null, date: item.date || null, blurb: item.blurb || null }));
      break;
    case "publication":
      Object.assign(d, strip({ title: item.title, publisher: item.publisher || null, url: item.url || null, date: item.date || null, authors: item.authors, citationStyle: item.citationStyle || null, blurb: item.blurb || null }));
      break;
    case "language":
      Object.assign(d, strip({ name: item.name, proficiency: item.proficiency || null }));
      break;
    case "volunteer":
      Object.assign(d, strip({
        organization: item.organization, role: item.role, location: item.location || null, startDate: item.startDate || null,
        endDate: item.endDate || null, current: item.current, description: item.description || null, bullets: item.bullets,
      }));
      break;
    case "custom":
      Object.assign(d, strip({ title: item.title, kind: item.sectionKindTag || "generic", items: item.items }));
      break;
  }
  return { model, data: d };
}

