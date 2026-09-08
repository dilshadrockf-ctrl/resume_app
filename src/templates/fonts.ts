/**
 * Font access for PDF rendering. TTFs come from @expo-google-fonts npm
 * packages so builds work fully offline (no Google Fonts fetch).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url ?? `file://${__filename}`);

type Weight = 400 | 500 | 600 | 700;

const PACKAGES: Record<string, { pkg: string; base: string; hasBoldItalic: boolean }> = {
  inter: { pkg: "@expo-google-fonts/inter", base: "Inter", hasBoldItalic: true },
  lora: { pkg: "@expo-google-fonts/lora", base: "Lora", hasBoldItalic: false },
  mono: { pkg: "@expo-google-fonts/jetbrains-mono", base: "JetBrainsMono", hasBoldItalic: false },
};

const FILES: Record<string, Record<string, string>> = {
  Inter: {
    "400-normal": "Inter_400Regular.ttf",
    "400-italic": "Inter_400Regular_Italic.ttf",
    "500-normal": "Inter_500Medium.ttf",
    "500-italic": "Inter_500Medium_Italic.ttf",
    "600-normal": "Inter_600SemiBold.ttf",
    "600-italic": "Inter_600SemiBold_Italic.ttf",
    "700-normal": "Inter_700Bold.ttf",
    "700-italic": "Inter_700Bold_Italic.ttf",
  },
  Lora: {
    "400-normal": "Lora_400Regular.ttf",
    "400-italic": "Lora_400Regular_Italic.ttf",
    "500-normal": "Lora_500Medium.ttf",
    "500-italic": "Lora_500Medium_Italic.ttf",
    "600-normal": "Lora_600SemiBold.ttf",
    "600-italic": "Lora_600SemiBold_Italic.ttf",
    "700-normal": "Lora_700Bold.ttf",
    "700-italic": "Lora_700Bold_Italic.ttf",
  },
  JetBrainsMono: {
    "400-normal": "JetBrainsMono_400Regular.ttf",
    "400-italic": "JetBrainsMono_400Regular_Italic.ttf",
    "500-normal": "JetBrainsMono_500Medium.ttf",
    "500-italic": "JetBrainsMono_500Medium_Italic.ttf",
    "600-normal": "JetBrainsMono_600SemiBold.ttf",
    "600-italic": "JetBrainsMono_600SemiBold_Italic.ttf",
    "700-normal": "JetBrainsMono_700Bold.ttf",
    "700-italic": "JetBrainsMono_700Bold_Italic.ttf",
  },
};

export type PdfFontKey = string; // "<base>/<variant>"

export function pdfFontKey(family: "inter" | "lora" | "mono", bold: boolean, italic: boolean): PdfFontKey {
  const p = PACKAGES[family] ?? PACKAGES.inter!;
  const weight: Weight = bold ? 700 : 400;
  const variant = italic ? `${weight}-italic` : `${weight}-normal`;
  return `${p.base}/${variant}`;
}

let cache: Map<PdfFontKey, Uint8Array> | null = null;

export function loadPdfFonts(): Map<PdfFontKey, Uint8Array> {
  if (cache) return cache;
  const out = new Map<PdfFontKey, Uint8Array>();
  for (const p of Object.values(PACKAGES)) {
    for (const [variant, file] of Object.entries(FILES[p.base]!)) {
      const key = `${p.base}/${variant}`;
      try {
        const path = require.resolve(`${p.pkg}/${file}`);
        out.set(key, new Uint8Array(readFileSync(path)));
      } catch {
        // Italic/medium variants may not exist for some families — fall back.
        try {
          const path = require.resolve(`${p.pkg}/${FILES[p.base]!["400-normal"]}`);
          out.set(key, new Uint8Array(readFileSync(path)));
        } catch {
          /* tested by font unit test; build fails loudly if base missing */
        }
      }
    }
  }
  cache = out;
  return out;
}

/** Family tokens used by the HTML preview — mapped to CSS font stacks. */
export function cssFontStack(family: "inter" | "lora" | "mono"): string {
  switch (family) {
    case "lora":
      return "'Lora', Georgia, 'Times New Roman', serif";
    case "mono":
      return "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";
    default:
      return "'Inter', ui-sans-serif, system-ui, sans-serif";
  }
}

export const FONT_LIMITS = 6; // curated professional fonts only (§112)
