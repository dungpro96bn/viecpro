import { HttpStatus, Injectable } from '@nestjs/common';
import {
  INDUSTRIES,
  REPORT_REASON_LABEL,
  WEB_LINKS,
  jobDetailContentSchema,
  type Industry,
  type JobRemoval,
  type ModerationDetail,
  type ModerationItem,
  type ModerationList,
  type ModerationQueueQuery,
  type RejectJobInput,
  type ReportReason,
} from '@viecpro/shared';
import type { Request } from 'express';
import { AssetUrlService } from '../../../core/assets/asset-url.service.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { reportCode } from '../../reports/report-rules.js';
import { autoChecks, contentFlags, median, scoreJobRisk, type RiskInput } from './risk.js';

/** Hạn xử lý một tin chờ duyệt (phút) */
export const MODERATION_SLA_MINUTES = 120;
/** "Sắp quá SLA": còn ≤ 30 phút */
const NEAR_SLA_MINUTES = 30;
/** Hàng chờ tối đa nạp một lần để chấm điểm + lọc trong bộ nhớ */
const QUEUE_CAP = 500;
const HIGH_RISK = 60;
const DAY = 86400_000;
/** Tab "Đã xử lý": 7 ngày gần nhất */
const DONE_WINDOW_DAYS = 7;
const OPEN_REPORT = { in: ['open' as const, 'investigating' as const] };

const rowSelect = {
  id: true,
  code: true,
  slug: true,
  status: true,
  title: true,
  imageUrl: true,
  salary: true,
  program: true,
  industry: true,
  detail: true,
  feeUsd: true,
  employerId: true,
  submittedAt: true,
  createdAt: true,
  moderatedAt: true,
  rejectReason: true,
  changesRequestedAt: true,
  deletedAt: true,
  purgedAt: true,
  moderatedBy: { select: { name: true } },
  recruiter: { select: { name: true } },
  employer: { select: { name: true, shortName: true, verified: true, createdAt: true } },
  _count: { select: { reports: { where: { status: OPEN_REPORT } } } },
} satisfies Prisma.JobSelect;
type Row = Prisma.JobGetPayload<{ select: typeof rowSelect }>;

