import { getRedis } from "@/services/redis";
import { env } from "@/lib/env";
import { createHash } from "node:crypto";

/**
 * Fixed-window rate limiting (§60). Redis-backed when available; in-memory
 * sliding map otherwise so limits still exist on a plain local machine.
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
}

export const LIMIT_SCOPES = {
  login: () => ({ max: env.RATE_LIMIT_LOGIN, windowSec: 60 }),
  register: () => ({ max: env.RATE_LIMIT_REGISTER, windowSec: 3600 }),
  ai: () => ({ max: env.RATE_LIMIT_AI, windowSec: 3600 }),
  import: () => ({ max: env.RATE_LIMIT_IMPORT, windowSec: 3600 }),
  export: () => ({ max: env.RATE_LIMIT_EXPORT, windowSec: 3600 }),
  publicResume: () => ({ max: env.RATE_LIMIT_PUBLIC_RESUME, windowSec: 60 }),
} as const;

export type LimitScope = keyof typeof LIMIT_SCOPES;

const memory = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
}, 60_000).unref?.();

export async function rateLimit(scope: LimitScope, identity: string): Promise<RateLimitResult> {
  const { max, windowSec } = LIMIT_SCOPES[scope]();
  const idHash = createHash("sha256").update(`${scope}:${identity}`).digest("hex").slice(0, 32);
  const key = `rl:${scope}:${idHash}`;
  const redis = await getRedis();
  if (redis) {
    try {
      const results = (await redis
        .multi()
        .incr(key)
        .ttl(key)
        .exec()) as [[null, number], [null, number]] | null;
      const count = results?.[0]?.[1] ?? 1;
      let ttl = results?.[1]?.[1] ?? -1;
      if (ttl < 0) {
        await redis.expire(key, windowSec);
        ttl = windowSec;
      }
      return { ok: count <= max, remaining: Math.max(0, max - count), resetMs: ttl * 1000, limit: max };
    } catch {
      /* fall through to memory */
    }
  }
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowSec * 1000 };
    memory.set(key, next);
    return { ok: true, remaining: Math.max(0, max - 1), resetMs: windowSec * 1000, limit: max };
  }
  entry.count++;
  return { ok: entry.count <= max, remaining: Math.max(0, max - entry.count), resetMs: entry.resetAt - now, limit: max };
}
