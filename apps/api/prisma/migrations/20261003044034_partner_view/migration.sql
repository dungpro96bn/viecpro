-- CreateTable
CREATE TABLE "PartnerView" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "viewerRecruiterId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerView_applicationId_createdAt_idx" ON "PartnerView"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerView_viewerRecruiterId_applicationId_createdAt_idx" ON "PartnerView"("viewerRecruiterId", "applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "PartnerView" ADD CONSTRAINT "PartnerView_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerView" ADD CONSTRAINT "PartnerView_viewerRecruiterId_fkey" FOREIGN KEY ("viewerRecruiterId") REFERENCES "Recruiter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerView" ADD CONSTRAINT "PartnerView_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
