import { createTransport, type Transporter } from "nodemailer";
import { env, isProduction } from "@/lib/env";
import { log } from "@/lib/logger";

/**
 * Email abstraction (§7/§139). Production: SMTP. Development default: Mailpit
 * (SMTP on localhost:1025 — inspect at :8025); when SMTP is unreachable, or
 * MAIL_DRIVER=log, verification/reset links are printed to the server log so
 * auth flows remain fully testable locally without any email account.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null = null;
let transportBroken = false;

function getTransport(): Transporter | null {
  if (env.MAIL_DRIVER === "log") return null;
  if (transporter) return transporter;
  transporter = createTransport({
    host: env.MAIL_HOST,
    port: Number(env.MAIL_PORT),
    secure: env.MAIL_SECURE,
    auth: env.MAIL_USER ? { user: env.MAIL_USER, pass: env.MAIL_PASSWORD } : undefined,
    tls: { rejectUnauthorized: !isProduction() },
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 8000,
  });
  return transporter;
}

export async function sendEmail(
  msg: EmailMessage,
): Promise<{ delivered: boolean; logged: boolean }> {
  const t = getTransport();
  if (!t || transportBroken) {
    log.info(`[email:log] to=${msg.to} subject=${msg.subject}`, { body: msg.text.slice(0, 2000) });
    return { delivered: false, logged: true };
  }
  try {
    await t.sendMail({ from: env.MAIL_FROM, ...msg });
    log.info("email sent", { to: msg.to, subject: msg.subject });
    return { delivered: true, logged: false };
  } catch (e) {
    transportBroken = isProduction();
    log.warn("email delivery failed — falling back to log transport", {
      err: String((e as Error).message).slice(0, 160),
    });
    log.info(`[email:log] to=${msg.to} subject=${msg.subject}`, { body: msg.text.slice(0, 2000) });
    return { delivered: false, logged: true };
  }
}

export async function emailStatus(): Promise<{ ok: boolean; detail: string }> {
  if (env.MAIL_DRIVER === "log")
    return { ok: true, detail: "log transport (links printed to server output)" };
  const t = getTransport();
  if (!t) return { ok: true, detail: "log transport" };
  try {
    await t.verify();
    return {
      ok: true,
      detail: `SMTP ${env.MAIL_HOST}:${env.MAIL_PORT} (dev viewer: http://localhost:8025)`,
    };
  } catch (e) {
    return {
      ok: false,
      detail: `SMTP unreachable — log fallback (${String((e as Error).message).slice(0, 90)})`,
    };
  }
}
