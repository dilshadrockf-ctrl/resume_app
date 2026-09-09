import { z } from "zod";

const optionalUrl = z
  .union([z.string().url(), z.literal("")])
  .optional()
  .transform((v) => (v ? v : undefined));
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const booleanish = (fallback: "true" | "false") =>
  z
    .enum(["true", "false", "1", "0"])
    .default(fallback)
    .transform((v) => v === "true" || v === "1");

const intish = (fallback: number) =>
  z
    .string()
    .regex(/^-?\d+$/)
    .default(String(fallback))
    .transform((v) => Number.parseInt(v, 10));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().default("ResumeForge"),

  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  TRUSTED_ORIGINS: z.string().default(""),

  DATABASE_URL: z.string().min(1),

  AUTH_SECRET: z.string().optional(),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: booleanish("true"),

  REDIS_URL: optionalString,
  QUEUE_PREFIX: z.string().default("resumeforge"),
  QUEUE_INPROCESS: booleanish("true"),

  STORAGE_DRIVER: z.enum(["auto", "minio", "filesystem"]).default("auto"),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_BUCKET: z.string().default("resumes"),
  FILESYSTEM_STORAGE_DIR: z.string().default("./storage"),

  MAIL_DRIVER: z.enum(["auto", "smtp", "log"]).default("auto"),
  MAIL_HOST: z.string().default("localhost"),
  MAIL_PORT: intish(1025),
  MAIL_USER: optionalString,
  MAIL_PASSWORD: optionalString,
  MAIL_SECURE: booleanish("false"),
  MAIL_FROM: z.string().default("ResumeForge <noreply@localhost>"),

  AI_PROVIDER: z
    .enum(["none", "ollama", "openai", "anthropic", "google", "openai-compatible"])
    .default("none"),
  AI_BASE_URL: optionalUrl,
  AI_API_KEY: optionalString,
  AI_DEFAULT_MODEL: optionalString,
  AI_FAST_MODEL: optionalString,
  AI_REASONING_MODEL: optionalString,
  AI_FALLBACK_PROVIDER: z
    .enum(["none", "ollama", "openai", "anthropic", "google", "openai-compatible"])
    .default("none"),
  AI_FALLBACK_BASE_URL: optionalUrl,
  AI_FALLBACK_API_KEY: optionalString,
  AI_FALLBACK_MODEL: optionalString,
  AI_MAX_INPUT_CHARS: intish(24000),
  AI_TIMEOUT_MS: intish(120000),
  AI_DAILY_TOKEN_BUDGET: intish(0),

  BILLING_ENABLED: booleanish("false"),
  FREE_PLAN_UNLIMITED: booleanish("true"),
  FEATURE_FLAGS_ON: z.string().default(""),

  RATE_LIMIT_LOGIN: intish(5),
  RATE_LIMIT_REGISTER: intish(3),
  RATE_LIMIT_AI: intish(30),
  RATE_LIMIT_IMPORT: intish(10),
  RATE_LIMIT_EXPORT: intish(30),
  RATE_LIMIT_PUBLIC_RESUME: intish(120),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_FORMAT: z.enum(["pretty", "json"]).default("pretty"),

  SEED_DEMO_USER: z.string().default("demo@example.com"),
  SEED_DEMO_PASSWORD: z.string().default("demo-password-123"),
});

export type AppEnv = z.infer<typeof envSchema>;

function formatZodIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

let cached: AppEnv | null = null;
let cachedErrors: string | null = null;

function loadEnv(): { value: AppEnv | null; error: string | null } {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = `Invalid environment configuration:\n${formatZodIssues(parsed.error)}\n\nCopy .env.example to .env and adjust values.`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    }
    return { value: null, error: msg };
  }
  const v = parsed.data;
  const problems: string[] = [];
  if (v.NODE_ENV !== "development" && !v.AUTH_SECRET) {
    problems.push("  - AUTH_SECRET is required outside development (openssl rand -base64 32)");
  }
  if (v.NODE_ENV === "production") {
    if (!v.AUTH_SECRET || v.AUTH_SECRET.length < 32) {
      problems.push("  - AUTH_SECRET must be at least 32 characters in production");
    }
  }
  if (problems.length > 0) {
    const msg = `Invalid environment configuration:\n${problems.join("\n")}`;
    if (v.NODE_ENV === "production") throw new Error(msg);
    return { value: v, error: msg };
  }
  return { value: v, error: null };
}

function ensure(): AppEnv {
  if (cached) return cached;
  const { value, error } = loadEnv();
  if (error) {
    // Development/test: log once and continue with defaults so the app can
    // still boot with a partial .env; production throws above.
    console.error(error);
  }
  if (!value) {
    // Only possible for dev when a non-fatal field is invalid; fill defaults.
    const fallback = envSchema.safeParse({
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://resume:resume@localhost:5432/resumebuilder",
    });
    if (!fallback.success) {
      throw new Error(`Environment validation failed: ${formatZodIssues(fallback.error)}`);
    }
    cached = fallback.data;
    cachedErrors = error;
  } else {
    cached = value;
    cachedErrors = error;
  }
  return cached;
}

export const env: AppEnv = new Proxy({} as AppEnv, {
  get(_t, prop: keyof AppEnv) {
    return ensure()[prop];
  },
  ownKeys() {
    return Reflect.ownKeys(ensure());
  },
  getOwnPropertyDescriptor(_t, p) {
    return Reflect.getOwnPropertyDescriptor(ensure(), p);
  },
  has(_t, p) {
    return p in ensure();
  },
});

export const envWarnings = () => {
  ensure();
  return cachedErrors;
};

export const isProduction = () => ensure().NODE_ENV === "production";
export const isDevelopment = () => ensure().NODE_ENV === "development";
export const isTest = () => ensure().NODE_ENV === "test";

/** Feature config that depends on env mode. */
export const appConfig = {
  get baseUrl(): string {
    const e = ensure();
    return (e.AUTH_URL ?? e.NEXT_PUBLIC_APP_URL).replace(/\/$/, "");
  },
  get billingEnabled(): boolean {
    return ensure().BILLING_ENABLED;
  },
  get aiConfigured(): boolean {
    const e = ensure();
    if (e.AI_PROVIDER === "none") return false;
    if (e.AI_PROVIDER === "openai" || e.AI_PROVIDER === "anthropic" || e.AI_PROVIDER === "google") {
      return Boolean(e.AI_API_KEY);
    }
    return true; // ollama / openai-compatible: base url (+ optional key) is enough
  },
  get appUrl(): string {
    return ensure().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  },
};
