/** Full lifecycle: create → save → export via queue → storage → download; publish + public page. */
import { db } from "../src/db/client.ts";
import { hashPassword } from "../src/lib/password.ts"; // ensure native works here too
void hashPassword;
import { createResume, saveDoc, setPublished, listResumes } from "../src/features/resume/service.ts";
import { ensureExportHandlers } from "../src/features/export/service.ts";
import { storage } from "../src/services/storage.ts";
import { runJobRunLocally } from "../src/services/queue.ts";

ensureExportHandlers();

const email = process.env.E2E_EMAIL!;
const user = await db.user.findUnique({ where: { email } });
if (!user) throw new Error("run e2e-user first");
const ctx = { userId: user.id, role: "USER" as const, email: user.email };

// 1) create resume from library
const { resumeId, doc } = await createResume(ctx, "E2E — Northwind role");
console.log("created resume", resumeId, "sections:", doc.sections.length);
const exp = doc.sections.find((s) => s.kind === "EXPERIENCE")!;
if (exp.items.length !== 2) throw new Error(`expected 2 attached experiences, got ${exp.items.length}`);

// 2) edit + save (autosave path) with a brand-new inline project
doc.sections.find((s) => s.kind === "PROJECTS")!.items.push({
  kind: "project", name: "Deploy Train", bullets: ["Shipped weekly releases for 30 services"], technologies: ["ArgoCD"], skillsUsed: [],
  ref: { model: "PROJECT", id: "tmp:e2e-proj" }, visible: true, order: 0, origin: "USER",
} as never);
const save = await saveDoc(ctx, resumeId, doc, { mode: "autosave" });
console.log("autosave hash ok:", save.contentHash.length, "versions:", save.versionCreated);
const reload = await (await import("../src/features/resume/repository.ts")).loadResumeDocument(ctx.userId, resumeId);
const proj = reload.doc.sections.find((s: { kind: string }) => s.kind === "PROJECTS")!.items[0] as { ref: { id: string } };
if (proj.ref.id.startsWith("tmp:")) throw new Error("project still has tmp ref");
console.log("project persisted with real id:", proj.ref.id);

// 3) export through the queue (in-process), poll until READY
const { createExportJob, getExport } = await import("../src/features/export/service.ts");
const { exportId } = await createExportJob(ctx, resumeId, "pdf");
let st = await getExport(ctx, exportId);
for (let i = 0; i < 40 && st.status !== "READY" && st.status !== "FAILED"; i++) {
  await new Promise((r) => setTimeout(r, 250));
  st = await getExport(ctx, exportId);
}
console.log("export status:", st.status, st.sizeBytes ? `${st.sizeBytes} bytes` : st.error);
if (st.status !== "READY") throw new Error("export never became READY: " + st.error);

// 4) verify stored bytes are a real PDF, text-extractable
const row = await db.export.findUnique({ where: { id: exportId } });
const store = await storage();
const file = await store.get(row!.storageKey!);
const buf = Buffer.from(file!.stream);
if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error("not a PDF");
const { extractText } = await import("unpdf");
const { text } = await extractText(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
const joined = (text as string[]).join("\n");
if (!joined.includes("Northwind")) throw new Error("PDF missing employer text");
console.log("PDF verified:", buf.length, "bytes, text has Northwind ✓");

// docx + txt quick
const d2 = await createExportJob(ctx, resumeId, "docx");
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); const s2 = await getExport(ctx, d2.exportId); if (s2.status === "READY") break; if (s2.status === "FAILED") throw new Error("docx failed " + s2.error); }
const s2f = await getExport(ctx, d2.exportId);
if (s2f.status !== "READY") throw new Error("docx not ready");
const t2 = await createExportJob(ctx, resumeId, "text");
for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); const s3 = await getExport(ctx, t2.exportId); if (s3.status === "READY") break; if (s3.status === "FAILED") throw new Error("txt failed " + s3.error); }
const s2t = await getExport(ctx, t2.exportId);
if (s2t.status !== "READY") throw new Error("txt not ready");
const trow = await db.export.findUnique({ where: { id: t2.exportId } });
const tfile = await store.get(trow!.storageKey!);
const ttext = Buffer.from(tfile!.stream).toString();
if (!ttext.includes("Deploy Train") || !ttext.includes("Northwind")) throw new Error("ATS text missing content");
console.log("DOCX + ATS TXT exports OK; txt", ttext.length, "chars");

// 5) publish + list
const slug = await setPublished(ctx, resumeId, true);
console.log("published slug:", slug);
const resumes = await listResumes(ctx);
if (!resumes.find((r) => r.published)) throw new Error("list missing published flag");
console.log(`PUBLIC_URL /resume/${slug}`);
console.log("E2E FLOW OK");
process.exit(0);
