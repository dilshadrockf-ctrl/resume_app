import { db } from "@/db/client";
import { ForbiddenError, type Ctx } from "@/server/context";
import { emptyResumeDocument, type ResumeDocument } from "@/lib/resume/document";
import { loadResumeDocument, saveResumeDocument, type SaveOptions } from "@/features/resume/repository";
import { getTemplate, TEMPLATES } from "@/templates/catalog";

/**
 * Resume CRUD + versions + publishing. Deleting a resume never touches the
 * career library (§57). Template switching preserves content exactly (§107)
 * — only meta.templateId changes; stored config stays sparse.
 */

export interface ResumeListItem {
  id: string;
  name: string;
  templateId: string;
  archivedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  published: boolean;
  slug: string | null;
  primaryVersionId: string | null;
}

export async function listResumes(ctx: Ctx): Promise<ResumeListItem[]> {
  const rows = await db.resume.findMany({
    where: { careerProfile: { userId: ctx.userId }, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    templateId: r.templateId,
    archivedAt: r.archivedAt,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
    published: Boolean(r.publishedAt),
    slug: r.slug,
    primaryVersionId: r.primaryVersionId,
  }));
}

async function getProfileId(userId: string): Promise<string> {
  const p = await db.careerProfile.findUnique({ where: { userId } });
  if (!p) throw new ForbiddenError("profile missing");
  return p.id;
}

/** New resumes start pre-populated with every visible library entry. */
export async function createResume(ctx: Ctx, name: string): Promise<{ resumeId: string; doc: ResumeDocument }> {
  const careerProfileId = await getProfileId(ctx.userId);
  const doc = emptyResumeDocument(name);
  const resume = await db.resume.create({
    data: { careerProfileId, name, templateId: "ats-classic", templateConfig: {} },
  });
  doc.meta.resumeId = resume.id;
  doc.meta.name = name;
  // attach library content
  const profile = await db.careerProfile.findUnique({
    where: { id: careerProfileId },
    include: {
      experiences: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      educations: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      projects: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      skills: { where: { archivedAt: null } },
      certifications: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      awards: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      publications: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      languages: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      volunteers: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      customSections: { where: { archivedAt: null }, orderBy: { order: "asc" } },
    },
  });
  if (profile) {
    const attach = (sectionKind: string, model: string, ids: string[]) => {
      const section = doc.sections.find((s) => s.kind === sectionKind);
      if (!section) return;
      section.items = ids.map((id, i) => ({
        kind: sectionKindToItemKind(sectionKind),
        ref: { model: model as never, id },
        visible: true,
        order: i,
        origin: "USER" as const,
        ...({} as object),
      })) as never;
      if (ids.length) section.visible = true;
    };
    attach("EXPERIENCE", "EXPERIENCE", profile.experiences.map((e) => e.id));
    attach("EDUCATION", "EDUCATION", profile.educations.map((e) => e.id));
    attach("PROJECTS", "PROJECT", profile.projects.map((e) => e.id));
    attach("SKILLS", "SKILL", profile.skills.map((e) => e.id));
    attach("CERTIFICATIONS", "CERTIFICATION", profile.certifications.map((e) => e.id));
    attach("AWARDS", "AWARD", profile.awards.map((e) => e.id));
    attach("PUBLICATIONS", "PUBLICATION", profile.publications.map((e) => e.id));
    attach("LANGUAGES", "LANGUAGE", profile.languages.map((e) => e.id));
    attach("VOLUNTEER", "VOLUNTEER", profile.volunteers.map((e) => e.id));
    attach("CUSTOM", "CUSTOM_SECTION", profile.customSections.map((e) => e.id));
    doc.summary = profile.summary ?? "";
  }
  const saved = await saveResumeDocument(ctx.userId, resume.id, doc, { mode: "manual", label: "Initial draft", source: "MANUAL", syncEntries: false, createVersion: true });
  void saved;
  return { resumeId: resume.id, doc };
}

