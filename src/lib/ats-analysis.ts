import type { ResumeDocument, SectionItem } from "@/lib/resume/document";

/**
 * Local ATS/quality analysis engine (§31/§36/§40/§172).
 * Deterministic and explainable: every issue cites what was detected, where,
 * and a copyable fix that never invents facts. This is NOT an ATS guarantee —
 * real ATSes vary; this checks what recruiters consistently complain about.
 */

export const ATS_ENGINE_VERSION = "local-ats-1.1.0";

export type IssueSeverity = "high" | "medium" | "low";

export type AnalysisIssue = {
  code: string;
  severity: IssueSeverity;
  sectionKind?: string;
  itemIndex?: number;
  message: string;
  fix: string;
  evidence?: string;
};

export type AnalysisBreakdown = Record<string, { earned: number; possible: number; note: string }>;

export type AnalysisResult = {
  score: number; // 0-100
  breakdown: AnalysisBreakdown;
  issues: AnalysisIssue[];
  engineVersion: string;
};

const WEAK_STARTERS = [
  "responsible for",
  "helped with",
  "helped to",
  "worked on",
  "assisted with",
  "tasked with",
  "in charge of",
  "duties included",
  "involved in",
];
const PRONOUNS = /\b(i|my|me|we|our|myself)\b/i;
const PASSIVE = /^\s*(was|were|been|being|is|are)\s+\w+ed\b/i;
const QUANTIFIED = /(\d+(\.\d+)?\s?(%|percent|x|k\b|m\b|million|billion)|[$€£]\s?\d|\b\d{2,}\b)/;
const ACTION_VERB =
  /^[A-Z][a-z]+ed\b|^(Built|Led|Launched|Shipped|Improved|Reduced|Increased|Automated|Migrated|Scaled|Optimized|Delivered|Created|Drove|Owned|Refactored|Implemented|Architected|Mentored|Cut|Grew|Streamlined|Introduced|Designed|Ran|Wrote|Established|Eliminated)|^(Designed|Rewrote|Prototyped|Deployed|Released)/;

function words(t: string): string[] {
  return t.trim().split(/\s+/).filter(Boolean);
}

function itemBullets(item: SectionItem): string[] {
  const i = item as unknown as { bullets?: string[]; achievements?: string[] };
  return [...(i.bullets ?? []), ...(i.achievements ?? [])].filter((b) => b.trim().length > 0);
}

