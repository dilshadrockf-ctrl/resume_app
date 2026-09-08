import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-friendly middleware (§51/§59): session presence gate + CSRF-ish origin
 * check for state-changing requests. Real authorization is always re-checked
 * server-side in actions — this only avoids rendering gated UI to anon users.
 */

const AUTH_COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];
const PUBLIC_PREFIXES = [
  "/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email",
  "/api/auth", "/api/health", "/health", "/resume/", "/api/og",
];
const PROTECTED_PREFIXES = [
  "/dashboard", "/resumes", "/profile", "/jobs", "/applications", "/cover-letters",
  "/templates", "/coach", "/settings", "/api/uploads", "/api/ai", "/api/files", "/api/internal",
];

function isProtected(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => p === pathname)) return false;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Origin check for mutating requests (defense-in-depth beyond server-action
  // built-in CSRF protection).
  const method = req.method;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        const host = req.nextUrl.host;
        const proto = req.nextUrl.protocol.replace(":", "");
        const allowed = new Set([`${proto}://${host}`, process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""]);
        const trusted = (process.env.TRUSTED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        for (const t of trusted) allowed.add(t);
        if (!allowed.has(origin) && !origin.endsWith(".e2b.app")) {
          return NextResponse.json({ error: "Bad origin" }, { status: 403 });
        }
      } catch {
        /* fail-open here: actions validate independently */
      }
    }
  }

  if (isProtected(pathname)) {
    const hasSession = AUTH_COOKIE_NAMES.some((n) => Boolean(req.cookies.get(n)?.value));
    if (!hasSession) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      const next = encodeURIComponent(pathname + req.nextUrl.search);
      url.searchParams.set("next", next);
      const res = NextResponse.redirect(url);
      return res;
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|fonts/|\\.well-known).*)"],
};
