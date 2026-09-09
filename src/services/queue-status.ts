import { getRedis } from "@/services/redis";
import { env } from "@/lib/env";

export async function queueStatus(): Promise<{ ok: boolean; detail: string }> {
  const redis = await getRedis();
  if (redis)
    return {
      ok: true,
      detail: `BullMQ available (prefix ${env.QUEUE_PREFIX}); in-process fallback enabled=${env.QUEUE_INPROCESS}`,
    };
  if (env.QUEUE_INPROCESS)
    return { ok: true, detail: "in-process runner (no Redis) — jobs still execute + retry" };
  return {
    ok: false,
    detail: "no Redis and in-process runner disabled — jobs would queue but never run",
  };
}
