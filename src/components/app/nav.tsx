"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FolderKanban,
  Briefcase,
  MailOpen,
  Wand2,
  User,
  Settings2,
  Activity,
  Palette,
  LogOut,
  Sun,
  Moon,
  Monitor,
  ChevronsUpDown,
  Plus,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { Badge } from "@/components/ui/primitives";
import { logoutAction } from "@/features/auth/actions";

export interface ShellUser {
  name: string | null;
  email: string;
  role: "USER" | "ADMIN";
  emailVerified: boolean;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/profile", label: "Career profile", icon: User },
  { href: "/templates", label: "Templates", icon: Palette },
  { href: "/jobs", label: "Job descriptions", icon: Briefcase },
  { href: "/applications", label: "Applications", icon: FolderKanban },
  { href: "/cover-letters", label: "Cover letters", icon: MailOpen },
  { href: "/coach", label: "Coach", icon: Wand2 },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar({ user, isDev }: { user: ShellUser; isDev: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme } = useTheme();
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-card/60 px-3 py-4 lg:flex">
      <Link
        href="/dashboard"
        className="mb-6 flex items-center gap-2 px-2 font-semibold tracking-tight"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FileText className="size-4" aria-hidden />
        </span>
        ResumeForge
      </Link>

      <Button
        className="mb-4 w-full justify-start gap-2"
        onClick={() => router.push("/resumes?new=1")}
      >
        <Plus className="size-4" /> New resume
      </Button>

      <nav aria-label="Main" className="grid gap-0.5">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active(n.href) && "bg-accent text-accent-foreground",
            )}
          >
            <n.icon className="size-4" aria-hidden />
            {n.label}
          </Link>
        ))}
        {isDev ? (
          <Link
            href="/diagnostics"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active("/diagnostics") && "bg-accent text-accent-foreground",
            )}
          >
            <Gauge className="size-4" aria-hidden /> Diagnostics
          </Link>
        ) : null}
      </nav>

      <div className="mt-auto grid gap-2 border-t pt-3">
        <div className="flex items-center gap-1 px-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Light theme"
            onClick={() => setTheme("light")}
          >
            <Sun />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dark theme"
            onClick={() => setTheme("dark")}
          >
            <Moon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="System theme"
            onClick={() => setTheme("system")}
          >
            <Monitor />
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(user.name ?? user.email).slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{user.name ?? "Account"}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            {!user.emailVerified ? (
              <DropdownMenuItem asChild>
                <Link href="/settings?tab=account">Verify email</Link>
              </DropdownMenuItem>
            ) : null}
            {user.role === "ADMIN" ? (
              <DropdownMenuItem asChild>
                <Link href="/admin">Admin</Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              danger
              onSelect={() => {
                void logoutAction();
              }}
            >
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {!user.emailVerified ? (
          <Badge variant="warning" className="mx-2">
            Email not verified
          </Badge>
        ) : null}
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {[NAV[0]!, NAV[1]!, NAV[2]!, NAV[4]!, NAV[8]!].map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground",
            (pathname === n.href || pathname.startsWith(n.href + "/")) && "text-primary",
          )}
        >
          <n.icon className="size-5" aria-hidden />
          {n.label.split(" ")[0]}
        </Link>
      ))}
    </nav>
  );
}
