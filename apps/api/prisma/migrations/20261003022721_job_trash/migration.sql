-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "purgedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Job_deletedAt_idx" ON "Job"("deletedAt");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "Recruiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
