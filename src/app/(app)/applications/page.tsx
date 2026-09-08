import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireCtx } from "@/server/context";
import { listApplications } from "@/features/applications/service";
import { AppRow } from "@/features/applications/components/app-row";
import { NewAppDialog } from "@/features/applications/components/new-app-dialog";
import { db } from "@/db/client";
import { EmptyState } from "@/components/ui/primitives";
import { Kanban } from "lucide-react";

export const metadata: Metadata = { title: "Applications", robots: { index: false } };
export const dynamic = "force-dynamic";

const GROUPS: Array<{ label: string; statuses: string[] }> = [
  {
    label: "In motion",
    statuses: [
      "APPLIED",
      "RECRUITER_SCREEN",
      "INTERVIEW",
      "TECHNICAL_INTERVIEW",
      "FINAL_INTERVIEW",
    ],
  },
  { label: "Offers", statuses: ["OFFER"] },
  { label: "Preparing", statuses: ["SAVED", "PREPARING"] },
  { label: "Closed", statuses: ["REJECTED", "WITHDRAWN"] },
];

export default async function ApplicationsPage() {
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  const [apps, jobs, letters] = await Promise.all([
    listApplications(ctx),
    db.jobDescription.findMany({
      where: { userId: ctx.userId },
      select: { id: true, title: true, company: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.coverLetter.findMany({
      where: { userId: ctx.userId },
      select: { id: true, company: true, role: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where you applied, with exactly which version and letter — {apps.length} tracked.
          </p>
        </div>
        <NewAppDialog jobs={jobs} letters={letters} />
      </header>
      {apps.length === 0 ? (
        <EmptyState
          icon={<Kanban aria-hidden />}
          title="Nothing tracked yet"
          description="Track an application from a job page (“Apply” link on a match) or add one manually — every row records which resume version was actually sent."
        />
      ) : (
        <div className="grid gap-6">
          {GROUPS.map((g) => {
            const rows = apps.filter((a) => g.statuses.includes(a.status));
            if (rows.length === 0) return null;
            return (
              <section key={g.label} aria-label={g.label}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label} ({rows.length})
                </h2>
                <ul className="grid gap-2" role="list">
                  {rows.map((a) => (
                    <AppRow
                      key={a.id}
                      app={{
                        id: a.id,
                        company: a.company,
                        role: a.role,
                        status: a.status,
                        updatedAt: a.updatedAt,
                        appliedAt: a.appliedAt,
                        versionLabel: a.versionLabel,
                      }}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
