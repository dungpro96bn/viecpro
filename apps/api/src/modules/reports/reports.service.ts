import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { REPORT_REASON_LABEL, WEB_LINKS, type MyReportItem, type Paginated, type PaginationQuery, type ReportCreateInput, type ReportCreated, type ReportReason } from '@viecpro/shared';
import { createHmac } from 'node:crypto';
import { ENV, type Env } from '../../config/env.js';
import { ApiException } from '../../core/http/api-exception.js';
import { pageArgs, paginated } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AUTO_HIDE_WINDOW_MS, dueAtFor, reportCode, severityOf, shouldAutoHide } from './report-rules.js';

type Target = { targetType: 'job' | 'employer' | 'recruiter'; jobId?: string; employerId?: string | null; recruiterId?: string | null };

/** Báo cáo vi phạm từ người dùng / khách (M18). Xử lý ở admin (A-06) */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Dấu vân tay ẩn danh của khách (HMAC IP) – chống một người gửi nhiều lần, không lưu IP gốc */
  private fingerprint(ip: string | undefined) {
    return createHmac('sha256', this.env.OTP_SECRET).update(`report:${ip ?? 'unknown'}`).digest('hex').slice(0, 32);
  }

  /** Tìm đối tượng theo id hoặc slug. Tin nháp / chưa duyệt không công khai nên coi như không tồn tại */
  private async resolveTarget(input: ReportCreateInput): Promise<Target> {
    const key = input.target;
    if (input.targetType === 'job') {
      const job = await this.prisma.job.findFirst({
        where: { OR: [{ id: key }, { slug: key }], status: { in: ['open', 'closed', 'paused'] } },
        select: { id: true, employerId: true, recruiterId: true },
      });
      if (!job) throw ApiException.notFound('Không tìm thấy tin tuyển dụng');
      return { targetType: 'job', jobId: job.id, employerId: job.employerId, recruiterId: job.recruiterId };
    }
    if (input.targetType === 'employer') {
      const e = await this.prisma.employer.findFirst({ where: { OR: [{ id: key }, { slug: key }] }, select: { id: true } });
      if (!e) throw ApiException.notFound('Không tìm thấy doanh nghiệp');
      return { targetType: 'employer', employerId: e.id };
    }
    const r = await this.prisma.recruiter.findFirst({ where: { OR: [{ id: key }, { slug: key }] }, select: { id: true, employerId: true } });
    if (!r) throw ApiException.notFound('Không tìm thấy nhà tuyển dụng');
    return { targetType: 'recruiter', recruiterId: r.id, employerId: r.employerId };
  }

  private targetWhere(t: Target): Prisma.ReportWhereInput {
    if (t.targetType === 'job') return { targetType: 'job', jobId: t.jobId };
    if (t.targetType === 'employer') return { targetType: 'employer', employerId: t.employerId };
    return { targetType: 'recruiter', recruiterId: t.recruiterId };
  }

  async create(input: ReportCreateInput, reporterId: string | undefined, ip: string | undefined): Promise<ReportCreated> {
    const target = await this.resolveTarget(input);
    const fingerprint = reporterId ? null : this.fingerprint(ip);
    const who: Prisma.ReportWhereInput = reporterId ? { reporterId } : { reporterFingerprint: fingerprint };

    const dup = await this.prisma.report.findFirst({ where: { ...this.targetWhere(target), ...who, status: { in: ['open', 'investigating'] } }, select: { id: true } });
    if (dup) throw new ApiException('ALREADY_REPORTED', 'Bạn đã báo cáo nội dung này, chúng tôi đang xử lý', HttpStatus.CONFLICT);

    const now = new Date();
    const severity = severityOf(input.reason);
    const report = await this.prisma.report.create({
      data: {
        targetType: target.targetType,
        jobId: target.jobId,
        employerId: target.employerId,
        recruiterId: target.recruiterId,
        reporterId: reporterId ?? null,
        reporterFingerprint: fingerprint,
        reporterContact: reporterId ? null : (input.contact ?? null),
        reason: input.reason,
        detail: input.detail ?? null,
        severity,
        dueAt: dueAtFor(severity, now),
      },
      select: { number: true, dueAt: true },
    });

    if (target.targetType === 'job' && input.reason === 'fee') await this.maybeAutoHide(target.jobId!, now);
    return { code: reportCode(report.number), dueAt: report.dueAt!.toISOString() };
  }

  /** ≥ 3 người khác nhau báo "thu phí" trong 24 giờ → tạm ẩn tin + báo NTD và kiểm duyệt viên (spec 3.9) */
  private async maybeAutoHide(jobId: string, now: Date) {
    const rows = await this.prisma.report.findMany({
      where: { targetType: 'job', jobId, reason: 'fee', createdAt: { gte: new Date(now.getTime() - AUTO_HIDE_WINDOW_MS) } },
      select: { reporterId: true, reporterFingerprint: true },
    });
    const distinct = new Set(rows.map((r) => r.reporterId ?? `fp:${r.reporterFingerprint}`)).size;
    if (!shouldAutoHide(distinct)) return;

    const reason = 'Tự tạm ẩn: nhiều người báo cáo thu phí ngoài hợp đồng trong 24 giờ';
    const hidden = await this.prisma.job.updateMany({ where: { id: jobId, status: 'open', suspendedAt: null }, data: { status: 'paused', suspendedAt: now, suspendReason: reason } });
    if (!hidden.count) return;
    const job = await this.prisma.job.findUniqueOrThrow({ where: { id: jobId }, select: { title: true, code: true, recruiter: { select: { userId: true } } } });
    await this.prisma.jobEvent.create({ data: { jobId, action: 'auto_hide', note: reason } });
    this.logger.warn(`Tin ${job.code} tự tạm ẩn sau ${distinct} báo cáo thu phí`);

    if (job.recruiter.userId) {
      await this.notifications.notify(job.recruiter.userId, 'job.suspended', {
        title: `Tin tạm ẩn để kiểm tra: ${job.title}`,
        body: 'Tin nhận nhiều báo cáo về thu phí. Bộ phận kiểm duyệt sẽ liên hệ trong 2 giờ làm việc.',
        link: WEB_LINKS.employerJobs,
      });
    }
    const moderators = await this.prisma.user.findMany({
      where: { role: 'admin', lockedAt: null, deletedAt: null, adminRole: { permissions: { has: 'jobs.moderate' } } },
      select: { id: true },
    });
    for (const m of moderators) {
      await this.notifications.notify(m.id, 'report.auto_hide', { title: `Tin ${job.code} đã tự tạm ẩn`, body: `${distinct} báo cáo thu phí trong 24 giờ – cần xử lý trong 2 giờ`, link: '/bao-cao-vi-pham' });
    }
  }

  /** Báo cáo của tôi – chỉ trạng thái và kết quả rút gọn, không có ghi chú nội bộ / thông tin người xử lý */
  async mine(userId: string, query: PaginationQuery): Promise<Paginated<MyReportItem>> {
    const where = { reporterId: userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
        select: {
          number: true, targetType: true, reason: true, status: true, decision: true, createdAt: true,
          job: { select: { title: true } }, employer: { select: { name: true } }, recruiter: { select: { name: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);
    const items = rows.map((r) => ({
      code: reportCode(r.number),
      targetType: r.targetType,
      targetName: (r.targetType === 'job' ? r.job?.title : r.targetType === 'employer' ? r.employer?.name : r.recruiter?.name) ?? 'Nội dung đã gỡ',
      reason: REPORT_REASON_LABEL[r.reason as ReportReason] ?? r.reason,
      status: r.status,
      outcome: r.status === 'resolved' ? 'Đã xác nhận vi phạm và xử lý' : r.status === 'dismissed' ? 'Chưa đủ căn cứ vi phạm' : null,
      createdAt: r.createdAt.toISOString(),
    }));
    return paginated(items, total, query);
  }
}
