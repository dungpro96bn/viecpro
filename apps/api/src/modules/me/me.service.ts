import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  AuthUser,
  ChangePasswordInput,
  CompleteUploadInput,
  PushTokenInput,
  PresignUploadInput,
  PresignedUpload,
  SeekerDashboard,
  SessionItem,
} from '@viecpro/shared';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { authUserInclude, toAuthUser } from '../auth/auth-user.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { SessionService } from '../auth/session.service.js';
import { JobMapper, PUBLIC_JOB_STATUSES, recruiterSummarySelect } from '../jobs/job.mapper.js';
import { JobsService } from '../jobs/jobs.service.js';
import { UploadService } from '../../core/assets/upload.service.js';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetUrlService,
    private readonly sessions: SessionService,
    private readonly jobs: JobsService,
    private readonly mapper: JobMapper,
    private readonly uploads: UploadService,
  ) {}

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: authUserInclude });
    if (!user || user.deletedAt) throw new ApiException('UNAUTHORIZED', 'Tài khoản không tồn tại', HttpStatus.UNAUTHORIZED);
    return toAuthUser(user, this.assets);
  }

  /** Các ô số liệu trên trang tổng quan tài khoản ứng viên */
  async dashboard(userId: string): Promise<SeekerDashboard> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400_000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400_000);
    const soon = new Date(now.getTime() + 7 * 86400_000);

    const [appTotal, appUpdated, nextInterview, savedTotal, savedExpiring, views7, viewsPrev, newMatching, profile] = await Promise.all([
      this.prisma.application.count({ where: { userId } }),
      this.prisma.application.count({ where: { userId, updatedAt: { gte: weekAgo }, status: { not: 'submitted' } } }),
      this.prisma.application.findFirst({
        where: { userId, status: 'interview', interviewAt: { gte: now } },
        orderBy: { interviewAt: 'asc' },
        include: { job: { select: { title: true } } },
      }),
      this.prisma.savedJob.count({ where: { userId, job: { status: { in: PUBLIC_JOB_STATUSES } } } }),
      this.prisma.savedJob.count({ where: { userId, job: { status: 'open', deadline: { gte: now, lte: soon } } } }),
      this.prisma.profileView.count({ where: { seekerId: userId, createdAt: { gte: weekAgo } } }),
      this.prisma.profileView.count({ where: { seekerId: userId, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
      this.jobs.countNewMatching(userId),
      this.prisma.seekerProfile.findUnique({ where: { userId }, include: { consultant: { select: { ...recruiterSummarySelect, phone: true, online: true } } } }),
    ]);

    return {
      applications: { total: appTotal, updated: appUpdated },
      nextInterview: nextInterview?.interviewAt
        ? { applicationId: nextInterview.id, jobTitle: nextInterview.job.title, at: nextInterview.interviewAt.toISOString() }
        : null,
      saved: { total: savedTotal, expiringSoon: savedExpiring },
      profileViews: { last7Days: views7, delta: views7 - viewsPrev },
      newMatchingJobs: newMatching,
      consultant: profile?.consultant ? this.mapper.recruiter(profile.consultant) : null,
      // Cán bộ phụ trách chính ứng viên này – được thấy số điện thoại đầy đủ
      consultantContact: profile?.consultant ? { phone: profile.consultant.phone, online: profile.consultant.online } : null,
    };
  }

  async changePassword(userId: string, sessionId: string, input: ChangePasswordInput) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new ApiException('INVALID_CREDENTIALS', 'Mật khẩu hiện tại không đúng', HttpStatus.BAD_REQUEST, { currentPassword: 'Mật khẩu hiện tại không đúng' });
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date() } });
    // Giữ phiên hiện tại, đăng xuất các thiết bị khác
    await this.prisma.session.updateMany({ where: { userId, id: { not: sessionId }, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async sessionsList(userId: string, currentSessionId: string): Promise<SessionItem[]> {
    const rows = await this.sessions.list(userId);
    return rows.map((s) => ({
      id: s.id,
      platform: s.platform,
      deviceName: s.deviceName,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.sessions.revoke(sessionId, userId);
    if (!result.count) throw ApiException.notFound('Không tìm thấy phiên đăng nhập');
  }

  async savePushToken(userId: string, input: PushTokenInput) {
    // Một token chỉ thuộc một người dùng (đổi tài khoản trên cùng máy)
    await this.prisma.pushToken.upsert({
      where: { token: input.token },
      create: { userId, ...input },
      update: { userId, platform: input.platform, deviceName: input.deviceName, appVersion: input.appVersion },
    });
  }

  async removePushToken(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  presignUpload(userId: string, input: PresignUploadInput): Promise<PresignedUpload> {
    return this.uploads.presign(userId, input);
  }

  completeUpload(userId: string, input: CompleteUploadInput): Promise<{ assetUrl: string; assetPath: string }> {
    return this.uploads.complete(userId, input);
  }

  /**
   * Xoá tài khoản (bắt buộc với app trên App Store / Google Play).
   * Xoá mềm + ẩn danh thông tin liên hệ; hồ sơ ứng tuyển đã gửi giữ lại cho NTD theo chính sách.
   */
  async deleteAccount(userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), phone: null, email: null, googleId: null, passwordHash: null, name: 'Tài khoản đã xoá', avatarUrl: null },
      }),
      this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.pushToken.deleteMany({ where: { userId } }),
      this.prisma.savedJob.deleteMany({ where: { userId } }),
      this.prisma.follow.deleteMany({ where: { userId } }),
    ]);
  }
}
