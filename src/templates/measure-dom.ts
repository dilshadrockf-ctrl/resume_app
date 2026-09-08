"use client";
import type { Measurer } from "@/templates/typeset";
import { cssFontStack } from "@/templates/font-css";

/**
 * Canvas-based measurer for the browser preview. It uses the very same font
 * stacks the PDF embeds (fontsource loaded in globals.css), so widths match
 * within a fraction of a point — WYSIWYG pagination in the editor.
 */

let cache = new Map<string, number>();

export function clearMeasureCache(): void {
  cache = new Map();
}

export function createDomMeasurer(pxPerPt: number): Measurer {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  cache = new Map();
  return {
    width(text: string, fontKey: string, sizePt: number): number {
      if (!text) return 0;
      if (!Number.isFinite(sizePt)) return text.length * sizePt * 0.5 * pxPerPt;
      const key = `${fontKey}|${sizePt}|${text}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const [family, variant = "400-normal"] = (fontKey || "Inter/400-normal").split("/");
      const [weight] = variant.split("-");
      const italic = variant.includes("italic");
      const f = `${italic ? "italic " : ""}${Number(weight) || 400} ${(sizePt * pxPerPt).toFixed(2)}px ${cssFontStack((family === "Lora" ? "lora" : family === "JetBrainsMono" ? "mono" : "inter") as never)}`;
      ctx.font = f;
      const w = ctx.measureText(text).width / pxPerPt;
      if (cache.size > 40_000) cache = new Map();
      cache.set(key, w);
      return w;
    },
  };
}

export async function ensureFontsLoaded(): Promise<void> {
  if (!document.fonts) return;
  try {
    await Promise.all(
      ["400", "500", "600", "700"].flatMap((w) => [
        document.fonts.load(`${w} 10px Inter`),
        document.fonts.load(`italic ${w} 10px Inter`),
        document.fonts.load(`${w} 10px Lora`),
        document.fonts.load(`${w} 10px "JetBrains Mono"`),
      ]),
    );
    await document.fonts.ready;
  } catch {
    /* preview falls back to system metrics until fonts land */
  }
}
