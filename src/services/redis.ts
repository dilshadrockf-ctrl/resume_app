import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import type Redis from "ioredis";

/**
 * Optional Redis with graceful degradation (§9): when REDIS_URL is unset or
 * the server is unreachable, callers fall back to in-memory behavior. The
 * app must always keep working locally without Redis.
 */

let client: Redis | null = null;
let connectPromise: Promise<Redis | null> | null = null;
let disabledUntil = 0;

export async function getRedis(): Promise<Redis | null> {
  if (!env.REDIS_URL) return null;
  if (client) return client;
  if (Date.now() < disabledUntil) return null;
  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        const { default: IORedis } = await import("ioredis");
        const r = new IORedis(env.REDIS_URL!, {
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
          retryStrategy: (times) => (times > 5 ? null : Math.min(times * 250, 2000)),
          lazyConnect: true,
          connectTimeout: 2500,
        });
        r.on("error", (e) =>
          log.warn("redis error", { err: String((e as Error).message).slice(0, 120) }),
        );
        await r.connect();
        client = r;
        log.info("redis connected");
        return r;
      } catch (e) {
        disabledUntil = Date.now() + 15_000;
        log.warn("redis unavailable — using in-memory fallbacks", {
          err: String((e as Error).message).slice(0, 120),
        });
        connectPromise = null;
        return null;
      }
    })();
  }
  return connectPromise;
}

export async function redisStatus(): Promise<{ ok: boolean; detail: string }> {
  if (!env.REDIS_URL) return { ok: false, detail: "REDIS_URL not configured (in-memory mode)" };
  const r = await getRedis();
  if (!r) return { ok: false, detail: "configured but unreachable — in-memory mode" };
  try {
    const pong = await r.ping();
    return { ok: pong === "PONG", detail: "connected" };
  } catch (e) {
    return { ok: false, detail: String((e as Error).message).slice(0, 120) };
  }
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const r = await getRedis();
  if (!r) return null;
  const v = await r.get(`cache:${key}`).catch(() => null);
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const r = await getRedis();
  if (!r) return;
  await r
    .set(`cache:${key}`, JSON.stringify(value), "EX", Math.max(1, ttlSeconds))
    .catch(() => undefined);
}

export async function cacheDel(key: string): Promise<void> {
  const r = await getRedis();
  if (!r) return;
  await r.del(`cache:${key}`).catch(() => undefined);
}
