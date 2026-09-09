import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireCtx } from "@/server/context";
import { db } from "@/db/client";
import { Card } from "@/components/ui/primitives";
import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";

export const metadata: Metadata = { title: "Coach", robots: { index: false } };
export const dynamic = "force-dynamic";

type Item = { level: "act" | "note" | "good"; title: string; detail?: string; href?: string; cta?: string };

/**
 * Career coach: an honest checklist computed from the user's own data.
 * No AI, no motivational filler — each item links to the exact screen that
 * resolves it.
 */
export default async function CoachPage() {
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  const now = Date.now();

  const [profile, imports, matches, staleApps, pendingRecos, letters, applications, resumes] = await Promise.all([
    db.careerProfile.findUnique({
      where: { userId: ctx.userId },
      include: { experiences: { where: { archivedAt: null } }, skills: { where: { archivedAt: null } } },
    }),
    db.importJob.findMany({ where: { userId: ctx.userId, status: "NEEDS_REVIEW" }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.jobMatch.findMany({
      where: { userId: ctx.userId, status: "REVIEW" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { jobDescription: { select: { id: true, title: true, company: true } } },
    }),
    db.application.findMany({
      where: { userId: ctx.userId, status: { notIn: ["REJECTED", "WITHDRAWN", "OFFER"] }, followUpAt: { not: null } },
      orderBy: { followUpAt: "asc" },
      take: 5,
    }),
    db.recommendation.count({ where: { userId: ctx.userId, status: "PENDING" } }),
    db.coverLetter.count({ where: { userId: ctx.userId, status: "DRAFT" } }),
    db.application.count({ where: { userId: ctx.userId } }),
    db.resume.count({ where: { careerProfile: { userId: ctx.userId }, deletedAt: null, archivedAt: null } }),
  ]);

  const items: Item[] = [];

  if (!profile?.summary) {
    items.push({ level: "act", title: "Your profile has no summary yet", detail: "One summary is shared by every resume — write it where it can be reused.", href: "/profile", cta: "Write summary" });
  }
  if ((profile?.experiences.length ?? 0) === 0) {
    items.push({ level: "act", title: "No experience entries in your library", detail: "Resumes pull from your career library; capture your roles there once, reuse everywhere.", href: "/profile", cta: "Add experience" });
  }
  for (const imp of imports) {
    items.push({
      level: "act",
      title: `Imported file “${imp.fileName}” awaits your review`,
      detail: "Parsed content was placed into sections by headings only — confirm, fix, or delete.",
      href: imp.resumeId ? `/resumes/${imp.resumeId}` : "/resumes",
      cta: "Review import",
    });
  }
  for (const m of matches) {
    const gaps = (m.gaps as { requiredMissing?: string[] } | null)?.requiredMissing ?? [];
    if (gaps.length) {
      items.push({
        level: "note",
        title: `“${m.jobDescription.title}” requires ${gaps.slice(0, 4).join(", ")} — not found in the matched resume`,
        detail: "Only add what is genuinely true. If you have the experience elsewhere, put it in your library first.",
        href: `/jobs/${m.jobDescriptionId}`,
        cta: "See breakdown",
      });
    }
  }
  for (const a of staleApps) {
    const due = new Date(a.followUpAt!).getTime() < now;
    items.push({
      level: due ? "act" : "note",
      title: due ? `Follow-up with ${a.company} is ${Math.floor((now - new Date(a.followUpAt!).getTime()) / 86_400_000)}d overdue` : `Follow-up with ${a.company} on ${a.followUpAt!.toLocaleDateString()}`,
      detail: a.role,
      href: `/applications/${a.id}`,
      cta: "Open tracker",
    });
  }
  if (pendingRecos > 0) items.push({ level: "note", title: `${pendingRecos} suggestion${pendingRecos > 1 ? "s" : ""} waiting on your decision`, detail: "Suggestions only surface facts already in your profile or rewrite your own wording — nothing applies itself.", href: "/jobs", cta: "Review" });
  if (applications > 0 && letters === 0) items.push({ level: "note", title: "Applications tracked, but no draft letters", detail: "Letter scaffolds reuse only what your resume can back up.", href: "/cover-letters", cta: "Start one" });
  if (resumes > 0 && items.length === 0) items.push({ level: "good", title: "Everything checks out", detail: "Profile populated, no imports awaiting review, no overdue follow-ups." });

  const acts = items.filter((i) => i.level === "act").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Coach</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {acts > 0 ? `${acts} thing${acts > 1 ? "s" : ""} worth doing now` : "A checklist from your own data — nothing invented, nothing naggy"}
        </p>
      </header>
      <ul className="grid gap-2" role="list" aria-label="Coach checklist">
        {items.map((it, i) => (
          <li key={i}>
            <Card className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 shrink-0">
                {it.level === "act" ? <AlertTriangle className="size-4 text-amber-600" aria-hidden /> : it.level === "good" ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> : <Lightbulb className="size-4 text-muted-foreground" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{it.title}</p>
                {it.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{it.detail}</p> : null}
              </div>
              {it.href && it.cta ? (
                <Link href={it.href} className="shrink-0 text-sm font-medium text-primary hover:underline">
                  {it.cta} →
                </Link>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-muted-foreground">
        The coach never writes your resume for you. For AI rewrites of specific lines, use the AI button in the editor — always a review step first.
      </p>
    </div>
  );
}
