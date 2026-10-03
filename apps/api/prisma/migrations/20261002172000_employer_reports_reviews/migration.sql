CREATE TABLE "EmployerReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT,
    "recruiterId" TEXT NOT NULL,
    "employerId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(1500) NOT NULL,
    "response" VARCHAR(1500),
    "responseById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployerReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployerReview_applicationId_key" ON "EmployerReview"("applicationId");
CREATE INDEX "EmployerReview_recruiterId_createdAt_idx" ON "EmployerReview"("recruiterId", "createdAt");
CREATE INDEX "EmployerReview_employerId_createdAt_idx" ON "EmployerReview"("employerId", "createdAt");

ALTER TABLE "EmployerReview" ADD CONSTRAINT "EmployerReview_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployerReview" ADD CONSTRAINT "EmployerReview_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployerReview" ADD CONSTRAINT "EmployerReview_recruiterId_fkey"
    FOREIGN KEY ("recruiterId") REFERENCES "Recruiter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployerReview" ADD CONSTRAINT "EmployerReview_employerId_fkey"
    FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployerReview" ADD CONSTRAINT "EmployerReview_responseById_fkey"
    FOREIGN KEY ("responseById") REFERENCES "Recruiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
