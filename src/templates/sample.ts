import { resumeDocumentSchema, type ResumeDocument } from "@/lib/resume/document";

/**
 * Realistic placeholder resume used for template thumbnails and the gallery
 * when the user has no content yet. Never persisted.
 */
export function sampleResumeDocument(): ResumeDocument {
  return resumeDocumentSchema.parse({
    meta: { name: "Sample", templateId: "ats-classic" },
    contact: {
      fullName: "Dilshad Rahman",
      headline: "Senior Software Engineer",
      email: "dilshad@example.com",
      phone: "+94 77 123 4567",
      location: "Colombo, Sri Lanka",
      linkedin: "linkedin.com/in/dilshad",
      github: "github.com/dilshad",
      website: "dilshad.dev",
    },
    summary:
      "Full-stack engineer with 8 years of experience building high-traffic web platforms. Led migrations to cloud-native architecture, cut infrastructure spend by 40%, and mentored teams of up to 12 engineers.",
    sections: [
      {
        id: "exp",
        kind: "EXPERIENCE",
        order: 1,
        items: [
          {
            kind: "experience",
            employer: "Northwind Technologies",
            title: "Senior Software Engineer",
            location: "Colombo",
            startDate: "2021-03",
            current: true,
            bullets: [
              "Architected event-driven order pipeline handling 2M events/day with 99.99% uptime",
              "Reduced p95 API latency from 850ms to 120ms by introducing read replicas and caching",
              "Mentored 6 engineers; 3 promoted to senior within 18 months",
            ],
            technologies: ["TypeScript", "Node.js", "PostgreSQL", "AWS", "Kubernetes"],
            ref: { model: "EXPERIENCE", id: "1" },
          },
          {
            kind: "experience",
            employer: "Contoso Ltd",
            title: "Software Engineer",
            location: "Remote",
            startDate: "2017-06",
            endDate: "2021-02",
            bullets: [
              "Built React design system adopted by 4 product teams",
              "Automated CI/CD reducing release cycle from 2 weeks to daily",
            ],
            ref: { model: "EXPERIENCE", id: "2" },
          },
        ],
      },
      {
        id: "edu",
        kind: "EDUCATION",
        order: 4,
        items: [
          {
            kind: "education",
            institution: "University of Moratuwa",
            degree: "BSc (Hons)",
            field: "Computer Science",
            startDate: "2013",
            endDate: "2017",
            gpa: "3.8/4.0",
            honors: "First Class",
            ref: { model: "EDUCATION", id: "3" },
          },
        ],
      },
      {
        id: "sk",
        kind: "SKILLS",
        order: 3,
        items: [
          ...["TypeScript", "Python", "Go"].map((n, i) => ({
            kind: "skill",
            name: n,
            category: "PROGRAMMING",
            ref: { model: "SKILL", id: "s" + i },
          })),
          ...["React", "Next.js", "Node.js"].map((n, i) => ({
            kind: "skill",
            name: n,
            category: "FRAMEWORKS",
            ref: { model: "SKILL", id: "f" + i },
          })),
          ...["AWS", "Docker", "Kubernetes", "Terraform"].map((n, i) => ({
            kind: "skill",
            name: n,
            category: "CLOUD",
            ref: { model: "SKILL", id: "c" + i },
          })),
        ],
      },
      {
        id: "pr",
        kind: "PROJECTS",
        order: 2,
        items: [
          {
            kind: "project",
            name: "OpenLedger",
            role: "Maintainer",
            url: "https://github.com/dilshad/openledger",
            description: "Open-source double-entry accounting library with 2k GitHub stars.",
            technologies: ["Rust", "WASM"],
            ref: { model: "PROJECT", id: "p1" },
          },
        ],
      },
      {
        id: "cert",
        kind: "CERTIFICATIONS",
        order: 5,
        items: [
          {
            kind: "certification",
            name: "AWS Solutions Architect – Professional",
            issuer: "Amazon",
            issueDate: "2023-01",
            ref: { model: "CERTIFICATION", id: "c1" },
          },
        ],
      },
      {
        id: "lang",
        kind: "LANGUAGES",
        order: 6,
        items: [
          {
            kind: "language",
            name: "English",
            proficiency: "Fluent",
            ref: { model: "LANGUAGE", id: "l1" },
          },
          {
            kind: "language",
            name: "Sinhala",
            proficiency: "Native",
            ref: { model: "LANGUAGE", id: "l2" },
          },
        ],
      },
    ],
  });
}
