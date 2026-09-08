/**
 * AI provider layer (§15/§16/§85). Local-first: any OpenAI-compatible
 * endpoint works (Ollama, LM Studio, vLLM), plus native Anthropic/Google
 * adapters. Every endpoint/model/key comes from env — nothing is hardcoded
 * as a dependency, and the whole app runs with AI_PROVIDER=none (the
 * default). Output never writes to a resume directly: callers must put it
 * through the Original-vs-Suggested review step (§17).
 */
import { createHash } from "node:crypto";
import { env, appConfig } from "@/lib/env";

export type AiInput = {
  /** task id for logging + prompt versioning */
  promptKey: string;
  promptVersion: number;
  system: string;
  user: string;
  maxTokens?: number;
  timeoutMs?: number;
};

export type AiResult = {
  text: string;
  provider: string;
  model: string;
  durationMs: number;
  tokensIn?: number;
  tokensOut?: number;
  fallbackUsed: boolean;
};

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "AI provider not configured. Set AI_PROVIDER in .env (optional — everything else works without it).",
    );
    this.name = "AiNotConfiguredError";
  }
}

type Cfg = { provider: string; baseUrl?: string; apiKey?: string; model?: string };

function primary(): Cfg | null {
  if (!appConfig.aiConfigured) return null;
  return {
    provider: env.AI_PROVIDER,
    baseUrl: env.AI_BASE_URL || undefined,
    apiKey: env.AI_API_KEY || undefined,
    model: env.AI_DEFAULT_MODEL || undefined,
  };
}

function fallback(): Cfg | null {
  if (env.AI_FALLBACK_PROVIDER === "none") return null;
  return {
    provider: env.AI_FALLBACK_PROVIDER,
    baseUrl: env.AI_FALLBACK_BASE_URL || undefined,
    apiKey: env.AI_FALLBACK_API_KEY || undefined,
    model: env.AI_FALLBACK_MODEL || undefined,
  };
}

const ENDPOINTS: Record<string, { openai?: string; anthropic?: string; google?: string }> = {
  // Remote defaults only apply when the user explicitly opts into that
  // provider via AI_PROVIDER; ollama/openai-compatible require AI_BASE_URL.
  openai: { openai: "https://api.openai.com/v1" },
  anthropic: { anthropic: "https://api.anthropic.com/v1" },
  google: { google: "https://generativelanguage.googleapis.com/v1beta" },
};

const DEFAULT_MODEL: Record<string, string> = {
  openai: "gpt-4o-mini",
  ollama: "llama3.1",
  "openai-compatible": "local-model",
  anthropic: "claude-haiku-4-5-20251001",
  google: "gemini-2.0-flash",
};