/** Đầu ngày hôm nay theo giờ Việt Nam (UTC+7) */
function vnStartOfToday(now = new Date()): Date {
  const vn = new Date(now.getTime() + 7 * 3600_000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3600_000);
}

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetUrlService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private search(q?: string): Prisma.JobWhereInput {
    if (!q) return {};
    const ci = { contains: q, mode: 'insensitive' as const };
    return {
      OR: [
        { title: ci },
        { code: ci },
        { employer: { is: { name: ci } } },
        { employer: { is: { shortName: ci } } },
        { recruiter: { is: { name: ci } } },
      ],
    };
  }

  /** Dữ liệu so sánh để chấm rủi ro: lương trung vị, tiêu đề 60 ngày, báo cáo theo doanh nghiệp */
  private async riskContext(rows: Row[]) {
    const since = new Date(Date.now() - 60 * DAY);
    const [peers, recentTitles, employerReports] = await Promise.all([
      this.prisma.job.findMany({ where: { status: 'open' }, select: { program: true, industry: true, salary: true } }),
      this.prisma.job.findMany({ where: { createdAt: { gte: since }, status: { in: ['open', 'closed', 'rejected'] } }, select: { id: true, title: true } }),
      this.prisma.report.groupBy({
        by: ['employerId'],
        where: { status: OPEN_REPORT, employerId: { in: rows.map((j) => j.employerId).filter((id): id is string => !!id) } },
        _count: { _all: true },
      }),
    ]);
    const reportsByEmployer = new Map(employerReports.map((r) => [r.employerId, r._count._all]));
    const now = Date.now();
    return (j: Row): RiskInput & { feeUsd: number | null } => ({
      openReports: j._count.reports + (j.employerId ? (reportsByEmployer.get(j.employerId) ?? 0) : 0),
      employerVerified: !!j.employer?.verified,
      employerAgeDays: j.employer ? (now - j.employer.createdAt.getTime()) / DAY : 0,
      salary: j.salary,
      medianSalary: median(peers.filter((p) => p.program === j.program && p.industry === j.industry).map((p) => p.salary)),
      // Trùng tiêu đề với tin khác (không tính chính nó)
      duplicate: recentTitles.some((t) => t.id !== j.id && t.title.toLowerCase() === j.title.toLowerCase()),
      ...contentFlags(`${j.title}\n${JSON.stringify(j.detail ?? {})}`),
      feeUsd: j.feeUsd,
    });
  }

  private toItem(j: Row, input: RiskInput, now: number): ModerationItem {
    const risk = scoreJobRisk(input);
    const submitted = (j.submittedAt ?? j.createdAt).getTime();
    return {
      id: j.id,
      code: j.code,
      status: j.status,
      title: j.title,
      imageUrl: this.assets.url(j.imageUrl),
      employerName: j.employer?.shortName ?? j.employer?.name ?? j.recruiter.name,
      submittedAt: (j.submittedAt ?? j.createdAt).toISOString(),
      program: j.program,
      industry: (INDUSTRIES as readonly string[]).includes(j.industry) ? (j.industry as Industry) : 'Khác',
      salary: j.salary,
      employerVerified: !!j.employer?.verified,
      reportCount: input.openReports,
      flag: risk.flag,
      risk: risk.score,
      reasons: risk.reasons,
      slaMinutes: Math.round(MODERATION_SLA_MINUTES - (now - submitted) / 60_000),
      moderatedAt: j.moderatedAt?.toISOString() ?? null,
      moderatorName: j.moderatedBy?.name ?? null,
      rejectReason: j.rejectReason,
      changesRequested: !!j.changesRequestedAt,
      removedByOwner: jobRemoval(j),
    };
  }

  private async scored(rows: Row[]): Promise<ModerationItem[]> {
    if (!rows.length) return [];
    const ctx = await this.riskContext(rows);
    const now = Date.now();
    return rows.map((j) => this.toItem(j, ctx(j), now));
  }

  /** Hàng chờ đầy đủ (đã chấm điểm), sắp theo hạn SLA – dùng cho bảng điều khiển và tab "Chờ duyệt" */
  private async pendingQueue(q?: string): Promise<ModerationItem[]> {
    const rows = await this.prisma.job.findMany({ where: { status: 'pending', ...this.search(q) }, orderBy: { submittedAt: 'asc' }, take: QUEUE_CAP, select: rowSelect });
    return this.scored(rows);
  }

  /** Bản rút gọn cho bảng điều khiển */
  async queue(limit: number): Promise<{ total: number; items: ModerationItem[] }> {
    const [total, items] = await Promise.all([this.prisma.job.count({ where: { status: 'pending' } }), this.pendingQueue()]);
    return { total, items: items.slice(0, limit) };
  }

  private changesWhere(): Prisma.JobWhereInput {
    // Tin NTD đã xoá thì không còn chờ NTD sửa – chuyển sang tab đã xử lý
    return { status: 'rejected', changesRequestedAt: { not: null }, deletedAt: null };
  }

  private doneWhere(): Prisma.JobWhereInput {
    return { moderatedAt: { gte: new Date(Date.now() - DONE_WINDOW_DAYS * DAY) }, status: { not: 'pending' }, OR: [{ changesRequestedAt: null }, { deletedAt: { not: null } }] };
  }

  /** Trang kiểm duyệt (design-new 07): 3 tab, lọc nhanh, thống kê */
  async list(query: ModerationQueueQuery): Promise<ModerationList> {
    const { page, limit, q, filter, tab } = query;
    const start = (page - 1) * limit;

    let items: ModerationItem[];
    let total: number;
    if (tab === 'pending') {
      const all = (await this.pendingQueue(q)).filter((i) =>
        filter === 'high_risk'
          ? i.risk >= HIGH_RISK
          : filter === 'reported'
            ? i.reportCount > 0
            : filter === 'new_employer'
              ? i.reasons.includes('DN mới')
              : filter === 'sla'
                ? i.slaMinutes <= NEAR_SLA_MINUTES
                : true,
      );
      total = all.length;
      items = all.slice(start, start + limit);
    } else {
      // AND: điều kiện tab và ô tìm kiếm đều có thể dùng OR – không gộp bằng spread để khỏi đè nhau
      const where: Prisma.JobWhereInput = { AND: [tab === 'changes' ? this.changesWhere() : this.doneWhere(), this.search(q)] };
      const [count, rows] = await Promise.all([
        this.prisma.job.count({ where }),
        this.prisma.job.findMany({ where, orderBy: tab === 'changes' ? { changesRequestedAt: 'desc' } : { moderatedAt: 'desc' }, skip: start, take: limit, select: rowSelect }),
      ]);
      total = count;
      items = await this.scored(rows);
    }

    const nearSlaBefore = new Date(Date.now() - (MODERATION_SLA_MINUTES - NEAR_SLA_MINUTES) * 60_000);
    const [pending, nearSla, processedToday, changes, done] = await Promise.all([
      this.prisma.job.count({ where: { status: 'pending' } }),
      this.prisma.job.count({ where: { status: 'pending', OR: [{ submittedAt: { lte: nearSlaBefore } }, { submittedAt: null, createdAt: { lte: nearSlaBefore } }] } }),
      this.prisma.job.count({ where: { moderatedAt: { gte: vnStartOfToday() } } }),
      this.prisma.job.count({ where: this.changesWhere() }),
      this.prisma.job.count({ where: this.doneWhere() }),
    ]);
    return {
      items,
      page,
      limit,
      total,
      hasMore: page * limit < total,
      stats: { pending, nearSla, processedToday },
      tabs: { pending, changes, done },
    };
  }

  /** Chi tiết tin: nội dung, kiểm tra tự động, lịch sử thao tác, báo cáo */
  async detail(id: string): Promise<ModerationDetail> {
    const j = await this.prisma.job.findUnique({
      where: { id },
      select: {
        ...rowSelect,
        region: true,
        pref: true,
        quantity: true,
        gender: true,
        birthYearFrom: true,
        birthYearTo: true,
        contractYears: true,
        jlptRequired: true,
        examAt: true,
        deadline: true,
        departureAt: true,
        events: { orderBy: { createdAt: 'desc' }, take: 15, select: { action: true, note: true, createdAt: true, actor: { select: { name: true } } } },
        reports: { orderBy: { createdAt: 'desc' }, take: 10, select: { number: true, reason: true, status: true, createdAt: true } },
      },
    });
    if (!j) throw ApiException.notFound('Không tìm thấy đơn hàng');
    const ctx = await this.riskContext([j]);
    const input = ctx(j);
    const openJobs = j.employerId ? await this.prisma.job.count({ where: { employerId: j.employerId, status: 'open' } }) : 0;
    const content = jobDetailContentSchema.parse(j.detail ?? {});
    return {
      ...this.toItem(j, input, Date.now()),
      slug: j.slug,
      region: j.region,
      pref: j.pref,
      quantity: j.quantity,
      gender: j.gender,
      birthYearFrom: j.birthYearFrom,
      birthYearTo: j.birthYearTo,
      feeUsd: j.feeUsd,
      contractYears: j.contractYears,
      jlptRequired: j.jlptRequired,
      examAt: j.examAt?.toISOString() ?? null,
      deadline: j.deadline?.toISOString() ?? null,
      departureAt: j.departureAt?.toISOString() ?? null,
      employer: {
        name: j.employer?.name ?? j.recruiter.name,
        verified: !!j.employer?.verified,
        createdAt: j.employer?.createdAt.toISOString() ?? null,
        openJobs,
      },
      recruiterName: j.recruiter.name,
      content: {
        overview: content.overview || content.posting?.description || '',
        tasks: content.tasks,
        requirements: content.requirements,
        benefits: content.benefits.length ? content.benefits : (content.posting?.benefits ?? []),
        incomes: content.incomes.map((i) => ({ label: i.label, value: i.value })),
      },
      medianSalary: input.medianSalary,
      checks: autoChecks(input),
      events: j.events.map((e) => ({ action: e.action, note: e.note, actor: e.actor?.name ?? null, at: e.createdAt.toISOString() })),
      reports: j.reports.map((r) => ({ code: reportCode(r.number), reason: REPORT_REASON_LABEL[r.reason as ReportReason] ?? r.reason, status: r.status, createdAt: r.createdAt.toISOString() })),
    };
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
      await tx.job.update({ where: { id: jobId }, data: { status: 'open', publishedAt: job.publishedAt ?? now, moderatedAt: now, moderatedById: adminId, rejectReason: null, changesRequestedAt: null } });
      await tx.jobEvent.create({ data: { jobId, action: 'approve' } });
      await this.audit.log({ actorId: adminId, action: 'job.approve', targetType: 'job', targetId: jobId, before: { status: job.status }, after: { status: 'open' } }, req, tx);
    });
    if (job.recruiter.userId) {
      await this.notifications.notify(job.recruiter.userId, 'job.approved', { title: `Tin đã được duyệt: ${job.title}`, link: WEB_LINKS.job(job.slug) });
    }
  }

  async reject(adminId: string, jobId: string, input: RejectJobInput, req: Request) {
    await this.decline(adminId, jobId, input, req, false);
  }

  /** Yêu cầu NTD sửa: tin không công khai, NTD sửa và gửi lại thì quay về hàng chờ */
  async requestChanges(adminId: string, jobId: string, input: RejectJobInput, req: Request) {
    await this.decline(adminId, jobId, input, req, true);
  }

  private async decline(adminId: string, jobId: string, input: RejectJobInput, req: Request, changes: boolean) {
    const job = await this.pendingJob(jobId);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: { status: 'rejected', moderatedAt: now, moderatedById: adminId, rejectReason: input.reason, changesRequestedAt: changes ? now : null },
      });
      await tx.jobEvent.create({ data: { jobId, action: changes ? 'request_changes' : 'reject', note: input.reason } });
      await this.audit.log(
        { actorId: adminId, action: changes ? 'job.request_changes' : 'job.reject', targetType: 'job', targetId: jobId, before: { status: job.status }, after: { status: 'rejected', reason: input.reason } },
        req,
        tx,
      );
    });
    if (job.recruiter.userId) {
      await this.notifications.notify(job.recruiter.userId, changes ? 'job.changes_requested' : 'job.rejected', {
        title: changes ? `Cần chỉnh sửa tin: ${job.title}` : `Tin chưa được duyệt: ${job.title}`,
        body: changes ? `${input.reason}. Sửa tin và gửi lại để được duyệt.` : input.reason,
        link: WEB_LINKS.employerJobs,
      });
    }
  }
}

/** NTD đã xoá tin chưa: còn trong thùng rác (khôi phục được) hay đã xoá vĩnh viễn */
export function jobRemoval(j: { deletedAt: Date | null; purgedAt: Date | null }): JobRemoval | null {
  return j.purgedAt ? 'purged' : j.deletedAt ? 'trash' : null;
}
