import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { auth } from "@/lib/auth";
import { log } from "@/lib/logger";

/**
 * Server-side session + tenant context. Every mutating action funnels
 * through here (authenticate → authorize → validate → execute, §155).
 */

export interface Ctx {
  userId: string;
  role: "USER" | "ADMIN";
  email: string;
  ip?: string;
  userAgent?: string;
}

export const getSessionCtx = cache(async (): Promise<Ctx | null> => {
  const session = await auth();
  const id = session?.user?.id as string | undefined;
  if (!id) return null;
  const user = await db.user
    .findUnique({ where: { id }, select: { id: true, email: true, role: true } })
    .catch(() => null);
  if (!user) return null;
  const h = await headers().catch(() => undefined);
  return {
    userId: user.id,
    role: user.role,
    email: user.email,
    ip: h?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: h?.get("user-agent")?.slice(0, 200) ?? undefined,
  };
});

export class UnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export async function requireCtx(): Promise<Ctx> {
  const ctx = await getSessionCtx();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

/**
 * Ownership guard (§58). `resource` describes what is being touched; the
 * resolver must confirm the row belongs to ctx.userId. Returns the resolved
 * row or throws.
 */
export async function own<T>(
  ctx: Ctx,
  loader: (userId: string) => Promise<T | null>,
  what = "resource",
): Promise<T> {
  const row = await loader(ctx.userId);
  if (!row) {
    log.warn("ownership check failed", { userId: ctx.userId, what });
    throw new ForbiddenError();
  }
  return row;
}

export class ForbiddenError extends Error {
  constructor(msg = "FORBIDDEN") {
    super(msg);
    this.name = "ForbiddenError";
  }
}

export async function audit(ctx: Ctx, action: string, meta: Record<string, unknown> = {}) {
  await db.auditLog
    .create({ data: { userId: ctx.userId, action, ip: ctx.ip, userAgent: ctx.userAgent, meta: meta as never } })
    .catch(() => undefined);
}

export async function track(ctx: { userId: string } | null, event: string, props: Record<string, unknown> = {}) {
  await db.usageEvent
    .create({ data: { userId: ctx?.userId ?? null, event, props: props as never } })
    .catch(() => undefined);
}
