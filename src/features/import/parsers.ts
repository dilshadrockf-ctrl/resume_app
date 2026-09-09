import type {
  ExperienceItem,
  ProjectItem,
  SkillItem,
  ResumeDocument,
  EducationItem,
} from "@/lib/resume/document";
import { emptyResumeDocument } from "@/lib/resume/document";
import { blankItem } from "@/features/resume/editor-model";

/**
 * Deterministic resume-text → draft-document parser (§56). Deliberately
 * conservative: it only MOVES text the user already wrote into sections;
 * nothing is phrased, summarized, or invented. Confidence per section tells
 * the review UI where to look first. PDFs/DOCX are flattened to text first
 * (unpdf / mammoth), so table-heavy layouts land in EXPERIENCE as blocks —
 * which is exactly why every import requires review.
 */

export type ParsedSection = { kind: string; confidence: number; note?: string };
export type ParseOutcome = { doc: ResumeDocument; sections: ParsedSection[]; warnings: string[] };

const HEADINGS: Array<[RegExp, string]> = [
  [/^(summary|profile|professional summary|about me|objective)\b/i, "SUMMARY"],
  [
    /^(work experience|professional experience|experience|employment( history)?|career)\b/i,
    "EXPERIENCE",
  ],
  [/^(projects?|side projects?|selected projects?)\b/i, "PROJECTS"],
  [/^(education|academic background)\b/i, "EDUCATION"],
  [/^(skills|technical skills|core competencies|competencies)\b/i, "SKILLS"],
  [/^(certifications?|licenses?|certificates)\b/i, "CERTIFICATIONS"],
  [/^(awards?|honors?|recognition)\b/i, "AWARDS"],
  [/^(publications?)\b/i, "PUBLICATIONS"],
  [/^(volunteer(ing)?|community)\b/i, "VOLUNTEER"],
  [/^(languages?)\b/i, "LANGUAGES"],
];

const YEAR = /\b(19|20)\d{2}\b/;

