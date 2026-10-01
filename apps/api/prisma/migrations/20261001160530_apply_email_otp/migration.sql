-- CreateEnum
CREATE TYPE "EmailOtpPurpose" AS ENUM ('apply');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailOtpCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" "EmailOtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailOtpCode_email_purpose_createdAt_idx" ON "EmailOtpCode"("email", "purpose", "createdAt");

