import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/db/client";
import { requireCtx } from "@/server/context";
import { env } from "@/lib/env";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Minimal admin overview (§142: no public admin surface — ADMIN role only,
 *  no destructive actions in v1 beyond role display). */
export default async function AdminPage() {
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  if (ctx.role !== "ADMIN") redirect("/dashboard");

  const [users, resumes, exports_, jobs, failed, recent] = await Promise.all([
    db.user.count(),
    db.resume.count(),
    db.export.count(),
    db.jobRun.count(),
    db.jobRun.count({ where: { status: { in: ["FAILED", "DEAD_LETTER"] } } }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { email: true, role: true, createdAt: true, emailVerified: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <Badge variant="secondary">
          {env.BILLING_ENABLED ? "billing: on" : "billing disabled"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Users", users],
          ["Resumes", resumes],
          ["Exports", exports_],
          ["Jobs", jobs],
          ["Failed jobs", failed],
        ].map(([label, n]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xl font-semibold tabular-nums">{n as number}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Newest accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm">
            {recent.map((u) => (
              <li
                key={u.email}
                className="flex items-center justify-between rounded-md border px-3 py-1.5"
              >
                <span>{u.email}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {u.role === "ADMIN" ? <Badge variant="warning">admin</Badge> : null}
                  {u.emailVerified ? null : <Badge variant="muted">unverified</Badge>}
                  {new Date(u.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <p className="mt-4 text-xs text-muted-foreground">
        User management actions are deliberately absent until there are real multi-tenant needs.{" "}
        <Link className="text-primary underline" href="/diagnostics">
          Diagnostics →
        </Link>
      </p>
    </div>
  );
}
