import { Injectable } from '@nestjs/common';
import { jobShortTitle, type EmployerDashboard, type EmployerPartnerItem, type EmployerRange, type EmployerReport } from '@viecpro/shared';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { type EmployerActor, EmployerContext } from './employer-context.service.js';
import { applicantBrief, applicantBriefSelect, interviewBrief, interviewBriefInclude } from './employer-mappers.js';
import { averageByDay, countByDay, dayKey, isWeekend, rate, startOfDay, trustScore, windows } from './employer-stats.js';

const DAY = 86400_000;
/** Mục tiêu "phản hồi trong 30 phút" của gói dịch vụ (%) */
const FAST_RESPONSE_TARGET = 80;
const CONTACTED = ['viewed', 'interview', 'passed', 'departed'] as const;

/** Trang tổng quan khu NTD (doanh nghiệp: design 10 · cá nhân: design 11) */
@Injectable()
export class EmployerDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
    private readonly assets: AssetUrlService,
  ) {}

  async dashboard(userId: string, range: EmployerRange): Promise<EmployerDashboard> {
    const actor = await this.ctx.resolve(userId);
    const days = Number(range);
    const now = new Date();
    const { start, prevStart, keys } = windows(days, now);
    const jobScope = this.ctx.jobScope(actor);
    const appScope = this.ctx.applicationScope(actor);

    const [apps, jobs, viewDays, departedEvents, latest, today, recruiter] = await Promise.all([
      this.prisma.application.findMany({
        where: { ...appScope, createdAt: { gte: prevStart } },
        select: { createdAt: true, contactedAt: true, status: true, jobId: true },
      }),
      this.prisma.job.findMany({
        where: jobScope,
        select: { id: true, title: true, position: true, industry: true, pref: true, status: true, publishedAt: true, deadline: true, quantity: true, salary: true },
      }),
      this.prisma.jobViewDay.findMany({ where: { job: this.ctx.ownerScope(actor), day: { gte: prevStart } }, select: { day: true, count: true } }),
      this.prisma.applicationEvent.findMany({ where: { status: 'departed', application: appScope }, select: { createdAt: true } }),
      this.prisma.application.findMany({
        where: { ...appScope, status: { not: 'withdrawn' } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: applicantBriefSelect,
      }),
      this.prisma.interview.findMany({
        where: { ...this.ctx.interviewScope(actor), status: { not: 'cancelled' }, startAt: { gte: startOfDay(now), lt: new Date(startOfDay(now).getTime() + DAY) } },
        orderBy: { startAt: 'asc' },
        include: interviewBriefInclude,
      }),
      this.prisma.recruiter.findUniqueOrThrow({ where: { id: actor.recruiterId }, select: { rating: true, reviewCount: true } }),
    ]);

    const inRange = apps.filter((a) => a.createdAt >= start);
    const prev = apps.filter((a) => a.createdAt < start);

    // Phản hồi: hồ sơ được liên hệ trong 30 phút / thời gian phản hồi trung bình
    const minutesOf = (a: { createdAt: Date; contactedAt: Date | null }) => (a.contactedAt ? (a.contactedAt.getTime() - a.createdAt.getTime()) / 60_000 : null);
    const fastRate = (list: typeof apps) => (list.length ? Math.round((list.filter((a) => (minutesOf(a) ?? Infinity) <= 30).length / list.length) * 100) : 0);
    const avgMinutes = (list: typeof apps) => {
      const m = list.map(minutesOf).filter((v): v is number => v !== null);
      return m.length ? Math.round(m.reduce((s, v) => s + v, 0) / m.length) : null;
    };
    const fastSeries = keys.map((k) => fastRate(inRange.filter((a) => dayKey(a.createdAt) === k)));

    // Lượt xem tin
    const viewsOn = (from: Date, to: Date) => viewDays.filter((v) => v.day >= from && v.day < to).reduce((s, v) => s + v.count, 0);
    const viewSeries = keys.map((k) => viewDays.filter((v) => dayKey(v.day) === k).reduce((s, v) => s + v.count, 0));

    // Đơn có nhiều hồ sơ nhất trong kỳ
    const byJob = new Map<string, number>();
    for (const a of inRange) byJob.set(a.jobId, (byJob.get(a.jobId) ?? 0) + 1);
    const topJobId = [...byJob.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const topJob = jobs.find((j) => j.id === topJobId);

    // Tin đang hiển thị
    const open = jobs.filter((j) => j.status === 'open');
    const openSeries = keys.map((k) => open.filter((j) => j.publishedAt && dayKey(j.publishedAt) <= k).length);

    const dailyCounts = countByDay(inRange.map((a) => a.createdAt), keys);

    return {
      range,
      overdueApplicants: await this.prisma.application.count({ where: { ...appScope, status: 'submitted', createdAt: { lt: new Date(now.getTime() - DAY) } } }),
      applications: { value: inRange.length, previous: prev.length, series: dailyCounts, topJob: topJob ? `đơn ${jobShortTitle(topJob).replace(' – ', ' ').toLowerCase()}` : null },
      visibleJobs: {
        value: open.length,
        added: open.filter((j) => j.publishedAt && j.publishedAt >= start).length,
        expiringSoon: open.filter((j) => j.deadline && j.deadline.getTime() - now.getTime() < 7 * DAY && j.deadline > now).length,
        series: openSeries,
      },
      fastResponse: { value: fastRate(inRange), previous: fastRate(prev), series: fastSeries, target: FAST_RESPONSE_TARGET },
      views: { value: viewsOn(start, new Date(now.getTime() + DAY)), previous: viewsOn(prevStart, start), series: viewSeries },
      responseMinutes: {
        value: avgMinutes(inRange),
        previous: avgMinutes(prev),
        series: averageByDay(inRange.filter((a) => a.contactedAt).map((a) => ({ at: a.createdAt, value: minutesOf(a)! })), keys),
      },
      rating: { value: recruiter.rating, reviewCount: recruiter.reviewCount, newReviews: 0, series: keys.map(() => recruiter.rating) },
      departed: {
        value: departedEvents.length,
        inRange: departedEvents.filter((e) => e.createdAt >= start).length,
        series: keys.map((k) => departedEvents.filter((e) => dayKey(e.createdAt) <= k).length),
      },
      daily: keys.map((date, i) => ({ date, count: dailyCounts[i]!, weekend: isWeekend(date) })),
      funnel: {
        views: viewsOn(start, new Date(now.getTime() + DAY)),
        applied: inRange.length,
        contacted: inRange.filter((a) => (CONTACTED as readonly string[]).includes(a.status) || a.contactedAt).length,
        interview: inRange.filter((a) => ['interview', 'passed', 'departed'].includes(a.status)).length,
        passed: inRange.filter((a) => ['passed', 'departed'].includes(a.status)).length,
      },
      latest: latest.map(applicantBrief),
      todayInterviews: today.map((i) => interviewBrief(i)),
      attention: actor.employerId ? await this.attention(jobs, now) : [],
      partners: actor.employerId ? [] : await this.partners(actor),
      trust: actor.employerId ? null : await this.trust(actor, recruiter.rating),
    };
  }

  /** Báo cáo hiệu quả tuyển dụng: chỉ truy vấn tin thuộc doanh nghiệp / NTD hiện tại. */
  async report(userId: string, range: '7' | '30' | '90'): Promise<EmployerReport> {
    const actor = await this.ctx.resolve(userId);
    const days = Number(range);
    const now = new Date();
    const { start, prevStart, keys } = windows(days, now);
    const jobScope = this.ctx.jobScope(actor);
    const appScope = this.ctx.applicationScope(actor);
    const [applications, views, sources, appJobs, viewJobs] = await Promise.all([
      this.prisma.application.findMany({ where: { ...appScope, createdAt: { gte: prevStart } }, select: { createdAt: true, status: true } }),
      this.prisma.jobViewDay.findMany({ where: { job: this.ctx.ownerScope(actor), day: { gte: prevStart } }, select: { jobId: true, day: true, count: true } }),
      this.prisma.application.groupBy({ by: ['source'], where: { ...appScope, createdAt: { gte: start } }, _count: { _all: true }, orderBy: { _count: { source: 'desc' } } }),
      this.prisma.application.groupBy({ by: ['jobId'], where: { ...appScope, createdAt: { gte: start } }, _count: { _all: true }, orderBy: { _count: { jobId: 'desc' } }, take: 10 }),
      this.prisma.jobViewDay.groupBy({ by: ['jobId'], where: { job: jobScope, day: { gte: start } }, _sum: { count: true } }),
    ]);
    const daily = keys.map((date) => {
      const from = new Date(`${date}T00:00:00`);
      const to = new Date(from.getTime() + DAY);
      return {
        date,
        applications: applications.filter((a) => a.createdAt >= start && dayKey(a.createdAt) === date).length,
        views: views.filter((v) => v.day >= from && v.day < to).reduce((sum, v) => sum + v.count, 0),
      };
    });
    const totalApplications = applications.filter((a) => a.createdAt >= start).length;
    const previousApplications = applications.filter((a) => a.createdAt < start).length;
    const totalViews = views.filter((v) => v.day >= start).reduce((sum, v) => sum + v.count, 0);
    const previousViews = views.filter((v) => v.day < start).reduce((sum, v) => sum + v.count, 0);
    const currentApps = applications.filter((a) => a.createdAt >= start);
    const jobIds = appJobs.map((j) => j.jobId);
    const jobs = jobIds.length ? await this.prisma.job.findMany({ where: { id: { in: jobIds }, ...jobScope }, select: { id: true, title: true, code: true } }) : [];
    const viewsByJob = new Map(viewJobs.map((v) => [v.jobId, v._sum.count ?? 0]));
    const applicationsByJob = new Map(appJobs.map((a) => [a.jobId, a._count._all]));
    return {
      range,
      totalApplications,
      totalViews,
      conversion: rate(totalApplications, totalViews),
      previousApplications,
      previousViews,
      daily,
      sources: sources.map((s) => ({ source: s.source, count: s._count._all })),
      jobs: jobs
        .map((job) => {
          const applicationsCount = applicationsByJob.get(job.id) ?? 0;
          const viewsCount = viewsByJob.get(job.id) ?? 0;
          return { ...job, views: viewsCount, applications: applicationsCount, conversion: rate(applicationsCount, viewsCount) };
        })
        .sort((a, b) => b.applications - a.applications),
      funnel: {
        applied: currentApps.length,
        contacted: currentApps.filter((a) => ['viewed', 'interview', 'passed', 'departed'].includes(a.status)).length,
        interview: currentApps.filter((a) => ['interview', 'passed', 'departed'].includes(a.status)).length,
        passed: currentApps.filter((a) => ['passed', 'departed'].includes(a.status)).length,
        departed: currentApps.filter((a) => a.status === 'departed').length,
      },
    };
  }

  /** Tin cần chú ý: ít hồ sơ, sắp hết hạn mà thiếu chỉ tiêu, đã gần đủ chỉ tiêu */
  private async attention(
    jobs: Array<{ id: string; title: string; position: string | null; industry: string; pref: string; status: string; deadline: Date | null; quantity: number; salary: number }>,
    now: Date,
  ): Promise<EmployerDashboard['attention']> {
    const open = jobs.filter((j) => j.status === 'open');
    if (!open.length) return [];
    const ids = open.map((j) => j.id);
    const [recent, passed, peers] = await Promise.all([
      this.prisma.application.groupBy({ by: ['jobId'], where: { jobId: { in: ids }, createdAt: { gte: new Date(now.getTime() - 7 * DAY) } }, _count: { _all: true } }),
      this.prisma.application.groupBy({ by: ['jobId'], where: { jobId: { in: ids }, status: { in: ['passed', 'departed'] } }, _count: { _all: true } }),
      this.prisma.job.findMany({ where: { status: 'open', industry: { in: [...new Set(open.map((j) => j.industry))] } }, select: { industry: true, salary: true } }),
    ]);
    const recentOf = new Map(recent.map((r) => [r.jobId, r._count._all]));
    const passedOf = new Map(passed.map((r) => [r.jobId, r._count._all]));
    const median = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return s.length ? s[Math.floor(s.length / 2)]! : 0;
    };
    const out: EmployerDashboard['attention'] = [];
    for (const j of open) {
      const hired = passedOf.get(j.id) ?? 0;
      const title = jobShortTitle(j);
      const fresh = recentOf.get(j.id) ?? 0;
      const peerMedian = median(peers.filter((p) => p.industry === j.industry).map((p) => p.salary));
      if (j.deadline && j.deadline > now && j.deadline.getTime() - now.getTime() < 3 * DAY && hired < j.quantity) {
        const daysLeft = Math.ceil((j.deadline.getTime() - now.getTime()) / DAY);
        out.push({ jobId: j.id, kind: 'expiring', title, text: `Hết hạn sau ${daysLeft} ngày, còn thiếu ${j.quantity - hired}/${j.quantity} chỉ tiêu.` });
      } else if (hired >= Math.ceil(j.quantity * 0.9)) {
        out.push({ jobId: j.id, kind: 'quota_full', title, text: `Đã đủ ${Math.round((hired / j.quantity) * 100)}% chỉ tiêu. Cân nhắc tạm ẩn để tránh nhận thêm hồ sơ.` });
      } else if (fresh < 5) {
        const salaryNote = peerMedian > j.salary ? ` Tin tương tự trả ${peerMedian.toLocaleString('de-DE')} ¥ nhận nhiều hồ sơ hơn.` : '';
        out.push({ jobId: j.id, kind: 'low_applicants', title, text: `Ít ứng viên (${fresh} hồ sơ/7 ngày).${salaryNote}` });
      }
      if (out.length >= 3) break;
    }
    return out;
  }

  /** Doanh nghiệp phái cử của NTD cá nhân */
  async partners(actor: EmployerActor): Promise<EmployerPartnerItem[]> {
    const rows = await this.prisma.recruiterPartner.findMany({
      where: { recruiterId: actor.recruiterId },
      orderBy: [{ expiresAt: 'asc' }],
      include: { employer: { select: { id: true, name: true, shortName: true, slug: true, logoUrl: true, verified: true } } },
    });
    const counts = await this.prisma.job.groupBy({
      by: ['employerId', 'status'],
      where: { recruiterId: actor.recruiterId, employerId: { in: rows.map((r) => r.employerId) } },
      _count: { _all: true },
    });
    const count = (employerId: string, statuses: string[]) =>
      counts.filter((c) => c.employerId === employerId && statuses.includes(c.status)).reduce((s, c) => s + c._count._all, 0);
    return rows.map((r) => ({
      id: r.id,
      employer: { id: r.employer.id, name: r.employer.shortName ?? r.employer.name, slug: r.employer.slug, logoUrl: this.assets.url(r.employer.logoUrl), verified: r.employer.verified },
      jobCount: count(r.employerId, ['open', 'pending', 'paused']),
      pendingJobs: count(r.employerId, ['pending']),
      departedCount: r.departedCount,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      renewRequested: !!r.renewRequestedAt,
    }));
  }

  private async trust(actor: EmployerActor, rating: number): Promise<EmployerDashboard['trust']> {
    const [recruiter, licensed, violations, peers] = await Promise.all([
      this.prisma.recruiter.findUniqueOrThrow({ where: { id: actor.recruiterId }, select: { sections: true, user: { select: { phoneVerifiedAt: true } } } }),
      this.prisma.recruiterPartner.count({ where: { recruiterId: actor.recruiterId, employer: { verified: true } } }),
      this.prisma.report.count({ where: { job: { recruiterId: actor.recruiterId }, status: { not: 'dismissed' }, createdAt: { gte: new Date(Date.now() - 365 * DAY) } } }),
      this.prisma.recruiter.findMany({ where: { employerId: null, userId: { not: null } }, select: { rating: true } }),
    ]);
    const sections = (recruiter.sections ?? {}) as { video?: unknown };
    const { score, checks } = trustScore({
      phoneVerified: !!recruiter.user?.phoneVerifiedAt,
      licensedPartners: licensed,
      violations12m: violations,
      rating,
      hasVideo: !!sections.video,
    });
    // Tỉ lệ NTD cá nhân có điểm đánh giá thấp hơn
    const percentile = peers.length > 1 ? Math.round((peers.filter((p) => p.rating < rating).length / (peers.length - 1)) * 100) : 0;
    return { score, checks, percentile };
  }
}
