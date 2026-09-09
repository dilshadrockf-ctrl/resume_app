"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError } from "next-auth";
import { db } from "@/db/client";
import { hashPassword, checkPasswordStrength } from "@/lib/password";
import { newToken, hashToken } from "@/lib/tokens";
import { sendEmail } from "@/services/email";
import { rateLimit } from "@/services/rate-limit";
import { guard, ok, fail, withValidation, type ActionResult } from "@/server/action-utils";
import { audit, requireCtx, track } from "@/server/context";
import { appConfig } from "@/lib/env";
import { log } from "@/lib/logger";
import { signIn, signOut } from "@/lib/auth";

const emailSchema = z.string().trim().toLowerCase().email().max(254);

const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(10).max(200),
  name: z.string().trim().min(1).max(80),
});

export async function registerAction(raw: {
  email: string;
  password: string;
  name: string;
}): Promise<ActionResult<{ email: string }>> {
  return withValidation(registerSchema, raw, async (input) => {
    const limit = await rateLimit("register", input.email);
    if (!limit.ok)
      return fail("Too many sign-ups from this email. Try again later.", "RATE_LIMITED");
    const strength = checkPasswordStrength(input.password, input.email);
    if (!strength.ok)
      return fail(strength.message ?? "Weak password", "VALIDATION", {
        password: strength.message ?? "",
      });

    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing)
      return fail("An account with that email already exists.", "CONFLICT", {
        email: "Already registered",
      });

    const passwordHash = await hashPassword(input.password);
    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        profile: { create: { displayName: input.name } },
        careerProfile: { create: {} },
        subscription: { create: { planId: "free", provider: "none" } },
      },
    });
    const { raw: rawToken } = newToken();
    await db.authToken.create({
      data: {
        tokenHash: hashToken(rawToken),
        purpose: "EMAIL_VERIFY",
        email: user.email,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 3600_000),
      },
    });
    const verifyUrl = `${appConfig.baseUrl}/verify-email?token=${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: "Verify your ResumeForge email",
      text:
        `Welcome to ${appConfig.baseUrl}!\n\n` +
        `Verify your email to activate account recovery features:\n${verifyUrl}\n\n` +
        `This link expires in 24 hours.`,
    });
    await audit({ userId: user.id, role: "USER", email: user.email }, "register");
    await track({ userId: user.id }, "account_created", {});
    return ok({ email: user.email });
  });
}

export async function loginAction(raw: {
  email: string;
  password: string;
  redirectTo?: string;
}): Promise<ActionResult<{ redirectTo: string }>> {
  return guard(async () => {
    const schema = z.object({
      email: emailSchema,
      password: z.string().min(1).max(200),
      redirectTo: z.string().startsWith("/").max(200).optional(),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return fail("Enter a valid email and password.", "VALIDATION");
    const limit = await rateLimit("login", `form:${parsed.data.email}`);
    if (!limit.ok) return fail("Too many attempts. Try again in a minute.", "RATE_LIMITED");
    try {
      const redirectTo = parsed.data.redirectTo ?? "/dashboard";
      await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirectTo,
        redirect: false,
      });
      return ok({ redirectTo });
    } catch (e) {
      if (e instanceof AuthError) {
        const msg =
          e.type === "CredentialsSignin"
            ? "Incorrect email or password."
            : "Sign-in failed. Try again.";
        return fail(msg, e.type === "CredentialsSignin" ? "UNAUTHORIZED" : "INTERNAL");
      }
      throw e;
    }
  });
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

export async function forgotPasswordAction(raw: {
  email: string;
}): Promise<ActionResult<{ sent: true }>> {
  return withValidation(
    z.object({ email: emailSchema }),
    raw,
    async (input): Promise<ActionResult<{ sent: true }>> => {
      const limit = await rateLimit("login", `reset:${input.email}`);
      if (!limit.ok) return fail("Too many requests. Try again in a minute.", "RATE_LIMITED");
      const user = await db.user.findUnique({ where: { email: input.email } });
      // Always report the same outcome so accounts are not enumerable (§59).
      if (user) {
        const { raw: rawToken } = newToken();
        await db.authToken.create({
          data: {
            tokenHash: hashToken(rawToken),
            purpose: "PASSWORD_RESET",
            email: input.email,
            userId: user.id,
            expiresAt: new Date(Date.now() + 3600_000),
          },
        });
        const url = `${appConfig.baseUrl}/reset-password?token=${rawToken}`;
        await sendEmail({
          to: input.email,
          subject: "Reset your ResumeForge password",
          text:
            `Use this secure link to choose a new password (expires in 1 hour):\n${url}\n\n` +
            `If you didn't request this, you can ignore this email.`,
        });
        await audit(
          { userId: user.id, role: "USER", email: user.email },
          "password_reset_requested",
        );
      }
      return ok({ sent: true });
    },
  );
}

