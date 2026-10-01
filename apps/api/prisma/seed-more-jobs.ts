/**
 * Thêm đơn hàng demo vào database đang có (KHÔNG xoá dữ liệu cũ). CHỈ dùng cho môi trường dev.
 * Chạy: npm run db:seed:jobs            (mặc định 120 đơn)
 *       npm run db:seed:jobs -- 300     (số lượng tuỳ ý, tối đa 2000)
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedBulkJobs } from './seed-jobs.js';

try {
  process.loadEnvFile();
} catch {
  /* dùng biến môi trường hệ thống */
}

if (process.env.NODE_ENV === 'production') throw new Error('Không chạy seed ở production');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const count = Math.min(Math.max(Number(process.argv[2] ?? 120) || 120, 1), 2000);

  const recruiters = await prisma.recruiter.findMany({ where: { employer: { verified: true } }, select: { id: true, employerId: true } });
  if (!recruiters.length) throw new Error('Chưa có nhà tuyển dụng đã xác minh – chạy npm run db:seed trước');
  const moderator = await prisma.user.findFirst({ where: { role: 'admin' }, orderBy: { createdAt: 'asc' }, select: { id: true } });

  // Mã tiếp theo sau mã lớn nhất hiện có (tối thiểu VP-10400)
  const codes = await prisma.job.findMany({ select: { code: true } });
  const maxNumber = Math.max(10399, ...codes.map((c) => Number(c.code.replace(/^VP-/, '')) || 0));

  const jobs = await seedBulkJobs(prisma, { count, startNumber: maxNumber + 1, recruiters, moderatorId: moderator?.id, seed: maxNumber });
  console.log(`✔ Đã thêm ${jobs.length} đơn (VP-${maxNumber + 1} → VP-${maxNumber + jobs.length}), ${jobs.filter((j) => j.status === 'open').length} đang tuyển`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
