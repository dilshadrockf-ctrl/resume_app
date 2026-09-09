import { parseResumeText } from "../src/features/import/parsers.ts";
const SAMPLE = `Jane Doe
Staff Engineer · Berlin
jane@doe.dev | +49 170 1234567 | linkedin.com/in/janedoe

SUMMARY
Staff engineer focused on developer platforms.

EXPERIENCE
Senior Engineer — Acme Corp
2020 - 2024
- Cut build times 60% with remote caching
- Led migration to Kubernetes
Engineer, Beta Labs
2016 - 2020
- Built internal CLI used by 300 developers

SKILLS
Go, Kubernetes, Terraform, gRPC

EDUCATION
MSc Software Engineering — TU Berlin, 2016
`;
const p = parseResumeText(SAMPLE);
console.log("email:", p.doc.contact.email, "| phone:", p.doc.contact.phone, "| linkedin:", p.doc.contact.linkedin, "| name:", p.doc.contact.fullName);
const exp = p.doc.sections.find((s) => s.kind === "EXPERIENCE")!;
console.log("exp count:", exp.items.length);
for (const x of exp.items as any[]) console.log(" exp:", JSON.stringify({ employer: x.employer, title: x.title, start: x.startDate, end: x.endDate, bullets: x.bullets }));
