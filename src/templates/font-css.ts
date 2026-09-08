/** Client-safe font CSS helpers (no node:fs). The TTF loader lives in
 *  fonts.ts and is server-only; this file is imported by browser code. */

export type PdfFontKey = string; // "<Base>/<weight>-<style>"
export type FontFamily = "inter" | "lora" | "mono";

export function cssFontStack(family: FontFamily): string {
  switch (family) {
    case "lora":
      return "'Lora', Georgia, 'Times New Roman', serif";
    case "mono":
      return "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
    default:
      return "'Inter', ui-sans-serif, system-ui, sans-serif";
  }
}

export function pdfFontKey(family: "inter" | "lora" | "mono", bold: boolean, italic: boolean): PdfFontKey {
  const fam = family === "lora" ? "Lora" : family === "mono" ? "JetBrainsMono" : "Inter";
  const weight = bold ? "700" : "400";
  return `${fam}/${weight}-${italic ? "italic" : "normal"}`;
}
