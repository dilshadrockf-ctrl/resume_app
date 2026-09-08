import { z } from "zod";

/**
 * ResumeDocument — the single normalized representation of a composed resume
 * (§20/§30). A resume is a *view* over the career profile; composing snapshots
 * flattened entries (with per-resume overrides) so versions, exports, ATS
 * analysis and comparisons are all self-contained.
 */

export const PAPER_SIZES = ["A4", "LETTER"] as const;
export type PaperSize = (z.infer<typeof paperSizeEnum>);

export const paperSizeEnum = z.enum(PAPER_SIZES);

export const SECTION_KINDS = [
  "SUMMARY",
  "EXPERIENCE",
  "EDUCATION",
  "SKILLS",
  "PROJECTS",
  "CERTIFICATIONS",
  "AWARDS",
  "PUBLICATIONS",
  "LANGUAGES",
  "VOLUNTEER",
  "CUSTOM",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const SKILL_CATEGORIES = [
  "PROGRAMMING",
  "TECHNICAL",
  "CLOUD",
  "DEVOPS",
  "NETWORKING",
  "SECURITY",
  "DATABASES",
  "TOOLS",
  "FRAMEWORKS",
  "BUSINESS",
  "LEADERSHIP",
  "SOFT",
  "INDUSTRY",
  "OTHER",
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "INTERNSHIP",
  "FREELANCE",
  "SELF_EMPLOYED",
  "BOUNDED_VOLUNTEER",
] as const;

export const ORIGIN_KINDS = ["USER", "IMPORTED", "AI_GENERATED", "AI_MODIFIED"] as const;
export const originEnum = z.enum(ORIGIN_KINDS);

const partialDate = z
  .string()
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
  .max(10)
  .optional()
  .nullable()
  .or(z.literal(""));

// ─────────────────────────────── items ──────────────────────────────────────

const refBase = {
  ref: z.object({
    model: z.enum([
      "EXPERIENCE",
      "EDUCATION",
      "PROJECT",
      "SKILL",
      "CERTIFICATION",
      "AWARD",
      "PUBLICATION",
      "LANGUAGE",
      "VOLUNTEER",
      "CUSTOM_SECTION",
    ]),
    id: z.string(),
  }),
  visible: z.boolean().default(true),
  order: z.number().int().default(0),
  origin: originEnum.default("USER"),
};

export const experienceItemSchema = z.object({
  kind: z.literal("experience"),
  employer: z.string().min(1),
  title: z.string().min(1),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("FULL_TIME"),
  location: z.string().optional(),
  startDate: partialDate,
  endDate: partialDate,
  current: z.boolean().default(false),
  companyUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  skillsUsed: z.array(z.string()).default([]),
  projectNote: z.string().optional(),
  ...refBase,
});
export type ExperienceItem = z.infer<typeof experienceItemSchema>;

export const educationItemSchema = z.object({
  kind: z.literal("education"),
  institution: z.string().min(1),
  degree: z.string().optional(),
  field: z.string().optional(),
  location: z.string().optional(),
  startDate: partialDate,
  endDate: partialDate,
  current: z.boolean().default(false),
  gpa: z.string().optional(),
  honors: z.string().optional(),
  coursework: z.array(z.string()).default([]),
  activities: z.array(z.string()).default([]),
  description: z.string().optional(),
  ...refBase,
});
export type EducationItem = z.infer<typeof educationItemSchema>;

export const projectItemSchema = z.object({
  kind: z.literal("project"),
  name: z.string().min(1),
  role: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
  startDate: partialDate,
  endDate: partialDate,
  description: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  skillsUsed: z.array(z.array(z.string())).optional().or(z.array(z.string())).optional(),
  ...refBase,
});
export type ProjectItem = z.infer<typeof projectItemSchema>;

export const skillItemSchema = z.object({
  kind: z.literal("skill"),
  name: z.string().min(1),
  category: z.enum(SKILL_CATEGORIES).default("OTHER"),
  level: z.number().int().min(1).max(5).optional(),
  keywords: z.array(z.string()).default([]),
  ...refBase,
});
export type SkillItem = z.infer<typeof skillItemSchema>;

export const certificationItemSchema = z.object({
  kind: z.literal("certification"),
  name: z.string().min(1),
  issuer: z.string().optional(),
  credentialId: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
  issueDate: partialDate,
  expiryDate: partialDate,
  inProgress: z.boolean().default(false),
  ...refBase,
});

export const awardItemSchema = z.object({
  kind: z.literal("award"),
  title: z.string().min(1),
  issuer: z.string().optional(),
  date: partialDate,
  blurb: z.string().optional(),
  ...refBase,
});

export const publicationItemSchema = z.object({
  kind: z.literal("publication"),
  title: z.string().min(1),
  publisher: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
  date: partialDate,
  authors: z.array(z.string()).default([]),
  citationStyle: z.string().optional(),
  blurb: z.string().optional(),
  ...refBase,
});

export const languageItemSchema = z.object({
  kind: z.literal("language"),
  name: z.string().min(1),
  proficiency: z.string().optional(),
  ...refBase,
});

export const volunteerItemSchema = z.object({
  kind: z.literal("volunteer"),
  organization: z.string().min(1),
  role: z.string().min(1),
  location: z.string().optional(),
  startDate: partialDate,
  endDate: partialDate,
  current: z.boolean().default(false),
  description: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  ...refBase,
});

export const customItemSchema = z.object({
  kind: z.literal("custom"),
  title: z.string().min(1),
  sectionKindTag: z.string().default("generic"),
  items: z.array(z.string()).default([]),
  ...refBase,
});

export const sectionItemSchema = z.discriminatedUnion("kind", [
  experienceItemSchema,
  educationItemSchema,
  projectItemSchema,
  skillItemSchema,
  certificationItemSchema,
  awardItemSchema,
  publicationItemSchema,
  languageItemSchema,
  volunteerItemSchema,
  customItemSchema,
]);
export type SectionItem = z.infer<typeof sectionItemSchema>;

export const resumeSectionSchema = z.object({
  id: z.string(),
  kind: z.enum(SECTION_KINDS),
  title: z.string().optional(),
  visible: z.boolean().default(true),
  order: z.number().int().default(0),
  items: z.array(sectionItemSchema).default([]),
});
export type ResumeSectionDoc = z.infer<typeof resumeSectionSchema>;

// ─────────────────────────────── template config ───────────────────────────

export const templateConfigSchema = z.object({
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1d4ed8"),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#111827"),
  baseFont: z.enum(["inter", "lora", "mono"]).default("inter"),
  fontSize: z.number().min(8).max(13).default(10), // pt
  lineHeight: z.number().min(1.1).max(1.7).default(1.32),
  marginScale: z.number().min(0.6).max(1.4).default(1),
  density: z.enum(["comfortable", "compact", "dense"]).default("comfortable"),
  fontScale: z.number().min(0.75).max(1.25).default(1),
  uppercaseHeadings: z.boolean().default(true),
  headingAlign: z.enum(["left", "center"]).default("left"),
  dateAlign: z.enum(["right", "below", "inline"]).default("right"),
  sectionDivider: z.enum(["rule", "bar", "underline", "space"]).default("rule"),
  bulletStyle: z.enum(["dash", "dot", "square", "none"]).default("dash"),
  headerStyle: z.enum(["left", "centered", "stacked", "banner"]).default("left"),
  skillFormat: z.enum(["inline", "grouped-inline", "grouped-lines"]).default("grouped-inline"),
  showPhoto: z.boolean().default(false),
  atsSafe: z.boolean().default(false), // §32 presentation-only safety mode
  onePage: z.boolean().default(false),
});
export type TemplateConfig = z.infer<typeof templateConfigSchema>;
export const DEFAULT_TEMPLATE_CONFIG = templateConfigSchema.parse({});

