import type { ResumeDocument, SectionKind, TemplateConfig } from "@/lib/resume/document";

/**
 * Template catalog (§29-§33). Every template consumes the common ResumeDocument
 * schema and only changes presentation — never data (§107). ATS ratings are
 * honest labels, not guarantees (§31).
 */

export type FontToken = "inter" | "lora" | "mono";

export interface TemplateLayoutSpec {
  header: "left" | "centered" | "stacked" | "banner";
  columns: 1 | 2;
  /** Kinds rendered in the sidebar for two-column templates. */
  rail: SectionKind[];
  entryTitleFormat: "title-employer" | "employer-title";
  datePlacement: "right" | "below" | "inline";
  headingCase: "uppercase" | "title-case";
  headingRule: "rule" | "bar" | "underline" | "space";
  headingSizeScale: number;
  baseSizeScale: number;
  spacingScale: number;
  sectionDefaultOrder: SectionKind[];
  skillFormat: "inline" | "grouped-inline" | "grouped-lines";
  photoSupported: boolean;
  accent: string;
  serif: boolean;
  /** One-page oriented (aggressive density by default). */
  pageMode: "one" | "multi" | "both";
  /** Customizable knobs exposed in the design panel. */
  allowsAccent: boolean;
  allowsDensity: boolean;
  /** For templates marked LIMITED: layout switch that fixes parseability. */
  atsSafeSwitch: boolean;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  ats: "excellent" | "good" | "limited";
  tags: string[];
  version: number;
  layout: TemplateLayoutSpec;
  defaultConfig: Partial<TemplateConfig>;
}

const STD_ORDER: SectionKind[] = [
  "SUMMARY",
  "EXPERIENCE",
  "PROJECTS",
  "SKILLS",
  "EDUCATION",
  "CERTIFICATIONS",
  "AWARDS",
  "VOLUNTEER",
  "PUBLICATIONS",
  "LANGUAGES",
  "CUSTOM",
];

