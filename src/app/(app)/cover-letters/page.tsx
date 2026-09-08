import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireCtx } from "@/server/context";
import { listLetters } from "@/features/coverletters/service";
import { NewLetterDialog } from "@/features/coverletters/components/new-letter-dialog";
import { db } from "@/db/client";
import { Card, EmptyState } from "@/components/ui/primitives";
import { Mail } from "lucide-react";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Cover letters", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LettersPage() {
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  const [letters, resumes, jobs] = await Promise.all([
    listLetters(ctx),
    db.resume.findMany({
      where: { careerProfile: { userId: ctx.userId }, deletedAt: null, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.jobDescription.findMany({
      where: { userId: ctx.userId },
      select: { id: true, title: true, company: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cover letters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scaffolds assemble only what your resume can back up — every sentence is yours to edit
            or delete.
          </p>
        </div>
        <NewLetterDialog
          resumes={resumes}
          jobs={jobs.map((j) => ({ id: j.id, title: j.title, company: j.company }))}
        />
      </header>
      {letters.length === 0 ? (
        <EmptyState
          icon={<Mail aria-hidden />}
          title="No letters yet"
          description="Create one and pick a resume — the scaffold pulls your strongest bullets and leaves [PLACEHOLDERS] for whatever only you can say."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" role="list">
          {letters.map((l) => (
            <li key={l.id}>
              <Link href={`/cover-letters/${l.id}`}>
                <Card className="px-4 py-3 transition-colors hover:bg-muted/40">
                  <p className="text-sm font-medium">
                    {l.role} · {l.company}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {l.status.toLowerCase()} · edited {timeAgo(l.updatedAt)}
                    {l.jobDescription ? ` · for ${l.jobDescription.title}` : ""}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
