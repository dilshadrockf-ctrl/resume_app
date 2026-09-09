import { describe, expect, it } from "vitest";

// env must be set BEFORE the module's first read
process.env.AI_PROVIDER = "none";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";

const mod = await import("@/services/ai/provider");
const { evaluateOutput, aiStatus, complete, AiNotConfiguredError, FACTS_SYSTEM_PROMPT } = mod;

describe("guardrail — no fabrication (§16/§17)", () => {
  it("NO_CHANGE is honored as an honest answer", () => {
    expect(evaluateOutput("some original text here", "NO_CHANGE")).toBe("no_change");
  });
  it("inflation beyond the source is blocked", () => {
    expect(evaluateOutput("short original", "x".repeat(500))).toBe("inflation");
  });
  it("tight rewrites pass", () => {
    expect(
      evaluateOutput(
        "Led a team that cut p99 latency by 40% using caching",
        "Cut p99 latency 40% by leading team's caching rollout",
      ),
    ).toBe("ok");
  });
  it("system prompt states the fact rule", () => {
    expect(FACTS_SYSTEM_PROMPT).toContain("Never add employers, dates, technologies, metrics");
  });
});

describe("provider selection", () => {
  it("AI_PROVIDER=none means honestly unconfigured", () => {
    const s = aiStatus();
    expect(s.configured).toBe(false);
    expect(s.note).toContain("optional");
  });
  it("complete() throws a typed error when unconfigured", async () => {
    await expect(
      complete({ promptKey: "t", promptVersion: 1, system: "s", user: "u" }),
    ).rejects.toBeInstanceOf(AiNotConfiguredError);
  });
});
