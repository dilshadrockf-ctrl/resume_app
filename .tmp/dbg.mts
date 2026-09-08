import { PDFDocument, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { loadPdfFonts } from "../src/templates/fonts.ts";
const pdf = await PDFDocument.create();
await pdf.registerFontkit(fontkit);
const fonts = loadPdfFonts();
console.log("keys:", [...fonts.keys()].slice(0, 4));
const buf = fonts.get("Inter/400-normal")!;
console.log("buf type", buf.constructor.name, buf.length);
const f = await pdf.embedFont(buf, { custom: true });
console.log("font:", f.constructor.name);
try { console.log("width:", f.widthOfTextAtSize("Hello", 10)); } catch (e) { console.log("ERR", (e as Error).message); }
