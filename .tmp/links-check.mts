import { readFileSync } from "node:fs";
import { PDFDocument, PDFName, PDFArray } from "pdf-lib";
const bytes = readFileSync(".tmp/smoke-ats-classic.pdf");
const doc = await PDFDocument.load(bytes);
const page = doc.getPage(0);
const annots = page.node.lookup(PDFName.of("Annots"));
console.log("annots found:", annots instanceof PDFArray ? annots.size() : annots);
if (annots instanceof PDFArray) {
  for (let i = 0; i < Math.min(3, annots.size()); i++) {
    const a = doc.context.lookup(annots.get(i));
    console.log("annot:", a?.toString().slice(0, 160));
  }
}
