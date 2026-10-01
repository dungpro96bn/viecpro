/**
 * Tạo tài khoản quản trị (cách DUY NHẤT ngoài trang quản lý admin – RULE-BE.md mục 6).
 *   npm run admin:create -w @viecpro/api -- --email ten@viecpro.vn --name "Họ Tên" --role moderator
 * Mật khẩu ngẫu nhiên in ra MỘT lần; 2FA bật ở lần đăng nhập đầu.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/modules/auth/password.js';

try {
  process.loadEnvFile();
} catch {
  /* dùng biến môi trường hệ thống */
}

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'moderator' } } });
if (!values.email || !values.name) {
  console.error('Thiếu tham số. Ví dụ: --email ten@viecpro.vn --name "Họ Tên" --role moderator');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const role = await prisma.adminRole.findUnique({ where: { key: values.role! } });
  if (!role) throw new Error(`Không có vai trò "${values.role}". Chạy seed hoặc tạo vai trò trước.`);
  const email = values.email!.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new Error(`Email ${email} đã tồn tại`);

  const password = randomBytes(12).toString('base64url');
  await prisma.user.create({ data: { role: 'admin', name: values.name!, email, passwordHash: await hashPassword(password), adminRoleId: role.id } });
  console.log(`✔ Đã tạo ${role.name}: ${email}`);
  console.log(`  Mật khẩu tạm (chỉ hiện 1 lần): ${password}`);
}

main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