function sectionKindToItemKind(kind: string) {
  const map: Record<string, string> = {
    EXPERIENCE: "experience", EDUCATION: "education", PROJECTS: "project", SKILLS: "skill",
    CERTIFICATIONS: "certification", AWARDS: "award", PUBLICATIONS: "publication",
    LANGUAGES: "language", VOLUNTEER: "volunteer", CUSTOM: "custom",
  };
  return map[kind] as never;
}

export async function duplicateResume(ctx: Ctx, resumeId: string, name?: string): Promise<string> {
  const source = await db.resume.findFirst({
    where: { id: resumeId, careerProfile: { userId: ctx.userId }, deletedAt: null },
    include: { sections: { include: { items: true } } },
  });
  if (!source) throw new ForbiddenError("NOT_FOUND");
  const { doc } = await loadResumeDocument(ctx.userId, resumeId);
  doc.meta.name = (name ?? `${source.name} copy`).slice(0, 120);
  const resume = await db.resume.create({
    data: {
      careerProfileId: source.careerProfileId,
      name: doc.meta.name,
      templateId: source.templateId,
      templateConfig: source.templateConfig as never,
      paperSize: source.paperSize,
      resumeLanguage: source.resumeLanguage,
      description: source.description,
    },
  });
  doc.meta.resumeId = resume.id;
  await saveResumeDocument(ctx.userId, resume.id, doc, { mode: "manual", label: "Duplicate", source: "DUPLICATE", syncEntries: false, createVersion: true });
  return resume.id;
}

export async function softDeleteResume(ctx: Ctx, resumeId: string): Promise<void> {
  // §57: only the resume's composition is removed — library stays untouched.
  const res = await db.resume.updateMany({
    where: { id: resumeId, careerProfile: { userId: ctx.userId }, deletedAt: null },
    data: { deletedAt: new Date(), publishedAt: null, slug: null },
  });
  if (res.count === 0) throw new ForbiddenError("NOT_FOUND");
}

