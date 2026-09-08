import { ZodError, type ZodType } from "zod";
import { log } from "@/lib/logger";
import { ForbiddenError, UnauthorizedError } from "@/server/context";

/**
 * Typed action result envelope (§155 "Return typed result"). UI code never
 * parses raw errors (§136) and never sees stack traces.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: ActionErrorCode; fieldErrors?: Record<string, string> };

export type ActionErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "AI_NOT_CONFIGURED"
  | "CONFLICT"
  | "TOO_LARGE"
  | "INTERNAL";

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string, code: ActionErrorCode = "INTERNAL", fieldErrors?: Record<string, string>): ActionResult<never> =>
  ({ ok: false, error, code, fieldErrors });

/** Recommended wrapper for use with a zod-parsed input. */
export function withValidation<TIn, TOut>(
  schema: ZodType<TIn>,
  raw: unknown,
  fn: (input: TIn) => Promise<ActionResult<TOut>>,
): Promise<ActionResult<TOut>> {
  return guard(async () => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues.slice(0, 12)) {
        const path = issue.path.join(".") || "_";
        if (!fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      return fail("Please fix the highlighted fields.", "VALIDATION", fieldErrors);
    }
    return fn(parsed.data);
  });
}

/** Map thrown errors to safe envelopes. */
export async function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof UnauthorizedError) return fail("Please sign in again.", "UNAUTHORIZED");
    if (e instanceof ForbiddenError) return fail("You do not have access to that resource.", "FORBIDDEN");
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of e.issues.slice(0, 12)) {
        const path = issue.path.join(".") || "_";
        if (!fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      return fail("Please fix the highlighted fields.", "VALIDATION", fieldErrors);
    }
    if (e instanceof Error && e.message === "TOO_MANY_ATTEMPTS") {
      return fail("Too many attempts. Please wait a minute and try again.", "RATE_LIMITED");
    }
    log.error("action failed", { err: e instanceof Error ? e.message : String(e) });
    return fail("Something went wrong. Please try again.", "INTERNAL");
  }
}
