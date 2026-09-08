import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireCtx } from "@/server/context";
import { getApplication } from "@/features/applications/service";
import { AppDetail } from "@/features/applications/components/app-detail";
import { db } from "@/db/client";
import { Badge } from "@/components/ui/primitives";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Application", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  let app;
  try {
    app = await getApplication(ctx, id);
  } catch {
    notFound();
  }
  const [jobs, letters] = await Promise.all([
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
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <Link
        href="/applications"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All applications
      </Link>
      <header className="mb-5 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {app.role} — {app.company}
        </h1>
        <Badge
          variant={
            app.status === "OFFER"
              ? "success"
              : app.status === "REJECTED" || app.status === "WITHDRAWN"
                ? "muted"
                : "secondary"
          }
        >
          {app.status.toLowerCase().replace(/_/g, " ")}
        </Badge>
      </header>
      <AppDetail
        app={{
          id: app.id,
          company: app.company,
          role: app.role,
          status: app.status,
          url: app.url,
          salary: app.salary,
          location: app.location,
          contactName: app.contactName,
          contactEmail: app.contactEmail,
          contactPhone: app.contactPhone,
          appliedAt: app.appliedAt,
          followUpAt: app.followUpAt,
          interviewAt: app.interviewAt,
          jobDescriptionId: app.jobDescriptionId,
          coverLetterId: app.coverLetterId,
          notes: app.notesList,
        }}
        jobs={jobs}
        letters={letters}
      />
    </div>
  );
}
