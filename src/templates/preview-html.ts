import type { PlacedDoc, PlacedLine, PlacedRun, RectBox, TextBox } from "@/templates/typeset";
import { cssFontStack } from "@/templates/font-css";

/**
 * Preview renderer shared by the live editor and the public resume page:
 * the exact same PlacedDoc the PDF renderer consumes, painted as positioned
 * HTML so what you see is what exports (§113: browser print uses this same
 * markup via the #resume-print-area print CSS).
 */

export interface PreviewOptions {
  /** CSS px per PDF point (96/72 = 100% at 96dpi). */
  pxPerPt?: number;
  background?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function runStyle(run: PlacedRun, px: number): string {
  const [family, variant = "400-normal"] = (run.fontKey || "Inter/400-normal").split("/");
  const [weight] = variant.split("-");
  const italic = variant.includes("italic") || run.italic;
  const key = (family ?? "Inter").toLowerCase();
  const stack = cssFontStack(
    (key === "lora" || key === "mono" ? key : "inter") as "inter" | "lora" | "mono",
  );
  const parts = [
    `font-family:${stack}`,
    `font-size:${(run.size * px).toFixed(2)}px`,
    `line-height:normal`,
    `color:${esc(run.color ?? "#111827")}`,
    `font-weight:${run.bold ? 700 : Number(weight) || 400}`,
  ];
  if (italic) parts.push("font-style:italic");
  return parts.join(";");
}

function lineHtml(line: PlacedLine, px: number): string {
  return line.runs
    .map((r) => {
      const inner = `<span style="${runStyle(r, px)}">${esc(String(r.text ?? ""))}</span>`;
      if (r.link && /^https?:|^mailto:/i.test(r.link)) {
        return `<a href="${esc(r.link)}" style="color:inherit;text-decoration:none" target="_blank" rel="noopener noreferrer">${inner}</a>`;
      }
      return inner;
    })
    .join("");
}

export function placedDocToHtml(
  placed: PlacedDoc,
  opts: PreviewOptions = {},
): { html: string; widthPx: number; heightPx: number; pages: number } {
  const px = opts.pxPerPt ?? 96 / 72;
  const W = placed.width * px;
  const H = placed.height * px;
  const pagesHtml = placed.pages
    .map((page, i) => {
      const items = page.items
        .map((item) => {
          if (item.kind === "rect") {
            const rect = item as RectBox;
            return `<div style="position:absolute;left:${(rect.x * px).toFixed(2)}px;top:${(rect.y * px).toFixed(2)}px;width:${(rect.width * px).toFixed(2)}px;height:${(rect.height * px).toFixed(2)}px;background:${esc(rect.color)}"></div>`;
          }
          const t = item as TextBox;
          return t.lines
            .map((ln, li) => {
              const y = (t.y + li * t.lineHeight) * px;
              const lineWidth = ln.width * px;
              let x = t.x * px;
              if (t.align === "right") x = (t.x + t.width) * px - lineWidth;
              else if (t.align === "center") x = t.x * px + (t.width * px - lineWidth) / 2;
              return `<div style="position:absolute;left:${x.toFixed(2)}px;top:${y.toFixed(2)}px;white-space:pre">${lineHtml(ln, px)}</div>`;
            })
            .join("");
        })
        .join("");
      const shadow = i > 0 ? "margin-top:16px" : "";
      return `<div class="resume-page-box" data-page="${i + 1}" style="position:relative;width:${W.toFixed(1)}px;height:${H.toFixed(1)}px;background:${opts.background ?? "#ffffff"};overflow:hidden;flex-shrink:0;${shadow}">${items}</div>`;
    })
    .join("");
  return {
    html: `<div class="resume-paper" style="position:relative;display:flex;flex-direction:column;align-items:center">${pagesHtml}</div>`,
    widthPx: W,
    heightPx: H,
    pages: placed.pages.length,
  };
}
