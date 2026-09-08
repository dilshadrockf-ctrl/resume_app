"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ok, withValidation, type ActionResult } from "@/server/action-utils";
import { requireCtx } from "@/server/context";
import * as service from "@/features/applications/service";

const createSchema = z.object({
  company: z.string().trim().min(1).max(160),
  role: z.string().trim().min(1).max(160),
  url: z.string().max(500).optional(),
  salary: z.string().max(120).optional(),
  location: z.string().max(160).optional(),
  status: z.enum(service.STATUSES).optional(),
  appliedAt: z.string().optional().nullable(),
  followUpAt: z.string().optional().nullable(),
  interviewAt: z.string().optional().nullable(),
  jobId: z.string().max(64).optional().nullable(),
  coverLetterId: z.string().max(64).optional().nullable(),
  resumeVersionId: z.string().max(64).optional().nullable(),
  contactName: z.string().max(120).optional(),
  contactEmail: z.string().email().max(254).optional().or(z.literal("")),
  contactPhone: z.string().max(40).optional(),
  notes: z.string().max(5000).optional(),
});

export async function createApplicationAction(
  raw: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withValidation(createSchema, raw, async (input) => {
    const ctx = await requireCtx();
    const id = await service.createApplication(ctx, input as service.CreateAppInput);
    revalidatePath("/applications");
    return ok({ id });
  });
}

export async function updateApplicationAction(
  raw: { id: string } & Partial<z.input<typeof createSchema>>,
): Promise<ActionResult<undefined>> {
  return withValidation(
    z.object({ id: z.string().min(1).max(64) }).merge(createSchema.partial()),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      const { id, ...rest } = input;
      await service.updateApplication(ctx, id, rest as service.CreateAppInput);
      revalidatePath("/applications");
      revalidatePath(`/applications/${id}`);
      return ok(undefined);
    },
  );
}

export async function deleteApplicationAction(raw: {
  id: string;
}): Promise<ActionResult<undefined>> {
  return withValidation(z.object({ id: z.string().min(1).max(64) }), raw, async (input) => {
    const ctx = await requireCtx();
    await service.deleteApplication(ctx, input.id);
    revalidatePath("/applications");
    return ok(undefined);
  });
}

export async function addNoteAction(raw: {
  applicationId: string;
  body: string;
}): Promise<ActionResult<undefined>> {
  return withValidation(
    z.object({
      applicationId: z.string().min(1).max(64),
      body: z.string().trim().min(1).max(4000),
    }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      await service.addNote(ctx, input.applicationId, input.body);
      revalidatePath(`/applications/${input.applicationId}`);
      return ok(undefined);
    },
  );
}

export async function deleteNoteAction(raw: {
  noteId: string;
  applicationId: string;
}): Promise<ActionResult<undefined>> {
  return withValidation(
    z.object({ noteId: z.string().min(1).max(64), applicationId: z.string().min(1).max(64) }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      await service.deleteNote(ctx, input.noteId);
      revalidatePath(`/applications/${input.applicationId}`);
      return ok(undefined);
    },
  );
}