export function analyzeResume(doc: ResumeDocument): AnalysisResult {
  const issues: AnalysisIssue[] = [];
  const add = (i: AnalysisIssue) => issues.push(i);
  const push = (
    code: string,
    severity: IssueSeverity,
    message: string,
    fix: string,
    extra?: Partial<AnalysisIssue>,
  ) => add({ code, severity, message, fix, ...extra });

  // ── contact ────────────────────────────────────────────────────────────────
  const c = doc.contact;
  const missing: string[] = [];
  if (!c.email || !/.+@.+\..+/.test(c.email)) missing.push("email");
  if (!c.phone) missing.push("phone");
  if (!c.location) missing.push("location");
  const contactScore = Math.max(0, 10 - missing.length * 4);
  if (missing.length) {
    push(
      "CONTACT_INCOMPLETE",
      "high",
      `Recruiters can't reach you: ${missing.join(", ")} missing from the header.`,
      `Add ${missing.join(", ")} under Contact settings — profile fields feed every resume.`,
      { sectionKind: "HEADER" },
    );
  }

  // ── summary ────────────────────────────────────────────────────────────────
  const summaryWords = words(doc.summary ?? "").length;
  let summaryScore = 0;
  if (!doc.summary || summaryWords === 0) {
    push(
      "SUMMARY_MISSING",
      "low",
      "No professional summary — optional, but a 25–60 word one frames the reader's first impression.",
      "Write it in your own words in the Summary block (or generate an AI draft and edit it).",
      { sectionKind: "SUMMARY" },
    );
    summaryScore = 0;
  } else if (summaryWords < 15) {
    summaryScore = 4;
    push(
      "SUMMARY_THIN",
      "low",
      `Summary is only ${summaryWords} words.`,
      "Expand to 25–60 words: role, years, one differentiating fact.",
      { sectionKind: "SUMMARY", evidence: doc.summary },
    );
  } else if (summaryWords > 80) {
    summaryScore = 6;
    push(
      "SUMMARY_LONG",
      "medium",
      `Summary is ${summaryWords} words — past 80 it stops being read.`,
      "Cut it to 25–60 words; keep one quantified highlight.",
      { sectionKind: "SUMMARY", evidence: doc.summary.slice(0, 120) },
    );
  } else {
    summaryScore = 10;
    if (PRONOUNS.test(doc.summary)) {
      push(
        "FIRST_PERSON",
        "low",
        "Summary uses first-person pronouns (I/my/we).",
        "Résumés read better in implied-subject style: 'Built…' not 'I built…'.",
        { sectionKind: "SUMMARY", evidence: doc.summary.match(PRONOUNS)?.[0] },
      );
    }
  }

  // ── experience ─────────────────────────────────────────────────────────────
  const expSec = doc.sections.find((s) => s.kind === "EXPERIENCE" && s.visible);
  const expItems = (expSec?.items ?? []).filter((i) => i.visible);
  let expQuality = 0;
  const expPossible = 45;
  if (expItems.length === 0) {
    push(
      "NO_EXPERIENCE",
      "high",
      "The Experience section is empty — for most roles this sinks any screen, ATS or human.",
      "Link at least one entry from your career library (it stays shared across resumes).",
      { sectionKind: "EXPERIENCE" },
    );
  } else {
    const allBullets: { text: string; idx: number }[] = [];
    expItems.forEach((it, idx) =>
      itemBullets(it).forEach((b) => allBullets.push({ text: b, idx })),
    );

    if (allBullets.length < expItems.length) {
      push(
        "THIN_ROLES",
        "high",
        `${expItems.length - allBullets.length} of ${expItems.length} roles have no bullet points at all.`,
        "Add 2–4 bullets per role describing outcomes — titles alone read as filler.",
        { sectionKind: "EXPERIENCE" },
      );
    }
    expQuality += Math.min(15, allBullets.length * 3); // substance present

    const quantified = allBullets.filter((b) => QUANTIFIED.test(b.text)).length;
    const ratio = allBullets.length ? quantified / allBullets.length : 0;
    expQuality += Math.round(ratio * 12);
    if (allBullets.length >= 3 && ratio < 0.4) {
      const sample = allBullets.find((b) => !QUANTIFIED.test(b.text))?.text;
      push(
        "UNQUANTIFIED",
        "medium",
        `Only ${quantified}/${allBullets.length} bullets contain numbers or concrete scope.`,
        "Where you actually measured it, add the figure (time saved, traffic, team size, budget). Never estimate what you don't know.",
        { sectionKind: "EXPERIENCE", evidence: sample?.slice(0, 140) },
      );
    }

    const weak = allBullets.filter((b) =>
      WEAK_STARTERS.some((w) => b.text.toLowerCase().trim().startsWith(w)),
    );
    expQuality += weak.length === 0 ? 8 : Math.max(0, 8 - weak.length * 3);
    if (weak.length) {
      push(
        "WEAK_STARTERS",
        "medium",
        `${weak.length} bullet${weak.length > 1 ? "s" : ""} start with a weak phrase ("responsible for", "helped with"…).`,
        "Open with the result or a past-tense verb you actually did: 'Cut deploy time…', 'Led migration…'.",
        {
          sectionKind: "EXPERIENCE",
          evidence: weak[0]!.text.slice(0, 140),
          itemIndex: weak[0]!.idx,
        },
      );
    }

    const longBullets = allBullets.filter((b) => words(b.text).length > 36);
    if (longBullets.length) {
      push(
        "BULLETS_TOO_LONG",
        "low",
        `${longBullets.length} bullet${longBullets.length > 1 ? "s" : ""} exceed ~36 words.`,
        "One idea per bullet, ≤ 2 lines; split or drop context that repeats elsewhere.",
        { sectionKind: "EXPERIENCE", evidence: longBullets[0]!.text.slice(0, 160) },
      );
    }
    expQuality += longBullets.length === 0 ? 4 : 2;

    const pronoun = allBullets.filter((b) => PRONOUNS.test(b.text));
    const passive = allBullets.filter((b) => PASSIVE.test(b.text.trim()));
    expQuality += Math.max(0, 6 - pronoun.length - passive.length);
    if (pronoun.length) {
      push(
        "FIRST_PERSON_BULLETS",
        "low",
        `${pronoun.length} bullet${pronoun.length > 1 ? "s use" : " uses"} 'I/my/we'.`,
        "Drop the pronoun: 'I built X' → 'Built X'.",
        { sectionKind: "EXPERIENCE", evidence: pronoun[0]!.text.slice(0, 140) },
      );
    }
    if (passive.length) {
      push(
        "PASSIVE_VOICE",
        "low",
        `${passive.length} bullet${passive.length > 1 ? "s read" : " reads"} passive ("was chosen…").`,
        "Flip to the action: 'Chosen to…', 'Selected from…' with the outcome first.",
        { sectionKind: "EXPERIENCE", evidence: passive[0]!.text.slice(0, 140) },
      );
    }

    // dates
    const dated = expItems
      .map((it, idx) => ({
        idx,
        it: it as unknown as {
          startDate?: string;
          endDate?: string;
          current?: boolean;
          employer?: string;
          title?: string;
        },
      }))
      .filter((x) => /^\d{4}/.test(x.it.startDate ?? ""));
    let dateScore = 0;
    const missingEnd = dated.filter((x) => !x.it.endDate && !x.it.current).length;
    if (missingEnd) {
      push(
        "MISSING_END_DATES",
        "medium",
        `${missingEnd} role${missingEnd > 1 ? "s" : ""} have a start year but no end date or 'Present'.`,
        "ATS parsers key on date ranges — set the end date (or mark current).",
        {
          sectionKind: "EXPERIENCE",
          itemIndex: dated.find((x) => !x.it.endDate && !x.it.current)!.idx,
        },
      );
      dateScore = 4;
    } else dateScore = 8;
    // sort descending by start year, detect >9mo gaps between stints
    const sorted = [...dated].sort(
      (a, b) => Number(b.it.startDate!.slice(0, 4)) - Number(a.it.startDate!.slice(0, 4)),
    );
    let gaps = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const prevEnd = sorted[i]!.it.endDate ?? (sorted[i]!.it.current ? "now" : undefined);
      const prevYear =
        prevEnd === "now"
          ? new Date().getFullYear()
          : prevEnd
            ? Number(prevEnd.slice(0, 4))
            : Number(sorted[i]!.it.startDate!.slice(0, 4));
      const nextYear = Number(
        sorted[i + 1]!.it.endDate?.slice(0, 4) ?? sorted[i + 1]!.it.startDate!.slice(0, 4),
      );
      const gap = prevYear - nextYear;
      if (prevEnd && gap >= 1) gaps++;
    }
    if (gaps > 0) {
      push(
        "EMPLOYMENT_GAPS",
        "low",
        `${gaps} gap${gaps > 1 ? "s over a year" : " over a year"} between roles is detectable from your dates.`,
        "You don't owe anyone a story — but a one-line entry (study, care work, freelance, travel) removes parser ambiguity.",
        { sectionKind: "EXPERIENCE" },
      );
    }
    expQuality += dateScore;
  }

  // ── skills ─────────────────────────────────────────────────────────────────
  const skillsSec = doc.sections.find((s) => s.kind === "SKILLS" && s.visible);
  const skills = (skillsSec?.items ?? []).filter((i) => i.visible);
  let skillsScore = 0;
  if (skills.length < 4) {
    push(
      "SKILLS_THIN",
      "medium",
      `${skills.length} skill${skills.length === 1 ? "" : "s"} listed — most keyword screens look for a dozen+ concrete names.`,
      "Add the exact tool/language names you use daily (from your library — don't list things you can't discuss).",
      { sectionKind: "SKILLS" },
    );
    skillsScore = Math.min(10, skills.length * 3);
  } else skillsScore = 10;

  // ── structure & length ─────────────────────────────────────────────────────
  const visibleEmpty = doc.sections.filter(
    (s) => s.visible && s.items.filter((i) => i.visible).length === 0 && s.kind !== "SUMMARY",
  );
  let structScore = 10;
  if (visibleEmpty.length) {
    structScore = Math.max(4, 10 - visibleEmpty.length * 2);
    push(
      "EMPTY_SECTIONS",
      "low",
      `${visibleEmpty.length} visible section${visibleEmpty.length > 1 ? "s are" : " is"} empty (${visibleEmpty.map((s) => s.title ?? s.kind.toLowerCase()).join(", ")}).`,
      "Hide them with the section toggle — blank headers read as unfinished.",
      { evidence: visibleEmpty.map((s) => s.kind).join(",") },
    );
  }
  const totalWords =
    words(doc.summary ?? "").length +
    doc.sections.reduce(
      (acc, s) =>
        acc +
        s.items.reduce((a, i) => a + itemBullets(i).reduce((x, b) => x + words(b).length, 0), 0),
      0,
    );
  let lenScore = 10;
  if (totalWords > 900 && expItems.length >= 6) {
    lenScore = 5;
    push(
      "TOO_DENSE",
      "medium",
      `~${totalWords} words across ${expItems.length} roles — most readers stop at the top two roles.`,
      "Keep recent roles detailed; compress anything >10 years old to one line, or use the compact template.",
      { sectionKind: "EXPERIENCE" },
    );
  }

  const breakdown: AnalysisBreakdown = {
    contact: {
      earned: contactScore,
      possible: 10,
      note: missing.length ? `missing: ${missing.join(", ")}` : "complete",
    },
    summary: {
      earned: summaryScore,
      possible: 10,
      note: doc.summary ? `${summaryWords} words` : "absent (optional)",
    },
    experience: {
      earned: expQuality,
      possible: expPossible,
      note: expItems.length ? `${expItems.length} roles` : "no roles",
    },
    skills: { earned: skillsScore, possible: 10, note: `${skills.length} entries` },
    structure: {
      earned: structScore,
      possible: 10,
      note: visibleEmpty.length ? "empty visible sections" : "clean",
    },
    length: { earned: lenScore, possible: 10, note: `~${totalWords} words in bullets/summary` },
  };
  const earnedTotal = Object.values(breakdown).reduce((a, b) => a + b.earned, 0);
  const possibleTotal = Object.values(breakdown).reduce((a, b) => a + b.possible, 0);
  const score = Math.max(2, Math.min(100, Math.round((earnedTotal / possibleTotal) * 100)));

  const order: Record<IssueSeverity, number> = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return { score, breakdown, issues, engineVersion: ATS_ENGINE_VERSION };
}

/** Human-readable component labels for the UI. */
export const BREAKDOWN_LABELS: Record<keyof AnalysisBreakdown & string, string> = {
  contact: "Reachability",
  summary: "Summary",
  experience: "Experience quality",
  skills: "Skills breadth",
  structure: "Structure",
  length: "Length",
};

export type { SectionItem };
