import { HttpStatus, Injectable } from '@nestjs/common';
import {
  jobShortTitle,
  type EmployerJobItem,
  type EmployerJobList,
  type EmployerJobListQuery,
  type EmployerJobStats,
  type EmployerJobSummary,
  type EmployerJobTab,
  type Industry,
  type JobStatus,
} from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { pageArgs } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { type EmployerActor, EmployerContext } from './employer-context.service.js';
import { countByDay, rate, windows } from './employer-stats.js';
import { canPublish } from './plan-rules.js';

const DAY = 86400_000;

/** Tab → trạng thái tin */
const TAB_STATUSES: Record<EmployerJobTab, JobStatus[]> = {
  visible: ['open', 'paused'],
  pending: ['pending', 'rejected'],
  draft: ['draft'],
  expired: ['closed'],
};

const SORT: Record<EmployerJobListQuery['sort'], Prisma.JobOrderByWithRelationInput[]> = {
  updated: [{ updatedAt: 'desc' }],
  newest: [{ createdAt: 'desc' }],
  applications: [{ applications: { _count: 'desc' } }, { updatedAt: 'desc' }],
  deadline: [{ deadline: { sort: 'asc', nulls: 'last' } }],
};

const itemSelect = {
  id: true,
  code: true,
  slug: true,
  title: true,
  position: true,
  imageUrl: true,
  status: true,
  visibility: true,
  industry: true,
  pref: true,
  program: true,
  views: true,
  quantity: true,
  deadline: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  boostedAt: true,
  rejectReason: true,
  recruiter: { select: { id: true, name: true, photoUrl: true } },
  _count: { select: { applications: true } },
} satisfies Prisma.JobSelect;

type ItemRow = Prisma.JobGetPayload<{ select: typeof itemSelect }>;

