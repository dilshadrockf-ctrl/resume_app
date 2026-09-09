import NextAuth, { type NextAuthConfig, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/db/client";
import { verifyPassword } from "@/lib/password";
import { log } from "@/lib/logger";
import { rateLimit } from "@/services/rate-limit";
import { z } from "zod";

/**
 * Auth.js v5 — self-hosted credentials auth (§5). Sessions are signed JWTs in
 * httpOnly cookies; all authorization decisions are made server-side against
 * the database (ownership checks in services), never from the token alone.
 */

declare module "next-auth" {
  interface Session {
    user: { id: string; role: "USER" | "ADMIN" } & DefaultSession["user"];
  }
  interface User {
    role?: "USER" | "ADMIN";
  }
}

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export const authConfig = {
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 }, // 30d
  trustHost: true,
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    },
    callbackUrl: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    },
    csrfToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    },
  },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const limit = await rateLimit("login", `ip:${email}`);
        if (!limit.ok) {
          log.warn("login rate limited", { email });
          throw new Error("TOO_MANY_ATTEMPTS");
        }
        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await verifyPassword(user.passwordHash, parsed.data.password);
        if (!ok) return null;
        await db.auditLog
          .create({ data: { userId: user.id, action: "login", meta: {} } })
          .catch(() => undefined);
        await db.usageEvent
          .create({ data: { userId: user.id, event: "login", props: {} } })
          .catch(() => undefined);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role === "ADMIN" ? "ADMIN" : "USER",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: "USER" | "ADMIN" }).role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
        (session.user as { role?: string }).role = (token.role as "USER" | "ADMIN") ?? "USER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
