import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireCtx } from "@/server/context";
import { listResumes } from "@/features/resume/service";
import { loadResumeDocument } from "@/features/resume/repository";
import { buildRenderDoc } from "@/templates/blocks";
import { typesetWithRealMetrics } from "@/render/pdf";
import { placedDocToHtml } from "@/templates/preview-html";
import { TEMPLATES } from "@/templates/catalog";
import { TemplateGalleryCard } from "@/features/resume/components/template-card";
import { EmptyState, Badge } from "@/components/ui/primitives";
import { FileText } from "lucide-react";

export const metadata: Metadata = { title: "Templates", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  const resumes = (await listResumes(ctx)).filter((r) => !r.archivedAt);
  let doc = null as Awaited<ReturnType<typeof loadResumeDocument>>["doc"] | null;
  if (resumes[0])
    doc = (await loadResumeDocument(ctx.userId, resumes[0]!.id).catch(() => null))?.doc ?? null;

  const previews = await Promise.all(
    TEMPLATES.map(async (t) => {
      if (!doc) return { id: t.id, html: "", pages: 1 };
      try {
        const mergedDoc = { ...doc, meta: { ...doc.meta, templateId: t.id } };
        const render = buildRenderDoc(mergedDoc);
        const placed = await typesetWithRealMetrics(render);
        const { html } = placedDocToHtml(placed, { pxPerPt: (96 / 72) * 0.42 });
        return { id: t.id, html, pages: placed.pages.length };
      } catch {
        return { id: t.id, html: "", pages: 1 };
      }
    }),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {doc ? (
            <>
              Live previews of{" "}
              <Link
                className="font-medium text-primary hover:underline"
                href={`/resumes/${resumes[0]!.id}`}
              >
                {resumes[0]!.name}
              </Link>{" "}
              — switching never changes your text.
            </>
          ) : (
            "Create a resume to see your content rendered in each template."
          )}
        </p>
      </header>
      {!doc ? (
        <EmptyState
          icon={<FileText aria-hidden />}
          title="No content to preview"
          description="Templates are just presentations of your career profile — add a resume first."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map((t) => {
            const preview = previews.find((p) => p.id === t.id)!;
            return (
              <TemplateGalleryCard
                key={t.id}
                template={{
                  id: t.id,
                  name: t.name,
                  description: t.description,
                  ats: t.ats,
                  tags: t.tags,
                }}
                html={preview.html}
                pages={preview.pages}
                resumeId={resumes[0]!.id}
                current={doc!.meta.templateId === t.id}
              />
            );
          })}
        </div>
      )}
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">ATS</Badge>
        ratings are our honest structural assessment (layout, text order, fonts) — screening
        software varies; verify with a paste test on the target system.
      </p>
    </div>
  );
}