/** Quản lý tin tuyển dụng (design 12): danh sách theo tab, chỉ số, thao tác nhanh */
@Injectable()
export class EmployerJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
    private readonly assets: AssetUrlService,
  ) {}

  /** Số hồ sơ mới chưa xem và số đã tuyển của từng tin */
  private async counters(jobIds: string[]) {
    if (!jobIds.length) return { unseen: new Map<string, number>(), passed: new Map<string, number>() };
    const [unseen, passed] = await Promise.all([
      this.prisma.application.groupBy({ by: ['jobId'], where: { jobId: { in: jobIds }, status: 'submitted', seenAt: null }, _count: { _all: true } }),
      this.prisma.application.groupBy({ by: ['jobId'], where: { jobId: { in: jobIds }, status: { in: ['passed', 'departed'] } }, _count: { _all: true } }),
    ]);
    return {
      unseen: new Map(unseen.map((r) => [r.jobId, r._count._all])),
      passed: new Map(passed.map((r) => [r.jobId, r._count._all])),
    };
  }

  private toItem(j: ItemRow, c: Awaited<ReturnType<EmployerJobsService['counters']>>): EmployerJobItem {
    return {
      id: j.id,
      code: j.code,
      slug: j.slug,
      title: j.title,
      shortTitle: jobShortTitle(j),
      imageUrl: this.assets.url(j.imageUrl),
      status: j.status,
      visibility: j.visibility,
      industry: j.industry as Industry,
      pref: j.pref,
      program: j.program,
      views: j.views,
      applications: j._count.applications,
      newApplications: c.unseen.get(j.id) ?? 0,
      passed: c.passed.get(j.id) ?? 0,
      quantity: j.quantity,
      deadline: j.deadline?.toISOString() ?? null,
      publishedAt: j.publishedAt?.toISOString() ?? null,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
      boostedAt: j.boostedAt?.toISOString() ?? null,
      rejectReason: j.rejectReason,
      recruiter: { id: j.recruiter.id, name: j.recruiter.name, photoUrl: this.assets.url(j.recruiter.photoUrl) },
    };
  }

  async list(userId: string, query: EmployerJobListQuery): Promise<EmployerJobList> {
    const actor = await this.ctx.resolve(userId);
    const scope = this.ctx.jobScope(actor);
    const filters: Prisma.JobWhereInput = {
      ...(query.industry && { industry: query.industry }),
      ...(query.q && { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q.toUpperCase() } }] }),
    };
    const where: Prisma.JobWhereInput = { ...scope, ...filters, status: { in: TAB_STATUSES[query.tab] } };

    const [rows, total, byStatus] = await Promise.all([
      this.prisma.job.findMany({ where, select: itemSelect, orderBy: SORT[query.sort], ...pageArgs(query) }),
      this.prisma.job.count({ where }),
      this.prisma.job.groupBy({ by: ['status'], where: { ...scope, ...filters }, _count: { _all: true } }),
    ]);
    const c = await this.counters(rows.map((r) => r.id));
    const counts = Object.fromEntries(
      (Object.keys(TAB_STATUSES) as EmployerJobTab[]).map((tab) => [tab, byStatus.filter((s) => TAB_STATUSES[tab].includes(s.status)).reduce((n, s) => n + s._count._all, 0)]),
    ) as Record<EmployerJobTab, number>;
    return { items: rows.map((r) => this.toItem(r, c)), page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total, counts };
  }

  async summary(userId: string): Promise<EmployerJobSummary> {
    const actor = await this.ctx.resolve(userId);
    const scope = this.ctx.jobScope(actor);
    const now = new Date();
    const week = windows(7, now);
    const month = new Date(now.getTime() - 30 * DAY);

    const [visible, expiringSoon, views, newApps, unseen, apps30, views30, marketApps, marketViews, passed, quota, sources, events] = await Promise.all([
      this.prisma.job.count({ where: { ...scope, status: 'open' } }),
      this.prisma.job.count({ where: { ...scope, status: 'open', deadline: { gte: now, lte: new Date(now.getTime() + 45 * DAY) } } }),
      this.prisma.jobViewDay.groupBy({ by: ['day'], where: { job: scope, day: { gte: week.prevStart } }, _sum: { count: true } }),
      this.prisma.application.count({ where: { job: scope, createdAt: { gte: week.start } } }),
      this.prisma.application.count({ where: { job: scope, status: 'submitted', seenAt: null } }),
      this.prisma.application.count({ where: { job: scope, createdAt: { gte: month } } }),
      this.prisma.jobViewDay.aggregate({ where: { job: scope, day: { gte: month } }, _sum: { count: true } }),
      this.prisma.application.count({ where: { createdAt: { gte: month } } }),
      this.prisma.jobViewDay.aggregate({ where: { day: { gte: month } }, _sum: { count: true } }),
      this.prisma.application.count({ where: { job: { ...scope, status: 'open' }, status: { in: ['passed', 'departed'] } } }),
      this.prisma.job.aggregate({ where: { ...scope, status: 'open' }, _sum: { quantity: true } }),
      this.prisma.application.groupBy({ by: ['source'], where: { job: scope, createdAt: { gte: month } }, _count: { _all: true }, orderBy: { _count: { source: 'desc' } } }),
      this.prisma.jobEvent.findMany({
        where: { job: scope, action: { not: 'approve' } },
        orderBy: { createdAt: 'desc' },
        take: 4,
        include: { actor: { select: { name: true, photoUrl: true } }, job: { select: { code: true } } },
      }),
    ]);

    const sumViews = (from: Date, to: Date) => views.filter((v) => v.day >= from && v.day < to).reduce((s, v) => s + (v._sum.count ?? 0), 0);
    return {
      visible,
      expiringSoon,
      views7: sumViews(week.start, new Date(now.getTime() + DAY)),
      viewsPrev7: sumViews(week.prevStart, week.start),
      newApplications7: newApps,
      unseen,
      conversion: rate(apps30, views30._sum.count ?? 0),
      marketConversion: rate(marketApps, marketViews._sum.count ?? 0),
      passed,
      quota: quota._sum.quantity ?? 0,
      sources: sources.map((s) => ({ source: s.source, count: s._count._all })),
      activity: events.map((e) => ({
        id: e.id,
        actor: e.actor ? { name: e.actor.name, photoUrl: this.assets.url(e.actor.photoUrl) } : null,
        action: e.action,
        jobCode: e.job.code,
        note: e.note,
        at: e.createdAt.toISOString(),
      })),
    };
  }

  /** Bảng bên phải: số liệu + hồ sơ 7 ngày + gợi ý của một tin */
  async stats(userId: string, jobId: string): Promise<EmployerJobStats> {
    const actor = await this.ctx.resolve(userId);
    const row = await this.prisma.job.findFirst({ where: { id: jobId, ...this.ctx.jobScope(actor) }, select: itemSelect });
    if (!row) throw ApiException.notFound('Không tìm thấy đơn hàng');
    const now = new Date();
    const { start, keys } = windows(7, now);
    const [c, recent, peers] = await Promise.all([
      this.counters([row.id]),
      this.prisma.application.findMany({ where: { jobId: row.id, createdAt: { gte: start } }, select: { createdAt: true } }),
      this.prisma.job.aggregate({ where: { industry: row.industry, status: 'open', id: { not: row.id } }, _sum: { views: true } }),
    ]);
    const peerApps = await this.prisma.application.count({ where: { job: { industry: row.industry, status: 'open', id: { not: row.id } } } });
    const job = this.toItem(row, c);
    const conversion = rate(job.applications, job.views);
    const peerConversion = rate(peerApps, peers._sum.views ?? 0);

    const suggestions: EmployerJobStats['suggestions'] = [];
    if (peerConversion > 0 && conversion > 0) {
      const diff = Math.round(((conversion - peerConversion) / peerConversion) * 100);
      if (diff >= 5) suggestions.push({ kind: 'conversion_up', text: `Tin đang có tỉ lệ chuyển đổi cao hơn ${diff}% so với tin cùng ngành.`, target: null });
      if (diff <= -5) suggestions.push({ kind: 'conversion_down', text: `Tỉ lệ chuyển đổi thấp hơn ${Math.abs(diff)}% so với tin cùng ngành – thử tăng lương hoặc thêm ảnh thực tế.`, target: 'edit' });
    }
    if (job.newApplications) suggestions.push({ kind: 'unseen', text: `${job.newApplications} hồ sơ mới chưa xem – phản hồi trong 30 phút giúp giữ ứng viên.`, target: 'applicants' });
    if (row.deadline && row.status === 'open' && row.deadline.getTime() - now.getTime() < 7 * DAY) {
      suggestions.push({ kind: 'expiring', text: `Tin hết hạn sau ${Math.max(0, Math.ceil((row.deadline.getTime() - now.getTime()) / DAY))} ngày – gia hạn để không gián đoạn nhận hồ sơ.`, target: 'edit' });
    }

    const perDay = countByDay(recent.map((r) => r.createdAt), keys);
    return { job, conversion, daily: keys.map((date, i) => ({ date, count: perDay[i]! })), suggestions };
  }

  /** Tin thuộc phạm vi NTD (điều kiện sở hữu trong câu truy vấn – trả 404 nếu không có quyền) */
  private async own(actor: EmployerActor, jobId: string) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, ...this.ctx.jobScope(actor) }, select: { id: true, status: true, suspendedAt: true, suspendReason: true } });
    if (!job) throw ApiException.notFound('Không tìm thấy đơn hàng');
    return job;
  }

  private async item(jobId: string) {
    const row = await this.prisma.job.findUniqueOrThrow({ where: { id: jobId }, select: itemSelect });
    return this.toItem(row, await this.counters([jobId]));
  }

  /** Đẩy tin lên đầu: trừ 1 lượt của gói, làm mới thời điểm đăng (đứng đầu danh sách "mới nhất") */
  async boost(userId: string, jobId: string): Promise<EmployerJobItem> {
    const actor = await this.ctx.resolve(userId);
    const job = await this.own(actor, jobId);
    if (job.status !== 'open') throw new ApiException('CONFLICT', 'Chỉ đẩy được tin đang hiển thị', HttpStatus.CONFLICT);
    const planWhere = actor.employerId ? { employerId: actor.employerId } : { recruiterId: actor.recruiterId };
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const plan = await tx.businessPlan.findFirst({ where: planWhere });
      if (!plan || plan.expiresAt < now) throw new ApiException('CONFLICT', 'Gói dịch vụ đã hết hạn, vui lòng gia hạn để đẩy tin', HttpStatus.CONFLICT);
      // Trừ lượt có điều kiện để 2 lần bấm cùng lúc không vượt quá hạn mức
      const used = await tx.businessPlan.updateMany({ where: { id: plan.id, boostsUsed: { lt: plan.boostQuota } }, data: { boostsUsed: { increment: 1 } } });
      if (!used.count) throw new ApiException('CONFLICT', 'Đã dùng hết lượt đẩy tin của gói', HttpStatus.CONFLICT);
      await tx.job.update({ where: { id: jobId }, data: { boostedAt: now, publishedAt: now } });
      await tx.jobEvent.create({ data: { jobId, actorId: actor.recruiterId, action: 'boost' } });
    });
    return this.item(jobId);
  }

  async pause(userId: string, jobId: string): Promise<EmployerJobItem> {
    const actor = await this.ctx.resolve(userId);
    const job = await this.own(actor, jobId);
    if (job.status !== 'open') throw new ApiException('CONFLICT', 'Chỉ tạm ẩn được tin đang hiển thị', HttpStatus.CONFLICT);
    await this.prisma.$transaction([
      this.prisma.job.update({ where: { id: jobId }, data: { status: 'paused' } }),
      this.prisma.jobEvent.create({ data: { jobId, actorId: actor.recruiterId, action: 'pause' } }),
    ]);
    return this.item(jobId);
  }

  /** Mở lại tin tạm ẩn: NTD chưa xác minh phải qua kiểm duyệt lại (RULE-BE.md mục 7) */
  async resume(userId: string, jobId: string): Promise<EmployerJobItem> {
    const actor = await this.ctx.resolve(userId);
    const job = await this.own(actor, jobId);
    if (job.status !== 'paused') throw new ApiException('CONFLICT', 'Tin không ở trạng thái tạm ẩn', HttpStatus.CONFLICT);
    // Tin bị hệ thống / quản trị tạm ẩn chỉ mở lại được sau khi kiểm duyệt xử lý xong
    if (job.suspendedAt) throw new ApiException('SUSPENDED', job.suspendReason ?? 'Tin đang bị tạm ẩn để kiểm tra, vui lòng liên hệ 1900 66 99', HttpStatus.CONFLICT);
    const status = actor.verified ? 'open' : 'pending';
    await this.prisma.$transaction(async (tx) => {
      const planWhere = actor.employerId ? { employerId: actor.employerId } : { recruiterId: actor.recruiterId };
      const [plan, visibleJobs] = await Promise.all([
        tx.businessPlan.findFirst({ where: planWhere, select: { jobQuota: true, expiresAt: true } }),
        tx.job.count({ where: { ...this.ctx.jobScope(actor), status: 'open' } }),
      ]);
      const quota = canPublish(plan, visibleJobs);
      if (!quota.allowed) {
        const expired = quota.reason === 'expired';
        throw new ApiException(expired ? 'PLAN_EXPIRED' : 'PLAN_LIMIT', expired ? 'Gói dịch vụ đã hết hạn. Gia hạn để đăng thêm tin.' : 'Đã đạt giới hạn tin hiển thị của gói. Nâng cấp để đăng thêm tin.');
      }
      await tx.job.update({ where: { id: jobId }, data: { status, ...(status === 'pending' && { submittedAt: new Date() }) } });
      await tx.jobEvent.create({ data: { jobId, actorId: actor.recruiterId, action: 'resume' } });
    });
    return this.item(jobId);
  }

  async close(userId: string, jobId: string, note?: string): Promise<EmployerJobItem> {
    const actor = await this.ctx.resolve(userId);
    const job = await this.own(actor, jobId);
    if (job.status === 'closed') throw new ApiException('CONFLICT', 'Tin đã đóng', HttpStatus.CONFLICT);
    await this.prisma.$transaction([
      this.prisma.job.update({ where: { id: jobId }, data: { status: 'closed' } }),
      this.prisma.jobEvent.create({ data: { jobId, actorId: actor.recruiterId, action: 'close', note: note ?? null } }),
    ]);
    return this.item(jobId);
  }
}
