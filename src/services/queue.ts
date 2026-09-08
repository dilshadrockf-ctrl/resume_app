import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { getRedis } from "@/services/redis";
import { db } from "@/db/client";
import type { JobRunType } from "@prisma/client";

/**
 * Background job abstraction (§10/§72/§73).
 *
 * Two interchangeable runtimes:
 *  - BullMQ (Redis): durable queues, retries with exponential backoff, used
 *    by the `worker` process (`npm run worker` / docker service).
 *  - In-process runner: same handlers executed via a lightweight loop with
 *    retries — lets the whole product run with just Node + PostgreSQL, which
 *    is the guaranteed local mode (QUEUE_INPROCESS=true default in dev).
 *
 * Every job is mirrored in the `JobRun` table for status polling, audit and
 * dead-letter visibility — jobs are never silently lost.
 */

export type JobHandler = (payload: JobPayload, jobRunId: string) => Promise<unknown>;

export type JobPayload =
  | { type: "RESUME_IMPORT"; importJobId: string }
  | { type: "RESUME_EXPORT"; exportId: string }
  | { type: "RESUME_ANALYZE"; versionId: string; jobId?: string | null }
  | { type: "AI_GENERATE"; generationId: string; action: string; input: unknown }
  | { type: "COVER_LETTER_GENERATE"; coverLetterId: string }
  | { type: "ACCOUNT_DATA_EXPORT"; exportId: string; userId: string };

type QueueName = JobRunType;

const handlers = new Map<QueueName, JobHandler>();

export function registerHandler(name: QueueName, handler: JobHandler) {
  handlers.set(name, handler);
}

const BACKOFF_BASE_MS = 1000;

export async function enqueue(
  type: QueueName,
  userId: string,
  payload: JobPayload,
  opts: { maxAttempts?: number } = {},
): Promise<{ jobRunId: string; mode: "bullmq" | "in-process" }> {
  const jobRun = await db.jobRun.create({
    data: { userId, type, payload: payload as object, maxAttempts: opts.maxAttempts ?? 3 },
  });
  const redis = await getRedis();
  if (redis && !useInProcessOnly()) {
    try {
      const { Queue } = await import("bullmq");
      const q = new Queue(`q:${type}`, {
        connection: redis,
        prefix: env.QUEUE_PREFIX,
        defaultJobOptions: {
          attempts: opts.maxAttempts ?? 3,
          backoff: { type: "exponential", delay: BACKOFF_BASE_MS },
          removeOnComplete: 1000,
          removeOnFail: 2000,
        },
      });
      await q.add(type, payload, { jobId: jobRun.id });
      await q.close();
      await db.jobRun.update({ where: { id: jobRun.id }, data: { status: "QUEUED" } });
      return { jobRunId: jobRun.id, mode: "bullmq" };
    } catch (e) {
      log.warn("queue: bullmq enqueue failed — running in-process", { err: String((e as Error).message).slice(0, 120) });
    }
  }
  if (useInProcessOnly()) {
    setImmediate(() => void runJobRunLocally(jobRun.id));
  } else {
    // Redis present but no worker attached? Start a local attempt too when the
    // queue is empty of workers — dev convenience only.
    setImmediate(() => void runJobRunLocally(jobRun.id));
  }
  return { jobRunId: jobRun.id, mode: "in-process" };
}

function useInProcessOnly(): boolean {
  return env.QUEUE_INPROCESS;
}

