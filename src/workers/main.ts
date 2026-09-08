/**
 * Standalone worker process: `npm run worker`.
 * Requires REDIS_URL (BullMQ). Without Redis, exports/AI jobs run in-process
 * inside the web app (QUEUE_INPROCESS), so this process is optional locally
 * and standard for horizontal scaling in production (§72/§73).
 */
import { log } from "@/lib/logger";
import { startWorkerLoop } from "@/services/queue";
import { ensureExportHandlers } from "@/features/export/service";

async function main() {
  ensureExportHandlers();
  const close = await startWorkerLoop(() => log.info("worker consuming queues"));
  const bye = async () => {
    log.info("worker: shutting down");
    await close();
    process.exit(0);
  };
  process.on("SIGINT", bye);
  process.on("SIGTERM", bye);
}

main().catch((e) => {
  log.error("worker failed to start", { err: String((e as Error).message) });
  process.exit(1);
});
