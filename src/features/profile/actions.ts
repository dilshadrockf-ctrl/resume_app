"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { guard, ok, fail, withValidation, type ActionResult } from "@/server/action-utils";
import { audit, requireCtx } from "@/server/context";
import {
  experienceItemSchema,
  educationItemSchema,
  projectItemSchema,
  skillItemSchema,
  certificationItemSchema,
  awardItemSchema,
  publicationItemSchema,
  languageItemSchema,
  volunteerItemSchema,
  customItemSchema,
} from "@/lib/resume/document";

/**
 * Career library CRUD (§19). Entries are shared across resumes: edits here
 * propagate; archiving hides everywhere but never destroys (§57).
 */

export const LIBRARY_KINDS = [
  "experience", "education", "project", "skill", "certification",
  "award", "publication", "language", "volunteer", "custom",
] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

const DELEGATE: Record<LibraryKind, string> = {
  experience: "experience", education: "education", project: "project", skill: "skill",
  certification: "certification", award: "award", publication: "publication",
  language: "languageEntry", volunteer: "volunteerExperience", custom: "customSection",
};

/** strip doc-only fields, keep entry payload */
function entryData(kind: LibraryKind, parsed: Record<string, unknown>): Record<string, unknown> {
  const { ref, visible, order, origin, ...rest } = parsed;
  void ref; void visible; void order; void origin;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) out[k] = v === undefined ? null : v;
  if (kind === "custom") {
    out.kind = out.sectionKindTag ?? "generic";
    delete out.sectionKindTag;
  }
  if (kind === "project") out.url = out.url || null;
  return out;
}

const entrySchemas: Record<LibraryKind, z.ZodType> = {
  experience: experienceItemSchema, education: educationItemSchema, project: projectItemSchema,
  skill: skillItemSchema, certification: certificationItemSchema, award: awardItemSchema,
  publication: publicationItemSchema, language: languageItemSchema, volunteer: volunteerItemSchema,
  custom: customItemSchema,
};

export async function saveEntryAction(raw: {
  kind: LibraryKind;
  id?: string | null;
  data: Record<string, unknown>;
}): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const ctx = await requireCtx();
    const schema = entrySchemas[raw.kind];
    if (!schema) return fail("Unknown entry kind", "VALIDATION");
    const KIND_TO_MODEL: Record<LibraryKind, string> = {
      experience: "EXPERIENCE", education: "EDUCATION", project: "PROJECT", skill: "SKILL",
      certification: "CERTIFICATION", award: "AWARD", publication: "PUBLICATION",
      language: "LANGUAGE", volunteer: "VOLUNTEER", custom: "CUSTOM_SECTION",
    };
    const parsed = (schema as z.ZodType<Record<string, unknown>>).parse({
      ...raw.data,
      ref: { model: KIND_TO_MODEL[raw.kind], id: raw.id ?? "tmp:client" },
      visible: true,
      order: 0,
    });
    const data = entryData(raw.kind, parsed);
    const profile = await db.careerProfile.findUnique({ where: { userId: ctx.userId } });
    if (!profile) return fail("Career profile not found", "NOT_FOUND");
    const delegate = (db as unknown as Record<string, {
      create: (a: { data: object }) => Promise<{ id: string }>;
      update: (a: { where: { id: string }; data: object }) => Promise<{ id: string }>;
    }>)[DELEGATE[raw.kind]]!;
    if (raw.id) {
      const finder = (db as unknown as Record<string, { findFirst: (a: { where: object }) => Promise<{ id: string } | null> }>)[DELEGATE[raw.kind]]!;
      const existing = await finder.findFirst({ where: { id: raw.id, careerProfileId: profile.id } });
      if (!existing) return fail("Entry not found", "NOT_FOUND");
      await delegate.update({ where: { id: raw.id }, data });
      await audit(ctx, "entry_updated", { kind: raw.kind, id: raw.id });
      revalidateAll();
      return ok({ id: raw.id });
    }
    const created = await delegate.create({ data: { ...data, careerProfileId: profile.id } });
    await audit(ctx, "entry_created", { kind: raw.kind, id: created.id });
    revalidateAll();
    return ok({ id: created.id });
  });
}

