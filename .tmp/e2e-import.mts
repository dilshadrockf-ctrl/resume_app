import { db } from "../src/db/client.ts";
import { requestImport, runImport } from "../src/features/import/service.ts";
import { parseResumeText } from "../src/features/import/parsers.ts";
import { storage } from "../src/services/storage.ts";

const user = await db.user.findFirst({ where: { email: { startsWith: "e2e-" } }, include: { careerProfile: true } });
if (!user?.careerProfile) throw new Error("no user");
const ctx = { userId: user.id, email: user.email, profileId: user.careerProfile.id, isPremium: false, ip: "127.0.0.1" } as never;

const txt = `E2E Tester
Senior Platform Engineer · Remote
e2e-tester@northwind.test | +1 555 010 2020 | linkedin.com/in/e2e

SUMMARY
Reliability-minded platform engineer with 6 years shipping internal developer platforms.

EXPERIENCE
Senior Platform Engineer — Northwind Cloud
2021 - Present
- Cut deploy time 70% by containerizing build pipeline
- Built observability with Prometheus and Grafana across 40 services
Platform Engineer, Harbor Labs
2019 - 2021
- Migrated 12 services to Kubernetes with zero downtime

SKILLS
Kubernetes, Terraform, Go, Python, Prometheus, Grafana, CI/CD

EDUCATION
BSc Computer Science — State University, 2016
`;

// parser units
const p = parseResumeText(txt);
console.log("parse name:", p.doc.contact.fullName, "| email:", p.doc.contact.email, "| headline:", p.doc.contact.headline);
console.log("parse exp items:", p.doc.sections.find((s) => s.kind === "EXPERIENCE")!.items.length, "skills:", p.doc.sections.find((s) => s.kind === "SKILLS")!.items.length, "edu:", p.doc.sections.find((s) => s.kind === "EDUCATION")!.items.length);
console.log("parse summary ok:", p.doc.summary.length > 40, "| warnings:", p.warnings);
const exp0 = p.doc.sections.find((s) => s.kind === "EXPERIENCE")!.items[0] as any;
console.log("exp0:", exp0.title, "@", exp0.employer, "|", exp0.startDate, "-", exp0.endDate, "| bullets:", exp0.bullets.length);

// full queue path with TXT
const r1 = await requestImport(ctx, { name: "resume.txt", mime: "text/plain", bytes: Buffer.from(txt) });
await runImport(r1.importId);
let job = await db.importJob.findUniqueOrThrow({ where: { id: r1.importId } });
console.log("TXT import:", job.status, "resume:", job.resumeId?.slice(-6));
const created = await db.resume.findUnique({ where: { id: job.resumeId! }, include: { versions: { select: { source: true, label: true } } } });
console.log("created resume:", created?.name, "| version source:", created?.versions[0]?.source);
const sections = await db.resumeSection.findMany({ where: { resumeId: job.resumeId! }, include: { items: true } });
console.log("rows: sections", sections.length, "items", sections.reduce((a, s) => a + (s as any).items.length, 0));

// PDF path: grab the app's own PDF export of the original resume and re-import it
const origExport = await db.export.findFirst({ where: { userId: user.id, status: "READY", type: "PDF" }, orderBy: { createdAt: "desc" } });
if (origExport?.storageKey) {
  const rec = await (await storage()).get(origExport.storageKey);
  if (rec) {
    const r2 = await requestImport(ctx, { name: "self-export.pdf", mime: "application/pdf", bytes: rec.stream });
    await runImport(r2.importId);
    const job2 = await db.importJob.findUniqueOrThrow({ where: { id: r2.importId } });
    console.log("PDF import:", job2.status, "size:", rec.bytes, "chars parsed:", (job2.result as any)?.chars);
    const doc2 = (job2.result as any)?.doc;
    console.log("PDF resume name:", doc2?.meta?.name, "| items found:", doc2?.sections?.reduce((a: number, s: any) => a + (s.items?.length ?? 0), 0));
  }
} else console.log("no prior PDF export to reuse");

// failure path: image-ish PDF → FAILED with friendly error, no resume row
const r3 = await requestImport(ctx, { name: "scan.pdf", mime: "application/pdf", bytes: Buffer.from("%PDF-1.4 garbage") });
try { await runImport(r3.importId); } catch {}
const job3 = await db.importJob.findUniqueOrThrow({ where: { id: r3.importId } });
console.log("garbage PDF:", job3.status, "| error:", job3.error?.slice(0, 60), "| resumeId null:", job3.resumeId === null);
console.log("IMPORT_TEST_DONE");
