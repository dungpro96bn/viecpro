import { Injectable } from '@nestjs/common';
import { REPORT_REASON_LABEL, type ActivityItem, type AdminBadges, type AdminDashboard, type DashboardRange, type KpiCard, type ReportGroup, type ReportReason } from '@viecpro/shared';
import { readFileSync } from 'node:fs';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { VerificationsService } from '../verifications/verifications.service.js';
import { buildInsights } from './insights.js';
import { fillDays, pctChange, periodOf, vnDate, type Period } from './period.js';

const VERSION = (JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8')) as { version: string }).version;
const DAY = 86400_000;

type DayRow = { d: string; c: number };
const short = (s: string, n = 32) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Số liệu bảng điều khiển admin. Chỉ dùng dữ liệu thật trong DB;
 * khối cần module chưa có (doanh thu, lượt truy cập, xuất cảnh) trả null.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly verifications: VerificationsService,
  ) {}

  async badges(): Promise<AdminBadges> {
    const [pendingJobs, pendingVerifications, openReports] = await Promise.all([
      this.prisma.job.count({ where: { status: 'pending' } }),
      this.prisma.verificationRequest.count({ where: { status: { in: ['pending', 'needs_info'] } } }),
      this.prisma.report.count({ where: { status: { in: ['open', 'investigating'] } } }),
    ]);
    return { pendingJobs, pendingVerifications, openReports };
  }

  /* ---------------- Chuỗi số theo ngày (giờ VN) ---------------- */
  private applicationsByDay(from: Date) {
    return this.prisma.$queryRaw<DayRow[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
      FROM "Application" WHERE "createdAt" >= ${from} GROUP BY 1`;
  }

  private activeUsersByDay(from: Date) {
    return this.prisma.$queryRaw<DayRow[]>`
      SELECT to_char(("lastUsedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS d, COUNT(DISTINCT "userId")::int AS c
      FROM "Session" WHERE "lastUsedAt" >= ${from} AND "isAdmin" = false GROUP BY 1`;
  }

  private publishedByDay(from: Date) {
    return this.prisma.$queryRaw<DayRow[]>`
      SELECT to_char(("publishedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
      FROM "Job" WHERE "publishedAt" >= ${from} GROUP BY 1`;
  }

  /** Thời gian duyệt trung bình (phút) theo ngày duyệt */
  private moderationMinutesByDay(from: Date) {
    return this.prisma.$queryRaw<DayRow[]>`
      SELECT to_char(("moderatedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS d,
             ROUND(AVG(EXTRACT(EPOCH FROM ("moderatedAt" - "submittedAt")) / 60))::int AS c
      FROM "Job" WHERE "moderatedAt" >= ${from} AND "submittedAt" IS NOT NULL GROUP BY 1`;
  }

  private async avgModerationMinutes(from: Date, to: Date) {
    const [row] = await this.prisma.$queryRaw<Array<{ m: number | null }>>`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("moderatedAt" - "submittedAt")) / 60))::int AS m
      FROM "Job" WHERE "moderatedAt" >= ${from} AND "moderatedAt" < ${to} AND "submittedAt" IS NOT NULL`;
    return row?.m ?? null;
  }

  /* ---------------- Thẻ số liệu ---------------- */
  private async kpis(p: Period, appsDaily: number[]): Promise<KpiCard[]> {
    const lookback = new Date(Math.min(p.chartFrom.getTime(), p.prevFrom.getTime()));
    const [dauRows, pubRows, modRows, openJobs, openEmployers, publishedBefore, sessions, appSplit, modNow, modPrev, appsToday, appsYesterday] = await Promise.all([
      this.activeUsersByDay(lookback),
      this.publishedByDay(lookback),
      this.moderationMinutesByDay(p.chartFrom),
      this.prisma.job.count({ where: { status: 'open' } }),
      this.prisma.job.groupBy({ by: ['employerId'], where: { status: 'open', employerId: { not: null } } }),
      this.prisma.job.count({ where: { status: 'open', publishedAt: { lt: p.chartFrom } } }),
      this.prisma.session.groupBy({ by: ['platform'], where: { isAdmin: false, lastUsedAt: { gte: p.from } }, _count: { _all: true } }),
      this.prisma.application.groupBy({ by: ['userId'], where: { createdAt: { gte: p.from } }, _count: { _all: true } }),
      this.avgModerationMinutes(p.from, p.to),
      this.avgModerationMinutes(p.prevFrom, p.from),
      this.prisma.application.count({ where: { createdAt: { gte: periodOf('today').from } } }),
      // So với cùng giờ hôm qua (không so ngày chưa hết với cả ngày)
      this.prisma.application.count({ where: { createdAt: { gte: new Date(periodOf('today').from.getTime() - DAY), lt: new Date(Date.now() - DAY) } } }),
    ]);

    // Người dùng hoạt động / ngày: trung bình trong kỳ so với kỳ trước
    const prevDays = Array.from({ length: p.days }, (_, i) => vnDate(new Date(p.prevFrom.getTime() + i * DAY + 12 * 3600_000)));
    const dauSeries = fillDays(p.chartDays, dauRows);
    const currentDays = p.chartDays.slice(-p.days);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
    const dauNow = avg(fillDays(currentDays, dauRows));
    const dauPrev = avg(fillDays(prevDays, dauRows));
    const totalSessions = sessions.reduce((s, x) => s + x._count._all, 0);
    const appSessions = sessions.filter((s) => s.platform !== 'web').reduce((s, x) => s + x._count._all, 0);

    // Tin đang hiển thị: đường tích luỹ số tin được đăng
    const pubSeries = fillDays(p.chartDays, pubRows);
    let running = publishedBefore;
    const openSeries = pubSeries.map((n) => (running += n));
    const pubNow = fillDays(currentDays, pubRows).reduce((s, x) => s + x, 0);
    const pubPrev = fillDays(prevDays, pubRows).reduce((s, x) => s + x, 0);

    const totalApps = appSplit.reduce((s, x) => s + x._count._all, 0);
    const oneTap = appSplit.filter((x) => x.userId).reduce((s, x) => s + x._count._all, 0);

    return [
      {
        key: 'dau',
        label: 'Người dùng / ngày',
        value: dauNow,
        delta: pctChange(dauNow, dauPrev),
        unit: 'count',
        series: dauSeries,
        note: totalSessions ? `DAU · ${Math.round((appSessions / totalSessions) * 100)}% từ app` : 'DAU',
      },
      {
        key: 'openJobs',
        label: 'Tin đang hiển thị',
        value: openJobs,
        delta: pctChange(pubNow, pubPrev),
        unit: 'count',
        series: openSeries,
        note: `${openEmployers.length.toLocaleString('vi-VN')} doanh nghiệp`,
      },
      {
        key: 'applicationsToday',
        label: 'Ứng tuyển hôm nay',
        value: appsToday,
        delta: pctChange(appsToday, appsYesterday),
        unit: 'count',
        series: appsDaily,
        note: totalApps ? `Tỉ lệ 1 chạm: ${Math.round((oneTap / totalApps) * 100)}%` : null,
      },
      { key: 'revenue', label: 'Doanh thu tháng', value: null, delta: null, unit: 'vnd', series: [], note: 'Chưa tích hợp thanh toán' },
      {
        key: 'moderationTime',
        label: 'Thời gian duyệt TB',
        value: modNow,
        delta: modNow !== null && modPrev !== null ? modNow - modPrev : null,
        inverse: true,
        unit: 'minutes',
        series: fillDays(p.chartDays, modRows),
        note: 'Mục tiêu dưới 30 phút',
      },
    ];
  }

  /* ---------------- Báo cáo vi phạm ---------------- */
  private async reportGroups(): Promise<{ open: number; groups: ReportGroup[]; employersByReason: Map<string, Set<string>>; jobsByReason: Map<string, number> }> {
    const reports = await this.prisma.report.findMany({
      where: { status: { in: ['open', 'investigating'] } },
      orderBy: { createdAt: 'desc' },
      select: { reason: true, severity: true, jobId: true, employerId: true, createdAt: true, job: { select: { title: true, employerId: true } }, employer: { select: { name: true, shortName: true } } },
      take: 500,
    });
    const groups = new Map<string, ReportGroup & { latest: number; urgent: boolean }>();
    const employersByReason = new Map<string, Set<string>>();
    const jobsByReason = new Map<string, number>();
    for (const r of reports) {
      // Báo cáo mới lưu mã lý do (fee, scam…); dữ liệu cũ lưu nguyên câu
      const reason = REPORT_REASON_LABEL[r.reason as ReportReason] ?? r.reason;
      const target = r.employer ? (r.employer.shortName ?? r.employer.name) : short(r.job?.title ?? '—', 36);
      const key = `${reason}|${target}`;
      const g = groups.get(key) ?? { reason, target, reporters: 0, severity: 'medium' as const, urgent: false, latestAt: r.createdAt.toISOString(), latest: r.createdAt.getTime() };
      g.reporters++;
      g.urgent ||= r.severity === 'critical' || r.severity === 'high';
      groups.set(key, g);
      const employerId = r.employerId ?? r.job?.employerId;
      if (employerId) employersByReason.set(reason, (employersByReason.get(reason) ?? new Set()).add(employerId));
      if (r.jobId) jobsByReason.set(reason, (jobsByReason.get(reason) ?? 0) + 1);
    }
    const list = [...groups.values()]
      .map(({ latest: _l, urgent, ...g }) => ({ ...g, severity: urgent || g.reporters >= 3 ? ('high' as const) : ('medium' as const) }))
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt))
      .slice(0, 3);
    return { open: reports.length, groups: list, employersByReason, jobsByReason };
  }

  /* ---------------- Hoạt động trực tiếp ---------------- */
  private async activity(): Promise<ActivityItem[]> {
    const hourAgo = new Date(Date.now() - 3600_000);
    const [jobs, apps, logs, subs] = await Promise.all([
      this.prisma.job.findMany({
        where: { OR: [{ publishedAt: { not: null } }, { submittedAt: { not: null } }] },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { title: true, createdAt: true, employer: { select: { shortName: true, name: true } }, recruiter: { select: { name: true } } },
      }),
      this.prisma.application.findMany({ orderBy: { createdAt: 'desc' }, take: 4, select: { fullName: true, userId: true, createdAt: true, job: { select: { pref: true } } } }),
      this.prisma.auditLog.findMany({
        where: { action: { in: ['job.approve', 'job.reject', 'verification.approve', 'verification.request_info'] } },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { action: true, targetId: true, createdAt: true, actor: { select: { name: true, adminRole: { select: { name: true } } } } },
      }),
      this.prisma.subscription.findMany({ where: { createdAt: { gte: hourAgo } }, select: { createdAt: true }, orderBy: { createdAt: 'desc' } }),
    ]);

    const jobTitles = new Map(
      (await this.prisma.job.findMany({ where: { id: { in: logs.map((l) => l.targetId).filter((id): id is string => !!id) } }, select: { id: true, title: true } })).map((j) => [j.id, j.title]),
    );
    const ACTION_TEXT: Record<string, (target: string) => string> = {
      'job.approve': (t) => `duyệt tin “${t}”`,
      'job.reject': (t) => `từ chối tin “${t}”`,
      'verification.approve': () => 'xác minh 1 doanh nghiệp',
      'verification.request_info': () => 'yêu cầu DN bổ sung giấy tờ',
    };

    const items: ActivityItem[] = [
      ...jobs.map((j) => ({ type: 'job' as const, actor: j.employer?.shortName ?? j.employer?.name ?? j.recruiter.name, text: `đăng tin mới “${short(j.title)}”`, at: j.createdAt.toISOString() })),
      ...apps.map((a) => ({ type: 'application' as const, actor: a.fullName, text: `ứng tuyển ${a.userId ? '1 chạm ' : ''}đơn ${a.job.pref}`, at: a.createdAt.toISOString() })),
      ...logs.map((l) => ({
        type: (l.action.startsWith('job') ? 'moderation' : 'verification') as ActivityItem['type'],
        actor: `${l.actor.adminRole?.name ?? 'Quản trị viên'} ${l.actor.name}`,
        text: ACTION_TEXT[l.action]!(short(jobTitles.get(l.targetId ?? '') ?? '', 28)),
        at: l.createdAt.toISOString(),
      })),
      ...(subs.length ? [{ type: 'subscription' as const, actor: `${subs.length} người`, text: 'đăng ký nhận đơn mới qua Zalo / email', at: subs[0]!.createdAt.toISOString() }] : []),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  }

  /** Ngành có hồ sơ ứng tuyển tăng mạnh nhất tuần này so với tuần trước */
  private async topIndustryGrowth() {
    const rows = await this.prisma.$queryRaw<Array<{ industry: string; now: number; prev: number }>>`
      SELECT j.industry,
        COUNT(*) FILTER (WHERE a."createdAt" >= NOW() - INTERVAL '7 days')::int AS now,
        COUNT(*) FILTER (WHERE a."createdAt" < NOW() - INTERVAL '7 days')::int AS prev
      FROM "Application" a JOIN "Job" j ON j.id = a."jobId"
      WHERE a."createdAt" >= NOW() - INTERVAL '14 days'
      GROUP BY j.industry`;
    const best = rows
      .filter((r) => r.prev >= 5)
      .map((r) => ({ industry: r.industry, growth: Math.round(((r.now - r.prev) / r.prev) * 100) }))
      .sort((a, b) => b.growth - a.growth)[0];
    return best ?? null;
  }

  async dashboard(range: DashboardRange): Promise<AdminDashboard> {
    const p = periodOf(range);
    const now = Date.now();

    const appRows = await this.applicationsByDay(new Date(Math.min(p.chartFrom.getTime(), p.prevFrom.getTime())));
    const appsDaily = fillDays(p.chartDays, appRows);
    const prevDays = Array.from({ length: p.days }, (_, i) => vnDate(new Date(p.prevFrom.getTime() + i * DAY + 12 * 3600_000)));
    const periodApps = fillDays(p.chartDays.slice(-p.days), appRows).reduce((s, x) => s + x, 0);
    const prevApps = fillDays(prevDays, appRows).reduce((s, x) => s + x, 0);

    const dbStart = performance.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Math.round(performance.now() - dbStart);

    const [kpis, queue, verifications, reports, demand, activity, funnelCounts, submitted24, submittedPrev24, topIndustry, otpSent24h] = await Promise.all([
      this.kpis(p, appsDaily),
      this.moderation.queue(6),
      this.verifications.queue(3),
      this.reportGroups(),
      this.prisma.job.groupBy({ by: ['pref'], where: { status: 'open' }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 6 }),
      this.activity(),
      Promise.all([
        this.prisma.job.aggregate({ _sum: { views: true } }),
        this.prisma.application.count({ where: { createdAt: { gte: p.from } } }),
        this.prisma.application.count({ where: { createdAt: { gte: p.from }, status: { in: ['interview', 'passed'] } } }),
        this.prisma.application.count({ where: { createdAt: { gte: p.from }, status: 'passed' } }),
      ]),
      this.prisma.job.count({ where: { submittedAt: { gte: new Date(now - DAY) } } }),
      this.prisma.job.count({ where: { submittedAt: { gte: new Date(now - 2 * DAY), lt: new Date(now - DAY) } } }),
      this.topIndustryGrowth(),
      this.prisma.otpCode.count({ where: { createdAt: { gte: new Date(now - DAY) } } }),
    ]);

    const [views, applied, interviewed, passed] = funnelCounts;
    const topReason = [...reports.employersByReason.entries()].sort((a, b) => b[1].size - a[1].size)[0];
    const nonZero = appsDaily.filter((x) => x > 0);
    const appsKpi = kpis.find((k) => k.key === 'applicationsToday');

    return {
      range,
      generatedAt: new Date().toISOString(),
      insights: buildInsights({
        pending: queue.total,
        nearSla: queue.items.filter((i) => i.slaMinutes < 30).length,
        submittedLast24h: submitted24,
        submittedPrev24h: submittedPrev24,
        topReport: topReason ? { reason: topReason[0], employers: topReason[1].size, hiddenJobs: reports.jobsByReason.get(topReason[0]) ?? 0 } : null,
        topIndustry,
      }),
      kpis,
      applicationsDaily: {
        days: p.chartDays.map((date, i) => ({ date, count: appsDaily[i]! })),
        total: periodApps,
        delta: pctChange(periodApps, prevApps),
        average: Math.round(appsDaily.reduce((s, x) => s + x, 0) / appsDaily.length),
        max: Math.max(...appsDaily),
        min: nonZero.length ? Math.min(...nonZero) : 0,
        oneTapRate: appsKpi?.note ? Number(appsKpi.note.match(/(\d+)%/)?.[1] ?? 0) : null,
      },
      funnel: [
        { label: 'Lượt truy cập', value: null },
        { label: 'Xem chi tiết tin', value: views._sum.views ?? 0 },
        { label: 'Ứng tuyển', value: applied },
        { label: 'Phỏng vấn', value: interviewed },
        { label: 'Trúng tuyển', value: passed },
        { label: 'Đã xuất cảnh', value: null },
      ],
      moderationQueue: queue,
      verifications,
      reports: { open: reports.open, groups: reports.groups },
      demandByPref: demand.map((d) => ({ pref: d.pref, quota: d._sum.quantity ?? 0 })),
      revenue: null,
      activity,
      health: {
        status: dbLatencyMs < 200 ? 'ok' : 'degraded',
        dbLatencyMs,
        uptimeSeconds: Math.round(process.uptime()),
        otpSent24h,
        version: VERSION,
      },
    };
  }
}
