/**
 * Font access for PDF rendering. TTFs come from @expo-google-fonts npm
 * packages so builds and exports work fully offline (no Google Fonts fetch),
 * while the web UI uses matching @fontsource woff2 files (§112).
 */
import { readFileSync } from "node:fs";
export { cssFontStack, pdfFontKey, type FontFamily, type PdfFontKey } from "@/templates/font-css";
import type { PdfFontKey } from "@/templates/font-css";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);


interface Family {
  pkg: string;
  base: string;
  /** variant key -> [directory, filename] inside the package */
  files: Record<string, [string, string]>;
}

const FAMILIES: Family[] = [
  {
    pkg: "@expo-google-fonts/inter",
    base: "Inter",
    files: {
      "400-normal": ["400Regular", "Inter_400Regular.ttf"],
      "400-italic": ["400Regular_Italic", "Inter_400Regular_Italic.ttf"],
      "500-normal": ["500Medium", "Inter_500Medium.ttf"],
      "500-italic": ["500Medium_Italic", "Inter_500Medium_Italic.ttf"],
      "600-normal": ["600SemiBold", "Inter_600SemiBold.ttf"],
      "600-italic": ["600SemiBold_Italic", "Inter_600SemiBold_Italic.ttf"],
      "700-normal": ["700Bold", "Inter_700Bold.ttf"],
      "700-italic": ["700Bold_Italic", "Inter_700Bold_Italic.ttf"],
    },
  },
  {
    pkg: "@expo-google-fonts/lora",
    base: "Lora",
    files: {
      "400-normal": ["400Regular", "Lora_400Regular.ttf"],
      "400-italic": ["400Regular_Italic", "Lora_400Regular_Italic.ttf"],
      "500-normal": ["500Medium", "Lora_500Medium.ttf"],
      "500-italic": ["500Medium_Italic", "Lora_500Medium_Italic.ttf"],
      "600-normal": ["600SemiBold", "Lora_600SemiBold.ttf"],
      "600-italic": ["600SemiBold_Italic", "Lora_600SemiBold_Italic.ttf"],
      "700-normal": ["700Bold", "Lora_700Bold.ttf"],
      "700-italic": ["700Bold_Italic", "Lora_700Bold_Italic.ttf"],
    },
  },
  {
    pkg: "@expo-google-fonts/jetbrains-mono",
    base: "JetBrainsMono",
    files: {
      "400-normal": ["400Regular", "JetBrainsMono_400Regular.ttf"],
      "400-italic": ["400Regular_Italic", "JetBrainsMono_400Regular_Italic.ttf"],
      "500-normal": ["500Medium", "JetBrainsMono_500Medium.ttf"],
      "500-italic": ["500Medium_Italic", "JetBrainsMono_500Medium_Italic.ttf"],
      "600-normal": ["600SemiBold", "JetBrainsMono_600SemiBold.ttf"],
      "600-italic": ["600SemiBold_Italic", "JetBrainsMono_600SemiBold_Italic.ttf"],
      "700-normal": ["700Bold", "JetBrainsMono_700Bold.ttf"],
      "700-italic": ["700Bold_Italic", "JetBrainsMono_700Bold_Italic.ttf"],
    },
  },
];


let cache: Map<PdfFontKey, Uint8Array> | null = null;

export function loadPdfFonts(onlyKeys?: Set<string>): Map<PdfFontKey, Uint8Array> {
  if (cache && (!onlyKeys || onlyKeys.size === 0)) return cache;
  const out = new Map<PdfFontKey, Uint8Array>();
  for (const f of FAMILIES) {
    const fallback = f.files["400-normal"]!;
    for (const [variant, [dir, file]] of Object.entries(f.files)) {
      const key = `${f.base}/${variant}`;
      if (onlyKeys && onlyKeys.size > 0 && !onlyKeys.has(key)) continue;
      try {
        out.set(key, new Uint8Array(readFileSync(require.resolve(`${f.pkg}/${dir}/${file}`))));
      } catch {
        try {
          out.set(key, new Uint8Array(readFileSync(require.resolve(`${f.pkg}/${fallback[0]}/${fallback[1]}`))));
        } catch {
          /* base font missing => pdf renderer falls back to Helvetica */
        }
      }
    }
  }
  if (!onlyKeys || onlyKeys.size === 0) cache = out;
  return out;
}

/** Family tokens used by the HTML preview — mapped to CSS font stacks. */
export const FONT_LIMITS = 6; // curated professional fonts only
