-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'join_company';

-- AlterTable
ALTER TABLE "Recruiter" ADD COLUMN     "leftAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MemberInvite" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "title" TEXT NOT NULL,
    "companyAdmin" BOOLEAN NOT NULL DEFAULT false,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberInvite_tokenHash_key" ON "MemberInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "MemberInvite_employerId_createdAt_idx" ON "MemberInvite"("employerId", "createdAt");

-- CreateIndex
CREATE INDEX "MemberInvite_phone_idx" ON "MemberInvite"("phone");

-- AddForeignKey
ALTER TABLE "MemberInvite" ADD CONSTRAINT "MemberInvite_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberInvite" ADD CONSTRAINT "MemberInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Recruiter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
