import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireCtx } from "@/server/context";
import { listJobs } from "@/features/jobs/service";
import { db } from "@/db/client";
import { JobForm } from "@/features/jobs/components/job-form";
import { JobRow } from "@/features/jobs/components/job-row";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui/primitives";
import { Briefcase } from "lucide-react";

export const metadata: Metadata = { title: "Job descriptions", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  const [jobs, resumes] = await Promise.all([
    listJobs(ctx),
    db.resume.findMany({
      where: { careerProfile: { userId: ctx.userId }, deletedAt: null, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Job descriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a posting; get an explainable match score — keyword coverage with evidence, not a
          black box.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          {jobs.length === 0 ? (
            <EmptyState
              icon={<Briefcase aria-hidden />}
              title="No job posts yet"
              description="Save one on the right — it keeps the full text, so you never lose the original wording."
            />
          ) : (
            <ul className="grid gap-2" role="list">
              {jobs.map((j) => (
                <JobRow key={j.id} job={j} />
              ))}
            </ul>
          )}
        </div>
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle className="text-sm">Save a new posting</CardTitle>
          </CardHeader>
          <CardContent>
            <JobForm resumes={resumes} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
