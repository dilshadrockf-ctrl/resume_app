import type { ResumeDocument, SectionItem } from "@/lib/resume/document";

/**
 * Honest content checklist (§31/§40): pure, local, deterministic signals —
 * never marketed as an "ATS guarantee". Everything here is advice the user
 * can act on, computed from their own document.
 */

export interface ContentStats {
  wordCount: number;
  bulletCount: number;
  quantifiedBullets: number; // bullets containing digits/percent/$-numbers
  weakStarters: string[]; // bullets starting with "responsible for", "helped", ...
  startedWithActionVerb: number;
  contactComplete: boolean;
  missingContact: string[];
  experienceMonths: number;
  hasSummary: boolean;
  emptySections: string[];
  estimatedLines: number;
  onePageRisk: "low" | "medium" | "high";
  score: number; // 0-100 checklist score
  tips: string[];
}

const WEAK = [
  "responsible for",
  "helped with",
  "worked on",
  "assisted with",
  "tasked with",
  "in charge of",
  "duties included",
];
const ACTION_VERBS = [
  "built",
  "led",
  "launched",
  "designed",
  "shipped",
  "improved",
  "reduced",
  "increased",
  "automated",
  "migrated",
  "scaled",
  "optimized",
  "delivered",
  "created",
  "drove",
  "owned",
  "refactored",
  "implemented",
  "architected",
  "mentored",
  "cut",
  "grew",
  "streamlined",
  "introduced",
  "negotiated",
  "published",
  "patented",
  "saved",
  "accelerated",
  "standardized",
  "consolidated",
  "orchestrated",
  "resolved",
  "diagnosed",
  "deployed",
];
const QUANT =
  /(\d+(\.\d+)?\s?(%|percent|x\b|k\b|m\b|ms\b|hrs?|hours?|days?|weeks?|months?|years?|\$)|\$[\d,.]+|\b[A-Z]?[a-z]*\d{2,}\b)/;

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function computeStats(doc: ResumeDocument): ContentStats {
  const tips: string[] = [];
  let wordCount = 0;
  let bulletCount = 0;
  let quantified = 0;
  let actionStart = 0;
  let weakCount = 0;
  let experienceMonths = 0;

  const allBullets: string[] = [];
  const visit = (s: string) => {
    allBullets.push(s);
  };

  const missingContact: string[] = [];
  if (!doc.contact.email) missingContact.push("email");
  if (!doc.contact.phone) missingContact.push("phone");
  if (!doc.contact.location) missingContact.push("location");
  const contactComplete = missingContact.length === 0;

  for (const section of doc.sections) {
    if (!section.visible) continue;
    const items = section.items.filter((i) => i.visible);
    if (items.length === 0 && section.kind !== "SUMMARY") {
      continue; // empty sections are just hidden by the editor flow
    }
    switch (section.kind) {
      case "SUMMARY":
        break;
      case "EXPERIENCE":
        for (const it of items as Array<Extract<SectionItem, { kind: "experience" }>>) {
          wordCount += words(it.description ?? "") + it.bullets.reduce((a, b) => a + words(b), 0);
          it.bullets.forEach(visit);
          it.achievements.forEach(visit);
          experienceMonths += monthSpan(it.startDate, it.endDate, it.current);
        }
        break;
      case "EDUCATION":
        for (const it of items as Array<Extract<SectionItem, { kind: "education" }>>) {
          wordCount += words(it.description ?? "");
        }
        break;
      case "PROJECTS":
        for (const it of items as Array<Extract<SectionItem, { kind: "project" }>>) {
          wordCount += words(it.description ?? "") + it.bullets.reduce((a, b) => a + words(b), 0);
          it.bullets.forEach(visit);
        }
        break;
      case "VOLUNTEER":
        for (const it of items as Array<Extract<SectionItem, { kind: "volunteer" }>>) {
          it.bullets.forEach(visit);
          wordCount += words(it.description ?? "") + it.bullets.reduce((a, b) => a + words(b), 0);
        }
        break;
      case "SKILLS":
        wordCount += (items as Array<Extract<SectionItem, { kind: "skill" }>>).length;
        break;
      default:
        for (const it of items) {
          if ("blurb" in it && typeof it.blurb === "string") wordCount += words(it.blurb);
          if ("items" in it && Array.isArray(it.items))
            wordCount += (it.items as string[]).reduce((a, b) => a + words(b), 0);
        }
    }
  }
  wordCount += words(doc.summary);

  for (const b of allBullets) {
    if (!b.trim()) continue;
    bulletCount++;
    if (QUANT.test(b)) quantified++;
    const first = b.trim().toLowerCase().split(/\s+/)[0] ?? "";
    if (ACTION_VERBS.includes(first)) actionStart++;
    if (WEAK.some((w) => b.trim().toLowerCase().startsWith(w))) {
      weakCount++;
    }
  }
  const weakStarters = allBullets
    .filter((b) => WEAK.some((w) => b.trim().toLowerCase().startsWith(w)))
    .slice(0, 4);

  const hasSummary = doc.summary.trim().length > 30;
  const emptySections: string[] = [];
  for (const s of doc.sections) {
    if (s.visible && s.kind !== "SUMMARY" && s.items.filter((i) => i.visible).length === 0)
      emptySections.push(s.title ?? s.kind);
  }

  // rough single-page estimate: ~14 lines/inch header+sections
  const estimatedLines = Math.round(
    6 + // header
      (hasSummary ? Math.max(2, Math.ceil(words(doc.summary) / 13)) : 0) +
      bulletCount * 1.8 +
      allBullets.reduce((a, b) => a + (words(b) > 24 ? 0.7 : 0), 0) +
      doc.sections.filter((s) => s.visible && s.items.some((i) => i.visible)).length * 1.6,
  );
  const onePageRisk: ContentStats["onePageRisk"] =
    estimatedLines <= 46 ? "low" : estimatedLines <= 56 ? "medium" : "high";

  let score = 0;
  if (contactComplete) score += 10;
  else tips.push("Add phone number and location — most screening forms parse them.");
  if (hasSummary) score += 10;
  else tips.push("Write a 2–3 line summary above your experience.");
  if (experienceMonths > 0) score += 10;
  if (bulletCount >= 6) score += 10;
  else tips.push("Aim for 3–5 outcome bullets per recent role.");
  if (bulletCount === 0 || quantified / Math.max(1, bulletCount) >= 0.4) score += 20;
  else
    tips.push(
      `Only ${quantified}/${bulletCount} bullets have numbers — quantify impact (%, $, time saved).`,
    );
  if (bulletCount === 0 || actionStart / Math.max(1, bulletCount) >= 0.6) score += 15;
  else tips.push("Start bullets with action verbs (built, led, reduced…).");
  if (weakCount === 0) score += 10;
  else tips.push(`Replace ${weakCount} "responsible for / helped with" openers with action verbs.`);
  if (onePageRisk !== "high") score += 15;
  else tips.push(`About ${estimatedLines} lines — trim to one page or prune older roles.`);
  if (emptySections.length)
    tips.push(`Remove or fill empty sections: ${emptySections.join(", ")}.`);
  score = Math.max(5, Math.min(100, Math.round(score * (emptySections.length ? 0.95 : 1))));

  return {
    wordCount,
    bulletCount,
    quantifiedBullets: quantified,
    weakStarters,
    startedWithActionVerb: actionStart,
    contactComplete,
    missingContact,
    experienceMonths,
    hasSummary,
    emptySections,
    estimatedLines,
    onePageRisk,
    score,
    tips: tips.slice(0, 6),
  };
}

function monthSpan(start?: string | null, end?: string | null, current?: boolean): number {
  if (!start) return 0;
  const [sy, sm] = start.split("-").map((x) => parseInt(x, 10));
  const s = (sy ?? 0) * 12 + ((sm ?? 1) - 1);
  let e: number;
  if (current || !end) {
    const now = new Date();
    e = now.getFullYear() * 12 + now.getMonth();
  } else {
    const [ey, em] = end.split("-").map((x) => parseInt(x, 10));
    e = (ey ?? 0) * 12 + ((em ?? 1) - 1);
  }
  return Math.max(0, e - s);
}
