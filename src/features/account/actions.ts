"use server";
import { z } from "zod";
import { ok, withValidation, type ActionResult } from "@/server/action-utils";
import { requireCtx } from "@/server/context";
import { db } from "@/db/client";

/**
 * Queue the account data export server-side (runs through the same job
 * machinery as PDF exports) instead of downloading in the tab. The sync
 * GET /api/account/data remains available and is the default in Settings.
 */
export async function queueDataExportAction(): Promise<ActionResult<{ exportId: string }>> {
  return withValidation(z.object({}), {}, async () => {
    const ctx = await requireCtx();
    const { requestQueuedExport } = await import("@/features/account/export");
    return ok(await requestQueuedExport(ctx));
  });
}

export async function queuedDataExportsAction(): Promise<
  ActionResult<
    Array<{ id: string; status: string; bytes: number | null; createdAt: string; fileName: string }>
  >
> {
  return withValidation(z.object({}), {}, async () => {
    const ctx = await requireCtx();
    const rows = await db.export.findMany({
      where: { userId: ctx.userId, type: "DATA_JSON" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, status: true, bytes: true, createdAt: true, fileName: true },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        status: r.status,
        bytes: r.bytes,
        createdAt: r.createdAt.toISOString(),
        fileName: r.fileName ?? "ResumeForge data export.json",
      })),
    );
  });
}
