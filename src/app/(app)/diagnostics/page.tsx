import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db/client";
import { requireCtx } from "@/server/context";
import { env, isDevelopment } from "@/lib/env";
import { redisStatus } from "@/services/redis";
import { storageStatus } from "@/services/storage";
import { emailStatus } from "@/services/email";
import { queueStatus } from "@/services/queue-status";
import { SystemPanel, type SystemCheck } from "@/features/settings/system-panel";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Diagnostics", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Development-only operations console. In production this page refuses to
 *  render — the privileged /api/health endpoint remains for operators. */
export default async function DiagnosticsPage() {
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  if (!isDevelopment() && ctx.role !== "ADMIN") redirect("/dashboard");

  const [redis, mail, queue, recentJobs, jobCounts] = await Promise.all([
    redisStatus(),
    emailStatus(),
    queueStatus(),
    db.jobRun.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.jobRun.groupBy({ by: ["status"], where: { userId: ctx.userId }, _count: { _all: true } }),
  ]);
  const storage = storageStatus();
  const checks: SystemCheck[] = [
    {
      label: "Database",
      ok: true,
      detail:
        env.NODE_ENV === "production"
          ? "connected"
          : env.DATABASE_URL.replace(/:[^:@/]*@/, ":***@"),
    },
    { label: "Redis", ok: redis.ok, warn: !redis.ok, detail: redis.detail },
    { label: "Queue", ok: queue.ok, warn: !queue.ok, detail: queue.detail },
    { label: "Storage", ok: true, detail: `${storage.driver} — ${storage.detail}` },
    { label: "Mail", ok: mail.ok, warn: true, detail: mail.detail },
    {
      label: "AI",
      ok: env.AI_PROVIDER !== "none",
      warn: true,
      detail: env.AI_PROVIDER === "none" ? "off — core product unaffected" : env.AI_PROVIDER,
    },
    {
      label: "Billing",
      ok: true,
      detail: env.BILLING_ENABLED ? "ENABLED" : "disabled by design (plans are informational)",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Diagnostics</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Live status of every optional integration + your job history. Development-only view.
      </p>
      <SystemPanel checks={checks} />
      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">Your background jobs</CardTitle>
          <div className="flex gap-1">
            {jobCounts.map((j) => (
              <Badge
                key={j.status}
                variant={
                  j.status === "FAILED" || j.status === "DEAD_LETTER"
                    ? "destructive"
                    : j.status === "COMPLETED"
                      ? "success"
                      : "secondary"
                }
              >
                {j.status.toLowerCase()} {j._count._all}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No jobs yet — exports, imports and AI runs appear here.
            </p>
          ) : (
            <ul className="grid gap-1.5 text-xs">
              {recentJobs.map((j) => (
                <li key={j.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                  <span className="w-40 truncate font-medium">{j.type}</span>
                  <Badge
                    variant={
                      j.status === "COMPLETED"
                        ? "success"
                        : j.status === "FAILED" || j.status === "DEAD_LETTER"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {j.status.toLowerCase()}
                  </Badge>
                  <span className="text-muted-foreground">
                    attempts {j.attempts}/{j.maxAttempts}
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {j.createdAt.toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
