import { describe, expect, it } from "vitest";
import { analyzeResume, ATS_ENGINE_VERSION } from "@/lib/ats-analysis";
import { emptyResumeDocument, type ResumeDocument } from "@/lib/resume/document";

function expItem(i: number, over: Record<string, unknown> = {}) {
  return {
    kind: "experience" as const,
    employer: `Acme ${i}`,
    title: "Senior Engineer",
    employmentType: "FULL_TIME" as const,
    startDate: `201${4 + i}-01`,
    endDate: `20${16 + i}-01`,
    current: false,
    bullets: [`Cut p95 latency ${40 + i}% by rewriting the query planner`],
    achievements: [],
    technologies: [],
    skillsUsed: [],
    ref: { model: "EXPERIENCE" as const, id: `e${i}` },
    visible: true,
    order: i,
    origin: "USER" as const,
    ...over,
  };
}

function baseDoc(): ResumeDocument {
  const d = emptyResumeDocument("Ada Lovelace");
  d.contact = {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+44 7700 900000",
    location: "London",
  };
  d.summary =
    "Backend engineer with six years building APIs and data pipelines. I design systems that stay boring under load and lead small teams through big migrations.";
  const exp = d.sections.find((s) => s.kind === "EXPERIENCE")!;
  exp.items = [expItem(0), expItem(1)] as never;
  const skills = d.sections.find((s) => s.kind === "SKILLS")!;
  skills.items = (["Postgres", "TypeScript", "Python", "Docker"] as const).map((name, i) => ({
    kind: "skill" as const,
    name,
    category: "TECHNICAL" as const,
    keywords: [],
    ref: { model: "SKILL" as const, id: `s${i}` },
    visible: true,
    order: i,
    origin: "USER" as const,
  })) as never;
  return d;
}

describe("analyzeResume", () => {
  it("returns a bounded score with a complete breakdown", () => {
    const r = analyzeResume(baseDoc());
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(Object.keys(r.breakdown).sort()).toEqual([
      "contact",
      "experience",
      "length",
      "skills",
      "structure",
      "summary",
    ]);
    for (const part of Object.values(r.breakdown)) {
      expect(part.earned).toBeLessThanOrEqual(part.possible);
      expect(part.note.length).toBeGreaterThan(3);
    }
    expect(r.engineVersion).toBe(ATS_ENGINE_VERSION);
  });

  it("flags a missing email as a high-severity reachability issue", () => {
    const d = baseDoc();
    d.contact = { ...d.contact, email: "" };
    const r = analyzeResume(d);
    const issue = r.issues.find((i) => i.code === "CONTACT_INCOMPLETE");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("high");
    expect(issue!.message.toLowerCase()).toContain("email");
    expect(r.score).toBeLessThan(analyzeResume(baseDoc()).score);
  });

  it("flags unquantified weak bullets on a specific item", () => {
    const d = baseDoc();
    const exp = d.sections.find((s) => s.kind === "EXPERIENCE")!;
    exp.items = [
      expItem(0, {
        bullets: [
          "Responsible for improving performance of services",
          "Helped with team coordination across the organization",
          "In charge of the weekly status meetings and notes",
        ],
        startDate: "2019-01",
        endDate: "2021-01",
      }),
    ] as never;
    const r = analyzeResume(d);
    const weak = r.issues.find((i) => i.code === "WEAK_STARTERS");
    expect(weak?.itemIndex).toBe(0);
    expect(r.issues.some((i) => i.code === "UNQUANTIFIED")).toBe(true);
  });

  it("flags first-person bullets, thin skills, and an over-dense resume", () => {
    const d = baseDoc();
    const exp = d.sections.find((s) => s.kind === "EXPERIENCE")!;
    const filler = "many careful words describing the rollout plan ".repeat(8); // ~48 words per line
    exp.items = Array.from({ length: 7 }, (_, i) =>
      expItem(i, {
        bullets: [
          `I led a rollout affecting 1,200 users across ${i} regions`,
          `${filler}grew throughput 15% during 2020`,
          `${filler}and delivered the milestone in 2021`,
          `${filler}while documenting everything in 2022`,
        ],
      }),
    ) as never;
    const r = analyzeResume(d);
    const codes = new Set(r.issues.map((i) => i.code));
    expect(codes.has("FIRST_PERSON") || codes.has("PASSIVE_VOICE")).toBe(true);
    expect(codes.has("TOO_DENSE")).toBe(true);
    const skills = d.sections.find((s) => s.kind === "SKILLS")!;
    skills.items = [
      {
        kind: "skill",
        name: "Excel",
        category: "OTHER",
        keywords: [],
        ref: { model: "SKILL", id: "x" },
        visible: true,
        order: 0,
        origin: "USER",
      },
    ] as never;
    expect(analyzeResume(d).issues.some((i) => i.code === "SKILLS_THIN")).toBe(true);
  });

  it("is deterministic — same input, byte-identical output", () => {
    const a = JSON.stringify(analyzeResume(baseDoc()));
    const b = JSON.stringify(analyzeResume(baseDoc()));
    expect(a).toBe(b);
  });
});
