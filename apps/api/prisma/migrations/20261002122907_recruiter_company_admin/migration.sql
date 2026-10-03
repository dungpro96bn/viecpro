-- AlterTable
ALTER TABLE "Recruiter" ADD COLUMN     "companyAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Dữ liệu cũ: cán bộ có tài khoản tạo sớm nhất của mỗi doanh nghiệp làm quản trị viên doanh nghiệp
UPDATE "Recruiter" r
SET "companyAdmin" = true
FROM (
  SELECT DISTINCT ON ("employerId") id
  FROM "Recruiter"
  WHERE "employerId" IS NOT NULL AND "userId" IS NOT NULL
  ORDER BY "employerId", "createdAt" ASC
) first_member
WHERE r.id = first_member.id;