export async function restoreResume(ctx: Ctx, resumeId: string): Promise<void> {
  const res = await db.resume.updateMany({
    where: { id: resumeId, careerProfile: { userId: ctx.userId }, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  if (res.count === 0) throw new ForbiddenError("NOT_FOUND");
}

export async function setArchived(ctx: Ctx, resumeId: string, archived: boolean): Promise<void> {
  await db.resume.updateMany({
    where: { id: resumeId, careerProfile: { userId: ctx.userId }, deletedAt: null },
    data: { archivedAt: archived ? new Date() : null },
  });
}

export async function renameResume(ctx: Ctx, resumeId: string, name: string): Promise<void> {
  const clean = name.trim().slice(0, 120);
  if (!clean) throw new Error("name required");
  const res = await db.resume.updateMany({
    where: { id: resumeId, careerProfile: { userId: ctx.userId }, deletedAt: null },
    data: { name: clean },
  });
  if (res.count === 0) throw new ForbiddenError("NOT_FOUND");
  const loaded = await loadResumeDocument(ctx.userId, resumeId);
  loaded.doc.meta.name = clean;
  await saveResumeDocument(ctx.userId, resumeId, loaded.doc, { mode: "manual", label: "Renamed", createVersion: false });
}

export async function switchTemplate(ctx: Ctx, resumeId: string, templateId: string): Promise<void> {
  const valid = TEMPLATES.some((t) => t.id === templateId);
  if (!valid) throw new Error("Unknown template");
  const loaded = await loadResumeDocument(ctx.userId, resumeId);
  // content untouched; sparse config re-based onto new template defaults (§107)
  loaded.doc.meta.templateId = templateId;
  const def = getTemplate(templateId);
  await saveResumeDocument(ctx.userId, resumeId, loaded.doc, { mode: "manual", label: `Template: ${def.name}`, source: "TEMPLATE", syncEntries: false });
}

export async function saveDoc(ctx: Ctx, resumeId: string, doc: ResumeDocument, opts: SaveOptions) {
  return saveResumeDocument(ctx.userId, resumeId, doc, opts);
}

export async function loadDoc(ctx: Ctx, resumeId: string) {
  return loadResumeDocument(ctx.userId, resumeId);
}

// ─────────────────────────────── versions ────────────────────────────────────

export async function listVersions(ctx: Ctx, resumeId: string) {
  await assertOwned(ctx, resumeId);
  const rows = await db.resumeVersion.findMany({
    where: { resumeId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, label: true, source: true, note: true, createdAt: true, isPrimary: true,
      atsScore: true, jobMatch: true, pageEstimate: true, jobDescriptionId: true,
      jobDescription: { select: { title: true, company: true } },
    },
  });
  return rows;
}

export async function restoreVersion(ctx: Ctx, resumeId: string, versionId: string): Promise<void> {
  await assertOwned(ctx, resumeId);
  const version = await db.resumeVersion.findFirst({ where: { id: versionId, resumeId } });
  if (!version) throw new ForbiddenError("NOT_FOUND");
  const snapshot = version.snapshot as unknown as ResumeDocument;
  snapshot.meta.resumeId = resumeId;
  // restoring writes the snapshot back through the normal save path — the
  // current state becomes a version first so nothing is ever lost.
  const current = await loadResumeDocument(ctx.userId, resumeId);
  await saveResumeDocument(ctx.userId, resumeId, current.doc, { mode: "manual", label: "Before restore", createVersion: true });
  await saveResumeDocument(ctx.userId, resumeId, snapshot, {
    mode: "manual",
    label: `Restored “${version.label}”`,
    source: "RESTORE",
    createVersion: true,
  });
}

export async function setPrimaryVersion(ctx: Ctx, resumeId: string, versionId: string | null): Promise<void> {
  await assertOwned(ctx, resumeId);
  if (versionId) {
    const v = await db.resumeVersion.findFirst({ where: { id: versionId, resumeId } });
    if (!v) throw new ForbiddenError("NOT_FOUND");
  }
  await db.resumeVersion.updateMany({ where: { resumeId }, data: { isPrimary: false } });
  if (versionId) await db.resumeVersion.update({ where: { id: versionId }, data: { isPrimary: true } });
  await db.resume.update({ where: { id: resumeId }, data: { primaryVersionId: versionId } });
}

async function assertOwned(ctx: Ctx, resumeId: string) {
  const ok = await db.resume.count({ where: { id: resumeId, careerProfile: { userId: ctx.userId }, deletedAt: null } });
  if (!ok) throw new ForbiddenError("NOT_FOUND");
}

// ─────────────────────────────── publishing ──────────────────────────────────

const SLUG_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

export async function setPublished(ctx: Ctx, resumeId: string, published: boolean, publicFields?: Record<string, unknown>): Promise<string | null> {
  await assertOwned(ctx, resumeId);
  if (!published) {
    await db.resume.update({ where: { id: resumeId }, data: { publishedAt: null, slug: null, publicFields: (publicFields ?? {}) as never } });
    return null;
  }
  const existing = await db.resume.findUnique({ where: { id: resumeId }, select: { slug: true } });
  if (existing?.slug) {
    await db.resume.update({ where: { id: resumeId }, data: { publishedAt: new Date(), publicFields: (publicFields ?? {}) as never } });
    return existing.slug;
  }
  const profile = await db.user.findUnique({ where: { id: ctx.userId }, select: { email: true, name: true } });
  const base = (profile?.name ?? profile?.email ?? "resume").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "resume";
  let slug = "";
  for (let i = 0; i < 6; i++) {
    const candidate = `${base}-${Array.from({ length: 6 }, () => SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)]).join("")}`;
    const taken = await db.resume.count({ where: { slug: candidate } });
    if (!taken) {
      slug = candidate;
      break;
    }
  }
  if (!slug) throw new Error("Could not allocate a public link — try again");
  await db.resume.update({ where: { id: resumeId }, data: { publishedAt: new Date(), slug, publicFields: (publicFields ?? {}) as never } });
  return slug;
}

export async function getPublishedResume(slug: string) {
  const resume = await db.resume.findFirst({ where: { slug, publishedAt: { not: null }, deletedAt: null } });
  if (!resume) return null;
  return resume;
}
