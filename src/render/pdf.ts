import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { typesetDoc, type PlacedDoc, type PlacedItem, type PlacedLine } from "@/templates/typeset";
import type { RenderDoc } from "@/templates/blocks";
import { MeasurerCache } from "@/templates/measure-node";
import { loadPdfFonts, pdfFontKey } from "@/templates/fonts";

/**
 * PDF renderer. Text is drawn run-by-run from the shared typeset document:
 * every glyph is real, selectable and searchable text in correct reading
 * order; links are annotations; page breaks come from the same paginator the
 * live preview uses (§53, §114, §113).
 */

export interface PdfRenderResult {
  bytes: Uint8Array;
  pages: number;
}

type FontMap = Record<string, PDFFont>;

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return rgb(0.07, 0.09, 0.15);
  const to = (h: string) => parseInt(h, 16) / 255;
  return rgb(to(m[1]!), to(m[2]!), to(m[3]!));
}

function collectFontKeys(families: Array<"inter" | "lora" | "mono">): Set<string> {
  const keys = new Set<string>();
  for (const fam of families) {
    for (const bold of [false, true]) for (const italic of [false, true]) keys.add(pdfFontKey(fam, bold, italic));
  }
  return keys;
}

async function loadFonts(pdf: PDFDocument, render: RenderDoc): Promise<FontMap> {
  const fonts: FontMap = {};
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const families = new Set<"inter" | "lora" | "mono">([render.baseFont, "inter"]); // inter: dates/secondary defaults
  const buffers = loadPdfFonts(collectFontKeys([...families]));
  for (const [key, buf] of buffers) {
    try {
      fonts[key] = await pdf.embedFont(buf, { custom: true });
    } catch {
      fonts[key] = key.includes("/7") || key.includes("/6") ? helvB : helv;
    }
  }
  return fonts;
}

export async function renderResumePdf(render: RenderDoc): Promise<PdfRenderResult> {
  const pdf = await PDFDocument.create();
  await pdf.registerFontkit(fontkit);
  pdf.setProducer("ResumeForge");
  pdf.setCreator("ResumeForge");

  const fonts = await loadFonts(pdf, render);
  const measurer = new MeasurerCache((text, key, size) => {
    const f = fonts[key];
    if (!f) return (text?.length ?? 1) * (size || 10) * 0.5;
    if (typeof size !== "number" || Number.isNaN(size)) return (text?.length ?? 1) * 5;
    return f.widthOfTextAtSize(text, size);
  });

  const placed = typesetDoc(render, measurer);
  for (const page of placed.pages) {
    const p = pdf.addPage([placed.width, placed.height]);
    for (const item of page.items) drawItem(p, item, fonts);
  }

  const bytes = await pdf.save();
  return { bytes, pages: placed.pages.length };
}

function drawItem(p: PDFPage, item: PlacedItem, fonts: FontMap) {
  if (item.kind === "rect") {
    p.drawRectangle({
      x: Math.max(-4, item.x),
      y: p.getHeight() - item.y - item.height,
      width: item.width + (item.x < 0 ? -item.x : 0),
      height: item.height,
      color: hexToRgb(item.color),
      opacity: item.role === "rail" ? 0.55 : item.role === "rule" ? 0.8 : 1,
    });
    return;
  }
  drawText(p, item.x, item.y, item.width, item.lines, item.align, fonts, item.lineHeight);
}

function drawText(
  p: PDFPage,
  x0: number,
  y0: number,
  width: number,
  lines: PlacedLine[],
  align: "left" | "right" | "center",
  fonts: FontMap,
  lineHeight: number,
) {
  const pageH = p.getHeight();
  lines.forEach((line, li) => {
    const lineWidth = line.runs.reduce((a, r) => a + (fonts[r.fontKey]?.widthOfTextAtSize(r.text, r.size) ?? 0), 0);
    let x = x0;
    if (align === "right") x = x0 + Math.max(0, width - lineWidth);
    else if (align === "center") x = x0 + Math.max(0, (width - lineWidth) / 2);
    const size = line.runs[0]?.size ?? 10;
    const y = pageH - y0 - li * lineHeight - size * 0.82;
    for (const run of line.runs) {
      const font = fonts[run.fontKey] ?? fonts[pdfFontKey("inter", false, false)]!;
      const safeText = typeof run.text === "string" ? run.text : (() => { console.error("BAD RUN:", JSON.stringify(run)); return ""; })();
      const w = font.widthOfTextAtSize(safeText, run.size);
      if (safeText.trim()) {
        p.drawText(safeText, {
          font,
          size: run.size,
          x,
          y,
          color: hexToRgb(run.color ?? "#111827"),
        });
      }
      if (run.link && /^https?:|^mailto:/i.test(run.link)) {
        try {
          p.drawLink({ url: run.link, rect: { x, y: y - 2, width: w, height: run.size + 4 } });
        } catch {
          /* annotation best-effort */
        }
      }
      x += w;
    }
  });
}

export async function metricsFor(render: RenderDoc): Promise<MeasurerCache> {
  const pdf = await PDFDocument.create();
  await pdf.registerFontkit(fontkit);
  const fonts = await loadFonts(pdf, render);
  return new MeasurerCache((text, key, size) => {
    const f = fonts[key];
    return f ? f.widthOfTextAtSize(text, size) : text.length * size * 0.5;
  });
}

/** Typeset a render doc with real font metrics — used by server-side preview/page-count too. */
export async function typesetWithRealMetrics(render: RenderDoc): Promise<PlacedDoc> {
  return typesetDoc(render, await metricsFor(render));
}

/** Extract a deterministic measurement cache for preview (client sends nothing). */
export type { PlacedDoc };
