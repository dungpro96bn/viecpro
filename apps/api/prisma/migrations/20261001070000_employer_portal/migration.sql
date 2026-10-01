-- CreateEnum
CREATE TYPE "JobVisibility" AS ENUM ('standard', 'featured', 'urgent');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('viecpro', 'recommended', 'zalo', 'consultant', 'hotline', 'referral', 'job_fair', 'social', 'other');

-- CreateEnum
CREATE TYPE "InterviewKind" AS ENUM ('online', 'onsite', 'skill_test');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('scheduled', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "AttendeeStatus" AS ENUM ('pending', 'confirmed', 'declined', 'attended', 'no_show');

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'departed';

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'paused';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "contactedAt" TIMESTAMP(3),
ADD COLUMN     "departWithin" TEXT,
ADD COLUMN     "documents" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "education" TEXT,
ADD COLUMN     "experience" TEXT,
ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "hometown" TEXT,
ADD COLUMN     "jlpt" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "matchScore" INTEGER,
ADD COLUMN     "number" SERIAL NOT NULL,
ADD COLUMN     "passport" TEXT,
ADD COLUMN     "seenAt" TIMESTAMP(3),
ADD COLUMN     "source" "ApplicationSource" NOT NULL DEFAULT 'viecpro',
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "weightKg" INTEGER;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "boostedAt" TIMESTAMP(3),
ADD COLUMN     "contractYears" INTEGER,
ADD COLUMN     "examAt" TIMESTAMP(3),
ADD COLUMN     "feeUsd" INTEGER,
ADD COLUMN     "jlptRequired" TEXT,
ADD COLUMN     "visibility" "JobVisibility" NOT NULL DEFAULT 'standard';

-- AlterTable
ALTER TABLE "Recruiter" ADD COLUMN     "cccdVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SeekerProfile" ADD COLUMN     "departWithin" TEXT,
ADD COLUMN     "desiredSalary" INTEGER,
ADD COLUMN     "discoverable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "documents" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "experiences" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "eyesight" TEXT,
ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "jlptLearning" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "maxFeeUsd" INTEGER,
ADD COLUMN     "skills" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "tattoo" BOOLEAN,
ADD COLUMN     "weightKg" INTEGER;

-- CreateTable
CREATE TABLE "BusinessPlan" (
    "id" TEXT NOT NULL,
    "employerId" TEXT,
    "recruiterId" TEXT,
    "name" TEXT NOT NULL,
    "jobQuota" INTEGER NOT NULL,
    "boostQuota" INTEGER NOT NULL,
    "boostsUsed" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterPartner" (
    "id" TEXT NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "renewRequestedAt" TIMESTAMP(3),
    "departedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruiterPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobViewDay" (
    "jobId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobViewDay_pkey" PRIMARY KEY ("jobId","day")
);

-- CreateTable
CREATE TABLE "ApplicationNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "kind" "InterviewKind" NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'scheduled',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "platform" TEXT,
    "meetingUrl" TEXT,
    "location" TEXT,
    "note" TEXT,
    "partnerName" TEXT,
    "channels" TEXT[],
    "remind24h" BOOLEAN NOT NULL DEFAULT true,
    "remind2h" BOOLEAN NOT NULL DEFAULT true,
    "result" TEXT,
    "employerId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewAttendee" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "AttendeeStatus" NOT NULL DEFAULT 'pending',
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "InterviewAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_InterviewInterviewers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InterviewInterviewers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPlan_employerId_key" ON "BusinessPlan"("employerId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPlan_recruiterId_key" ON "BusinessPlan"("recruiterId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterPartner_recruiterId_employerId_key" ON "RecruiterPartner"("recruiterId", "employerId");

-- CreateIndex
CREATE INDEX "JobEvent_jobId_createdAt_idx" ON "JobEvent"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobViewDay_day_idx" ON "JobViewDay"("day");

-- CreateIndex
CREATE INDEX "ApplicationNote_applicationId_createdAt_idx" ON "ApplicationNote"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "Interview_employerId_startAt_idx" ON "Interview"("employerId", "startAt");

-- CreateIndex
CREATE INDEX "Interview_ownerId_startAt_idx" ON "Interview"("ownerId", "startAt");

-- CreateIndex
CREATE INDEX "InterviewAttendee_applicationId_idx" ON "InterviewAttendee"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewAttendee_interviewId_applicationId_key" ON "InterviewAttendee"("interviewId", "applicationId");

-- CreateIndex
CREATE INDEX "_InterviewInterviewers_B_index" ON "_InterviewInterviewers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Application_number_key" ON "Application"("number");

-- AddForeignKey
ALTER TABLE "BusinessPlan" ADD CONSTRAINT "BusinessPlan_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPlan" ADD CONSTRAINT "BusinessPlan_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "Recruiter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterPartner" ADD CONSTRAINT "RecruiterPartner_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "Recruiter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterPartner" ADD CONSTRAINT "RecruiterPartner_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Recruiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobViewDay" ADD CONSTRAINT "JobViewDay_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Recruiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Recruiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Recruiter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewAttendee" ADD CONSTRAINT "InterviewAttendee_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewAttendee" ADD CONSTRAINT "InterviewAttendee_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InterviewInterviewers" ADD CONSTRAINT "_InterviewInterviewers_A_fkey" FOREIGN KEY ("A") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InterviewInterviewers" ADD CONSTRAINT "_InterviewInterviewers_B_fkey" FOREIGN KEY ("B") REFERENCES "Recruiter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

