import { describe, expect, it } from "vitest";
import { resumeDocumentSchema } from "@/lib/resume/document";
import { scaffoldLetter } from "@/lib/coverletter";

const baseDoc = resumeDocumentSchema.parse({
  meta: { name: "T" },
  contact: { fullName: "Sam Doe", email: "sam@example.com" },
  summary: "Platform engineer.",
  sections: [
    {
      id: "experience",
      kind: "EXPERIENCE",
      order: 0,
      items: [
        {
          kind: "experience",
          employer: "Northwind",
          title: "Engineer",
          bullets: [
            "Cut deploy time 70% by containerizing build pipeline",
            "Mentored four juniors",
          ],
          ref: { model: "EXPERIENCE", id: "x1" },
        },
      ],
    },
  ],
});

describe("scaffoldLetter", () => {
  it("uses only facts present in the resume", () => {
    const letter = scaffoldLetter({
      doc: baseDoc,
      company: "Acme",
      role: "Platform Engineer",
      tone: "PROFESSIONAL",
      length: "SHORT",
    });
    expect(letter).toContain("Acme");
    expect(letter).toContain("Platform Engineer");
    expect(letter).toContain("Cut deploy time 70%");
    expect(letter).toContain("sam@example.com");
    expect(letter).toContain("Dear Hiring Manager");
  });
  it("prefers quantified bullets and respects length", () => {
    const short = scaffoldLetter({
      doc: baseDoc,
      company: "A",
      role: "R",
      tone: "CONCISE",
      length: "SHORT",
    });
    const detail = scaffoldLetter({
      doc: baseDoc,
      company: "A",
      role: "R",
      tone: "CONCISE",
      length: "DETAILED",
    });
    expect(short).toContain("Cut deploy time 70%"); // quantified wins
    expect(detail.length).toBeGreaterThanOrEqual(short.length);
  });
  it("leaves explicit placeholders instead of inventing content when the resume is empty", () => {
    const empty = resumeDocumentSchema.parse({ meta: { name: "E" }, sections: [] });
    const letter = scaffoldLetter({
      doc: empty,
      company: "Acme",
      role: "R",
      tone: "TECHNICAL",
      length: "STANDARD",
    });
    expect(letter).toContain("[Add 2–3 concrete results here");
    expect(letter).toContain("[YOUR NAME]");
  });
  it("tone changes the opener and closer", () => {
    const exec = scaffoldLetter({
      doc: baseDoc,
      company: "Acme",
      role: "VP",
      tone: "EXECUTIVE",
      length: "SHORT",
    });
    const trad = scaffoldLetter({
      doc: baseDoc,
      company: "Acme",
      role: "VP",
      tone: "TRADITIONAL",
      length: "SHORT",
    });
    expect(exec).toContain("Kind regards");
    expect(trad).toContain("Respectfully");
    expect(trad).toContain("I wish to submit my candidacy");
  });
});
