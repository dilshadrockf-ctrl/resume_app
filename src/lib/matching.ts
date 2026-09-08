import type { ResumeDocument, SectionItem } from "@/lib/resume/document";

/**
 * Deterministic, explainable job↔resume matching — no AI required, nothing
 * hidden. Scores are broken into components with the exact evidence used, and
 * recommendations may only ever surface facts the candidate already has
 * (§16: never invent experience).
 */

// ─────────────────────────── keyword vocabulary ──────────────────────────────

/** Curated vocabulary of things that appear in JDs and are checkable as
 *  keywords. Keep it honest: coverage means the term literally appears in the
 *  resume text (or skills keywords) — a good proxy, not a promise. */
const VOCAB = [
  // languages / runtimes
  "typescript",
  "javascript",
  "python",
  "go",
  "golang",
  "rust",
  "java",
  "kotlin",
  "swift",
  "scala",
  "ruby",
  "php",
  "c++",
  "c#",
  "sql",
  "bash",
  "react",
  "next.js",
  "vue",
  "angular",
  "svelte",
  "node.js",
  "nodejs",
  "express",
  "django",
  "flask",
  "fastapi",
  "spring",
  "rails",
  // data
  "pandas",
  "numpy",
  "spark",
  "databricks",
  "airflow",
  "dbt",
  "kafka",
  "flink",
  "redis",
  "postgresql",
  "mysql",
  "mongodb",
  "dynamodb",
  "elasticsearch",
  "snowflake",
  "bigquery",
  "redshift",
  "etl",
  "data pipeline",
  "data modeling",
  "analytics",
  "machine learning",
  "deep learning",
  "llm",
  "nlp",
  "computer vision",
  "statistics",
  "a/b testing",
  "experimentation",
  // infra / devops
  "aws",
  "gcp",
  "azure",
  "kubernetes",
  "docker",
  "terraform",
  "ansible",
  "helm",
  "ci/cd",
  "jenkins",
  "github actions",
  "gitlab",
  "cloudformation",
  "serverless",
  "lambda",
  "s3",
  "ec2",
  "eks",
  "monitoring",
  "observability",
  "prometheus",
  "grafana",
  "datadog",
  "sentry",
  "opentelemetry",
  "incident response",
  "on-call",
  "sre",
  "devops",
  "platform engineering",
  "security",
  "iam",
  "penetration testing",
  "encryption",
  "oauth",
  "compliance",
  "soc2",
  "hipaa",
  "gdpr",
  "pci",
  // engineering practices
  "microservices",
  "rest",
  "graphql",
  "grpc",
  "websockets",
  "distributed systems",
  "system design",
  "event-driven",
  "cqrs",
  "eda",
  "unit testing",
  "integration testing",
  "e2e testing",
  "tdd",
  "test coverage",
  "code review",
  "refactoring",
  "performance tuning",
  "optimization",
  "scalability",
  "high availability",
  "caching",
  "load balancing",
  // frontend craft
  "accessibility",
  "wcag",
  "responsive design",
  "css",
  "tailwind",
  "sass",
  "webpack",
  "vite",
  "state management",
  "redux",
  "animation",
  "i18n",
  "seo",
  // mobile
  "ios",
  "android",
  "react native",
  "flutter",
  "swiftui",
  "compose",
  // product / process
  "agile",
  "scrum",
  "kanban",
  "roadmap",
  "stakeholder",
  "cross-functional",
  "product-led",
  "user research",
  "usability",
  "prioritization",
  "mentoring",
  "tech lead",
  "team lead",
  "b2b",
  "b2c",
  "saas",
  "marketplace",
  "fintech",
  "e-commerce",
  "healthcare",
  "adtech",
  "devtools",
  "open source",
  // mgmt & leadership
  "hiring",
  "recruiting",
  "performance review",
  "career development",
  "org design",
  "headcount",
  "budget",
  "vendor management",
  "partnership",
  // misc checkable
  "git",
  "linux",
  "regex",
  "excel",
  "tableau",
  "looker",
  "power bi",
  "jira",
  "confluence",
  "figma",
];

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "you",
  "our",
  "are",
  "this",
  "that",
  "will",
  "have",
  "from",
  "your",
  "they",
  "their",
  "been",
  "were",
  "what",
  "when",
  "who",
  "how",
  "why",
  "all",
  "any",
  "can",
  "may",
  "must",
  "should",
  "would",
  "could",
]);