// ─────────────────────────────── document root ─────────────────────────────

export const contactSchema = z.object({
  fullName: z.string().min(1).default("Your Name"),
  headline: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
});
export type Contact = z.infer<typeof contactSchema>;

export const resumeDocumentSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  meta: z.object({
    resumeId: z.string().optional(),
    name: z.string().default("Untitled Resume"),
    language: z.string().default("en"), // resume content language (§110)
    paperSize: paperSizeEnum.default("A4"),
    templateId: z.string().default("ats-classic"),
    templateVersion: z.number().int().default(1),
    config: templateConfigSchema.prefault({}),
  }),
  contact: contactSchema.prefault({}),
  summary: z.string().default(""),
  sections: z.array(resumeSectionSchema).default([]),
});
export type ResumeDocument = z.infer<typeof resumeDocumentSchema>;

export function emptyResumeDocument(name: string): ResumeDocument {
  return resumeDocumentSchema.parse({
    meta: { name },
    sections: SECTION_KINDS.filter((k) => k !== "SUMMARY").map((kind, i) => ({
      id: kind.toLowerCase(),
      kind,
      order: i,
      items: [],
    })),
  });
}

/** Sections in presentation order. */
export function orderedSections(doc: ResumeDocument): ResumeSectionDoc[] {
  return [...doc.sections].sort((a, b) => a.order - b.order);
}

export function sectionItems<T extends SectionItem["kind"]>(
  doc: ResumeDocument,
  kind: T,
): Array<Extract<SectionItem, { kind: T }>> {
  const section = doc.sections.find((s) => s.kind === kind);
  if (!section) return [];
  return section.items
    .filter((i) => i.visible)
    .sort((a, b) => a.order - b.order)
    .map((i) => i as Extract<SectionItem, { kind: T }>);
}
