import type { Measurer } from "@/templates/typeset";

/**
 * Caching measurer wrapper. Renderers provide a raw width function; the cache
 * keeps repeated layout passes (autosave preview, export) cheap.
 */
export class MeasurerCache implements Measurer {
  private cache = new Map<string, number>();

  constructor(private raw: (text: string, fontKey: string, size: number) => number) {}

  width(text: string, fontKey: string, sizePt: number): number {
    const key = `${fontKey}|${Math.round(sizePt * 100)}|${text}`;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const w = this.raw(text, fontKey, sizePt);
    if (this.cache.size < 50000) this.cache.set(key, w);
    return w;
  }
}

/** Fallback measurer (avg char width heuristics) — used by tests & SSR estimate. */
export function heuristicMeasurer(): Measurer {
  const avgRatio: Record<string, number> = {
    inter: 0.5,
    Lora: 0.48,
    JetBrainsMono: 0.6,
  };
  return {
    width(text, fontKey, sizePt) {
      const fam = fontKey.split("/")[0]?.replace(/[A-Za-z]+$/, "") ?? "";
      const ratio =
        Object.entries(avgRatio).find(([k]) => fontKey.includes(k))?.[1] ??
        (fam.includes("Mono") ? 0.6 : 0.5);
      const bold = fontKey.includes("/700") || fontKey.includes("/600");
      const caps = text.replace(/[A-Z]/g, "XX").length / Math.max(text.length, 1);
      return text.length * sizePt * ratio * (bold ? 1.03 : 1) * (1 + (caps - 1) * 0.03);
    },
  };
}
