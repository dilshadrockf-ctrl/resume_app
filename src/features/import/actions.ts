"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, withValidation, type ActionResult } from "@/server/action-utils";
import { audit, requireCtx } from "@/server/context";
import * as service from "@/features/import/service";

const MAX_BYTES = 10 * 1024 * 1024;

export async function requestImportAction(raw: {
  name: string;
  mime: string;
  dataBase64: string;
}): Promise<ActionResult<{ importId: string }>> {
  return withValidation(
    z.object({
      name: z.string().min(1).max(200),
      mime: z.string().min(4).max(120),
      dataBase64: z.string().min(8).max(15_000_000),
    }),
    raw,
    async (input) => {
      const ctx = await requireCtx();
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (bytes.length > MAX_BYTES) return fail("File too large — 10 MB maximum.", "TOO_LARGE");
      try {
        const res = await service.requestImport(ctx, { name: input.name, mime: input.mime, bytes });
        await audit(ctx, "resume_import_requested", { importId: res.importId, name: input.name });
        revalidatePath("/resumes");
        return ok(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Import failed";
        return fail(msg, msg.includes("type") || msg.includes("empty") ? "VALIDATION" : "INTERNAL");
      }
    },
  );
}

/** poll target for the client; returns resumeId when the draft is ready */
export async function importStatusAction(raw: {
  importId: string;
}): Promise<ActionResult<{ status: string; resumeId: string | null; error: string | null }>> {
  return withValidation(z.object({ importId: z.string().min(1).max(64) }), raw, async (input) => {
    const ctx = await requireCtx();
    try {
      const job = await service.importStatus(ctx, input.importId);
      return ok(job);
    } catch {
      return fail("Import job not found", "NOT_FOUND");
    }
  });
}