export async function deleteEntryAction(raw: { kind: LibraryKind; id: string; purge?: boolean }): Promise<ActionResult<undefined>> {
  return withValidation(
    z.object({ kind: z.enum(LIBRARY_KINDS), id: z.string().min(1).max(64), purge: z.boolean().optional() }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      const profile = await db.careerProfile.findUnique({ where: { userId: ctx.userId } });
      if (!profile) return ok(undefined);
      const d = (db as unknown as Record<string, { updateMany: (a: { where: object; data: object }) => Promise<{ count: number }>; deleteMany: (a: { where: object }) => Promise<{ count: number }> }>)[DELEGATE[input.kind]]!;
      if (input.purge) {
        await d.deleteMany({ where: { id: input.id, careerProfileId: profile.id } });
        await audit(ctx, "entry_purged", { kind: input.kind, id: input.id });
      } else {
        await d.updateMany({ where: { id: input.id, careerProfileId: profile.id }, data: { archivedAt: new Date() } });
        await audit(ctx, "entry_archived", { kind: input.kind, id: input.id });
      }
      revalidateAll();
      return ok(undefined);
    },
  );
}

export async function reorderEntriesAction(raw: { kind: LibraryKind; ids: string[] }): Promise<ActionResult<undefined>> {
  return withValidation(
    z.object({ kind: z.enum(LIBRARY_KINDS), ids: z.array(z.string().min(1).max(64)).max(200) }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      const profile = await db.careerProfile.findUnique({ where: { userId: ctx.userId } });
      if (!profile) return ok(undefined);
      const d = (db as unknown as Record<string, { updateMany: (a: { where: object; data: object }) => Promise<unknown> }>)[DELEGATE[input.kind]]!;
      await Promise.all(
        input.ids.map((id, i) => d.updateMany({ where: { id, careerProfileId: profile.id }, data: { order: i } })),
      );
      revalidateAll();
      return ok(undefined);
    },
  );
}

export async function restoreEntryAction(raw: { kind: LibraryKind; id: string }): Promise<ActionResult<undefined>> {
  return withValidation(z.object({ kind: z.enum(LIBRARY_KINDS), id: z.string().min(1).max(64) }), raw, async (input) => {
    const ctx = await requireCtx();
    const profile = await db.careerProfile.findUnique({ where: { userId: ctx.userId } });
    if (!profile) return ok(undefined);
    const d = (db as unknown as Record<string, { updateMany: (a: { where: object; data: object }) => Promise<unknown> }>)[DELEGATE[input.kind]]!;
    await d.updateMany({ where: { id: input.id, careerProfileId: profile.id }, data: { archivedAt: null } });
    revalidateAll();
    return ok(undefined);
  });
}

// ────────────────────────── profile (contact) + summary ─────────────────────

const profileSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  headline: z.string().trim().max(120).optional(),
  email: z.string().email().max(254).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
  website: z.string().trim().max(200).optional(),
  linkedin: z.string().trim().max(200).optional(),
  github: z.string().trim().max(200).optional(),
  location: z.string().trim().max(120).optional(),
  targetRole: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(120).optional(),
  seniority: z.string().trim().max(60).optional(),
  country: z.string().trim().max(80).optional(),
  currentField: z.string().trim().max(120).optional(),
  targetField: z.string().trim().max(120).optional(),
});

export async function saveProfileAction(raw: z.input<typeof profileSchema>): Promise<ActionResult<undefined>> {
  return withValidation(profileSchema, raw, async (input) => {
    const ctx = await requireCtx();
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) data[k] = typeof v === "string" && v.trim() === "" ? null : v;
    await db.profile.upsert({
      where: { userId: ctx.userId },
      create: { userId: ctx.userId, ...data },
      update: data,
    });
    await audit(ctx, "profile_updated");
    revalidateAll();
    return ok(undefined);
  });
}

export async function saveSummaryAction(raw: { summary: string }): Promise<ActionResult<undefined>> {
  return withValidation(z.object({ summary: z.string().max(2000) }), raw, async (input) => {
    const ctx = await requireCtx();
    const profile = await db.careerProfile.findUnique({ where: { userId: ctx.userId } });
    if (!profile) return ok(undefined);
    await db.careerProfile.update({ where: { id: profile.id }, data: { summary: input.summary.trim() || null } });
    await audit(ctx, "summary_updated");
    revalidateAll();
    return ok(undefined);
  });
}

function revalidateAll() {
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/resumes");
}
