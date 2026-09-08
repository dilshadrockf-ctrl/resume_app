import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { getPublishedResume } from "@/features/resume/service";
import { loadResumeDocument } from "@/features/resume/repository";
import { buildRenderDoc } from "@/templates/blocks";
import { typesetWithRealMetrics } from "@/render/pdf";
import { placedDocToHtml } from "@/templates/preview-html";
import { rateLimit } from "@/services/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Public resume view (§94): read-only, no profile data leakage, noindex, and
 * view counting behind a per-IP rate limit. Only sections/fields the owner
 * opted into are rendered (publicFields).
 */

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const resume = await getPublishedResume(slug);
  if (!resume) return { title: "Resume not found" };
  return {
    title: `${resume.name} — shared via ResumeForge`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicResumePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{6,64}$/.test(slug)) notFound();
  const resume = await getPublishedResume(slug);
  if (!resume) notFound();

  const ip =
    (await headers().catch(() => undefined))
      ?.get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ?? "local";
  const limit = await rateLimit("publicResume", `ip:${ip}:${slug}`);
  if (!limit.ok) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">Slow down a moment</h1>
          <p className="mt-1 text-sm text-muted-foreground">This page is being viewed very quickly. Try again in a minute.</p>
        </div>
      </main>
    );
  }
  void db.usageEvent.create({ data: { event: "public_resume_view", props: { resumeId: resume.id } } }).catch(() => undefined);
  void db.resume.update({ where: { id: resume.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);

  const owner = await db.careerProfile.findUnique({ where: { id: resume.careerProfileId }, select: { userId: true } });
  if (!owner) notFound();
  const { doc } = await loadResumeDocument(owner.userId, resume.id).catch(() => ({ doc: null as never }));
  if (!doc) notFound();

  const pf = (resume.publicFields ?? {}) as { hideContact?: boolean };
  let visibleDoc = doc;
  if (pf.hideContact) {
    visibleDoc = { ...doc, contact: { ...doc.contact, email: undefined, phone: undefined } };
  }

  const render = buildRenderDoc(visibleDoc);
  const placed = await typesetWithRealMetrics(render);
  const { html } = placedDocToHtml(placed, { pxPerPt: 96 / 72 });

  return (
    <main className="min-h-dvh bg-neutral-200/70 py-10 dark:bg-neutral-950">
      <div className="mx-auto w-fit max-w-full">
        <div style={{ boxShadow: "0 10px 40px -12px rgb(0 0 0 / 0.35)" }} dangerouslySetInnerHTML={{ __html: html }} />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Built with ResumeForge · this view is read-only
        </p>
      </div>
    </main>
  );
}
