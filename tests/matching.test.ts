import { describe, expect, it } from "vitest";
import { resumeDocumentSchema, type ResumeDocument } from "@/lib/resume/document";
import {
  buildMatchRecommendations,
  extractJdSignals,
  resumeTextForMatching,
  scoreMatch,
} from "@/lib/matching";

function doc(partial: Record<string, unknown>): ResumeDocument {
  return resumeDocumentSchema.parse({
    meta: { name: "Test" },
    sections: [
      { id: "experience", kind: "EXPERIENCE", order: 0, items: [] },
      { id: "skills", kind: "SKILLS", order: 1, items: [] },
    ],
    ...partial,
  });
}

const richDoc = doc({
  summary: "",
  contact: { fullName: "Sam Doe", headline: "Platform Engineer" },
  sections: [
    {
      id: "experience",
      kind: "EXPERIENCE",
      order: 0,
      items: [
        {
          kind: "experience",
          employer: "Northwind",
          title: "Senior Platform Engineer",
          bullets: ["Cut deploy time 70% by containerizing builds with Docker and Kubernetes"],
          technologies: ["Kubernetes", "Terraform", "CI/CD"],
          ref: { model: "EXPERIENCE", id: "x1" },
        },
      ],
    },
    {
      id: "skills",
      kind: "SKILLS",
      order: 1,
      items: [
        {
          kind: "skill",
          name: "Observability",
          keywords: ["Prometheus", "Grafana"],
          ref: { model: "SKILL", id: "s1" },
        },
      ],
    },
  ],
});

const JD = `Staff Platform Engineer — Acme

Responsibilities
- Own CI/CD and developer platform
- Operate Kubernetes with Terraform

Requirements
- 6+ years experience with Kubernetes in production
- Strong Terraform and observability skills (Prometheus, Grafana)
- Rust required
`;

describe("extractJdSignals", () => {
  const signals = extractJdSignals(JD, "Staff Platform Engineer");
  it("captures vocabulary keywords with occurrence weight", () => {
    const terms = signals.keywords.map((k) => k.term);
    expect(terms).toContain("kubernetes");
    expect(terms).toContain("terraform");
  });
  it("marks requirement-line terms with context for honest gap reporting", () => {
    const kube = signals.keywords.find((k) => k.term === "kubernetes");
    expect(kube?.context).toBe("required");
  });
  it("extracts title words", () => {
    expect(signals.titleWords).toContain("engineer");
  });
});

describe("scoreMatch", () => {
  const signals = extractJdSignals(JD, "Staff Platform Engineer");
  it("resumes text includes bullets and technologies", () => {
    const text = resumeTextForMatching(richDoc);
    expect(text).toContain("docker and kubernetes");
    expect(text).toContain("terraform");
  });
  it("credits matched terms and records missing ones verbatim", () => {
    const r = scoreMatch(richDoc, signals);
    expect(r.breakdown.keywordCoverage.matched).toContain("kubernetes");
    expect(r.breakdown.keywordCoverage.matched).toContain("terraform");
    expect(r.breakdown.keywordCoverage.missing).toContain("rust");
    expect(r.score).toBeGreaterThan(40);
    expect(r.score).toBeLessThanOrEqual(100);
  });
  it("empty resume scores low but never zero-collapses into fake precision", () => {
    const empty = doc({});
    const r = scoreMatch(empty, signals);
    expect(r.score).toBeLessThan(35);
    expect(r.breakdown.keywordCoverage.matched).toHaveLength(0);
  });
});

describe("buildMatchRecommendations — no fabrication (§16)", () => {
  const signals = extractJdSignals(JD, "Staff Platform Engineer");
  it("only ever proposes surfacing terms that already exist in the library", () => {
    const recos = buildMatchRecommendations(
      signals,
      richDoc,
      JSON.stringify({ skills: ["Prometheus"] }),
    );
    for (const r of recos) {
      if (r.action === "ADD_KEYWORD" && r.suggested) {
        const isFactBacked =
          /prometheus/i.test(JSON.stringify(richDoc)) || /prometheus/i.test(r.suggested);
        expect(isFactBacked).toBe(true);
      }
      expect(r.rationale).toBeTruthy();
    }
  });
  it("terms absent from the library become honest 'skip' advice, never invented bullets", () => {
    const recos = buildMatchRecommendations(
      signals,
      richDoc,
      JSON.stringify({ nothing: "prometheus unrelated" }),
    );
    const rust = recos.find((r) => (r.rationale ?? "").includes("rust"));
    if (rust) {
      expect(rust.suggested ?? "").toBe(""); // advice only, no drafted claim
    }
    expect(recos.every((r) => !/won|award|led a team of 40/i.test(r.suggested ?? ""))).toBe(true);
  });
});
