import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireCtx } from "@/server/context";
import { listResumes } from "@/features/resume/service";
import { loadResumeDocument } from "@/features/resume/repository";
import { TEMPLATES } from "@/templates/catalog";
import { TemplateGalleryCard } from "@/features/resume/components/template-card";
import { Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Templates", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  const resumes = (await listResumes(ctx)).filter((r) => !r.archivedAt);
  const first = resumes[0] ?? null;
  const doc = first
    ? ((await loadResumeDocument(ctx.userId, first.id).catch(() => null))?.doc ?? null)
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {first ? (
            <>
              Previewing with{" "}
              <Link
                className="font-medium text-primary hover:underline"
                href={`/resumes/${first.id}`}
              >
                {first.name}
              </Link>
              . Switching a template never changes your text.
            </>
          ) : (
            "Shown with sample content — pick one to start your first resume."
          )}
        </p>
      </header>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((t) => (
          <TemplateGalleryCard
            key={t.id}
            template={{
              id: t.id,
              name: t.name,
              description: t.description,
              ats: t.ats,
              tags: t.tags,
            }}
            doc={doc}
            resumeId={first?.id ?? null}
            current={doc?.meta.templateId === t.id}
          />
        ))}
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">ATS</Badge>
        ratings are our honest structural assessment (layout, text order, fonts) — screening
        software varies.
      </p>
    </div>
  );
}
