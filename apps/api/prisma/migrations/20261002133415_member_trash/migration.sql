-- AlterTable
ALTER TABLE "Recruiter" ADD COLUMN     "purgedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" TEXT;

-- AddForeignKey
ALTER TABLE "Recruiter" ADD CONSTRAINT "Recruiter_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "Recruiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
