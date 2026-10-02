-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('job', 'employer', 'recruiter', 'user');

-- CreateEnum
CREATE TYPE "ReportSeverity" AS ENUM ('critical', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "ReportDecision" AS ENUM ('dismiss', 'warn', 'remove_job', 'suspend', 'ban');

-- CreateEnum
CREATE TYPE "AlertFrequency" AS ENUM ('instant', 'daily', 'weekly');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailOtpPurpose" ADD VALUE 'reset_password';
ALTER TYPE "EmailOtpPurpose" ADD VALUE 'change_email';

-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'change_phone';

-- AlterEnum
ALTER TYPE "ReportStatus" ADD VALUE 'investigating';

-- AlterTable
ALTER TABLE "Employer" ADD COLUMN     "suspendReason" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "suspendReason" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "decision" "ReportDecision",
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "number" SERIAL NOT NULL,
ADD COLUMN     "recruiterId" TEXT,
ADD COLUMN     "reporterContact" TEXT,
ADD COLUMN     "reporterFingerprint" TEXT,
ADD COLUMN     "severity" "ReportSeverity" NOT NULL DEFAULT 'medium',
ADD COLUMN     "targetType" "ReportTarget" NOT NULL DEFAULT 'job',
ADD COLUMN     "targetUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserSetting" (
    "userId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "phoneVisibility" TEXT NOT NULL DEFAULT 'applied',
    "notifyPrefs" JSONB NOT NULL DEFAULT '{}',
    "quietEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietFrom" TEXT NOT NULL DEFAULT '22:00',
    "quietTo" TEXT NOT NULL DEFAULT '07:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSetting_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "JobAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "criteria" JSONB NOT NULL DEFAULT '{}',
    "channels" TEXT[],
    "frequency" "AlertFrequency" NOT NULL DEFAULT 'daily',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobAlert_userId_idx" ON "JobAlert"("userId");

-- CreateIndex
CREATE INDEX "JobAlert_enabled_frequency_idx" ON "JobAlert"("enabled", "frequency");

-- CreateIndex
CREATE UNIQUE INDEX "Report_number_key" ON "Report"("number");

-- CreateIndex
CREATE INDEX "Report_status_dueAt_idx" ON "Report"("status", "dueAt");

-- CreateIndex
CREATE INDEX "Report_recruiterId_idx" ON "Report"("recruiterId");

-- CreateIndex
CREATE INDEX "Report_targetUserId_idx" ON "Report"("targetUserId");

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "Recruiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSetting" ADD CONSTRAINT "UserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAlert" ADD CONSTRAINT "JobAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: báo cáo cũ chưa có hạn xử lý → 24 giờ kể từ lúc gửi (mức trung bình)
UPDATE "Report" SET "dueAt" = "createdAt" + interval '24 hours' WHERE "dueAt" IS NULL;
