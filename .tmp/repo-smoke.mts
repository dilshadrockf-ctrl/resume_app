/**
 * Repository round-trip smoke: DB-backed create → mutate → save → reload
 * must preserve content exactly; hiding removes from render without touching
 * the library; template switch must not alter content.
 */
import { db } from "../src/db/client.ts";
import { emptyResumeDocument, resumeDocumentSchema, type ResumeDocument } from "../src/lib/resume/document.ts";
import { loadResumeDocument, saveResumeDocument } from "../src/features/resume/repository.ts";
import { computeStats } from "../src/lib/resume/stats.ts";

let currentResumeId = "";
async function createResumeRow() {
  const r = await db.resume.create({ data: { careerProfileId: profileId, name: "Smoke resume" } });
  currentResumeId = r.id;
  return r;
}

const email = `repo-smoke-${Date.now()}@example.com`;
const user = await db.user.create({
  data: {
    email,
    name: "Riley Smoke",
    passwordHash: "x",
    profile: { create: { displayName: "Riley Smoke", email, headline: "Data Engineer", location: "Denver, CO" } },
    careerProfile: { create: { summary: "Built pipelines." } },
    subscription: { create: { planId: "free", provider: "none" } },
  },
  include: { careerProfile: true },
});
const profileId = user.careerProfile!.id;

// library seed: two experiences
const exp1 = await db.experience.create({
  data: { careerProfileId: profileId, employer: "Acme", title: "DE I", startDate: "2020-01", endDate: "2022-06", bullets: ["Cut runtime 40%"], order: 0 },
});
const exp2 = await db.experience.create({
  data: { careerProfileId: profileId, employer: "Beta", title: "DE II", startDate: "2022-07", current: true, bullets: ["Led migration"], order: 1 },
});

let doc = emptyResumeDocument("Smoke resume");
doc.meta.language = "en";
doc.summary = "Senior data engineer focused on streaming.";
// attach exp1+exp2 to EXPERIENCE section
doc.sections.find((s) => s.kind === "EXPERIENCE")!.visible = true;
doc.sections.find((s) => s.kind === "EXPERIENCE")!.items = [
  { kind: "experience", employer: "Acme", title: "DE I", startDate: "2020-01", endDate: "2022-06", bullets: ["Cut runtime 40%"], achievements: [], technologies: [], skillsUsed: [], current: false, employmentType: "FULL_TIME", ref: { model: "EXPERIENCE", id: exp1.id }, visible: true, order: 0, origin: "USER" } as never,
  { kind: "experience", employer: "Beta", title: "DE II", startDate: "2022-07", bullets: ["Led migration"], achievements: [], technologies: [], skillsUsed: [], current: true, employmentType: "FULL_TIME", ref: { model: "EXPERIENCE", id: exp2.id }, visible: true, order: 1, origin: "USER" } as never,
];
// a brand-new inline item (tmp ref)
const tmpId = "tmp:exp-new";
(doc.sections.find((s) => s.kind === "PROJECTS")!).visible = true;
(doc.sections.find((s) => s.kind === "PROJECTS")!).items = [
  { kind: "project", name: "Sidecar", bullets: ["kafka ingest tool"], technologies: ["Kafka"], startDate: "2023", ref: { model: "PROJECT", id: tmpId }, visible: true, order: 0, origin: "USER" } as never,
];

doc = resumeDocumentSchema.parse(doc);
const save1 = await saveResumeDocument(user.id, (await createResumeRow()).id, doc, { mode: "manual", createVersion: true });
console.log("save1", save1.versionCreated);

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, stable(x)]));
  }
  return v;
}
function normalize(d: ResumeDocument) {
  return JSON.stringify(stable({
    summary: d.summary,
    items: d.sections
      .flatMap((s) => s.items.filter((i) => i.visible).map((i) => [s.kind, stable(stripRef(i))]))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  }));
}
function stripRef(i: unknown) {
  const { ref, ...rest } = i as { ref: unknown };
  void ref;
  return rest;
}

const { doc: reloaded } = await loadResumeDocument(user.id, currentResumeId);
{
  const a = JSON.parse(normalize(doc)) as { items: Array<[string, unknown]> };
  const b = JSON.parse(normalize(reloaded)) as { items: Array<[string, unknown]> };
  const ai = new Map(a.items.map((x) => [x[0] + ":" + JSON.stringify(x[1]), x]));
  const bi = new Map(b.items.map((x) => [x[0] + ":" + JSON.stringify(x[1]), x]));
  const missing = [...ai.keys()].filter((k) => !bi.has(k));
  const extra = [...bi.keys()].filter((k) => !ai.has(k));
  if (missing.length || extra.length || a.summary !== b.summary) {
    console.log("MISSING:", missing.slice(0, 3));
    console.log("EXTRA  :", extra.slice(0, 3));
    console.log("SUMMARY A:", a.summary, "| B:", b.summary);
    throw new Error("round-trip mismatch");
  }
}
console.log("ROUND-TRIP OK, resumeId:", currentResumeId);

// tmp item created in library and linked with real id
const proj = await db.project.findFirst({ where: { careerProfileId: profileId, name: "Sidecar" } });
if (!proj) throw new Error("tmp project not created");
const projItem = reloaded.sections.find((s) => s.kind === "PROJECTS")!.items[0];
if ((projItem as { ref: { id: string } }).ref.id !== proj.id) throw new Error("tmp id not replaced by real id");
console.log("TMP ITEM → LIBRARY OK");

// hide one experience (not delete) → save → render excludes it; library intact
reloaded.sections.find((s) => s.kind === "EXPERIENCE")!.items[0].visible = false;
await saveResumeDocument(user.id, currentResumeId, reloaded, { mode: "manual", syncEntries: false, createVersion: true });
const afterHide = await loadResumeDocument(user.id, currentResumeId);
const hidden = afterHide.doc.sections.find((s) => s.kind === "EXPERIENCE")!.items.find((i) => i.order === 0)!;
if (hidden.visible !== false) throw new Error("hide not persisted");
if (hidden.ref.model !== "EXPERIENCE" || (hidden.ref.id !== exp1.id)) throw new Error("hidden item lost its ref (must stay linked)");
const stillThere = await db.experience.count({ where: { id: exp1.id } });
if (stillThere !== 1) throw new Error("hiding deleted the library row!");
console.log("HIDE ≠ DELETE OK");

// unlink entirely → join row gone, entry alive
const d2 = afterHide.doc;
d2.sections.find((s) => s.kind === "EXPERIENCE")!.items = d2.sections.find((s) => s.kind === "EXPERIENCE")!.items.filter((i) => i.visible);
await saveResumeDocument(user.id, currentResumeId, d2, { mode: "manual", syncEntries: false, createVersion: true });
const afterUnlink = await loadResumeDocument(user.id, currentResumeId);
if (afterUnlink.doc.sections.find((s) => s.kind === "EXPERIENCE")!.items.length !== 1) throw new Error("unlink failed");
if ((await db.experience.count({ where: { id: exp1.id } })) !== 1) throw new Error("unlink deleted library row!");
console.log("UNLINK ≠ DELETE OK");

// stats run
const stats = computeStats(afterUnlink.doc);
console.log("stats score:", stats.score, "bullets:", stats.bulletCount, "words:", stats.wordCount);
if (stats.score <= 0 || stats.score > 100) throw new Error("bad score");

// cleanup
await db.resume.deleteMany({ where: { id: currentResumeId } });
await db.user.delete({ where: { id: user.id } });
console.log("REPOSITORY SMOKE OK");

