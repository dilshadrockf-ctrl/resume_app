import { describe, expect, it } from "vitest";
import { parseResumeText } from "@/features/import/parsers";

const SAMPLE = `Jane Doe
Staff Engineer · Berlin
jane@doe.dev | +49 170 1234567 | linkedin.com/in/janedoe

SUMMARY
Staff engineer focused on developer platforms.

EXPERIENCE
Senior Engineer — Acme Corp
2020 - 2024
- Cut build times 60% with remote caching
- Led migration to Kubernetes
Engineer, Beta Labs
2016 - 2020
- Built internal CLI used by 300 developers

SKILLS
Go, Kubernetes, Terraform, gRPC

EDUCATION
MSc Software Engineering — TU Berlin, 2016
`;

describe("parseResumeText — moves facts, invents none", () => {
  const p = parseResumeText(SAMPLE);
  const exp = p.doc.sections.find((s) => s.kind === "EXPERIENCE")!;
  const skills = p.doc.sections.find((s) => s.kind === "SKILLS")!;

  it("extracts contact lines verbatim", () => {
    expect(p.doc.contact.email).toBe("jane@doe.dev");
    expect(p.doc.contact.fullName).toBe("Jane Doe");
    expect(p.doc.contact.linkedin).toContain("linkedin.com/in/janedoe");
  });
  it("splits experience paragraphs with dates and bullet text unchanged", () => {
    expect(exp.items).toHaveLength(2);
    const first = exp.items[0] as {
      employer: string;
      title: string;
      bullets: string[];
      startDate?: string;
    };
    expect(first.title).toContain("Senior Engineer");
    expect(first.employer).toContain("Acme");
    expect(first.bullets.join(" ")).toContain("Cut build times 60% with remote caching");
    expect(first.startDate).toBe("2020");
  });
  it("splits skills on commas", () => {
    const names = skills.items.map((i) => (i as { name: string }).name);
    expect(names).toContain("Kubernetes");
    expect(names).toContain("Terraform");
  });
  it("summary is copied, not rewritten", () => {
    expect(p.doc.summary).toBe("Staff engineer focused on developer platforms.");
  });
  it("junk input yields a reviewable empty draft + warnings, never garbage claims", () => {
    const junk = parseResumeText("!!!! ---- ");
    expect(junk.warnings.length).toBeGreaterThan(0);
    expect(junk.doc.contact.email).toBeUndefined();
    expect(junk.doc.sections.every((s) => s.items.length === 0)).toBe(true);
  });
});
