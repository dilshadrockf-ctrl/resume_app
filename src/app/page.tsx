import Link from "next/link";
import {
  FileText,
  ShieldCheck,
  Cpu,
  Type,
  FolderKanban,
  MailOpen,
  Globe2,
  Zap,
  Check,
  ArrowRight,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { TEMPLATES } from "@/templates/catalog";

export const dynamic = "force-dynamic";

/**
 * Landing (§44-§48): honest copy, no fake testimonials, no invented numbers.
 * Pricing reflects reality: free & self-hosted; billing is disabled by design
 * until real payments exist.
 */
export default async function LandingPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="size-4" aria-hidden />
            </span>
            ResumeForge
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#templates" className="hover:text-foreground">
              Templates
            </a>
            <a href="#privacy" className="hover:text-foreground">
              Privacy
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Link
                href="/dashboard"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 pt-16 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" aria-hidden /> Self-hostable · your
              infrastructure, your data
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Resumes that stay <span className="text-primary">honest</span> — and still beat the
              robots.
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
              Build a career profile once; every resume is a view of it. Optimize against real job
              descriptions with an AI that <em>can&apos;t invent experience</em> — every suggestion
              goes through your review. Export pixel-true PDF, editable DOCX and clean ATS text.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={signedIn ? "/dashboard" : "/register"}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {signedIn ? "Open dashboard" : "Start free — self-hosted"}{" "}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a
                href="#templates"
                className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-accent"
              >
                See templates
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              No credit card exists in this product yet. Billing is intentionally off.
            </p>
          </div>
          <div className="relative hidden lg:block">
            <div
              className="absolute -inset-8 rounded-3xl bg-gradient-to-br from-primary/15 via-transparent to-emerald-500/10"
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-2xl border bg-card p-2 shadow-xl">
              <div className="rounded-xl bg-muted/40 p-6">
                <div
                  className="mx-auto w-[85%] rounded-sm bg-white p-6 shadow"
                  style={{ aspectRatio: "1 / 1.32" }}
                >
                  <div className="h-4 w-32 rounded bg-slate-800" />
                  <div className="mt-1.5 h-2 w-24 rounded bg-slate-300" />
                  <div className="mt-4 h-2 w-full rounded bg-slate-200" />
                  <div className="mt-1.5 h-2 w-11/12 rounded bg-slate-200" />
                  <div className="mt-5 h-2.5 w-24 rounded bg-blue-700/80" />
                  <div className="mt-2 space-y-1.5">
                    {[90, 100, 80, 96, 88].map((w, i) => (
                      <div
                        key={i}
                        className="h-1.5 rounded bg-slate-300/90"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 h-2.5 w-28 rounded bg-blue-700/80" />
                  <div className="mt-2 space-y-1.5">
                    {[95, 75, 100].map((w, i) => (
                      <div
                        key={i}
                        className="h-1.5 rounded bg-slate-300/90"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-t bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: FileText,
                title: "Profile-first resumes",
                body: "Roles, projects and skills live in one career profile. Every resume references it — update once, all resumes follow.",
              },
              {
                icon: Cpu,
                title: "AI with an honesty guard",
                body: "Tailoring, rewrites and cover letters are drafts with citations to your real entries. Nothing applies without you reviewing it.",
              },
              {
                icon: Zap,
                title: "Job-description targeting",
                body: "Paste a JD, see keyword coverage, gaps and matched bullets — and keep a tailored version per role, not a copy-paste mess.",
              },
              {
                icon: Type,
                title: "True WYSIWYG exports",
                body: "The preview uses the same paginator as the PDF. Selectable text, working links, plus DOCX and plain-text for pasting into portals.",
              },
              {
                icon: FolderKanban,
                title: "Application tracker",
                body: "Every role, stage, contact and follow-up date, linked to the exact resume version you sent.",
              },
              {
                icon: MailOpen,
                title: "Cover letters that stay factual",
                body: "Structure and phrasing help; your claims stay limited to what's on your resume.",
              },
              {
                icon: Globe2,
                title: "Share links you control",
                body: "Publish a read-only resume link; unpublish instantly. No crawler indexing.",
              },
              {
                icon: ShieldCheck,
                title: "Runs on your box",
                body: "Node + PostgreSQL. Redis/MinIO/SMTP attach when you have them, degrade gracefully when you don't.",
              },
            ].map((f) => (
              <div key={f.title}>
                <f.icon className="mb-3 size-5 text-primary" aria-hidden />
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="templates" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            Templates with honest ATS ratings
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            ATS systems differ; no template can guarantee a parse. Ours are rated on measurable
            structure — single-column flow, standard fonts, selectable text, sensible section order
            — and every switch preserves your content exactly.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((t) => (
              <div key={t.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span
                    className={
                      t.ats === "excellent"
                        ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                        : "rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                    }
                  >
                    ATS {t.ats}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {t.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="privacy" className="border-t bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Your job search is nobody&apos;s data mine.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Run it on a $5 VPS, a home server, or your laptop. Passwords are Argon2id-hashed,
                emails only ever go to your own SMTP, and AI calls hit only the provider{" "}
                <em>you</em> configure. No analytics beacons, no third-party storage you didn&apos;t
                choose.
              </p>
            </div>
            <ul className="grid gap-2 text-sm">
              {[
                "One docker compose up — Postgres, MinIO, Mailpit included",
                "AI optional: OpenAI, Anthropic, Gemini, Groq, Mistral or local Ollama",
                "No AI? Full manual editing, checks and exports still work",
                "Account export as raw JSON, one click; delete means delete",
              ].map((li) => (
                <li
                  key={li}
                  className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2.5"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {li}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Pricing, honestly</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            This is the self-hosted build: everything is unlocked and billing is disabled at the
            code level
            {env.BILLING_ENABLED ? "" : " (BILLING_ENABLED=false)"} — no paywalls, no upsell modals.
            Hosted plans, when they exist, will arrive as a separate offering.
          </p>
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border bg-card p-6 text-left shadow-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-semibold">Self-hosted</span>
              <span className="text-2xl font-bold">Free</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              forever, MIT-friendly, yours to run
            </p>
            <ul className="mt-4 grid gap-1.5 text-sm">
              {[
                "Unlimited resumes & versions",
                "All templates & exports",
                "Career profile + tracker",
                "BYO AI provider",
                "Docker compose in one file",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="size-3.5 text-success" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <Link
              href={signedIn ? "/dashboard" : "/register"}
              className="mt-6 block rounded-md bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground"
            >
              {signedIn ? "Open your dashboard" : "Create an account"}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-muted-foreground">
          <span>ResumeForge — a resume tool you can own.</span>
          <span>
            {signedIn ? (
              <Link className="text-primary hover:underline" href="/dashboard">
                Dashboard →
              </Link>
            ) : (
              <Link className="text-primary hover:underline" href="/register">
                Get started →
              </Link>
            )}
          </span>
        </div>
      </footer>
    </div>
  );
}
