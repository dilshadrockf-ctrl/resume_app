import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  FileText,
  User,
  Briefcase,
  FolderKanban,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { db } from "@/db/client";
import { requireCtx } from "@/server/context";
import { listResumes } from "@/features/resume/service";
import { computeStats } from "@/lib/resume/stats";
import { loadResumeDocument } from "@/features/resume/repository";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  EmptyState,
} from "@/components/ui/primitives";
import { timeAgo } from "@/lib/utils";
import { NewResumeButton } from "@/features/resume/components/new-resume-button";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");

  const resumes = await listResumes(ctx);
  const profile = await db.careerProfile.findUnique({
    where: { userId: ctx.userId },
    include: {
      experiences: { where: { archivedAt: null }, select: { id: true } },
      skills: { where: { archivedAt: null }, select: { id: true } },
    },
  });
  const contact = await db.profile.findUnique({ where: { userId: ctx.userId } });
  const [jobsCount, appsCount, coverCount] = await Promise.all([
    db.jobDescription.count({ where: { userId: ctx.userId } }),
    db.application.count({ where: { userId: ctx.userId } }),
    db.coverLetter.count({ where: { userId: ctx.userId } }),
  ]);

  const libraryCount = (profile?.experiences.length ?? 0) + (profile?.skills.length ?? 0);
  const contactReady = Boolean(contact?.displayName && contact?.email);

  // lightweight per-resume content check for the cards
  const checks = await Promise.all(
    resumes.slice(0, 4).map(async (r) => {
      try {
        const { doc } = await loadResumeDocument(ctx.userId, r.id);
        const s = computeStats(doc);
        return { id: r.id, score: s.score, onePage: s.onePageRisk };
      } catch {
        return { id: r.id, score: null as number | null, onePage: "low" as const };
      }
    }),
  );
  const byId = new Map(checks.map((c) => [c.id, c]));

  const steps = [
    {
      done: contactReady,
      label: "Add your contact details",
      href: "/profile",
      icon: User,
      hint: "Name, email, links — shared by every resume.",
    },
    {
      done: libraryCount > 0,
      label: "Build your career library",
      href: "/profile",
      icon: FileText,
      hint: "Roles, projects, skills once; reused on every resume.",
    },
    {
      done: resumes.length > 0,
      label: "Create your first resume",
      href: "/resumes?new=1",
      icon: Sparkles,
      hint: "A resume assembles your library — never duplicates it.",
    },
  ];
  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}
            {contact?.displayName ? `, ${contact.displayName.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything runs on your own infrastructure. Your data never leaves this server.
          </p>
        </div>
        <NewResumeButton />
      </header>

      {nextStep ? (
        <Card className="mb-6 border-primary/30 bg-primary/5 dark:bg-primary/10">
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <nextStep.icon className="size-5 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{nextStep.label}</p>
              <p className="text-xs text-muted-foreground">{nextStep.hint}</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={nextStep.href}>
                Continue <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Your resumes</CardTitle>
              <Link href="/resumes" className="text-sm font-medium text-primary hover:underline">
                All resumes
              </Link>
            </CardHeader>
            <CardContent className="grid gap-2">
              {resumes.filter((r) => !r.archivedAt).length === 0 ? (
                <EmptyState
                  title="No resumes yet"
                  description="Resumes pull from your career profile — edit once, reuse everywhere."
                  action={<NewResumeButton label="Create a resume" variant="default" />}
                />
              ) : (
                resumes
                  .filter((r) => !r.archivedAt)
                  .slice(0, 5)
                  .map((r) => {
                    const check = byId.get(r.id);
                    return (
                      <Link
                        key={r.id}
                        href={`/resumes/${r.id}`}
                        className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{r.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Edited {timeAgo(r.updatedAt)} · {r.templateId}
                            {r.published ? " · public" : ""}
                          </p>
                        </div>
                        {check?.score != null ? (
                          <Badge
                            variant={
                              check.score >= 75
                                ? "success"
                                : check.score >= 50
                                  ? "warning"
                                  : "destructive"
                            }
                          >
                            {check.score}%
                          </Badge>
                        ) : null}
                        <ArrowRight
                          className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                      </Link>
                    );
                  })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick stats</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Resumes" value={resumes.length} href="/resumes" />
              <Stat label="Job posts" value={jobsCount} href="/jobs" />
              <Stat label="Applications" value={appsCount} href="/applications" />
              <Stat label="Cover letters" value={coverCount} href="/cover-letters" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Setup</CardTitle>
              <CardDescription>Complete once — speeds up every resume.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-1.5">
              {steps.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent"
                >
                  <CheckCircle2
                    className={
                      s.done
                        ? "size-4 shrink-0 text-success"
                        : "size-4 shrink-0 text-muted-foreground/40"
                    }
                    aria-hidden
                  />
                  <span className={s.done ? "text-muted-foreground line-through decoration-1" : ""}>
                    {s.label}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5
    ? "Burning the midnight oil?"
    : h < 12
      ? "Good morning"
      : h < 18
        ? "Good afternoon"
        : "Good evening";
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Link>
  );
}
