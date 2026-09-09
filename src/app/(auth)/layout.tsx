import Link from "next/link";
import { FileText } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold tracking-tight">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FileText className="size-4.5" aria-hidden />
        </span>
        ResumeForge
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 max-w-md text-center text-xs text-muted-foreground">
        Self-hostable resume builder. Your data stays on your server. No AI provider is required for
        the core editor — configure one only if you want AI assistance.
      </p>
    </main>
  );
}
