import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireCtx } from "@/server/context";
import { listResumes } from "@/features/resume/service";
import { NewResumeButton } from "@/features/resume/components/new-resume-button";
import { ResumeRow } from "@/features/resume/components/resume-row";
import { EmptyState } from "@/components/ui/primitives";
import { FileText } from "lucide-react";

export const metadata: Metadata = { title: "Resumes", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ResumesPage({ searchParams }: { searchParams: Promise<{ new?: string; archived?: string }> }) {
  const params = await searchParams;
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  const wantArchived = params.archived === "1";
  const all = await listResumes(ctx);
  const rows = all.filter((r) => Boolean(r.archivedAt) === wantArchived);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{wantArchived ? "Archived resumes" : "Your resumes"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {wantArchived ? "Restore any time — nothing is deleted while it's here." : "Each resume is a live view of your career profile."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={wantArchived ? "/resumes" : "/resumes?archived=1"} className="text-sm font-medium text-primary hover:underline">
            {wantArchived ? "Back to active" : "View archived"}
          </Link>
          {!wantArchived && <NewResumeButton />}
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText aria-hidden />}
          title={wantArchived ? "Nothing archived" : "No resumes yet"}
          description={wantArchived ? "Archived resumes rest here until you restore them." : "Create one — your whole career profile comes along, pre-attached."}
          action={!wantArchived ? <NewResumeButton label="Create a resume" /> : undefined}
        />
      ) : (
        <ul className="grid gap-2" role="list">
          {rows.map((r) => (
            <ResumeRow key={r.id} resume={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