export function parseResumeText(raw: string): ParseOutcome {
  const text = raw.replace(/\r\n?/g, "\n").replace(/ /g, " ");
  const lines = text.split("\n");
  const warnings: string[] = [];
  const doc = emptyResumeDocument("Imported Resume");

  // contact: emails / phones / urls anywhere in the top 25 lines — every
  // pattern is checked on every line (headers often pipe them together)
  const head = lines.slice(0, 25);
  for (const l of head) {
    if (!doc.contact.email) {
      const email = l.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/)?.[0];
      if (email) doc.contact.email = email;
    }
    if (!doc.contact.phone) {
      const cand = l.match(
        /(?:\+\d{1,3}[ .-]?)?(?:\(\d{1,4}\)|\d{1,4})[ .-]?\d{2,4}[ .-]?\d{2,8}(?:[ .-]?\d{0,6})?/,
      )?.[0];
      if (cand && cand.replace(/\D/g, "").length >= 9 && cand.replace(/\D/g, "").length <= 15)
        doc.contact.phone = cand.trim();
    }
    if (!doc.contact.linkedin) {
      const linkedin = l.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|,]+/i)?.[0];
      if (linkedin) doc.contact.linkedin = linkedin;
    }
    if (!doc.contact.website) {
      const site = l.match(
        /(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:dev|io|me|site|app|org|com)(?:\/[^\s|,]*)?/i,
      )?.[0];
      if (site && !/linkedin|github|\.com\/in\b/.test(site) && !site.includes("@"))
        doc.contact.website = site.startsWith("http") ? site : `https://${site}`;
    }
  }
  // name: first short, wordy line before the contact block
  for (const l of head) {
    const t = l.trim();
    if (!t || t.length > 48) continue;
    if (/[^\w\s'.-]/.test(t.replace(/[-–|]/g, ""))) continue;
    const words = t.split(/\s+/);
    if (words.length >= 1 && words.length <= 4 && !/@|http/i.test(t)) {
      doc.contact.fullName = t.replace(/\s*\|.*$/, "").trim();
      const tail = t.split(/[|·–]/)[1]?.trim();
      if (tail) doc.contact.headline = tail.slice(0, 80);
      break;
    }
  }
  if (!doc.contact.email)
    warnings.push("No email detected in the first pages — add it in the editor.");
  if (doc.contact.fullName === "Imported Resume") doc.contact.fullName = "Your Name";

  // split into sections by heading lines
  const sectionOf: Record<string, string[]> = {};
  let current: string | null = null;
  let beforeHeading: string[] = [];
  for (const l of lines) {
    const t = l.trim();
    const hit = HEADINGS.find(([re]) => re.test(t) && t.length < 60);
    if (hit) {
      current = hit[1];
      continue;
    }
    if (current) (sectionOf[current] ??= []).push(l);
    else beforeHeading.push(l);
  }

  // EXPERIENCE: paragraphs separated by blank lines
  const expLines = sectionOf.EXPERIENCE ?? [];
  if (expLines.length) {
    const paragraphs = splitExperience(expLines);
    const items = [];
    for (const p of paragraphs) {
      const pLines = p
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      if (!pLines.length) continue;
      const dates = pLines.flatMap((l) => l.match(new RegExp(YEAR, "g")) ?? []);
      const header = pLines[0]!;
      let title = header.replace(/[-–|].*$/, "").trim();
      let employer = "";
      const atSplit = header.match(/^(.*?)\s+(?:at|[—–|]| - )\s*([A-Z].*)$/);
      if (atSplit) {
        title = atSplit[1]!.trim();
        employer = atSplit[2]!.replace(/,?\s*\(?\d{4}.*$/, "").trim();
      } else {
        const commaSplit = header.match(/^(.{3,60}?),\s+([A-Z][A-Za-z0-9 .&'-]{2,60})$/);
        if (commaSplit && !YEAR.test(commaSplit[1]!)) {
          title = commaSplit[1]!.trim();
          employer = commaSplit[2]!.replace(/,?\s*\(?\d{4}.*$/, "").trim();
        }
      }
      const bullets = pLines
        .slice(1)
        .filter((l) => YEAR.test(l) === false || l.replace(YEAR, "").trim().length > 25);
      const cleaned = bullets
        .map((l) =>
          l
            .replace(/^[-•·*•\s]+/, "")
            .replace(/\s+·\s+\d{4}.*$/, "")
            .trim(),
        )
        .filter((l) => l.length > 2);
      if (title.length < 2 && cleaned.length === 0) continue;
      const it = blankItem("experience", "EXPERIENCE") as ExperienceItem;
      it.employer = employer || "—";
      it.title = title.slice(0, 120) || "Role";
      if (dates[0]) it.startDate = dates[0];
      if (dates.length > 1 && dates[dates.length - 1] !== dates[0])
        it.endDate = dates[dates.length - 1];
      it.bullets = cleaned.slice(0, 12);
      it.order = items.length;
      items.push(it);
    }
    const sec = doc.sections.find((s) => s.kind === "EXPERIENCE");
    if (sec) sec.items = items as never;
    sectionOf.__expCount = items.map(() => "x");
    doc.meta.name = `${doc.contact.fullName} — imported`;
  }

  // SKILLS: comma/bullet split tokens
  const skillLines = sectionOf.SKILLS ?? [];
  const skills = skillLines
    .join(" ")
    .split(/[,;•\n]|\s{2,}/)
    .map((s) => s.replace(/^[\s\-–*•]+|[:\s]+$/g, "").trim())
    .filter((s) => s.length > 1 && s.length < 40)
    .slice(0, 40);
  if (skills.length) {
    const sec = doc.sections.find((s) => s.kind === "SKILLS");
    if (sec)
      sec.items = skills.map((name, i) => {
        const it = blankItem("skill", "SKILLS") as SkillItem;
        it.name = name;
        it.order = i;
        return it;
      }) as never;
  }

  // EDUCATION: paragraphs, first line = degree/school
  const eduLines = sectionOf.EDUCATION ?? [];
  if (eduLines.length) {
    const paras = joinParagraphs(eduLines);
    const sec = doc.sections.find((s) => s.kind === "EDUCATION");
    if (sec)
      sec.items = paras.slice(0, 6).map((p, i) => {
        const first =
          p
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean)[0] ?? "";
        const it = blankItem("education", "EDUCATION") as EducationItem;
        it.institution = first.slice(0, 140);
        it.degree = "";
        it.order = i;
        return it;
      }) as never;
  }

  // SUMMARY: paragraph under its heading, else leftover top lines
  const summarySrc = sectionOf.SUMMARY ?? [];
  const summary = summarySrc.join(" ").replace(/\s+/g, " ").trim();
  if (summary) doc.summary = summary.slice(0, 1200);

  const projects = sectionOf.PROJECTS ?? [];
  if (projects.length) {
    const sec = doc.sections.find((s) => s.kind === "PROJECTS");
    if (sec)
      sec.items = joinParagraphs(projects)
        .slice(0, 8)
        .map((p, i) => {
          const ls = p
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean);
          const it = blankItem("project", "PROJECTS") as ProjectItem;
          it.name = (ls[0] ?? "Project").replace(/^[-•·*•\s]+/, "").slice(0, 140);
          it.bullets = ls
            .slice(1)
            .map((l) => l.replace(/^[-•·*•\s]+/, ""))
            .slice(0, 8);
          it.order = i;
          return it;
        }) as never;
  }

  const sections: ParsedSection[] = [
    {
      kind: "EXPERIENCE",
      confidence: (sectionOf.EXPERIENCE?.length ?? 0) > 40 ? 0.7 : 0.3,
      note:
        (sectionOf.EXPERIENCE?.length ?? 0) < 40 ? "few lines found — check manually" : undefined,
    },
    { kind: "SKILLS", confidence: skills.length ? 0.8 : 0.2 },
    { kind: "EDUCATION", confidence: eduLines.length ? 0.6 : 0.2 },
    { kind: "SUMMARY", confidence: summary ? 0.7 : 0 },
  ];
  void beforeHeading;
  return { doc, sections, warnings };
}

/** Entry-aware grouping: a new role block starts at a line that is neither a
 *  bullet nor a date line, when the previous line ended a date or bullets. */
function splitExperience(lines: string[]): string[] {
  const blocks: string[][] = [];
  let cur: string[] = [];
  const isBullet = (t: string) => /^\s*[-•·*•]/.test(t);
  const isDateLine = (t: string) =>
    /^\W*((19|20)\d{2})\W*((19|20)\d{2}|present|current)?\W*$/i.test(t.trim()) && YEAR.test(t);
  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    const prev = cur[cur.length - 1]?.trim() ?? "";
    const startsNew =
      !isBullet(t) && !isDateLine(t) && (cur.length === 0 || isDateLine(prev) || isBullet(prev));
    if (cur.length === 0) cur = [t];
    else if (startsNew) {
      blocks.push(cur);
      cur = [t];
    } else cur.push(t);
  }
  if (cur.length) blocks.push(cur);
  return blocks.map((b) => b.join("\n"));
}

function joinParagraphs(lines: string[]): string[] {
  const paras: string[] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (!l.trim()) {
      if (cur.length) paras.push(cur.join("\n"));
      cur = [];
    } else cur.push(l);
  }
  if (cur.length) paras.push(cur.join("\n"));
  // if no blank-line structure emerged (typical PDFs), treat each bullet-ish
  // line as part of a rolling paragraph grouped by date headers
  if (paras.length <= 1 && lines.length > 6) {
    const out: string[] = [];
    let block: string[] = [];
    for (const l of lines) {
      const t = l.trim();
      if (!t) continue;
      if (YEAR.test(t) && (t.match(/[-–]|to|present/i) || block.length > 6)) {
        if (block.length) out.push(block.join("\n"));
        block = [t];
      } else block.push(t);
    }
    if (block.length) out.push(block.join("\n"));
    return out;
  }
  return paras;
}
