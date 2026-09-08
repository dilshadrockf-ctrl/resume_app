-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuthTokenKind" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET', 'DATA_EXPORT');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ContentOrigin" AS ENUM ('USER', 'IMPORTED', 'AI_GENERATED', 'AI_MODIFIED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE', 'SELF_EMPLOYED', 'BOUNDED_VOLUNTEER');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('PROGRAMMING', 'TECHNICAL', 'CLOUD', 'DEVOPS', 'NETWORKING', 'SECURITY', 'DATABASES', 'TOOLS', 'FRAMEWORKS', 'BUSINESS', 'LEADERSHIP', 'SOFT', 'INDUSTRY', 'OTHER');

-- CreateEnum
CREATE TYPE "LibraryItemKind" AS ENUM ('SUMMARY', 'BULLET', 'ACHIEVEMENT', 'SKILL', 'PROJECT');

-- CreateEnum
CREATE TYPE "SectionKind" AS ENUM ('SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS', 'PROJECTS', 'CERTIFICATIONS', 'AWARDS', 'PUBLICATIONS', 'LANGUAGES', 'VOLUNTEER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaperSize" AS ENUM ('A4', 'LETTER');

-- CreateEnum
CREATE TYPE "VersionSource" AS ENUM ('MANUAL', 'AUTOSAVE', 'AI_TAILOR', 'ONE_PAGE', 'IMPORT', 'DUPLICATE', 'RESTORE', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "EntryRefModel" AS ENUM ('EXPERIENCE', 'EDUCATION', 'PROJECT', 'SKILL', 'CERTIFICATION', 'AWARD', 'PUBLICATION', 'LANGUAGE', 'VOLUNTEER', 'CUSTOM_SECTION');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('QUEUED', 'EXTRACTING', 'PARSING', 'NEEDS_REVIEW', 'IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('REVIEW', 'TAILORED', 'IGNORED');

-- CreateEnum
CREATE TYPE "AnalysisKind" AS ENUM ('ATS', 'QUALITY');

-- CreateEnum
CREATE TYPE "RecoAction" AS ENUM ('REWRITE_BULLET', 'ADD_BULLET', 'REWRITE_SUMMARY', 'REORDER_SECTIONS', 'REORDER_ENTRIES', 'PIN_ENTRY', 'HIDE_ENTRY', 'ADD_KEYWORD', 'PRIORITY_SKILLS', 'SHORTEN_TEXT', 'COMPRESS_LAYOUT', 'GENERIC');

-- CreateEnum
CREATE TYPE "RecoStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'UNDONE');

-- CreateEnum
CREATE TYPE "CoverLetterTone" AS ENUM ('PROFESSIONAL', 'CONCISE', 'TRADITIONAL', 'TECHNICAL', 'EXECUTIVE', 'FRIENDLY');

-- CreateEnum
CREATE TYPE "CoverLetterLength" AS ENUM ('SHORT', 'STANDARD', 'DETAILED');

-- CreateEnum
CREATE TYPE "CoverLetterStatus" AS ENUM ('DRAFT', 'FINAL', 'SENT');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SAVED', 'PREPARING', 'APPLIED', 'RECRUITER_SCREEN', 'INTERVIEW', 'TECHNICAL_INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AtsRating" AS ENUM ('EXCELLENT', 'GOOD', 'LIMITED');

-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('PDF', 'DOCX', 'TXT', 'DATA_JSON', 'DATA_ZIP');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "JobRunType" AS ENUM ('RESUME_IMPORT', 'RESUME_EXPORT', 'RESUME_ANALYZE', 'AI_GENERATE', 'COVER_LETTER_GENERATE', 'ACCOUNT_DATA_EXPORT');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('SUCCESS', 'FAILED', 'INVALID_OUTPUT', 'BLOCKED_QUOTA', 'RATE_LIMITED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED', 'INCOMPLETE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "AuthTokenKind" NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "theme" "Theme" NOT NULL DEFAULT 'SYSTEM',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "headline" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "linkedin" TEXT,
    "github" TEXT,
    "location" TEXT,
    "targetRole" TEXT,
    "industry" TEXT,
    "seniority" TEXT,
    "country" TEXT,
    "currentField" TEXT,
    "targetField" TEXT,
    "onboardingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CareerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "careerProfileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "employer" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "location" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "companyUrl" TEXT,
    "description" TEXT,
    "bullets" TEXT[],
    "achievements" TEXT[],
    "technologies" TEXT[],
    "skillsUsed" TEXT[],
    "projectNote" TEXT,
    "origin" "ContentOrigin" NOT NULL DEFAULT 'USER',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Education" (
    "id" TEXT NOT NULL,
    "careerProfileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "institution" TEXT NOT NULL,
    "degree" TEXT,
    "field" TEXT,
    "location" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "gpa" TEXT,
    "honors" TEXT,
    "coursework" TEXT[],
    "activities" TEXT[],
    "description" TEXT,
    "origin" "ContentOrigin" NOT NULL DEFAULT 'USER',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "careerProfileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "url" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "description" TEXT,
    "bullets" TEXT[],
    "technologies" TEXT[],
    "skillsUsed" TEXT[],
    "origin" "ContentOrigin" NOT NULL DEFAULT 'USER',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "careerProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL DEFAULT 'OTHER',
    "level" INTEGER,
    "yearsUsed" INTEGER,
    "keywords" TEXT[],
    "origin" "ContentOrigin" NOT NULL DEFAULT 'USER',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "careerProfileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "credentialId" TEXT,
    "url" TEXT,
    "issueDate" TEXT,
    "expiryDate" TEXT,
    "inProgress" BOOLEAN NOT NULL DEFAULT false,
    "origin" "ContentOrigin" NOT NULL DEFAULT 'USER',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "careerProfileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "date" TEXT,
    "blurb" TEXT,
    "origin" "ContentOrigin" NOT NULL DEFAULT 'USER',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "careerProfileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "url" TEXT,
    "date" TEXT,
    "authors" TEXT[],
    "citationStyle" TEXT,
    "blurb" TEXT,
    "origin" "ContentOrigin" NOT NULL DEFAULT 'USER',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanguageEntry" (
    "id" TEXT NOT NULL,
    "careerProfileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "proficiency" TEXT,
    "origin" "ContentOrigin" NOT NULL DEFAULT 'USER',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LanguageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerExperience" (
    "id" TEXT NOT NULL,
    "careerProfileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "organization" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "bullets" TEXT[],
    "origin" "ContentOrigin" NOT NULL DEFAULT 'USER',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomSection" (
    "id" TEXT NOT NULL,
    "careerProfileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'generic',
    "items" TEXT[],
    "origin" "ContentOrigin" NOT NULL DEFAULT 'USER',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryItem" (
    "id" TEXT NOT NULL,
    "careerProfileId" TEXT NOT NULL,
    "kind" "LibraryItemKind" NOT NULL,
    "text" TEXT NOT NULL,
    "tags" TEXT[],
    "sourceRef" TEXT,
    "origin" "ContentOrigin" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL,
    "careerProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templateId" TEXT NOT NULL DEFAULT 'ats-classic',
    "templateConfig" JSONB NOT NULL DEFAULT '{}',
    "paperSize" "PaperSize" NOT NULL DEFAULT 'A4',
    "resumeLanguage" TEXT NOT NULL DEFAULT 'en',
    "slug" TEXT,
    "publicFields" JSONB NOT NULL DEFAULT '{}',
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "primaryVersionId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeVersion" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Draft',
    "jobDescriptionId" TEXT,
    "source" "VersionSource" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "snapshot" JSONB NOT NULL,
    "atsScore" INTEGER,
    "jobMatch" INTEGER,
    "pageEstimate" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "ResumeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeSection" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "kind" "SectionKind" NOT NULL,
    "title" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ResumeSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeSectionItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "model" "EntryRefModel" NOT NULL,
    "entryId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "override" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ResumeSectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'QUEUED',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "storageKey" TEXT,
    "error" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDescription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "location" TEXT,
    "url" TEXT,
    "salary" TEXT,
    "rawText" TEXT NOT NULL,
    "parsed" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobMatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "resumeVersionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "gaps" JSONB NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AnalysisKind" NOT NULL,
    "resumeVersionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "atsEngineVersion" TEXT NOT NULL,
    "semantic" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analysisId" TEXT,
    "jobMatchId" TEXT,
    "resumeVersionId" TEXT,
    "sectionKind" "SectionKind" NOT NULL,
    "entryRef" TEXT,
    "action" "RecoAction" NOT NULL,
    "rationale" TEXT,
    "original" TEXT,
    "suggested" TEXT,
    "snapshotBefore" JSONB,
    "edited" TEXT,
    "status" "RecoStatus" NOT NULL DEFAULT 'PENDING',
    "promptKey" TEXT,
    "promptVersion" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverLetter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "hiringManager" TEXT,
    "tone" "CoverLetterTone" NOT NULL DEFAULT 'PROFESSIONAL',
    "length" "CoverLetterLength" NOT NULL DEFAULT 'STANDARD',
    "content" TEXT NOT NULL,
    "status" "CoverLetterStatus" NOT NULL DEFAULT 'DRAFT',
    "jobDescriptionId" TEXT,
    "resumeVersionId" TEXT,
    "origin" "ContentOrigin" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "url" TEXT,
    "salary" TEXT,
    "location" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SAVED',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "appliedAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "interviewAt" TIMESTAMP(3),
    "resumeVersionId" TEXT,
    "coverLetterId" TEXT,
    "jobDescriptionId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "atsCompatibility" "AtsRating" NOT NULL DEFAULT 'GOOD',
    "pageModes" JSONB NOT NULL DEFAULT '["one","multi"]',
    "columns" INTEGER NOT NULL DEFAULT 1,
    "photoSupport" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateFavorite" (
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateFavorite_pkey" PRIMARY KEY ("userId","templateId")
);

-- CreateTable
CREATE TABLE "TemplateRecent" (
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateRecent_pkey" PRIMARY KEY ("userId","templateId")
);

-- CreateTable
CREATE TABLE "Export" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ExportType" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'QUEUED',
    "resumeVersionId" TEXT,
    "storageKey" TEXT,
    "fileName" TEXT,
    "bytes" INTEGER,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "downloadTokenHash" TEXT,
    "downloadExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "JobRunType" NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "AiStatus" NOT NULL DEFAULT 'SUCCESS',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptKey" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "inputHash" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "durationMs" INTEGER,
    "costEstimate" DECIMAL(10,6),
    "error" TEXT,
    "output" JSONB,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "props" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "priceCentsMonthly" INTEGER NOT NULL DEFAULT 0,
    "priceCentsAnnual" INTEGER NOT NULL DEFAULT 0,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "features" JSONB NOT NULL DEFAULT '[]',
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'none',
    "providerCustomerId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT 'true',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPct" INTEGER NOT NULL DEFAULT 100,
    "variant" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_email_purpose_idx" ON "AuthToken"("email", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "CareerProfile_userId_key" ON "CareerProfile"("userId");

-- CreateIndex
CREATE INDEX "Experience_careerProfileId_order_idx" ON "Experience"("careerProfileId", "order");

-- CreateIndex
CREATE INDEX "Education_careerProfileId_order_idx" ON "Education"("careerProfileId", "order");

-- CreateIndex
CREATE INDEX "Project_careerProfileId_order_idx" ON "Project"("careerProfileId", "order");

-- CreateIndex
CREATE INDEX "Skill_careerProfileId_category_idx" ON "Skill"("careerProfileId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_careerProfileId_name_category_key" ON "Skill"("careerProfileId", "name", "category");

-- CreateIndex
CREATE INDEX "Certification_careerProfileId_order_idx" ON "Certification"("careerProfileId", "order");

-- CreateIndex
CREATE INDEX "Award_careerProfileId_order_idx" ON "Award"("careerProfileId", "order");

-- CreateIndex
CREATE INDEX "Publication_careerProfileId_order_idx" ON "Publication"("careerProfileId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LanguageEntry_careerProfileId_name_key" ON "LanguageEntry"("careerProfileId", "name");

-- CreateIndex
CREATE INDEX "VolunteerExperience_careerProfileId_order_idx" ON "VolunteerExperience"("careerProfileId", "order");

-- CreateIndex
CREATE INDEX "CustomSection_careerProfileId_order_idx" ON "CustomSection"("careerProfileId", "order");

-- CreateIndex
CREATE INDEX "LibraryItem_careerProfileId_kind_idx" ON "LibraryItem"("careerProfileId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Resume_slug_key" ON "Resume"("slug");

-- CreateIndex
CREATE INDEX "Resume_careerProfileId_idx" ON "Resume"("careerProfileId");

-- CreateIndex
CREATE INDEX "Resume_updatedAt_idx" ON "Resume"("updatedAt");

-- CreateIndex
CREATE INDEX "ResumeVersion_resumeId_createdAt_idx" ON "ResumeVersion"("resumeId", "createdAt");

-- CreateIndex
CREATE INDEX "ResumeSection_resumeId_order_idx" ON "ResumeSection"("resumeId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeSection_resumeId_kind_key" ON "ResumeSection"("resumeId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeSectionItem_sectionId_model_entryId_key" ON "ResumeSectionItem"("sectionId", "model", "entryId");

-- CreateIndex
CREATE INDEX "ImportJob_userId_status_idx" ON "ImportJob"("userId", "status");

-- CreateIndex
CREATE INDEX "JobDescription_userId_createdAt_idx" ON "JobDescription"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JobMatch_userId_createdAt_idx" ON "JobMatch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ResumeAnalysis_resumeVersionId_createdAt_idx" ON "ResumeAnalysis"("resumeVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "Recommendation_userId_status_idx" ON "Recommendation"("userId", "status");

-- CreateIndex
CREATE INDEX "CoverLetter_userId_createdAt_idx" ON "CoverLetter"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Application_userId_status_idx" ON "Application"("userId", "status");

-- CreateIndex
CREATE INDEX "Application_userId_updatedAt_idx" ON "Application"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ApplicationNote_applicationId_idx" ON "ApplicationNote"("applicationId");

-- CreateIndex
CREATE INDEX "Template_atsCompatibility_idx" ON "Template"("atsCompatibility");

-- CreateIndex
CREATE UNIQUE INDEX "Export_downloadTokenHash_key" ON "Export"("downloadTokenHash");

-- CreateIndex
CREATE INDEX "Export_userId_status_idx" ON "Export"("userId", "status");

-- CreateIndex
CREATE INDEX "JobRun_status_createdAt_idx" ON "JobRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "JobRun_userId_type_idx" ON "JobRun"("userId", "type");

-- CreateIndex
CREATE INDEX "AIGeneration_userId_createdAt_idx" ON "AIGeneration"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIGeneration_action_createdAt_idx" ON "AIGeneration"("action", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_event_createdAt_idx" ON "UsageEvent"("event", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_createdAt_idx" ON "UsageEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_userId_key_key" ON "Entitlement"("userId", "key");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_careerProfileId_fkey" FOREIGN KEY ("careerProfileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_careerProfileId_fkey" FOREIGN KEY ("careerProfileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_careerProfileId_fkey" FOREIGN KEY ("careerProfileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_careerProfileId_fkey" FOREIGN KEY ("careerProfileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_careerProfileId_fkey" FOREIGN KEY ("careerProfileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_careerProfileId_fkey" FOREIGN KEY ("careerProfileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_careerProfileId_fkey" FOREIGN KEY ("careerProfileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageEntry" ADD CONSTRAINT "LanguageEntry_careerProfileId_fkey" FOREIGN KEY ("careerProfileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerExperience" ADD CONSTRAINT "VolunteerExperience_careerProfileId_fkey" FOREIGN KEY ("careerProfileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomSection" ADD CONSTRAINT "CustomSection_careerProfileId_fkey" FOREIGN KEY ("careerProfileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_careerProfileId_fkey" FOREIGN KEY ("careerProfileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_careerProfileId_fkey" FOREIGN KEY ("careerProfileId") REFERENCES "CareerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeSection" ADD CONSTRAINT "ResumeSection_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeSectionItem" ADD CONSTRAINT "ResumeSectionItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ResumeSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeAnalysis" ADD CONSTRAINT "ResumeAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeAnalysis" ADD CONSTRAINT "ResumeAnalysis_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "ResumeAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_jobMatchId_fkey" FOREIGN KEY ("jobMatchId") REFERENCES "JobMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_coverLetterId_fkey" FOREIGN KEY ("coverLetterId") REFERENCES "CoverLetter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateFavorite" ADD CONSTRAINT "TemplateFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateFavorite" ADD CONSTRAINT "TemplateFavorite_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateRecent" ADD CONSTRAINT "TemplateRecent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateRecent" ADD CONSTRAINT "TemplateRecent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIGeneration" ADD CONSTRAINT "AIGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

