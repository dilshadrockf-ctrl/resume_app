import type { ResumeDocument } from "@/lib/resume/document";

/**
 * Cover-letter scaffolds (§42) — pure template assembly from the user's own
 * resume facts. No AI claims, no invented achievements: every sentence is
 * generated from data on the resume or left as an explicit [PLACEHOLDER] the
 * user must replace.
 */

export type Tone =
  "PROFESSIONAL" | "CONCISE" | "TRADITIONAL" | "TECHNICAL" | "EXECUTIVE" | "FRIENDLY";
export type Length = "SHORT" | "STANDARD" | "DETAILED";

const OPENERS: Record<Tone, (role: string, company: string, hm: string) => string> = {
  PROFESSIONAL: (r, c, hm) => `Dear ${hm},\n\nI am writing to apply for the ${r} position at ${c}.`,
  CONCISE: (r, c, hm) => `Dear ${hm},\n\nApplying for the ${r} role at ${c}.`,
  TRADITIONAL: (r, c, hm) =>
    `Dear ${hm},\n\nI wish to submit my candidacy for the position of ${r} at ${c}.`,
  TECHNICAL: (r, c, hm) =>
    `Dear ${hm},\n\nThe ${r} role at ${c} lines up closely with what I have been building — notes below.`,
  EXECUTIVE: (r, c, hm) =>
    `Dear ${hm},\n\nI am applying for the ${r} position at ${c}, where outcomes and ownership matter most.`,
  FRIENDLY: (r, c, hm) => `Hi ${hm},\n\nThe ${r} role at ${c} caught my eye — here is why it fits.`,
};

const CLOSERS: Record<Tone, string> = {
  PROFESSIONAL: "Thank you for your time and consideration.\n\nSincerely,",
  CONCISE: "Thanks for your consideration.\n\nBest,",
  TRADITIONAL:
    "I would welcome the opportunity to discuss my qualifications further.\n\nRespectfully,",
  TECHNICAL: "Happy to walk through any of the above in depth.\n\nCheers,",
  EXECUTIVE: "I look forward to a conversation about impact and fit.\n\nKind regards,",
  FRIENDLY: "Would love to chat if it looks like a fit.\n\nBest,",
};

function topWins(doc: ResumeDocument, max: number): string[] {
  const bullets: string[] = [];
  for (const sec of doc.sections) {
    if (!sec.visible) continue;
    for (const item of sec.items) {
      if (!item.visible) continue;
      const i = item as unknown as { bullets?: string[]; achievements?: string[] };
      for (const b of [...(i.bullets ?? []), ...(i.achievements ?? [])]) {
        if (b.trim().length > 20) bullets.push(b.trim());
      }
    }
  }
  // prefer quantified bullets
  bullets.sort((a, b) => score(b) - score(a));
  return bullets.slice(0, max);
}
function score(b: string) {
  return (/\d/.test(b) ? 2 : 0) + (b.length > 40 && b.length < 180 ? 1 : 0);
}

export function scaffoldLetter(input: {
  doc: ResumeDocument;
  company: string;
  role: string;
  hiringManager?: string;
  tone: Tone;
  length: Length;
  jobSnippets?: string[];
}): string {
  const hm = input.hiringManager?.trim() || "Hiring Manager";
  const opener = OPENERS[input.tone](input.role, input.company, hm);
  const count = input.length === "SHORT" ? 2 : input.length === "STANDARD" ? 3 : 5;
  const wins = topWins(input.doc, count);
  const headline = input.doc.contact.headline ? `${input.doc.contact.headline}. ` : "";
  const name = input.doc.contact.fullName || "[YOUR NAME]";

  const middle = wins.length
    ? `In recent roles I have:\n${wins.map((w) => `• ${w}`).join("\n")}\n\n${headline}The details — stack, timeline, and context — are in the attached resume.`
    : `[Add 2–3 concrete results here — the resume has none to reuse. Numbers, scope, outcome.]`;

  const jd = input.jobSnippets?.length
    ? `\n\nWhy this role: ${input.jobSnippets.slice(0, 2).join(" ")} [EDIT: say in your own words why that excites you — only if true.]`
    : "";

  return `${opener}\n\n${middle}${jd}\n\nIf there is a specific problem your team is solving right now, I would enjoy hearing about it — [OPTIONAL: name one real thing from your own experience that maps to it.]\n\n${CLOSERS[input.tone]}\n${name}\n${input.doc.contact.email ?? "[email]"}${input.doc.contact.phone ? ` · ${input.doc.contact.phone}` : ""}`;
}
