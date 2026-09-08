const { db } = await import("../src/db/client.ts");
const user = await db.user.findFirst({ where: { email: { startsWith: "e2e-" } }, include: { careerProfile: { include: { resumes: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } } } } } });
if (!user?.careerProfile) throw new Error("no user");
const resume = user.careerProfile.resumes[0];
if (!resume) throw new Error("no resume");
console.log("user", user.id, "resume", resume.id, resume.name);

const { extractJdSignals } = await import("../src/lib/matching.ts");
// craft a JD that shares terms with the seeded library (Kafka, Terraform, observability...)
const jdText = `Senior Platform Engineer — Northwind Cloud (Remote)
About the role
You will design, build, and operate the platform our product teams deploy to. We run a microservices architecture on Kubernetes and value ownership, mentoring, and pragmatism.
Responsibilities
- Own CI/CD pipelines and developer productivity tooling
- Operate Kubernetes clusters, improve reliability, cut toil with Terraform and infrastructure as code
- Build observability: OpenTelemetry, Prometheus, Grafana, dashboards and alerts
- Mentor engineers on incident response and on-call practices
Requirements
- 5+ years in platform, SRE, or DevOps roles
- Deep Kubernetes and Docker experience in production
- Strong Go and Python; GitOps (ArgoCD) is a plus
- Experience with Kafka at scale
- Bonus: Terraform, Prometheus, Grafana, incident management, technical writing
Salary range: $160k-$190k plus equity.`;

const signals = extractJdSignals(jdText, "Senior Platform Engineer");
console.log("signals: keywords", signals.keywords.length, "required-ctx", signals.keywords.filter(k=>k.context==="required").map(k=>k.term).join(","), "| reqLines", signals.requirements.length, "| titleWords", signals.titleWords.join(" "));

const { createJob, matchJobAgainstResume, getJobDetail } = await import("../src/features/jobs/service.ts");
const ctx = { userId: user.id, email: user.email, profileId: user.careerProfile.id, isPremium: false, ip: "127.0.0.1" } as never;
const job = await createJob(ctx as never, { title: "Senior Platform Engineer", company: "Northwind Cloud", location: "Remote", salary: "$160k-$190k + equity", text: jdText });
console.log("job created", job.id);
const matchId = await matchJobAgainstResume(ctx as never, job.id, resume.id);
const detail = await getJobDetail(ctx as never, job.id);
const m = detail.matches[0];
console.log("match", matchId, "score", m.score, "status", m.status, "recos", m.recommendations.length);
const b = m.breakdown as never as { keywordCoverage: { earned: number; possible: number; matched: string[]; requiredMissing: string[] }; titleAlignment: { note: string }; structureFit: { present: string[] } };
console.log("coverage", b.keywordCoverage.earned + "/" + b.keywordCoverage.possible, "matched:", b.keywordCoverage.matched.join(", "));
console.log("requiredMissing:", b.keywordCoverage.requiredMissing.join(", "), "| title:", b.titleAlignment.note, "| structure:", b.structureFit.present.join(","));
for (const r of m.recommendations) console.log("RECO", r.action, "|", (r.rationale ?? "").slice(0, 140), "| status", r.status);
// write ids for page check
await import("node:fs").then((fs) => fs.writeFileSync(".tmp/job-ids.txt", job.id));
console.log("JOB_ID", job.id);