export async function resetPasswordAction(raw: {
  token: string;
  password: string;
}): Promise<ActionResult<undefined>> {
  return withValidation(
    z.object({ token: z.string().min(20).max(200), password: z.string().min(10).max(200) }),
    raw,
    async (input) => {
      const tok = await db.authToken.findUnique({ where: { tokenHash: hashToken(input.token) } });
      if (!tok || tok.purpose !== "PASSWORD_RESET" || tok.usedAt || tok.expiresAt < new Date()) {
        return fail("That reset link is invalid or has expired. Request a new one.", "VALIDATION");
      }
      const strength = checkPasswordStrength(input.password, tok.email);
      if (!strength.ok)
        return fail(strength.message ?? "Weak password", "VALIDATION", {
          password: strength.message ?? "",
        });
      const user = await db.user.findUnique({ where: { email: tok.email } });
      if (!user) return fail("Account not found.", "NOT_FOUND");
      const passwordHash = await hashPassword(input.password);
      await db.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
        await tx.authToken.update({ where: { id: tok.id }, data: { usedAt: new Date() } });
        // invalidate all sessions + outstanding verify links
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.authToken.deleteMany({
          where: { email: tok.email, purpose: "EMAIL_VERIFY", usedAt: null },
        });
      });
      await audit({ userId: user.id, role: "USER", email: tok.email }, "password_reset_completed");
      revalidatePath("/login");
      return ok(undefined);
    },
  );
}

export async function verifyEmailAction(raw: {
  token: string;
}): Promise<ActionResult<{ email: string }>> {
  return withValidation(z.object({ token: z.string().min(20).max(200) }), raw, async (input) => {
    const tok = await db.authToken.findUnique({ where: { tokenHash: hashToken(input.token) } });
    if (!tok || tok.purpose !== "EMAIL_VERIFY" || tok.expiresAt < new Date()) {
      return fail("That verification link is invalid or expired.", "VALIDATION");
    }
    const user = await db.user.findUnique({ where: { email: tok.email } });
    if (!user) return fail("Account not found.", "NOT_FOUND");
    await db.$transaction(async (tx) => {
      if (!user.emailVerified)
        await tx.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
      await tx.authToken.update({ where: { id: tok.id }, data: { usedAt: new Date() } });
    });
    return ok({ email: user.email });
  });
}

export async function resendVerificationAction(): Promise<ActionResult<{ sent: boolean }>> {
  return guard(async (): Promise<ActionResult<{ sent: boolean }>> => {
    const ctx = await requireCtx();
    const user = await db.user.findUnique({ where: { id: ctx.userId } });
    if (!user) return fail("Account not found.", "NOT_FOUND");
    if (user.emailVerified) return ok({ sent: false });
    const { raw: rawToken } = newToken();
    await db.authToken.create({
      data: {
        tokenHash: hashToken(rawToken),
        purpose: "EMAIL_VERIFY",
        email: user.email,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 3600_000),
      },
    });
    await sendEmail({
      to: user.email,
      subject: "Verify your ResumeForge email",
      text: `Verify your email:\n${appConfig.baseUrl}/verify-email?token=${rawToken}`,
    });
    return ok({ sent: true });
  });
}

const changeSchema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(10).max(200),
});

export async function changePasswordAction(raw: {
  current: string;
  next: string;
}): Promise<ActionResult<undefined>> {
  return withValidation(changeSchema, raw, async (input) => {
    const { requireCtx } = await import("@/server/context");
    const ctx = await requireCtx();
    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { passwordHash: true, email: true },
    });
    if (!user?.passwordHash)
      return fail("This account uses a different sign-in method.", "VALIDATION");
    const { verifyPassword } = await import("@/lib/password");
    if (!(await verifyPassword(user.passwordHash, input.current)))
      return fail("Current password is incorrect.", "UNAUTHORIZED", { current: "Wrong password" });
    const strength = checkPasswordStrength(input.next, user.email);
    if (!strength.ok)
      return fail(strength.message ?? "Weak password", "VALIDATION", {
        next: strength.message ?? "",
      });
    const passwordHash = await hashPassword(input.next);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: ctx.userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: ctx.userId } });
    });
    await audit(ctx, "password_changed");
    return ok(undefined);
  });
}

export async function deleteAccountAction(raw: {
  password: string;
}): Promise<ActionResult<undefined>> {
  return withValidation(z.object({ password: z.string().min(1).max(200) }), raw, async (input) => {
    const { requireCtx } = await import("@/server/context");
    const ctx = await requireCtx();
    const user = await db.user.findUnique({ where: { id: ctx.userId } });
    if (!user?.passwordHash) return fail("Cannot verify password for this account.", "VALIDATION");
    const { verifyPassword } = await import("@/lib/password");
    if (!(await verifyPassword(user.passwordHash, input.password)))
      return fail("Password incorrect — account NOT deleted.", "UNAUTHORIZED");
    // Deletion trail lives in the server log — DB rows (including audit
    // history) are intentionally erased, per the right-to-be-forgotten flow.
    log.info("account deleted", { userId: ctx.userId });
    await db.resume.deleteMany({ where: { careerProfile: { userId: ctx.userId } } });
    await db.user.delete({ where: { id: ctx.userId } }); // cascades: profile, jobs, applications, exports…
    return ok(undefined);
  });
}

export type { ActionResult };
