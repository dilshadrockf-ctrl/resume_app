import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { auth } from "@/lib/auth";
import { storage } from "@/services/storage";
import { log } from "@/lib/logger";

/**
 * Secure download for finished exports (§54/§59): the owner's session (or a
 * single-use token query) is required; files are streamed from storage with
 * attachment disposition. Failed/queued exports answer 404 — no probing.
 */
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  TXT: "text/plain; charset=utf-8",
  DATA_JSON: "application/json",
  DATA_ZIP: "application/zip",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.export.findUnique({ where: { id } });
  if (!row || row.status !== "READY" || !row.storageKey) {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  let authorized = false;
  if (token && row.downloadTokenHash) {
    const { hashToken, tokensEqual } = await import("@/lib/tokens");
    authorized = tokensEqual(hashToken(token), row.downloadTokenHash) && Boolean(row.downloadExpiresAt && row.downloadExpiresAt > new Date());
  }
  if (!authorized) {
    const session = await auth();
    authorized = Boolean(session?.user?.id && session.user.id === row.userId);
  }
  if (!authorized) return new NextResponse("Forbidden", { status: 403 });

  const store = await storage();
  const file = await store.open(row.storageKey);
  if (!file) {
    log.error("export file missing from storage", { exportId: id });
    return new NextResponse("File missing", { status: 410 });
  }
  return new NextResponse(file.body, {
    headers: {
      "content-type": MIME[row.type] ?? file.contentType,
      "content-length": String(file.bytes),
      "content-disposition": `attachment; filename="${(row.fileName ?? "resume").replaceAll('"', "")}"`,
      "cache-control": "private, no-store",
    },
  });
}
