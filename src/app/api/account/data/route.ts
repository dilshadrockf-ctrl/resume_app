import { NextResponse } from "next/server";
import { requireCtx } from "@/server/context";
import { buildAccountDataJson } from "@/features/account/export";

/** GDPR-style full data export (§ right-to-portability), synchronous JSON. */
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireCtx();
  const payload = await buildAccountDataJson(ctx.userId);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="resumeforge-account-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
