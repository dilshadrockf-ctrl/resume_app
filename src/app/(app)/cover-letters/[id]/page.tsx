import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireCtx } from "@/server/context";
import { getLetter } from "@/features/coverletters/service";
import { LetterEditor } from "@/features/coverletters/components/letter-editor";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Cover letter", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx().catch(() => null);
  if (!ctx) redirect("/login");
  let letter;
  try {
    letter = await getLetter(ctx, id);
  } catch {
    notFound();
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <Link
        href="/cover-letters"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All letters
      </Link>
      <header className="mb-4 mt-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {letter.role} — {letter.company}
        </h1>
        {letter.jobDescription ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            linked job:{" "}
            <Link className="underline" href={`/jobs/${letter.jobDescription.id}`}>
              {letter.jobDescription.title}
            </Link>
          </p>
        ) : null}
      </header>
      <LetterEditor
        letter={{
          id: letter.id,
          company: letter.company,
          role: letter.role,
          hiringManager: letter.hiringManager,
          content: letter.content,
          status: letter.status,
          tone: letter.tone,
          length: letter.length,
        }}
      />
    </div>
  );
}
