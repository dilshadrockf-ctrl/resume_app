import { env, isProduction } from "@/lib/env";

/**
 * Structured logging (§102). JSON lines in production, pretty in dev.
 * Never log secrets or resume content; call sites pass ids/counts only.
 */

type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogFields {
  [key: string]: unknown;
}

let requestSeq = 0;
export function newRequestId(): string {
  requestSeq = (requestSeq + 1) % 100000;
  return `${Date.now().toString(36)}-${requestSeq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emit(level: Level, msg: string, fields?: LogFields) {
  const min = order[env.LOG_LEVEL];
  if (order[level] < min) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(fields ?? {}),
  };
  const line =
    level === "error" && fields?.err instanceof Error && isProduction()
      ? { ...entry, err: { message: fields.err.message, name: fields.err.name } }
      : entry;

  if (env.LOG_FORMAT === "json") {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(JSON.stringify(line));
    return;
  }
  const colors: Record<Level, string> = {
    debug: "\x1b[90m",
    info: "\x1b[36m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
  };
  const rest = Object.entries(fields ?? {})
    .filter(([k]) => k !== "err")
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ");
  const out = `${colors[level]}[${level}]\x1b[0m ${msg}${rest ? " " + rest : ""}`;
  if (level === "error") console.error(out, fields?.err instanceof Error ? fields.err : "");
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const log = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
};

export function redact(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.length <= 8) return "•".repeat(s.length);
  return `${s.slice(0, 3)}${"•".repeat(Math.min(16, s.length - 6))}${s.slice(-3)}`;
}
