import { db } from "../src/db/client.ts";
import { createLetter } from "../src/features/coverletters/service.ts";
import { createApplication, listApplications } from "../src/features/applications/service.ts";
import { getJobDetail } from "../src/features/jobs/service.ts";

const user = await db.user.findFirst({ where: { email: { startsWith: "e2e-" } }, include: { careerProfile: { include: { resumes: { where: { deletedAt: null }, take: 1 } } } } });
if (!user?.careerProfile) throw new Error("no user");
const ctx = { userId: user.id, email: user.email, profileId: user.careerProfile.id, isPremium: false, ip: "127.0.0.1" } as never;
const resume = user.careerProfile.resumes[0];
const job = (await db.jobDescription.findFirst({ where: { userId: user.id }, select: { id: true } }))!;

const letterId = await createLetter(ctx, { company: "Northwind Cloud", role: "Senior Platform Engineer", tone: "TECHNICAL", length: "STANDARD", jobId: job.id, resumeId: resume.id });
const letter = await db.coverLetter.findUniqueOrThrow({ where: { id: letterId } });
console.log("LETTER id", letterId);
console.log("LETTER content head:", letter.content.split("\n").slice(0, 6).join(" | ").slice(0, 300));
console.log("placeholders remaining:", (letter.content.match(/\[[A-Z ]{3,}\]/g) ?? []).length);

const appId = await createApplication(ctx, { company: "Northwind Cloud", role: "Senior Platform Engineer", status: "APPLIED", appliedAt: new Date().toISOString(), jobId: job.id, coverLetterId: letterId, url: "https://example.com/apply" });
const apps = await listApplications(ctx);
console.log("APP created", appId, "tracked:", apps.length, "status:", apps[0].status, "linkedJob:", !!apps[0].jobDescription, "linkedLetter:", !!apps[0].coverLetter);

// snapshot a version linked to the job via tailored action path (direct db)
const version = await db.resumeVersion.findFirst({ where: { resumeId: resume.id, jobDescriptionId: job.id } });
console.log("tailored version exists for job:", !!version, version?.label, "atsScore:", version?.atsScore);
console.log("APP_ID", appId, "LETTER_ID", letterId);