function spec(partial: Partial<TemplateLayoutSpec>): TemplateLayoutSpec {
  return {
    header: "left",
    columns: 1,
    rail: [],
    entryTitleFormat: "title-employer",
    datePlacement: "right",
    headingCase: "uppercase",
    headingRule: "rule",
    headingSizeScale: 1.15,
    baseSizeScale: 1,
    spacingScale: 1,
    sectionDefaultOrder: STD_ORDER,
    skillFormat: "grouped-inline",
    photoSupported: false,
    accent: "#1d4ed8",
    serif: false,
    pageMode: "both",
    allowsAccent: true,
    allowsDensity: true,
    atsSafeSwitch: false,
    ...partial,
  };
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "ats-classic",
    name: "ATS Classic",
    description:
      "Single column, standard headings, maximum parseability. The safest choice for portals.",
    ats: "excellent",
    tags: ["ats-friendly", "minimal", "one-page"],
    version: 2,
    layout: spec({
      headingCase: "uppercase",
      headingRule: "rule",
      accent: "#111827",
      skillFormat: "inline",
      allowsAccent: false,
    }),
    defaultConfig: { accentColor: "#111827", sectionDivider: "rule", uppercaseHeadings: true },
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    description: "Generous whitespace, light type, hairline rules. Calm and contemporary.",
    ats: "excellent",
    tags: ["ats-friendly", "minimal", "modern"],
    version: 1,
    layout: spec({ headingRule: "rule", spacingScale: 1.18, headingSizeScale: 1.05 }),
    defaultConfig: { accentColor: "#374151", fontSize: 10, density: "comfortable" },
  },
  {
    id: "professional",
    name: "Professional",
    description: "Balanced business look with colored headings and strong section hierarchy.",
    ats: "excellent",
    tags: ["ats-friendly", "modern"],
    version: 1,
    layout: spec({ headingCase: "title-case", headingRule: "underline" }),
    defaultConfig: {
      accentColor: "#1d4ed8",
      uppercaseHeadings: false,
      sectionDivider: "underline",
    },
  },
  {
    id: "executive",
    name: "Executive",
    description: "Serif headline, small-caps section titles, restrained luxury for senior leaders.",
    ats: "good",
    tags: ["executive", "modern"],
    version: 1,
    layout: spec({
      header: "centered",
      serif: true,
      headingCase: "uppercase",
      headingRule: "bar",
      headingSizeScale: 1.2,
      spacingScale: 1.12,
      accent: "#0f3d3e",
    }),
    defaultConfig: {
      baseFont: "lora",
      accentColor: "#0f3d3e",
      sectionDivider: "bar",
      uppercaseHeadings: true,
    },
  },
  {
    id: "technical",
    name: "Technical",
    description: "Monospace accents, compact skill chips, engineer/IC focus.",
    ats: "excellent",
    tags: ["technical", "ats-friendly", "one-page"],
    version: 1,
    layout: spec({
      entryTitleFormat: "title-employer",
      datePlacement: "right",
      spacingScale: 0.92,
      baseSizeScale: 0.98,
      headingCase: "uppercase",
      skillFormat: "grouped-inline",
      accent: "#047857",
    }),
    defaultConfig: {
      accentColor: "#047857",
      fontSize: 9.5,
      density: "compact",
      skillFormat: "grouped-inline",
    },
  },
  {
    id: "compact",
    name: "Compact",
    description: "Dense but readable — tuned to fit a full career onto one page.",
    ats: "excellent",
    tags: ["one-page", "minimal", "ats-friendly"],
    version: 1,
    layout: spec({
      spacingScale: 0.8,
      baseSizeScale: 0.95,
      headingSizeScale: 1.0,
      pageMode: "one",
      accent: "#111827",
    }),
    defaultConfig: { fontSize: 9.5, density: "dense", marginScale: 1.15, accentColor: "#111827" },
  },
  {
    id: "corporate",
    name: "Corporate",
    description:
      "Two-column with a light sidebar for skills and education. Structured and familiar.",
    ats: "good",
    tags: ["modern"],
    version: 1,
    layout: spec({
      columns: 2,
      rail: ["SKILLS", "EDUCATION", "CERTIFICATIONS", "LANGUAGES", "AWARDS"],
      header: "stacked",
      headingRule: "bar",
      accent: "#1e3a8a",
      atsSafeSwitch: true,
    }),
    defaultConfig: { accentColor: "#1e3a8a", sectionDivider: "bar" },
  },
  {
    id: "elegant",
    name: "Elegant",
    description: "Serif body, centered header, delicate rules. Graduate students and consultants.",
    ats: "good",
    tags: ["minimal", "academic"],
    version: 1,
    layout: spec({
      header: "centered",
      serif: true,
      headingCase: "title-case",
      headingRule: "rule",
      spacingScale: 1.15,
      accent: "#44403c",
    }),
    defaultConfig: { baseFont: "lora", accentColor: "#44403c", fontSize: 10.5 },
  },
  {
    id: "creative",
    name: "Creative Professional",
    description: "Colored name banner and side rail — striking for design/portfolio roles.",
    ats: "limited",
    tags: ["creative"],
    version: 1,
    layout: spec({
      columns: 2,
      rail: ["SKILLS", "EDUCATION", "CERTIFICATIONS", "AWARDS", "LANGUAGES"],
      header: "banner",
      headingRule: "space",
      headingCase: "title-case",
      accent: "#7c3aed",
      photoSupported: true,
      spacingScale: 1.08,
      atsSafeSwitch: true,
    }),
    defaultConfig: { accentColor: "#7c3aed", showPhoto: false, sectionDivider: "space" },
  },
  {
    id: "academic",
    name: "Academic CV",
    description: "Multi-page scholarly format: publications, teaching, advisor notes, full dates.",
    ats: "excellent",
    tags: ["academic", "ats-friendly"],
    version: 1,
    layout: spec({
      header: "centered",
      serif: true,
      headingCase: "title-case",
      headingRule: "rule",
      spacingScale: 1.1,
      entryTitleFormat: "employer-title",
      datePlacement: "below",
      accent: "#000000",
      pageMode: "multi",
      allowsAccent: false,
      sectionDefaultOrder: [
        "SUMMARY",
        "EDUCATION",
        "PUBLICATIONS",
        "EXPERIENCE",
        "PROJECTS",
        "AWARDS",
        "CERTIFICATIONS",
        "VOLUNTEER",
        "SKILLS",
        "LANGUAGES",
        "CUSTOM",
      ],
    }),
    defaultConfig: {
      baseFont: "lora",
      accentColor: "#000000",
      dateAlign: "below",
      uppercaseHeadings: false,
      fontSize: 11,
    },
  },
  {
    id: "grad",
    name: "Student / Entry-Level",
    description: "Education and projects first — built for students, interns and career changers.",
    ats: "excellent",
    tags: ["ats-friendly", "one-page", "modern"],
    version: 1,
    layout: spec({
      sectionDefaultOrder: [
        "SUMMARY",
        "EDUCATION",
        "SKILLS",
        "PROJECTS",
        "EXPERIENCE",
        "CERTIFICATIONS",
        "VOLUNTEER",
        "AWARDS",
        "LANGUAGES",
        "CUSTOM",
        "PUBLICATIONS",
      ],
      spacingScale: 1.05,
      accent: "#0e7490",
    }),
    defaultConfig: { accentColor: "#0e7490" },
  },
  {
    id: "switch",
    name: "Engineering Switch",
    description:
      "Role-based skill emphasis for career changers — transferable skills surface first.",
    ats: "good",
    tags: ["technical", "modern"],
    version: 1,
    layout: spec({
      headingRule: "bar",
      spacingScale: 0.98,
      accent: "#b45309",
      skillFormat: "grouped-lines",
    }),
    defaultConfig: { accentColor: "#b45309", sectionDivider: "bar", skillFormat: "grouped-lines" },
  },
];

