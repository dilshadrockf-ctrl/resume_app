import { NextResponse } from "next/server";

/** Liveness probe — no secrets, safe for load balancers. */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok", ts: new Date().toISOString() });
}
