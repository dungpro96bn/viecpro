import { HttpStatus, Injectable } from '@nestjs/common';
import { INDUSTRIES, WEB_LINKS, type Industry, type ModerationItem, type ModerationQueueQuery, type Paginated, type RejectJobInput } from '@viecpro/shared';
import type { Request } from 'express';
import { AssetUrlService } from '../../../core/assets/asset-url.service.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { median, scoreJobRisk } from './risk.js';

/** Hạn xử lý một tin chờ duyệt (phút) */
export const MODERATION_SLA_MINUTES = 120;

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetUrlService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Hàng chờ kiểm duyệt, kèm điểm rủi ro, sắp theo hạn SLA */
  async queue(limit: number): Promise<{ total: number; items: ModerationItem[] }> {
    return this.loadQueue(limit, 0);
  }

  /** Danh sách quản trị có phân trang và lọc tìm kiếm phía máy chủ */
  async list(query: ModerationQueueQuery): Promise<Paginated<ModerationItem>> {
    const { page, limit, q } = query;
    const { total, items } = await this.loadQueue(limit, (page - 1) * limit, q);
    return { items, page, limit, total, hasMore: page * limit < total };
  }

  private async loadQueue(limit: number, skip: number, q?: string): Promise<{ total: number; items: ModerationItem[] }> {
    const where = {
      status: 'pending' as const,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { employer: { is: { name: { contains: q, mode: 'insensitive' as const } } } },
              { employer: { is: { shortName: { contains: q, mode: 'insensitive' as const } } } },
              { recruiter: { is: { name: { contains: q, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };
    const [total, jobs] = await Promise.all([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        orderBy: { submittedAt: 'asc' },
        take: limit,
        skip,
        select: {
          id: true,
          title: true,
          imageUrl: true,
          salary: true,
          program: true,
          industry: true,
          employerId: true,
          submittedAt: true,
          createdAt: true,
          recruiter: { select: { name: true } },
          employer: { select: { name: true, shortName: true, verified: true, createdAt: true } },
          _count: { select: { reports: { where: { status: 'open' } } } },
        },
      }),
    ]);
    if (!jobs.length) return { total, items: [] };

    const since = new Date(Date.now() - 60 * 86400_000);
    const [peers, recentTitles, employerReports] = await Promise.all([
      this.prisma.job.findMany({ where: { status: 'open' }, select: { program: true, industry: true, salary: true } }),
      this.prisma.job.findMany({ where: { createdAt: { gte: since }, status: { in: ['open', 'closed', 'rejected'] } }, select: { title: true } }),
      this.prisma.report.groupBy({
        by: ['employerId'],
        where: { status: 'open', employerId: { in: jobs.map((j) => j.employerId).filter((id): id is string => !!id) } },
        _count: { _all: true },
      }),
    ]);
    const titles = new Set(recentTitles.map((t) => t.title.toLowerCase()));
    const reportsByEmployer = new Map(employerReports.map((r) => [r.employerId, r._count._all]));
    const now = Date.now();

    const items = jobs.map((j) => {
      const risk = scoreJobRisk({
        openReports: j._count.reports + (j.employerId ? reportsByEmployer.get(j.employerId) ?? 0 : 0),
        employerVerified: !!j.employer?.verified,
        employerAgeDays: j.employer ? (now - j.employer.createdAt.getTime()) / 86400_000 : 0,
        salary: j.salary,
        medianSalary: median(peers.filter((p) => p.program === j.program && p.industry === j.industry).map((p) => p.salary)),
        duplicate: titles.has(j.title.toLowerCase()),
      });
      const submitted = (j.submittedAt ?? j.createdAt).getTime();
      return {
        id: j.id,
        title: j.title,
        imageUrl: this.assets.url(j.imageUrl),
        employerName: j.employer?.shortName ?? j.employer?.name ?? j.recruiter.name,
        submittedAt: (j.submittedAt ?? j.createdAt).toISOString(),
        program: j.program,
        industry: (INDUSTRIES as readonly string[]).includes(j.industry) ? (j.industry as Industry) : 'Khác',
        salary: j.salary,
        employerVerified: !!j.employer?.verified,
        reportCount: j._count.reports + (j.employerId ? reportsByEmployer.get(j.employerId) ?? 0 : 0),
        flag: risk.flag,
        risk: risk.score,
        reasons: risk.reasons,
        slaMinutes: Math.round(MODERATION_SLA_MINUTES - (now - submitted) / 60_000),
      };
    });
    return { total, items };
  }

  private async pendingJob(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, include: { recruiter: { select: { userId: true } } } });
    if (!job) throw ApiException.notFound('Không tìm thấy đơn hàng');
    if (job.status !== 'pending') throw new ApiException('CONFLICT', 'Tin này đã được xử lý', HttpStatus.CONFLICT);
    return job;
  }

  async approve(adminId: string, jobId: string, req: Request) {
    const job = await this.pendingJob(jobId);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: jobId }, data: { status: 'open', publishedAt: job.publishedAt ?? now, moderatedAt: now, moderatedById: adminId, rejectReason: null } });
      await this.audit.log({ actorId: adminId, action: 'job.approve', targetType: 'job', targetId: jobId, before: { status: job.status }, after: { status: 'open' } }, req, tx);
    });
    if (job.recruiter.userId) {
      await this.notifications.notify(job.recruiter.userId, 'job.approved', { title: `Tin đã được duyệt: ${job.title}`, link: WEB_LINKS.job(job.slug) });
    }
  }

  async reject(adminId: string, jobId: string, input: RejectJobInput, req: Request) {
    const job = await this.pendingJob(jobId);
    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: jobId }, data: { status: 'rejected', moderatedAt: new Date(), moderatedById: adminId, rejectReason: input.reason } });
      await this.audit.log(
        { actorId: adminId, action: 'job.reject', targetType: 'job', targetId: jobId, before: { status: job.status }, after: { status: 'rejected', reason: input.reason } },
        req,
        tx,
      );
    });
    if (job.recruiter.userId) {
      await this.notifications.notify(job.recruiter.userId, 'job.rejected', { title: `Tin chưa được duyệt: ${job.title}`, body: input.reason, link: WEB_LINKS.employerJobs });
    }
  }
}
