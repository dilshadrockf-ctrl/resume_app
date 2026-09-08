import type {
  Contact,
  ResumeDocument,
  SectionItem,
  SectionKind,
  TemplateConfig,
} from "@/lib/resume/document";
import { cleanDate, formatRange, monthsBetween } from "@/lib/resume/dates";
import {
  effectiveLayout,
  getTemplate,
  type TemplateDefinition,
  type TemplateLayoutSpec,
} from "@/templates/catalog";

/**
 * Block builder: ResumeDocument + template -> presentation-agnostic blocks.
 * React preview, PDF, DOCX and ATS-text renderers all consume this output so
 * content can never drift between views (§30, §107).
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  size?: number; // pt — relative scale already applied
  color?: string;
  link?: string;
  mono?: boolean;
}

export type Block =
  | { type: "paragraph"; runs: Run[]; align?: "left" | "center"; spaceBefore?: number; spaceAfter?: number }
  | { type: "entry"; block: EntryBlock }
  | { type: "skill-group"; label: string; items: string[] }
  | { type: "bullet-list"; items: Run[][] }
  | { type: "spacer"; size: number };

export interface HeaderBlock {
  name: string;
  headlineRuns: Run[] | null;
  contactRuns: Run[];
  align: "left" | "center";
  variant: "left" | "centered" | "stacked" | "banner";
  accent: string;
  photoKey?: string;
}

export interface EntryBlock {
  left: Run[]; // main title (e.g. "Senior Engineer, Northwind")
  secondary?: Run[]; // e.g. location / type / advisor
  right?: string; // dates
  rightSub?: string; // location when below
  paragraphs: Run[][];
  bullets: Run[][];
  tags?: string;
}

export interface RenderSection {
  kind: SectionKind;
  title: string;
  blocks: Block[];
}

export interface RenderDoc {
  templateId: string;
  templateVersion: number;
  paperSize: "A4" | "LETTER";
  accent: string;
  textColor: string;
  baseFont: TemplateConfig["baseFont"];
  fontSize: number;
  lineHeight: number;
  bullet: TemplateConfig["bulletStyle"];
  marginPt: { x: number; y: number };
  layout: TemplateLayoutSpec;
  header: HeaderBlock | null;
  summaryRuns: Run[][] | null;
  main: RenderSection[];
  rail: RenderSection[];
  columns: 1 | 2;
  railBg: string | null;
  headingAlign: "left" | "center";
  stats: DocStats;
}

export interface DocStats {
  wordCount: number;
  bulletCount: number;
  entryCount: number;
}

const densityScale = (d: TemplateConfig["density"]) =>
  d === "dense" ? 0.86 : d === "compact" ? 0.93 : 1;

function style(doc: ResumeDocument, def: TemplateDefinition, config: TemplateConfig) {
  const { layout, headingCase } = effectiveLayout(def, config);
  const scale = config.fontScale * layout.baseSizeScale;
  const lineHeight = config.fontSize * config.lineHeight;
  const spacing = layout.spacingScale * densityScale(config.density);
  const marginBase = { A4: 42, LETTER: 44 }[doc.meta.paperSize];
  const margin = {
    A4: { w: 595.28, h: 841.89 },
    LETTER: { w: 612, h: 792 },
  }[doc.meta.paperSize];
  return {
    layout,
    headingCase,
    size: (pt: number) => round2(pt * scale),
    lineHeight: round2(lineHeight),
    spacing,
    contentWidth: round2(margin.w - 2 * (marginBase / config.marginScale)),
    page: margin,
    marginPt: { x: round2(marginBase / config.marginScale), y: round2(marginBase / config.marginScale) },
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function caseTitle(title: string, c: "uppercase" | "title-case"): string {
  if (c === "uppercase") return title.toUpperCase();
  return title.replace(/\b\w/g, (ch) => ch);
}

function contactRuns(contact: Contact, style: { size: (pt: number) => number }): Run[] {
  const runs: Run[] = [];
  const push = (text?: string, link?: string) => {
    if (!text) return;
    if (runs.length) runs.push({ text: "  •  " });
    runs.push({ text, link });
  };
  push(contact.email, contact.email ? `mailto:${contact.email}` : undefined);
  push(contact.phone);
  push(contact.location);
  push(contact.website, maybeUrl(contact.website));
  push(contact.linkedin, maybeUrl(contact.linkedin));
  push(contact.github, maybeUrl(contact.github));
  return runs;
}

function maybeUrl(v?: string): string | undefined {
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^([\w.-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v)) return `https://${v}`;
  return undefined;
}

function runsFor(item: SectionItem, config: TemplateConfig, s: ReturnType<typeof style>): {
  entry: EntryBlock;
  keywords: string[];
} {
  const dateFmt =
    s.layout.datePlacement === "below" ? "below" : ("right" as const);
  const kw: string[] = [];
  switch (item.kind) {
    case "experience": {
      const title = item.title;
      const employer = item.employer;
      const left: Run[] =
        s.layout.entryTitleFormat === "title-employer"
          ? [{ text: title, bold: true }, { text: `, ${employer}` }]
          : [{ text: employer, bold: true }, { text: `, ${title}` }];
      const range = formatRange(cleanDate(item.startDate), cleanDate(item.endDate), item.current);
      const months = monthsBetween(cleanDate(item.startDate), cleanDate(item.endDate), item.current);
      const secondary: Run[] = [];
      if (item.location) secondary.push({ text: item.location });
      if (typeLabel(item.employmentType) && item.employmentType !== "FULL_TIME") {
        if (secondary.length) secondary.push({ text: "  •  " });
        secondary.push({ text: typeLabel(item.employmentType) });
      }
      item.bullets.forEach((b) => kw.push(b));
      item.achievements.forEach((a) => kw.push(a));
      (item.technologies ?? []).forEach((t) => kw.push(t));
      return {
        entry: {
          left,
          secondary: secondary.length ? secondary : undefined,
          right: range || undefined,
          rightSub: item.location && dateFmt === "below" ? item.location : undefined,
          paragraphs: item.description ? [[{ text: item.description }]] : [],
          bullets: [...(item.bullets ?? []), ...(item.achievements ?? [])].map((b) => [{ text: b }]),
          tags: item.technologies?.length ? `Tech: ${item.technologies.join(", ")}` : undefined,
        },
        keywords: kw,
      };
    }
    case "education": {
      const left: Run[] = [{ text: item.institution, bold: s.layout.entryTitleFormat !== "employer-title" }];
      if (!left[0]!.bold) left[0]!.bold = true;
      const degree = [item.degree, item.field].filter(Boolean).join(" in ");
      if (degree) {
        left.push({ text: `, ${degree}` });
      }
      const range = formatRange(cleanDate(item.startDate), cleanDate(item.endDate), item.current);
      const secondary: Run[] = [];
      if (item.location) secondary.push({ text: item.location });
      if (item.gpa) {
        if (secondary.length) secondary.push({ text: "  •  " });
        secondary.push({ text: `GPA ${item.gpa}` });
      }
      if (item.honors) {
        if (secondary.length) secondary.push({ text: "  •  " });
        secondary.push({ text: item.honors, italic: true });
      }
      const bullets: Run[][] = [];
      if (item.coursework?.length) bullets.push([{ text: `Coursework: `, bold: true }, { text: item.coursework.join(", ") }]);
      if (item.activities?.length) bullets.push([{ text: `Activities: `, bold: true }, { text: item.activities.join(", ") }]);
      return {
        entry: {
          left,
          secondary: secondary.length ? secondary : undefined,
          right: range || undefined,
          paragraphs: item.description ? [[{ text: item.description }]] : [],
          bullets,
        },
        keywords: [item.degree ?? "", item.field ?? ""].filter(Boolean),
      };
    }
    case "project": {
      const left: Run[] = [{ text: item.name, bold: true }];
      if (item.role) left.push({ text: ` — ${item.role}` });
      const range = formatRange(cleanDate(item.startDate), cleanDate(item.endDate));
      (item.technologies ?? []).forEach((t) => kw.push(t));
      return {
        entry: {
          left,
          secondary: item.url ? [{ text: item.url, link: item.url, color: undefined }] : undefined,
          right: range || undefined,
          paragraphs: item.description ? [[{ text: item.description }]] : [],
          bullets: (item.bullets ?? []).map((b) => [{ text: b }]),
          tags: item.technologies?.length ? item.technologies.join(", ") : undefined,
        },
        keywords: kw,
      };
    }
    case "certification": {
      const left: Run[] = [{ text: item.name, bold: true }];
      if (item.issuer) left.push({ text: ` — ${item.issuer}` });
      const range = item.inProgress
        ? "In progress"
        : formatRange(cleanDate(item.issueDate), cleanDate(item.expiryDate));
      if (item.url) kw.push(item.url);
      return {
        entry: {
          left,
          right: range || undefined,
          paragraphs: [],
          bullets: item.credentialId ? [[{ text: `Credential ID: ${item.credentialId}` }]] : [],
        },
        keywords: [item.name, item.issuer ?? ""].filter(Boolean),
      };
    }
    case "award": {
      const left: Run[] = [{ text: item.title, bold: true }];
      if (item.issuer) left.push({ text: ` — ${item.issuer}` });
      return {
        entry: {
          left,
          right: item.date ? formatPartial(item.date) : undefined,
          paragraphs: item.blurb ? [[{ text: item.blurb }]] : [],
          bullets: [],
        },
        keywords: [item.title],
      };
    }
    case "publication": {
      const left: Run[] = [{ text: item.authors?.length ? `${item.authors.join(", ")}. ` : "" }, { text: `"${item.title}."`, bold: true }];
      if (item.publisher) left.push({ text: ` ${item.publisher}.` });
      if (item.date) left.push({ text: ` (${item.date.slice(0, 4)}).` });
      return {
        entry: {
          left,
          right: item.url || undefined,
          paragraphs: item.blurb ? [[{ text: item.blurb }]] : [],
          bullets: [],
        },
        keywords: [item.title, item.publisher ?? ""].filter(Boolean),
      };
    }
    case "language": {
      const left: Run[] = [{ text: item.name, bold: true }];
      if (item.proficiency) left.push({ text: ` — ${item.proficiency}` });
      return { entry: { left, paragraphs: [], bullets: [] }, keywords: [item.name] };
    }
    case "volunteer": {
      const left: Run[] = [{ text: item.role, bold: true }, { text: `, ${item.organization}` }];
      const range = formatRange(cleanDate(item.startDate), cleanDate(item.endDate), item.current);
      return {
        entry: {
          left,
          secondary: item.location ? [{ text: item.location }] : undefined,
          right: range || undefined,
          paragraphs: item.description ? [[{ text: item.description }]] : [],
          bullets: (item.bullets ?? []).map((b) => [{ text: b }]),
        },
        keywords: [item.role, item.organization],
      };
    }
    case "custom": {
      return {
        entry: {
          left: [],
          paragraphs: (item.items ?? []).map((line) => [{ text: line }]),
          bullets: [],
        },
        keywords: [...(item.items ?? [])],
      };
    }
    default:
      return {
        entry: { left: [], paragraphs: (item as unknown as { description?: string }).description ? [[{ text: String((item as unknown as { description?: string }).description) }]] : [], bullets: [] },
        keywords: [],
      };
  }
}

function formatPartial(d: string): string {
  return d;
}

function typeLabel(t: string): string {
  return t
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ")
    .replace("Bounded Volunteer", "Volunteer");
}

export function buildRenderDoc(doc: ResumeDocument, overrides?: Partial<TemplateConfig>): RenderDoc {
  const def = getTemplate(doc.meta.templateId);
  const config = { ...def.defaultConfig, ...doc.meta.config, ...overrides } as TemplateConfig;
  const s = style(doc, def, config);
  const { layout, headingCase } = s;
  const accent = config.atsSafe || def.ats === "excellent" ? "#111827" : config.accentColor;

  const contactList = contactRuns(doc.contact, s).map((r) => ({ ...r, size: s.size(config.fontSize * 0.92) }) as Run);
  const headline = doc.contact.headline?.trim()
    ? [
        {
          text: doc.contact.headline,
          size: s.size(config.fontSize * 1.18),
          color: config.atsSafe || def.ats === "excellent" ? "#374151" : accent,
          bold: true,
        } as Run,
      ]
    : null;

  const header: RenderDoc["header"] = {
    name: doc.contact.fullName,
    headlineRuns: headline,
    contactRuns: contactList,
    align: layout.header === "centered" || layout.header === "banner" ? "center" : "left",
    variant: layout.header,
    accent,
    photoKey: undefined,
  };

  const summary = doc.summary.trim();
  const summaryRuns: Run[][] | null = summary ? [[{ text: summary }]] : null;

  const main: RenderSection[] = [];
  const rail: RenderSection[] = [];

  const ordered = [...doc.sections].sort((a, b) => a.order - b.order);

  for (const section of ordered) {
    if (!section.visible) continue;
    const visibleItems = section.items.filter((i) => i.visible);
    if (visibleItems.length === 0 && section.kind !== "SUMMARY") continue;
    const blocks: Block[] = [];
    if (section.kind === "SKILLS") {
      const skills = visibleItems.filter((i): i is Extract<SectionItem, { kind: "skill" }> => i.kind === "skill");
      const fmt = config.atsSafe ? "grouped-inline" : config.skillFormat;
      if (fmt === "inline") {
        blocks.push({
          type: "paragraph",
          runs: [{ text: skills.map((sk) => sk.name).join(" • ") }],
        });
      } else {
        const groups = new Map<string, string[]>();
        for (const sk of skills) {
          const key = categoryLabel(sk.category);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(sk.name);
        }
        for (const [label, items] of groups) {
          if (fmt === "grouped-lines") {
            blocks.push({ type: "paragraph", runs: [{ text: `${label}: `, bold: true }, { text: items.join(", ") }], spaceAfter: 1 });
          } else {
            blocks.push({ type: "skill-group", label, items });
          }
        }
      }
    } else {
      for (const item of visibleItems) {
        const { entry } = runsFor(item, config, s);
        if (entry.left.length || entry.paragraphs.length) {
          blocks.push({ type: "entry", block: entry });
        }
      }
    }
    const rendered: RenderSection = {
      kind: section.kind,
      title: caseTitle(section.title ?? defaultSectionTitle(section.kind), headingCase),
      blocks,
    };
    if (layout.columns === 2 && layout.rail.includes(section.kind) && !config.atsSafe) {
      rail.push(rendered);
    } else {
      main.push(rendered);
    }
  }

  return {
    templateId: def.id,
    templateVersion: def.version,
    paperSize: doc.meta.paperSize,
    accent,
    textColor: config.textColor,
    baseFont: config.baseFont,
    fontSize: s.size(config.fontSize),
    lineHeight: s.lineHeight,
    bullet: config.bulletStyle,
    marginPt: s.marginPt,
    layout,
    header,
    summaryRuns,
    main,
    rail,
    columns: config.atsSafe ? 1 : layout.columns,
    railBg: config.atsSafe ? null : layout.columns === 2 && rail.length > 0 ? (layout.header === "banner" ? "#f3f4f6" : "#f9fafb") : null,
    headingAlign: config.headingAlign === "center" && layout.columns === 1 ? "center" : "left",
    stats: computeStats(doc),
  };
}

function computeStats(doc: ResumeDocument): DocStats {
  let words = 0;
  let bullets = 0;
  let entries = 0;
  const countText = (t?: string | null) => {
    if (!t) return;
    words += t.split(/\s+/).filter(Boolean).length;
  };
  countText(doc.summary);
  for (const sec of doc.sections) {
    for (const item of sec.items) {
      if (!item.visible) continue;
      entries++;
      if ("bullets" in item) {
        bullets += (item.bullets ?? []).length;
        (item.bullets ?? []).forEach(countText);
      }
      if ("achievements" in item) {
        bullets += (item.achievements ?? []).length;
        (item.achievements ?? []).forEach(countText);
      }
      if ("description" in item) countText(item.description);
      if (item.kind === "custom") (item.items ?? []).forEach(countText);
      if (item.kind === "skill") words += 1;
    }
  }
  return { wordCount: words, bulletCount: bullets, entryCount: entries };
}

export function categoryLabel(cat: string): string {
  return cat
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function defaultSectionTitle(kind: SectionKind): string {
  return {
    SUMMARY: "Professional Summary",
    EXPERIENCE: "Work Experience",
    EDUCATION: "Education",
    SKILLS: "Skills",
    PROJECTS: "Projects",
    CERTIFICATIONS: "Certifications",
    AWARDS: "Awards",
    PUBLICATIONS: "Publications",
    LANGUAGES: "Languages",
    VOLUNTEER: "Volunteer Experience",
    CUSTOM: "Additional",
  }[kind];
}
