import { db } from "@/db/client";
import { ForbiddenError, type Ctx } from "@/server/context";

/** Application tracker (§43) — status pipeline, notes, links to the exact
 *  resume version + letter that were sent. */

export const STATUSES = [
  "SAVED",
  "PREPARING",
  "APPLIED",
  "RECRUITER_SCREEN",
  "INTERVIEW",
  "TECHNICAL_INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type AppStatus = (typeof STATUSES)[number];

export async function listApplications(ctx: Ctx, status?: AppStatus) {
  const rows = await db.application.findMany({
    where: { userId: ctx.userId, ...(status ? { status } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      jobDescription: { select: { id: true, title: true, company: true } },
      coverLetter: { select: { id: true, company: true, role: true } },
    },
  });
  const versionIds = rows.map((r) => r.resumeVersionId).filter((v): v is string => !!v);
  const versions = versionIds.length
    ? await db.resumeVersion.findMany({
        where: { id: { in: versionIds } },
        select: { id: true, label: true, resume: { select: { name: true } } },
      })
    : [];
  const vmap = new Map(versions.map((v) => [v.id, `${v.resume.name} · ${v.label}`]));
  return rows.map((r) => ({
    ...r,
    versionLabel: r.resumeVersionId ? (vmap.get(r.resumeVersionId) ?? null) : null,
  }));
}

export async function getApplication(ctx: Ctx, id: string) {
  const row = await db.application.findFirst({
    where: { id, userId: ctx.userId },
    include: {
      notesList: { orderBy: { createdAt: "asc" } },
      jobDescription: true,
      coverLetter: true,
    },
  });
  if (!row) throw new ForbiddenError("NOT_FOUND");
  const version = row.resumeVersionId
    ? await db.resumeVersion.findUnique({
        where: { id: row.resumeVersionId },
        select: {
          id: true,
          label: true,
          resumeId: true,
          atsScore: true,
          resume: { select: { name: true } },
        },
      })
    : null;
  return { ...row, resumeVersion: version };
}

const fields = {
  company: (v: string) => v.slice(0, 160),
  role: (v: string) => v.slice(0, 160),
  url: (v: string) => v.slice(0, 500),
  salary: (v: string) => v.slice(0, 120),
  location: (v: string) => v.slice(0, 160),
  contactName: (v: string) => v.slice(0, 120),
  contactEmail: (v: string) => v.slice(0, 254),
  contactPhone: (v: string) => v.slice(0, 40),
  notes: (v: string) => v.slice(0, 5000),
};

export type CreateAppInput = Partial<Record<keyof typeof fields, string>> & {
  status?: AppStatus;
  appliedAt?: string | null;
  followUpAt?: string | null;
  interviewAt?: string | null;
  jobId?: string | null;
  coverLetterId?: string | null;
  resumeVersionId?: string | null;
};

function dates(input: CreateAppInput) {
  const d = (v?: string | null) => (v ? new Date(v) : null);
  return {
    appliedAt: d(input.appliedAt),
    followUpAt: d(input.followUpAt),
    interviewAt: d(input.interviewAt),
  };
}

export async function createApplication(ctx: Ctx, input: CreateAppInput) {
  const row = await db.application.create({
    data: {
      userId: ctx.userId,
      company: fields.company(input.company ?? "Company"),
      role: fields.role(input.role ?? "Role"),
      url: input.url ? fields.url(input.url) : null,
      salary: input.salary ? fields.salary(input.salary) : null,
      location: input.location ? fields.location(input.location) : null,
      contactName: input.contactName ? fields.contactName(input.contactName) : null,
      contactEmail: input.contactEmail ? fields.contactEmail(input.contactEmail) : null,
      contactPhone: input.contactPhone ? fields.contactPhone(input.contactPhone) : null,
      notes: input.notes ? fields.notes(input.notes) : null,
      status: input.status ?? "SAVED",
      jobDescriptionId: input.jobId ?? null,
      coverLetterId: input.coverLetterId ?? null,
      resumeVersionId: input.resumeVersionId ?? null,
      ...dates(input),
    },
  });
  return row.id;
}

export async function updateApplication(ctx: Ctx, id: string, input: CreateAppInput) {
  const row = await db.application.findFirst({ where: { id, userId: ctx.userId } });
  if (!row) throw new ForbiddenError("NOT_FOUND");
  const data: Record<string, unknown> = { ...dates(input) };
  for (const k of Object.keys(fields) as Array<keyof typeof fields>) {
    if (input[k] !== undefined) data[k] = input[k] === "" ? null : fields[k](input[k]!);
  }
  if (input.status) data.status = input.status;
  if (input.status === "REJECTED" || input.status === "WITHDRAWN") data.closedAt = new Date();
  if (input.status === "SAVED" || input.status === "APPLIED") data.closedAt = null;
  if (input.jobId !== undefined) data.jobDescriptionId = input.jobId || null;
  if (input.coverLetterId !== undefined) data.coverLetterId = input.coverLetterId || null;
  if (input.resumeVersionId !== undefined) data.resumeVersionId = input.resumeVersionId || null;
  await db.application.update({ where: { id }, data: data as never });
}

export async function deleteApplication(ctx: Ctx, id: string) {
  const res = await db.application.deleteMany({ where: { id, userId: ctx.userId } });
  if (!res.count) throw new ForbiddenError("NOT_FOUND");
}

export async function addNote(ctx: Ctx, applicationId: string, body: string) {
  const app = await db.application.findFirst({ where: { id: applicationId, userId: ctx.userId } });
  if (!app) throw new ForbiddenError("NOT_FOUND");
  await db.applicationNote.create({
    data: { applicationId, userId: ctx.userId, body: body.slice(0, 4000) },
  });
}

export async function deleteNote(ctx: Ctx, noteId: string) {
  await db.applicationNote.deleteMany({ where: { id: noteId, userId: ctx.userId } });
}
