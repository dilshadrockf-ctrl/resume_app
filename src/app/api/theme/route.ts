import { NextResponse, type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { theme?: string };
  const theme = ["light", "dark", "system"].includes(body.theme ?? "") ? body.theme! : "system";
  const res = NextResponse.json({ ok: true });
  res.cookies.set("rf-theme", theme, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}