export interface JdSignals {
  /** matched vocabulary terms with occurrence weights */
  keywords: Array<{ term: string; weight: number; context: "required" | "preferred" | "plain" }>;
  /** raw requirement lines, verbatim evidence */
  requirements: string[];
  titleWords: string[];
}

export function extractJdSignals(jd: string, title = ""): JdSignals {
  const lower = jd.toLowerCase();
  const lines = jd.split(/\r?\n/);
  const requiredLines = lines
    .filter((l) =>
      /\b(must|required|minimum|at least|expertise in|deep (knowledge|experience)|years? of)\b/i.test(
        l,
      ),
    )
    .map((l) => l.toLowerCase());
  const preferredLines = lines
    .filter((l) => /\b(nice to have|bonus|preferred|plus\b|familiarity)\b/i.test(l))
    .map((l) => l.toLowerCase());

  const keywords: JdSignals["keywords"] = [];
  for (const term of VOCAB) {
    const count = countOccurrences(lower, term);
    if (count === 0) continue;
    const inReq = requiredLines.some((l) => l.includes(term));
    const inPref = preferredLines.some((l) => l.includes(term));
    keywords.push({
      term,
      weight: Math.min(4, count) + (inReq ? 2 : inPref ? 1 : 0),
      context: inReq ? "required" : inPref ? "preferred" : "plain",
    });
  }
  // extra capitalized phrases (company-specific tech), max 20
  const phrases = new Map<string, number>();
  for (const m of jd.matchAll(/\b([A-Z][A-Za-z0-9+#./-]{2,}(?: [A-Z][A-Za-z0-9+#./-]{1,})?)\b/g)) {
    const t = m[1]!.toLowerCase();
    if (STOP.has(t) || t.length < 4) continue;
    if (VOCAB.includes(t)) continue;
    phrases.set(t, (phrases.get(t) ?? 0) + 1);
  }
  for (const [term, c] of [...phrases.entries()].filter(([, n]) => n >= 2).slice(0, 20)) {
    keywords.push({ term, weight: Math.min(3, c), context: "plain" });
  }
  keywords.sort((a, b) => b.weight - a.weight);

  const requirements = lines
    .map((l) => l.replace(/^\s*[•·\-–*]\s*/, "").trim())
    .filter(
      (l) =>
        l.length > 15 &&
        l.length < 220 &&
        /required|experience|skills|ability|knowledge|strong|familiar|background|degree|years/i.test(
          l,
        ),
    )
    .slice(0, 25);

  const titleWords = (title || " ")
    .toLowerCase()
    .replace(/[^a-z0-9 +/]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

  return { keywords: keywords.slice(0, 80), requirements, titleWords };
}

function countOccurrences(haystack: string, needle: string): number {
  let i = 0;
  let n = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    const before = i === 0 ? " " : haystack[i - 1]!;
    const afterIdx = i + needle.length;
    const after = afterIdx >= haystack.length ? " " : haystack[afterIdx]!;
    const boundaryOk = !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
    if (boundaryOk) n++;
    i = afterIdx;
  }
  return n;
}

// ───────────────────────────── resume side ───────────────────────────────────

export function resumeTextForMatching(doc: ResumeDocument): string {
  const parts: string[] = [doc.contact.fullName, doc.contact.headline ?? "", doc.summary];
  for (const sec of doc.sections) {
    for (const item of sec.items) {
      const i = item as unknown as Record<string, unknown>;
      for (const key of [
        "title",
        "employer",
        "role",
        "name",
        "institution",
        "organization",
        "degree",
        "field",
        "description",
        "projectNote",
        "headline",
      ]) {
        if (typeof i[key] === "string") parts.push(i[key] as string);
      }
      for (const key of [
        "bullets",
        "achievements",
        "technologies",
        "skillsUsed",
        "keywords",
        "items",
        "coursework",
        "activities",
        "authors",
      ]) {
        if (Array.isArray(i[key])) parts.push((i[key] as unknown[]).map(String).join(" "));
      }
    }
  }
  return parts.filter(Boolean).join("\n").toLowerCase();
}

export interface MatchResult {
  score: number; // 0-100
  breakdown: {
    keywordCoverage: {
      earned: number;
      possible: number;
      matched: string[];
      missing: string[];
      requiredMissing: string[];
    };
    titleAlignment: { overlap: number; note: string };
    structureFit: { present: string[]; suggested: string[] };
    recency: { note: string };
  };
}

export function scoreMatch(doc: ResumeDocument, signals: JdSignals): MatchResult {
  const text = resumeTextForMatching(doc);
  let earned = 0;
  let possible = 0;
  const matched: string[] = [];
  const missing: string[] = [];
  const requiredMissing: string[] = [];
  for (const kw of signals.keywords) {
    possible += kw.weight;
    if (text.includes(kw.term)) {
      earned += kw.weight;
      matched.push(kw.term);
    } else {
      missing.push(kw.term);
      if (kw.context === "required") requiredMissing.push(kw.term);
    }
  }
  const coverageRatio = possible ? earned / possible : 0.5;

  const currentTitles = new Set<string>();
  for (const it of doc.sections.flatMap((s) => s.items) as SectionItem[]) {
    const i = it as unknown as Record<string, unknown>;
    if (typeof i.title === "string") currentTitles.add(i.title.toLowerCase());
    if (typeof i.role === "string") currentTitles.add(i.role.toLowerCase());
  }
  if (doc.contact.headline) currentTitles.add(doc.contact.headline.toLowerCase());
  let overlap = 0;
  for (const w of signals.titleWords) {
    if ([...currentTitles].some((t) => t.includes(w))) overlap++;
  }
  const titleRatio = signals.titleWords.length ? overlap / signals.titleWords.length : 0.5;

  const present = new Set(
    doc.sections.filter((s) => s.visible && s.items.some((i) => i.visible)).map((s) => s.kind),
  );
  const wantedSections = ["EXPERIENCE", "SKILLS"];
  if (signals.keywords.some((k) => /spark|airflow|etl|pipeline|data/.test(k.term)))
    wantedSections.push("PROJECTS");
  const structureOk = wantedSections.every((k) => present.has(k as never));
  const structureExtra = [...present].filter(
    (k) => !wantedSections.includes(k) && k !== "EDUCATION" && k !== "SUMMARY",
  ).length;

  const score = Math.round(
    100 *
      (0.65 * coverageRatio +
        0.2 * titleRatio +
        0.1 * (structureOk ? 1 : 0.4) +
        0.05 * Math.min(1, structureExtra / 2)),
  );

  return {
    score: Math.max(2, Math.min(100, score)),
    breakdown: {
      keywordCoverage: {
        earned,
        possible,
        matched: matched.slice(0, 40),
        missing: missing.slice(0, 40),
        requiredMissing: requiredMissing.slice(0, 12),
      },
      titleAlignment: {
        overlap,
        note: `${overlap}/${signals.titleWords.length || 0} title words appear in your roles/headline`,
      },
      structureFit: {
        present: [...present],
        suggested: wantedSections.filter((k) => !present.has(k as never)),
      },
      recency: {
        note: "Coverage counts text anywhere in the resume; keep must-haves near the top.",
      },
    },
  };
}

// ─────────────────────────── recommendations ─────────────────────────────────

export type RecoDraft = {
  sectionKind: string;
  action: "ADD_KEYWORD" | "PRIORITY_SKILLS" | "REORDER_ENTRIES" | "REWRITE_SUMMARY" | "GENERIC";
  rationale: string;
  entryRef?: string;
  suggested?: string;
  original?: string;
};

/**
 * Only factual moves: the engine looks for evidence already inside the user's
 * library (hidden items or other sections) and proposes surfacing it. If the
 * term isn't anywhere in their material, it says so honestly instead of
 * suggesting fabrication.
 */
export function buildMatchRecommendations(
  signals: JdSignals,
  doc: ResumeDocument,
  libraryText: string,
): RecoDraft[] {
  const out: RecoDraft[] = [];
  const text = resumeTextForMatching(doc);
  const missing = signals.keywords.filter((k) => !text.includes(k.term)).slice(0, 8);
  for (const kw of missing) {
    if (libraryText.toLowerCase().includes(kw.term)) {
      out.push({
        sectionKind: "SKILLS",
        action: "ADD_KEYWORD",
        rationale: `“${kw.term}” is in this job post and already appears somewhere in your career profile — surface it on this resume instead of typing something new.`,
      });
    } else {
      out.push({
        sectionKind: "SKILLS",
        action: "GENERIC",
        rationale: `This role emphasizes “${kw.term}”, which is nowhere in your material. If you have that experience, add it as a real bullet — otherwise skip this; padding hurts in interviews.`,
      });
    }
    if (out.length >= 8) break;
  }
  if (signals.requirements.length && !doc.summary.trim()) {
    out.push({
      sectionKind: "SUMMARY",
      action: "REWRITE_SUMMARY",
      rationale:
        "A 2-line summary mirroring the role's focus (using only your true experience) gives every listed requirement a place to hook into.",
    });
  }
  return out;
}
