import { describe, expect, it } from "vitest";
import { buildRenderDoc } from "@/templates/blocks";
import { typesetDoc, wrapRuns } from "@/templates/typeset";
import { heuristicMeasurer } from "@/templates/measure-node";
import { sampleResumeDocument } from "@/templates/sample";
import { TEMPLATES, resolveConfig } from "@/templates/catalog";
import { renderResumePdf } from "@/render/pdf";

const measurer = heuristicMeasurer();

describe("wrapRuns", () => {
  const ctx = {
    baseFont: "inter" as const,
    accent: "#000000",
    textColor: "#111827",
    fontSize: 10,
    lineHeight: 13,
    bullet: "dot" as const,
    page: { width: 595, height: 842 },
    margin: { x: 40, y: 40 },
  };

  it("keeps the spaces between words", () => {
    const lines = wrapRuns(measurer, ctx, [{ text: "Senior Software Engineer" }], 1000);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.runs.map((r) => r.text).join("")).toBe("Senior Software Engineer");
  });

  it("wraps long text and never starts a line with whitespace", () => {
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const lines = wrapRuns(measurer, ctx, [{ text }], 120);
    expect(lines.length).toBeGreaterThan(3);
    for (const l of lines) {
      const joined = l.runs.map((r) => r.text).join("");
      expect(joined).not.toMatch(/^\s/);
      expect(joined).not.toMatch(/\s$/);
    }
    expect(lines.map((l) => l.runs.map((r) => r.text).join("")).join(" ")).toBe(text);
  });
});

describe("templates", () => {
  it.each(TEMPLATES.map((t) => t.id))("%s lays out the sample resume on the page", (id) => {
    const doc = sampleResumeDocument();
    doc.meta.templateId = id;
    doc.meta.config = resolveConfig(id, {});
    const placed = typesetDoc(buildRenderDoc(doc), measurer);
    expect(placed.pages.length).toBeGreaterThanOrEqual(1);
    for (const page of placed.pages) {
      for (const it of page.items) {
        expect(it.x).toBeGreaterThanOrEqual(0);
        expect(it.y).toBeGreaterThanOrEqual(0);
        if (it.kind === "text") expect(it.x + it.width).toBeLessThanOrEqual(placed.width + 0.5);
      }
    }
    // every visible entry made it onto a page
    const text = placed.pages
      .flatMap((p) => p.items)
      .flatMap((i) => (i.kind === "text" ? i.lines.flatMap((l) => l.runs.map((r) => r.text)) : []))
      .join(" ");
    expect(text).toContain("Northwind Technologies");
    expect(text).toContain("University of Moratuwa");
  });

  it("renders a PDF with real fonts", async () => {
    const doc = sampleResumeDocument();
    const { bytes, pages } = await renderResumePdf(buildRenderDoc(doc));
    expect(pages).toBe(1);
    expect(bytes.byteLength).toBeGreaterThan(10_000);
  });
});