/** Execute one queued JobRun row directly (also used by tests). */
export async function runJobRunLocally(jobRunId: string): Promise<void> {
  const jobRun = await db.jobRun.findUnique({ where: { id: jobRunId } });
  if (!jobRun || (jobRun.status !== "QUEUED" && jobRun.status !== "ACTIVE")) return;
  const handler = handlers.get(jobRun.type);
  if (!handler) {
    await db.jobRun.update({
      where: { id: jobRunId },
      data: { status: "DEAD_LETTER", error: `no handler registered for ${jobRun.type}` },
    });
    return;
  }
  await db.jobRun.update({ where: { id: jobRunId }, data: { status: "ACTIVE", startedAt: new Date(), attempts: { increment: 1 } } });
  try {
    const result = await handler(jobRun.payload as JobPayload, jobRun.id);
    await db.jobRun.update({
      where: { id: jobRunId },
      data: { status: "COMPLETED", result: (result ?? null) as never, finishedAt: new Date(), error: null },
    });
  } catch (e) {
    const message = String((e as Error)?.message ?? e).slice(0, 500);
    const fresh = await db.jobRun.findUnique({ where: { id: jobRunId } });
    const attempts = fresh?.attempts ?? 1;
    const max = fresh?.maxAttempts ?? 3;
    if (attempts < max) {
      const delay = BACKOFF_BASE_MS * 2 ** (attempts - 1);
      log.warn("job failed — retry scheduled", { jobRunId, attempts, delayMs: delay });
      await db.jobRun.update({ where: { id: jobRunId }, data: { status: "QUEUED", lastError: message } });
      setTimeout(() => void runJobRunLocally(jobRunId), Math.min(delay, 30_000)).unref?.();
    } else {
      log.error("job failed permanently — dead letter", { jobRunId, err: message });
      await db.jobRun.update({ where: { id: jobRunId }, data: { status: "DEAD_LETTER", error: message, lastError: message, finishedAt: new Date() } });
    }
  }
}

/** BullMQ worker mode: block and process jobs from all queues. */
export async function startWorkerLoop(onTick?: () => void): Promise<() => Promise<void>> {
  const redis = await getRedis();
  if (!redis) throw new Error("BullMQ worker requires REDIS_URL");
  const { Worker } = await import("bullmq");
  const names: QueueName[] = ["RESUME_IMPORT", "RESUME_EXPORT", "RESUME_ANALYZE", "AI_GENERATE", "COVER_LETTER_GENERATE", "ACCOUNT_DATA_EXPORT"];
  const workers = await Promise.all(
    names.map(async (name) => {
      const w = new Worker(
        `q:${name}`,
        async (job) => {
          const handler = handlers.get(name);
          if (!handler) throw new Error(`no handler for ${name}`);
          const jobRunId = String(job.id ?? "");
          await db.jobRun.update({ where: { id: jobRunId }, data: { status: "ACTIVE", startedAt: new Date(), attempts: { increment: 1 } } }).catch(() => undefined);
          const result = await handler(job.data as JobPayload, jobRunId);
          await db.jobRun
            .update({ where: { id: jobRunId }, data: { status: "COMPLETED", result: (result ?? null) as never, finishedAt: new Date(), error: null } })
            .catch(() => undefined);
          return result ?? null;
        },
        { connection: redis, prefix: env.QUEUE_PREFIX },
      );
      w.on("failed", (job, err) => {
        const attempts = job?.attemptsMade ?? 0;
        const max = job?.opts?.attempts ?? 3;
        log.error("worker job failed", { queue: name, attemptsMade: attempts, max, err: String(err?.message).slice(0, 200) });
        db.jobRun
          .update({
            where: { id: String(job?.id ?? "") },
            data: {
              lastError: String(err?.message ?? "failed").slice(0, 500),
              ...(attempts + 1 >= max
                ? { status: "DEAD_LETTER" as const, error: String(err?.message ?? "failed").slice(0, 500), finishedAt: new Date() }
                : { status: "QUEUED" as const }),
            },
          })
          .catch(() => undefined);
      });
      w.on("ready", () => onTick?.());
      return w;
    }),
  );
  log.info("worker online", { queues: names.length });
  return async () => {
    await Promise.all(workers.map((w) => w.close()));
  };
}

/** When both BullMQ is unavailable and in-process mode is on, drain QUEUED rows periodically. */
let sweeper: ReturnType<typeof setInterval> | null = null;
export function startQueueSweeper(intervalMs = 15_000): void {
  if (sweeper) return;
  sweeper = setInterval(async () => {
    try {
      const pending = await db.jobRun.findMany({
        where: { status: "QUEUED", createdAt: { lt: new Date(Date.now() - intervalMs) } },
        take: 10,
        orderBy: { createdAt: "asc" },
      });
      for (const p of pending) await runJobRunLocally(p.id);
    } catch {
      /* db not ready */
    }
  }, intervalMs);
  sweeper.unref?.();
}
