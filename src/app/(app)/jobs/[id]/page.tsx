import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireCtx } from "@/server/context";
import { getJobDetail } from "@/features/jobs/service";
import { db } from "@/db/client";
import { MatchPanel } from "@/features/jobs/components/match-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Field, Badge } from "@/components/ui/primitives";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Job match", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  let job;
  try {
    job = await getJobDetail(ctx, id);
  } catch {
    notFound();
  }
  const resumes = await db.resume.findMany({
    where: { careerProfile: { userId: ctx.userId }, deletedAt: null, archivedAt: null },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All jobs
      </Link>
      <header className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[job.company, job.location, job.salary].filter(Boolean).join(" · ") || "—"}
            {job.url ? (
              <>
                {" · "}
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="underline"
                >
                  original posting
                </a>
              </>
            ) : null}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <CardTitle className="text-sm">Original posting (verbatim)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-muted-foreground">
              {job.rawText}
            </p>
          </CardContent>
        </Card>

        <div className="order-1 grid content-start gap-4 lg:order-2">
          <MatchPanel
            jobId={job.id}
            resumes={resumes}
            matches={job.matches.map((m) => ({
              id: m.id,
              score: m.score,
              versionId: m.resumeVersionId,
              resumeId: m.resumeVersion?.resume.id ?? "",
              resumeName: m.resumeVersion?.resume.name ?? "(deleted resume)",
              createdAt: m.createdAt.toISOString(),
              breakdown: m.breakdown as never,
              status: m.status,
              recommendations: m.recommendations.map((r) => ({
                id: r.id,
                action: r.action,
                rationale: r.rationale,
                status: r.status,
                suggested: r.suggested,
              })),
            }))}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Extracted signals</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {(() => {
                type Sig = {
                  keywords: Array<{ term: string; context: "required" | "preferred" | "plain" }>;
                  requirements: string[];
                };
                const p = job.parsed as Sig | null;
                if (!p)
                  return (
                    <p className="text-sm text-muted-foreground">
                      No extraction found — re-save the posting.
                    </p>
                  );
                const req = p.keywords.filter((k) => k.context === "required");
                const pref = p.keywords.filter((k) => k.context === "preferred");
                return (
                  <>
                    <Field label="Required terms (from the posting)">
                      <div className="flex flex-wrap gap-1 pt-1">
                        {req.length ? (
                          req.map((k) => (
                            <Badge key={k.term} variant="outline">
                              {k.term}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            no explicit “requirements” section — scoring falls back to
                            frequency-weighted terms
                          </span>
                        )}
                      </div>
                    </Field>
                    <Field label="Preferred / bonus terms">
                      <div className="flex flex-wrap gap-1 pt-1">
                        {pref.length ? (
                          pref.map((k) => (
                            <Badge key={k.term} variant="muted">
                              {k.term}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </Field>
                    <Field label={`Requirement lines (${p.requirements.length}, verbatim)`}>
                      <ul className="grid gap-1 pt-1 text-xs text-muted-foreground">
                        {p.requirements.slice(0, 8).map((r, i) => (
                          <li key={i} className="truncate rounded bg-muted/50 px-2 py-1 font-mono">
                            {r}
                          </li>
                        ))}
                        {p.requirements.length > 8 ? (
                          <li className="text-[11px]">…and {p.requirements.length - 8} more</li>
                        ) : null}
                      </ul>
                    </Field>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
