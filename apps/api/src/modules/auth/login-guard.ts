import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../core/http/api-exception.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';

/** Khoá tạm sau 10 lần đăng nhập sai liên tiếp, trong 15 phút (RULE-BE.md mục 5.3) */
export const MAX_FAILED_LOGINS = 10;
export const LOGIN_LOCK_MINUTES = 15;

type LoginUser = { id: string; failedLogins: number; loginLockedUntil: Date | null };

export const invalidCredentials = () =>
  new ApiException('INVALID_CREDENTIALS', 'Email / số điện thoại hoặc mật khẩu không đúng', HttpStatus.UNAUTHORIZED);

/** Cán bộ đã bị gỡ khỏi doanh nghiệp: không đăng nhập / vào khu quản lý được nữa */
export const memberRemoved = () =>
  new ApiException('MEMBER_REMOVED', 'Bạn đã được gỡ khỏi doanh nghiệp trên viecpro. Liên hệ quản trị viên doanh nghiệp nếu cần cấp lại quyền.', HttpStatus.FORBIDDEN);

/** Tài khoản NTD được tạo cho doanh nghiệp – gỡ khỏi doanh nghiệp thì không cấp phiên mới (mật khẩu hay Google) */
export async function assertStillMember(prisma: PrismaService, user: { id: string; role: string }) {
  if (user.role !== 'employer') return;
  const left = await prisma.recruiter.findFirst({ where: { userId: user.id, leftAt: { not: null } }, select: { id: true } });
  if (left) throw memberRemoved();
}

export async function assertNotTemporarilyLocked(user: LoginUser | null) {
  if (user?.loginLockedUntil && user.loginLockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.loginLockedUntil.getTime() - Date.now()) / 60_000);
    throw new ApiException('RATE_LIMITED', `Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutes} phút`, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export async function registerFailedLogin(prisma: PrismaService, user: LoginUser) {
  // Hết thời gian khoá thì đếm lại từ đầu
  const base = user.loginLockedUntil && user.loginLockedUntil.getTime() <= Date.now() ? 0 : user.failedLogins;
  const failed = base + 1;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
      loginLockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000) : user.loginLockedUntil,
    },
  });
}

export async function clearFailedLogins(prisma: PrismaService, user: LoginUser) {
  if (user.failedLogins || user.loginLockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, loginLockedUntil: null } });
  }
}