async function callOnce(
  cfg: Cfg,
  input: AiInput,
  signal: AbortSignal,
): Promise<AiResult["text"] | { error: string }> {
  const model = cfg.model ?? DEFAULT_MODEL[cfg.provider] ?? "model";
  try {
    if (cfg.provider === "anthropic") {
      const base = cfg.baseUrl ?? ENDPOINTS.anthropic!.anthropic!;
      const res = await fetch(`${base}/messages`, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.apiKey ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: input.maxTokens ?? 700,
          system: input.system,
          messages: [{ role: "user", content: input.user }],
        }),
      });
      if (!res.ok) return { error: `anthropic ${res.status}: ${(await res.text()).slice(0, 200)}` };
      const json = (await res.json()) as {
        content?: Array<{ text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      return (
        (json.content ?? [])
          .map((c) => c.text ?? "")
          .join("")
          .trim() || { error: "anthropic: empty completion" }
      );
    }
    if (cfg.provider === "google") {
      const base = cfg.baseUrl ?? ENDPOINTS.google!.google!;
      const res = await fetch(
        `${base}/models/${model}:generateContent?key=${encodeURIComponent(cfg.apiKey ?? "")}`,
        {
          method: "POST",
          signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: input.system }] },
            contents: [{ role: "user", parts: [{ text: input.user }] }],
            generationConfig: { maxOutputTokens: input.maxTokens ?? 700, temperature: 0.4 },
          }),
        },
      );
      if (!res.ok) return { error: `google ${res.status}: ${(await res.text()).slice(0, 200)}` };
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = (json.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      return text || { error: "google: empty completion" };
    }
    // openai / ollama / openai-compatible share /chat/completions
    const base = cfg.baseUrl ?? ENDPOINTS[cfg.provider]?.openai;
    if (!base)
      return {
        error: `${cfg.provider} requires AI_BASE_URL (no default on purpose — local-first)`,
      };
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: input.maxTokens ?? 700,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });
    if (!res.ok)
      return { error: `${cfg.provider} ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { error: `${cfg.provider}: empty completion` };
    return text;
  } catch (e) {
    const msg =
      e instanceof Error ? (e.name === "AbortError" ? "timeout" : e.message) : "unknown error";
    return { error: `${cfg.provider}: ${msg.slice(0, 200)}` };
  }
}

export function aiStatus(): {
  configured: boolean;
  provider: string;
  model: string | null;
  note: string;
} {
  const cfg = primary();
  if (!cfg)
    return {
      configured: false,
      provider: "none",
      model: null,
      note: "AI is optional. Set AI_PROVIDER=ollama (or an OpenAI-compatible endpoint) in .env. Resume editing, matching and exports never depend on it.",
    };
  return {
    configured: true,
    provider: cfg.provider,
    model: cfg.model ?? DEFAULT_MODEL[cfg.provider] ?? null,
    note: "Output is a suggestion only — it always appears next to the original for accept/discard.",
  };
}

export async function complete(input: AiInput): Promise<AiResult> {
  const cfg = primary();
  if (!cfg) throw new AiNotConfiguredError();
  const timeout = input.timeoutMs ?? 30_000;
  const t0 = Date.now();

  const run = await callOnce(cfg, input, AbortSignal.timeout(timeout));
  if (typeof run === "string") {
    return {
      text: run,
      provider: cfg.provider,
      model: cfg.model ?? DEFAULT_MODEL[cfg.provider] ?? "model",
      durationMs: Date.now() - t0,
      fallbackUsed: false,
    };
  }
  const fb = fallback();
  if (fb) {
    const alt = await callOnce(fb, input, AbortSignal.timeout(timeout));
    if (typeof alt === "string") {
      return {
        text: alt,
        provider: fb.provider,
        model: fb.model ?? DEFAULT_MODEL[fb.provider] ?? "model",
        durationMs: Date.now() - t0,
        fallbackUsed: true,
      };
    }
    throw new Error(`AI failed (primary: ${run.error}; fallback: ${alt})`);
  }
  throw new Error(`AI failed: ${run.error}`);
}

export function hashInput(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}

export const PROMPT_VERSION = 1;

/** Hard anti-fabrication guardrail shared by all resume prompts (§16). */
export const FACTS_SYSTEM_PROMPT = `You are a resume writing assistant. Rules you must never break:
- Rewrite ONLY using facts present in the user's text. Never add employers, dates, technologies, metrics, awards, or scope that are not already stated.
- Prefer removing fluff and starting with a strong verb over inventing substance.
- If there is nothing factual to improve, reply with exactly: NO_CHANGE
- Reply with the replacement text only — no quotes, no preamble, no explanation.`;

export function missingInfoNotice(text: string): boolean {
  return text.trim() === "NO_CHANGE";
}

/** Guardrail: is the suggested text an acceptable rewrite of the original?
 *  "inflation" = the provider tried to add more than it rewrote (§16). */
export function evaluateOutput(original: string, text: string): "ok" | "no_change" | "inflation" {
  if (missingInfoNotice(text)) return "no_change";
  if (text.length > original.length * 2.2 + 160) return "inflation";
  return "ok";
}
