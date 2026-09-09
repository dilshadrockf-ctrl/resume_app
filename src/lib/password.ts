import argon2 from "@node-rs/argon2";

/**
 * Argon2id password hashing (§6) — OWASP-aligned parameters.
 * Plaintext passwords are never stored or logged.
 */

const PARAMS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, PARAMS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

const MIN_LEN = 10;
const COMMON = new Set([
  "password123",
  "password1",
  "1234567890",
  "qwertyuiop",
  "letmein123",
  "changeme123",
  "iloveyou123",
  "admin12345",
  "welcome123",
  "passw0rd123",
]);

export interface PasswordCheck {
  ok: boolean;
  message?: string;
}

export function checkPasswordStrength(password: string, identifier?: string): PasswordCheck {
  if (password.length < MIN_LEN)
    return { ok: false, message: `Password must be at least ${MIN_LEN} characters.` };
  if (COMMON.has(password.toLowerCase()))
    return { ok: false, message: "That password is too common." };
  if (identifier && password.toLowerCase().includes(identifier.toLowerCase().split("@")[0] ?? "")) {
    return { ok: false, message: "Password must not contain your email name." };
  }
  return { ok: true };
}