export const TEMPLATE_MAP: Record<string, TemplateDefinition> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t]),
);

export function getTemplate(id: string | undefined | null): TemplateDefinition {
  return TEMPLATE_MAP[id ?? ""] ?? TEMPLATES[0]!;
}

export const TEMPLATE_FILTERS = [
  "ats-friendly",
  "one-page",
  "modern",
  "executive",
  "technical",
  "academic",
  "minimal",
  "creative",
] as const;
export type TemplateFilter = (typeof TEMPLATE_FILTERS)[number];

/** §32 — force the ATS-safe presentation without touching content. */
export function withAtsSafe(def: TemplateDefinition, config: TemplateConfig): TemplateConfig {
  return {
    ...config,
    atsSafe: true,
    accentColor: "#111827",
    sectionDivider: "rule",
    skillFormat: "grouped-inline",
    density: config.density,
  };
}

/** Layout as actually rendered — merges ATS-safe switch and config overrides. */
export function effectiveLayout(
  def: TemplateDefinition,
  config: TemplateConfig,
): { layout: TemplateLayoutSpec; headingCase: "uppercase" | "title-case" } {
  const layout: TemplateLayoutSpec = { ...def.layout };
  if (config.atsSafe || def.ats === "excellent") {
    layout.columns = 1;
    layout.rail = [];
    if (config.atsSafe) layout.header = def.layout.header === "banner" ? "left" : def.layout.header;
  }
  return { layout, headingCase: config.uppercaseHeadings ? "uppercase" : "title-case" };
}

export function validateTemplateCatalog(defs: TemplateDefinition[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const t of defs) {
    if (ids.has(t.id)) errors.push(`duplicate template id: ${t.id}`);
    ids.add(t.id);
    if (!t.name.trim()) errors.push(`${t.id}: empty name`);
    if (!t.description.trim()) errors.push(`${t.id}: empty description`);
    const allKinds = new Set<SectionKind>(STD_ORDER);
    for (const k of t.layout.sectionDefaultOrder) {
      if (!allKinds.has(k)) errors.push(`${t.id}: unknown section kind ${k}`);
    }
    if (t.layout.sectionDefaultOrder.length !== allKinds.size) {
      errors.push(`${t.id}: section order must list every section kind`);
    }
    for (const k of t.layout.rail) {
      if (!allKinds.has(k)) errors.push(`${t.id}: rail references unknown kind ${k}`);
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(t.layout.accent)) errors.push(`${t.id}: invalid accent`);
  }
  return errors;
}
