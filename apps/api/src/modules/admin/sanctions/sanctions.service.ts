import { HttpStatus, Injectable } from '@nestjs/common';
import { WEB_LINKS } from '@viecpro/shared';
import type { Request } from 'express';
import { AuditService } from '../../../core/audit/audit.service.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { NotificationsService } from '../../notifications/notifications.service.js';

/** Đánh dấu tin / tài khoản bị ẩn do NTD bị tạm khoá – để mở khoá chỉ hoàn tác đúng phần này */
export const EMPLOYER_SUSPEND_MARK = 'Nhà tuyển dụng đang bị tạm khoá';
export const BAN_MARK = 'Khoá vĩnh viễn';

export type SanctionTarget = { kind: 'company'; employerId: string } | { kind: 'individual'; recruiterId: string };

/**
 * Xử phạt dùng chung cho trang Nhà tuyển dụng (A-05) và Báo cáo vi phạm (A-06):
 * cảnh cáo, gỡ tin, tạm khoá / mở khoá NTD, khoá vĩnh viễn người dùng. Mọi thao tác ghi nhật ký.
 */
@Injectable()
export class SanctionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tài khoản đăng nhập của NTD: mọi thành viên công ty, hoặc chính NTD cá nhân */
  async memberUserIds(target: SanctionTarget): Promise<string[]> {
    const recruiters = await this.prisma.recruiter.findMany({
      where: target.kind === 'company' ? { employerId: target.employerId } : { id: target.recruiterId },
      select: { userId: true },
    });
    return recruiters.map((r) => r.userId).filter((id): id is string => !!id);
  }

  private jobScope(target: SanctionTarget): Prisma.JobWhereInput {
    return target.kind === 'company' ? { employerId: target.employerId } : { recruiterId: target.recruiterId };
  }

  async warn(adminId: string, target: SanctionTarget, reason: string, req: Request) {
    const userIds = await this.memberUserIds(target);
    await this.audit.log({ actorId: adminId, action: 'employer.warn', targetType: target.kind === 'company' ? 'employer' : 'recruiter', targetId: target.kind === 'company' ? target.employerId : target.recruiterId, after: { reason } }, req);
    for (const userId of userIds) {
      await this.notifications.notify(userId, 'account.warning', { title: 'Cảnh cáo từ bộ phận kiểm duyệt viecpro', body: reason, link: WEB_LINKS.employerAccount });
    }
  }

  /** Tạm khoá: ẩn mọi tin đang hiển thị, khoá + đăng xuất mọi thành viên */
  async suspend(adminId: string, target: SanctionTarget, reason: string, req: Request) {
    const now = new Date();
    const userIds = await this.memberUserIds(target);
    const targetType = target.kind === 'company' ? 'employer' : 'recruiter';
    const targetId = target.kind === 'company' ? target.employerId : target.recruiterId;
    await this.prisma.$transaction(async (tx) => {
      if (target.kind === 'company') {
        const e = await tx.employer.findUniqueOrThrow({ where: { id: target.employerId }, select: { suspendedAt: true } });
        if (e.suspendedAt) throw new ApiException('CONFLICT', 'Nhà tuyển dụng đang bị tạm khoá', HttpStatus.CONFLICT);
        await tx.employer.update({ where: { id: target.employerId }, data: { suspendedAt: now, suspendReason: reason } });
      }
      const jobs = await tx.job.updateMany({ where: { ...this.jobScope(target), status: 'open' }, data: { status: 'paused', suspendedAt: now, suspendReason: EMPLOYER_SUSPEND_MARK } });
      const users = await tx.user.updateMany({ where: { id: { in: userIds }, lockedAt: null }, data: { lockedAt: now, lockReason: `${EMPLOYER_SUSPEND_MARK}: ${reason}` } });
      await tx.session.updateMany({ where: { userId: { in: userIds }, revokedAt: null }, data: { revokedAt: now } });
      await this.audit.log({ actorId: adminId, action: 'employer.suspend', targetType, targetId, after: { reason, hiddenJobs: jobs.count, lockedUsers: users.count } }, req, tx);
    });
  }

  /** Mở khoá: chỉ hoàn tác phần do tạm khoá gây ra (tin bị ẩn vì báo cáo khác vẫn giữ ẩn) */
  async unsuspend(adminId: string, target: SanctionTarget, req: Request) {
    const userIds = await this.memberUserIds(target);
    const targetType = target.kind === 'company' ? 'employer' : 'recruiter';
    const targetId = target.kind === 'company' ? target.employerId : target.recruiterId;
    await this.prisma.$transaction(async (tx) => {
      let verified = true;
      if (target.kind === 'company') {
        const e = await tx.employer.findUniqueOrThrow({ where: { id: target.employerId }, select: { suspendedAt: true, verified: true } });
        if (!e.suspendedAt) throw new ApiException('CONFLICT', 'Nhà tuyển dụng không bị tạm khoá', HttpStatus.CONFLICT);
        verified = e.verified;
        await tx.employer.update({ where: { id: target.employerId }, data: { suspendedAt: null, suspendReason: null } });
      }
      const users = await tx.user.updateMany({ where: { id: { in: userIds }, lockReason: { startsWith: EMPLOYER_SUSPEND_MARK } }, data: { lockedAt: null, lockReason: null } });
      if (target.kind === 'individual' && !users.count) throw new ApiException('CONFLICT', 'Nhà tuyển dụng không bị tạm khoá', HttpStatus.CONFLICT);
      // NTD chưa xác minh: tin quay lại hàng chờ duyệt thay vì hiển thị ngay
      const jobs = await tx.job.updateMany({
        where: { ...this.jobScope(target), suspendReason: EMPLOYER_SUSPEND_MARK },
        data: { status: verified ? 'open' : 'pending', suspendedAt: null, suspendReason: null, ...(!verified && { submittedAt: new Date() }) },
      });
      await this.audit.log({ actorId: adminId, action: 'employer.unsuspend', targetType, targetId, after: { restoredJobs: jobs.count, unlockedUsers: users.count } }, req, tx);
    });
  }

  /** Gỡ tin vi phạm: đóng + đánh dấu bị gỡ (NTD không tự mở lại) */
  async removeJob(adminId: string, jobId: string, reason: string, req: Request) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { title: true, status: true, recruiter: { select: { userId: true } } } });
    if (!job) throw ApiException.notFound('Không tìm thấy tin');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: jobId }, data: { status: 'closed', suspendedAt: now, suspendReason: `Gỡ do vi phạm: ${reason}` } });
      await tx.jobEvent.create({ data: { jobId, action: 'remove', note: reason } });
      await this.audit.log({ actorId: adminId, action: 'job.remove', targetType: 'job', targetId: jobId, before: { status: job.status }, after: { status: 'closed', reason } }, req, tx);
    });
    if (job.recruiter.userId) {
      await this.notifications.notify(job.recruiter.userId, 'job.removed', { title: `Tin bị gỡ do vi phạm: ${job.title}`, body: reason, link: WEB_LINKS.employerJobs });
    }
  }

  /** Khoá vĩnh viễn một tài khoản người dùng (không áp dụng cho admin) */
  async banUser(adminId: string, userId: string, reason: string, req: Request) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: userId }, select: { role: true, lockedAt: true, lockReason: true } });
      if (!u || u.role === 'admin') throw ApiException.notFound('Không tìm thấy tài khoản');
      await tx.user.update({ where: { id: userId }, data: { lockedAt: now, lockReason: `${BAN_MARK}: ${reason}` } });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      await this.audit.log({ actorId: adminId, action: 'user.ban', targetType: 'user', targetId: userId, before: { lockedAt: u.lockedAt, reason: u.lockReason }, after: { lockedAt: now, reason } }, req, tx);
    });
  }
}
