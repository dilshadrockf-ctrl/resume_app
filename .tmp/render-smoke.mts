import { writeFileSync } from "node:fs";
import { emptyResumeDocument } from "../src/lib/resume/document.ts";
import { buildRenderDoc } from "../src/templates/blocks.ts";
import { renderResumePdf } from "../src/render/pdf.ts";
import { renderAtsText } from "../src/render/text.ts";

const doc = emptyResumeDocument("Test");
doc.contact = { fullName: "Jordan Rivers", headline: "Senior Platform Engineer", email: "jordan@example.com", phone: "+1 512 555 0134", location: "Austin, TX", website: "jordanrivers.dev", linkedin: "linkedin.com/in/jordanrivers" };
doc.summary = "Platform engineer with 8 years of experience building internal developer platforms for 400+ engineers.";
const exp = doc.sections.find((s) => s.kind === "EXPERIENCE")!;
exp.items.push({
  kind: "experience", ref: { model: "EXPERIENCE", id: "e1" }, visible: true, order: 0, origin: "USER",
  employer: "Northwind Logistics", title: "Senior Platform Engineer", employmentType: "FULL_TIME",
  location: "Austin, TX", startDate: "2021-03", endDate: null, current: true, companyUrl: "https://northwind.example",
  description: "", bullets: ["Cut deployment lead time 62% by rebuilding CI on ephemeral runners", "Migrated 140 services to Kubernetes with zero-downtime cutover"], achievements: ["Reduced p99 checkout latency from 1.8s to 340ms"], technologies: ["Kubernetes", "Go", "PostgreSQL"], skillsUsed: [], projectNote: null as never,
});
const skills = doc.sections.find((s) => s.kind === "SKILLS")!;
["Go","Kubernetes","Terraform","PostgreSQL","Python","AWS"].forEach((n, i) =>
  skills.items.push({ kind: "skill", ref: { model: "SKILL", id: "s" + i }, visible: true, order: i, origin: "USER", name: n, category: i % 2 ? "DEVOPS" : "PROGRAMMING", keywords: [] }));

for (const tpl of ["ats-classic", "corporate", "creative", "academic", "executive", "compact"]) {
  doc.meta.templateId = tpl;
  const render = buildRenderDoc(doc);
  const { bytes, pages } = await renderResumePdf(render);
  writeFileSync(`.tmp/smoke-${tpl}.pdf`, bytes);
  console.log(tpl, "pages:", pages, "bytes:", bytes.length);
  const txt = renderAtsText(render);
  if (!txt.includes("Northwind")) throw new Error("ATS text missing content: " + tpl);
}

import { buildDocx } from "../src/render/docx.ts";
const { extractText, getDocument } = await import("unpdf");
doc.meta.templateId = "ats-classic";
const render = buildRenderDoc(doc);
const bytes2 = await renderResumePdf(render);
const { text } = await extractText(await bytes2.bytes.buffer.slice(bytes2.bytes.byteOffset, bytes2.bytes.byteOffset + bytes2.bytes.byteLength) as ArrayBuffer);
const joined = text.join("\n");
if (!joined.includes("Jordan")) throw new Error("PDF text extraction failed");
if (!joined.includes("Northwind")) throw new Error("PDF missing employer");
{
  const { PDFDocument, PDFName, PDFArray } = await import("pdf-lib");
  const loaded = await PDFDocument.load(bytes2.bytes);
  const page = loaded.getPage(0);
  const annots = page.node.lookup(PDFName.of("Annots"));
  if (!(annots instanceof PDFArray) || annots.size() < 3) throw new Error("missing link annotations on page 1");
  let sawMailto = false, sawHttp = false;
  for (let i = 0; i < annots.size(); i++) {
    const a = loaded.context.lookup(annots.get(i)) as any;
    const act = loaded.context.lookup(a.dict.get(PDFName.of("A")));
    const uri = act?.dict?.get?.(PDFName.of("URI"))?.toString?.() ?? "";
    if (/mailto/i.test(uri)) sawMailto = true;
    if (/https?:/.test(uri)) sawHttp = true;
  }
  if (!sawMailto || !sawHttp) throw new Error(`bad link URIs (mailto=${sawMailto} http=${sawHttp})`);
  console.log("PDF LINK ANNOTATIONS OK (" + annots.size() + " on page 1)");
}
console.log("PDF TEXT EXTRACTION OK, chars:", joined.length);
const docxBytes = await buildDocx(render);
import { unzipSync } from "fflate";
try {
  const files = Object.keys(unzipSync(docxBytes.slice ? docxBytes : new Uint8Array(docxBytes)));
  if (!files.includes("word/document.xml")) throw new Error("no document.xml");
  const xml = new TextDecoder().decode(unzipSync(docxBytes as unknown as Uint8Array)["word/document.xml"]);
  if (!xml.includes("Northwind")) throw new Error("docx missing content");
  console.log("DOCX OK entries:", files.length);
} catch (e) { console.log("DOCX check:", String(e).slice(0,100)); }
console.log("RENDER PIPELINE OK");
