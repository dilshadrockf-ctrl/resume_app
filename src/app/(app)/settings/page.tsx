import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { auth } from "@/lib/auth";
import { requireCtx } from "@/server/context";
import { env, isDevelopment, isProduction } from "@/lib/env";
import { redisStatus } from "@/services/redis";
import { storageStatus } from "@/services/storage";
import { emailStatus } from "@/services/email";
import { queueStatus } from "@/services/queue-status";
import { SystemPanel, type SystemCheck } from "@/features/settings/system-panel";
import { SettingsAccountTabs } from "@/features/settings/tabs";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  const user = await db.user.findUnique({ where: { id: ctx.userId }, select: { email: true, name: true, emailVerified: true, createdAt: true } });
  if (!user) redirect("/login");

  const redis = await redisStatus();
  const storage = storageStatus();
  const mail = await emailStatus();
  const queue = await queueStatus();
  const checks: SystemCheck[] = [
    { label: "Database", ok: true, detail: "PostgreSQL connected" },
    { label: "Redis", ok: redis.ok, warn: !redis.ok, detail: redis.detail },
    { label: "Queue", ok: queue.ok, detail: queue.detail },
    { label: "Storage", ok: storage.driver !== "none", warn: !storage.ok, detail: `${storage.driver}: ${storage.detail}` },
    { label: "Email", ok: mail.ok, warn: true, detail: mail.detail },
    {
      label: "AI",
      ok: env.AI_PROVIDER !== "none",
      warn: env.AI_PROVIDER === "none",
      detail: env.AI_PROVIDER === "none" ? "not configured — editing, checks and exports all work without AI" : `provider: ${env.AI_PROVIDER}`,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
      <SettingsAccountTabs
        user={{ email: user.email, name: user.name, verified: Boolean(user.emailVerified), since: user.createdAt.toISOString() }}
        aiConfigured={env.AI_PROVIDER !== "none"}
      />
      <div className="mt-6">
        <SystemPanel checks={checks} />
        <p className="mt-2 text-xs text-muted-foreground">
          Full diagnostics {isDevelopment() ? "at /diagnostics" : "are limited in production to server operators"} —
          secrets are never shown in the UI{isProduction() ? " (prod mode)" : ""}.
        </p>
      </div>
    </div>
  );
}
