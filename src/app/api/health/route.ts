import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { auth } from "@/lib/auth";
import { env, isDevelopment } from "@/lib/env";
import { redisStatus } from "@/services/redis";
import { storageStatus } from "@/services/storage";
import { emailStatus } from "@/services/email";
import { queueStatus } from "@/services/queue-status";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  const ip = new URL(req.url).hostname;
  const privileged =
    session?.user?.id || isDevelopment() || ip === "localhost" || ip === "127.0.0.1";
  if (!privileged) return new NextResponse("Forbidden", { status: 403 });

  const out: Record<string, { ok: boolean; detail: string }> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    out.database = {
      ok: true,
      detail:
        env.NODE_ENV === "production"
          ? "connected"
          : `connected (${env.DATABASE_URL.replace(/:[^:@/]*@/, ":***@")})`,
    };
  } catch (e) {
    out.database = { ok: false, detail: String((e as Error).message).slice(0, 140) };
  }
  out.redis = await redisStatus();
  out.storage = { ...storageStatus(), detail: storageStatus().detail };
  out.mail = await emailStatus();
  out.queue = await queueStatus();
  out.ai = {
    ok: env.AI_PROVIDER !== "none",
    detail:
      env.AI_PROVIDER === "none"
        ? "not configured — AI features disabled, core product works"
        : `provider=${env.AI_PROVIDER} base=${env.AI_BASE_URL ?? "default"} model=${env.AI_DEFAULT_MODEL ?? "provider default"}`,
  };

  const allOk = Object.values(out).every(
    (v) => v.ok || v === out.ai || v === out.redis || v === out.mail,
  );
  return NextResponse.json({ ok: allOk, checks: out }, { status: 200 });
}
