import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  IParagraphOptions,
  Packer,
  Paragraph,
  ShadingType,
  TabStopPosition,
  TabStopType,
  TextRun,
  convertMillimetersToTwip,
  type IRunOptions,
} from "docx";
import type { Block, RenderDoc, Run } from "@/templates/blocks";

/**
 * DOCX generator: real WordprocessingML via the `docx` package — fully
 * editable output with styles, hyperlinks, bullets and page margins sized to
 * A4/Letter (§54). Uses right-tab stops for dates, which ATS + Word both like.
 */

const ptToTwip = (pt: number) => Math.round(pt * 20);

function fontName(render: RenderDoc): string {
  return render.baseFont === "lora" ? "Lora" : render.baseFont === "mono" ? "JetBrains Mono" : "Inter";
}

function runOpts(render: RenderDoc, r: Run, base: Partial<IRunOptions> = {}): IRunOptions {
  return {
    text: r.text,
    bold: r.bold,
    italics: r.italic,
    size: ptToTwip((r.size ?? render.fontSize) * 2), // half-points
    color: (r.color ?? render.textColor).replace("#", ""),
    font: r.mono ? "JetBrains Mono" : fontName(render),
    ...base,
  };
}

function runsToChildren(render: RenderDoc, runs: Run[]): (TextRun | ExternalHyperlink)[] {
  const out: (TextRun | ExternalHyperlink)[] = [];
  for (const r of runs) {
    if (r.link && /^https?:|^mailto:/i.test(r.link)) {
      out.push(
        new ExternalHyperlink({
          link: r.link,
          children: [new TextRun({ ...runOpts(render, r), style: "Hyperlink" })],
        }),
      );
    } else {
      out.push(new TextRun(runOpts(render, r)));
    }
  }
  return out;
}

function para(render: RenderDoc, runs: Run[], opts: IParagraphOptions = {}): Paragraph {
  return new Paragraph({ children: runsToChildren(render, runs), spacing: { after: 40, line: Math.round(render.lineHeight * 20) }, ...opts });
}

export function buildDocx(render: RenderDoc): Promise<Uint8Array> {
  const children: Paragraph[] = [];
  const accent = render.accent.replace("#", "");

  if (render.header) {
    const h = render.header;
    children.push(
      new Paragraph({
        alignment: h.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text: h.name, bold: true, size: ptToTwip(render.fontSize * 2 * 2), color: render.textColor.replace("#", ""), font: fontName(render) })],
        spacing: { after: 40 },
      }),
    );
    if (h.headlineRuns?.length) {
      children.push(para(render, h.headlineRuns, { alignment: h.align === "center" ? AlignmentType.CENTER : undefined, spacing: { after: 20 } }));
    }
    if (h.contactRuns.length) {
      children.push(para(render, h.contactRuns, { alignment: h.align === "center" ? AlignmentType.CENTER : undefined, spacing: { after: 120 }, border: h.variant !== "banner" ? { bottom: { color: accent, space: 6, style: BorderStyle.SINGLE, size: 8 } } : undefined }));
    }
  }

  const emitSection = (sec: RenderDoc["main"][number]) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 60 },
        border:
          render.layout.headingRule === "space"
            ? undefined
            : { bottom: { color: render.layout.headingRule === "rule" ? "9CA3AF" : accent, space: 2, style: BorderStyle.SINGLE, size: render.layout.headingRule === "bar" ? 12 : 6 } },
        children: [new TextRun({ text: sec.title, bold: true, color: accent, size: ptToTwip(render.fontSize * render.layout.headingSizeScale * 2), font: fontName(render) })],
      }),
    );
    for (const b of sec.blocks) emitBlock(b);
  };

  const emitBlock = (b: Block) => {
    switch (b.type) {
      case "paragraph":
        children.push(para(render, b.runs, { spacing: { after: 40 } }));
        break;
      case "skill-group":
        children.push(
          para(render, [{ text: `${b.label}: `, bold: true }, { text: b.items.join(", ") }], { spacing: { after: 20 } }),
        );
        break;
      case "bullet-list":
        for (const item of b.items) {
          children.push(
            new Paragraph({
              children: runsToChildren(render, item),
              bullet: { level: 0 },
              spacing: { after: 20, line: Math.round(render.lineHeight * 20) },
            }),
          );
        }
        break;
      case "entry": {
        const e = b.block;
        const runs = [...e.left];
        if (e.right) runs.push({ text: `  \t${e.right}`, color: "#6B7280" });
        children.push(
          new Paragraph({
            children: runsToChildren(render, runs),
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            spacing: { before: 60, after: 20 },
            ...(render.layout.columns === 2 ? { shading: { type: ShadingType.SOLID, color: "FFFFFF", fill: "FFFFFF" } } : {}),
          }),
        );
        if (e.secondary?.length) children.push(para(render, e.secondary, { spacing: { after: 20 } }));
        for (const p of e.paragraphs) children.push(para(render, p, { spacing: { after: 20 } }));
        if (e.bullets.length) {
          for (const bl of e.bullets) {
            children.push(
              new Paragraph({ children: runsToChildren(render, bl), bullet: { level: 0 }, spacing: { after: 20, line: Math.round(render.lineHeight * 20) } }),
            );
          }
        }
        if (e.tags) children.push(para(render, [{ text: e.tags, color: "#6B7280", italic: true }], { spacing: { after: 40 } }));
        break;
      }
      case "header":
      case "section-title":
      case "spacer":
        break;
    }
  };

  if (render.summaryRuns) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 60 },
        children: [new TextRun({ text: "PROFESSIONAL SUMMARY", bold: true, color: accent, font: fontName(render) })],
      }),
    );
    for (const p of render.summaryRuns) children.push(para(render, p));
  }
  for (const sec of render.main) emitSection(sec);
  for (const sec of render.rail) emitSection(sec); // linear order for docx

  const doc = new Document({
    creator: "ResumeForge",
    title: "Resume",
    styles: {
      default: {
        document: { run: { font: fontName(render), size: ptToTwip(render.fontSize * 2), color: render.textColor.replace("#", "") } },
      },
      paragraphStyles: [
        { id: "Normal", name: "Normal", run: { font: fontName(render), size: ptToTwip(render.fontSize * 2) } },
      ],
    },
  sections: [
      {
        properties: {
          page: {
            size: render.paperSize === "A4" ? { width: 11906, height: 16838 } : { width: 12240, height: 15840 },
            margin: {
              top: ptToTwip(render.marginPt.y),
              bottom: ptToTwip(render.marginPt.y),
              left: ptToTwip(render.marginPt.x),
              right: ptToTwip(render.marginPt.x),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc).then((buf) => new Uint8Array(buf));
}
