import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/theme";
import { readThemeCookie } from "@/lib/theme-cookie";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/overlays";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: {
    default: "ResumeForge — AI Resume Builder & ATS Optimizer",
    template: "%s · ResumeForge",
  },
  description:
    "Build an ATS-ready resume with AI that never invents facts. Tailor to any job description, generate PDF/DOCX, and track every application — self-hostable, private by default.",
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#12161f" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies().catch(() => undefined);
  const theme = readThemeCookie(jar?.get("rf-theme")?.value);
  return (
    <html lang="en" suppressHydrationWarning className={theme === "dark" ? "dark" : undefined}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ThemeProvider initial={theme}>
          <TooltipProvider delayDuration={350}>{children}</TooltipProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
