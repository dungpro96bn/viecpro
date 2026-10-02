import { HttpStatus, Injectable } from '@nestjs/common';
import {
  REPORT_DECISION_LABEL,
  REPORT_REASON_LABEL,
  REPORT_TARGET_LABEL,
  WEB_LINKS,
  type AdminReportDetail,
  type AdminReportItem,
  type AdminReportList,
  type AdminReportListQuery,
  type ReportDecisionInput,
  type ReportReason,
} from '@viecpro/shared';
import type { Request } from 'express';
import { AuditService } from '../../../core/audit/audit.service.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { paginated } from '../../../core/http/pagination.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { reportCode } from '../../reports/report-rules.js';
import { type SanctionTarget, SanctionsService } from '../sanctions/sanctions.service.js';
import { StepUpService } from '../sanctions/step-up.service.js';
import { seekerCode } from '../users/admin-users.service.js';
import { caseDueAt, caseSeverity, comparePriority, groupCases, targetIdOf } from './report-cases.js';

const DAY = 86400_000;
const ACTIVE = ['open', 'investigating'] as const;
/** Tab đã xử lý / bỏ qua chỉ tải 2.000 báo cáo gần nhất để gộp vụ */
const CLOSED_LIMIT = 2000;

const reportSelect = {
  id: true, number: true, targetType: true, jobId: true, employerId: true, recruiterId: true, targetUserId: true,
  reason: true, detail: true, severity: true, status: true, dueAt: true, createdAt: true, resolvedAt: true,
  decision: true, decisionNote: true, reporterContact: true, claimedAt: true,
  reporter: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  job: { select: { title: true, slug: true, status: true, suspendReason: true, employer: { select: { name: true, shortName: true } }, recruiter: { select: { name: true } } } },
  employer: { select: { name: true, shortName: true, address: true, suspendedAt: true } },
  recruiter: { select: { name: true, city: true, employerId: true, user: { select: { lockedAt: true } } } },
  targetUser: { select: { id: true, name: true, lockedAt: true } },
} satisfies Prisma.ReportSelect;
type Row = Prisma.ReportGetPayload<{ select: typeof reportSelect }>;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
/** "Nguyễn Thị Lan" → "Nguyễn T. L." – người báo cáo ẩn danh với bên bị báo cáo, admin chỉ thấy rút gọn */
const shortName = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.length <= 1 ? name : `${parts[0]} ${parts.slice(1).map((p) => `${p[0]}.`).join(' ')}`;
};
const maskContact = (c: string | null) => (!c ? null : c.includes('@') ? c.replace(/^(.{2}).*(@.*)$/, '$1•••$2') : `${c.slice(0, 4)}•••${c.slice(-3)}`);

/** Báo cáo vi phạm (design 11 – A-06): gộp vụ, SLA theo mức độ, nhận xử lý, quyết định */
@Injectable()
export class AdminReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly sanctions: SanctionsService,
    private readonly stepUp: StepUpService,
  ) {}

  private targetName(r: Row): string {
    switch (r.targetType) {
      case 'job':
        return r.job?.title ?? 'Tin đã xoá';
      case 'employer':
        return r.employer ? (r.employer.shortName ?? r.employer.name) : 'Doanh nghiệp đã xoá';
      case 'recruiter':
        return r.recruiter?.name ?? 'NTD đã xoá';
      default:
        return r.targetUser?.name ?? 'Tài khoản đã xoá';
    }
  }

  private targetMeta(r: Row, code: string): string {
    const label = REPORT_TARGET_LABEL[r.targetType];
    const extra =
      r.targetType === 'job'
        ? (r.job?.employer?.shortName ?? r.job?.employer?.name ?? r.job?.recruiter.name)
        : r.targetType === 'employer'
          ? r.employer?.address?.split(',').pop()?.trim()
          : r.targetType === 'recruiter'
            ? r.recruiter?.city
            : r.targetUserId && seekerCode(r.targetUserId);
    return [label, extra, code].filter(Boolean).join(' · ');
  }

  /** Số vi phạm đã xác nhận trước đây theo đối tượng (đánh dấu "Tái phạm") */
  private async priorViolations(cases: Row[][]): Promise<Map<string, number>> {
    const key = (t: string, id: string | null) => `${t}:${id}`;
    const where = (field: 'jobId' | 'employerId' | 'recruiterId' | 'targetUserId', ids: Array<string | null>) => ({
      [field]: { in: ids.filter((x): x is string => !!x) },
    });
    const firsts = cases.map((c) => c[0]!);
    const confirmed = { status: 'resolved' as const, decision: { not: 'dismiss' as const } };
    const [jobs, employers, recruiters, users] = await Promise.all([
      this.prisma.report.groupBy({ by: ['jobId'], where: { ...confirmed, ...where('jobId', firsts.map((r) => r.jobId)) }, _count: { _all: true } }),
      this.prisma.report.groupBy({ by: ['employerId'], where: { ...confirmed, ...where('employerId', firsts.map((r) => r.employerId)) }, _count: { _all: true } }),
      this.prisma.report.groupBy({ by: ['recruiterId'], where: { ...confirmed, ...where('recruiterId', firsts.map((r) => r.recruiterId)) }, _count: { _all: true } }),
      this.prisma.report.groupBy({ by: ['targetUserId'], where: { ...confirmed, ...where('targetUserId', firsts.map((r) => r.targetUserId)) }, _count: { _all: true } }),
    ]);
    const map = new Map<string, number>();
    // Tin thuộc doanh nghiệp tái phạm cũng tính là tái phạm
    for (const g of jobs) map.set(key('job', g.jobId), g._count._all);
    for (const g of employers) map.set(key('employer', g.employerId), g._count._all);
    for (const g of recruiters) map.set(key('recruiter', g.recruiterId), g._count._all);
    for (const g of users) map.set(key('user', g.targetUserId), g._count._all);
    const out = new Map<string, number>();
    for (const c of cases) {
      const r = c[0]!;
      const n = (map.get(key(r.targetType, targetIdOf(r))) ?? 0) + (r.targetType === 'job' ? (map.get(key('employer', r.employerId)) ?? 0) : 0);
      out.set(r.id, n);
    }
    return out;
  }

  private toItem(list: Row[], adminId: string, prior: number, now: Date): AdminReportItem {
    const first = list[0]!;
    const code = reportCode(first.number);
    const dueAt = caseDueAt(list);
    const reporters = new Map<string, string>();
    for (const r of list) reporters.set(r.reporter?.id ?? `guest:${r.id}`, r.reporter ? initials(r.reporter.name) : 'KH');
    return {
      id: first.id,
      code,
      targetType: first.targetType,
      targetId: targetIdOf(first),
      targetName: this.targetName(first),
      targetMeta: this.targetMeta(first, code),
      reason: first.reason,
      reasonLabel: REPORT_REASON_LABEL[first.reason as ReportReason] ?? first.reason,
      detail: list.find((r) => r.detail)?.detail ?? null,
      severity: caseSeverity(list),
      repeatOffender: prior > 0,
      reporterCount: reporters.size,
      reporterInitials: [...reporters.values()].slice(0, 3),
      status: list.some((r) => r.status === 'investigating') ? 'investigating' : first.status,
      dueAt: dueAt?.toISOString() ?? null,
      dueMinutes: dueAt && (first.status === 'open' || first.status === 'investigating') ? Math.round((dueAt.getTime() - now.getTime()) / 60_000) : null,
      assignee: first.assignee ? { ...first.assignee, isMe: first.assignee.id === adminId } : null,
      decision: first.decision,
      createdAt: first.createdAt.toISOString(),
      resolvedAt: first.resolvedAt?.toISOString() ?? null,
    };
  }

  async list(q: AdminReportListQuery, adminId: string): Promise<AdminReportList> {
    const now = new Date();
    const active = q.tab === 'open';
    const rows = await this.prisma.report.findMany({
      where: {
        status: active ? { in: [...ACTIVE] } : q.tab,
        ...(q.target && { targetType: q.target }),
        ...(q.reason && { reason: q.reason }),
      },
      orderBy: { createdAt: 'desc' },
      ...(!active && { take: CLOSED_LIMIT }),
      select: reportSelect,
    });
    let cases = groupCases(rows);
    if (q.severity) cases = cases.filter((c) => caseSeverity(c) === q.severity);
    if (q.mine) cases = cases.filter((c) => c[0]!.assignee?.id === adminId);
    if (q.q) {
      const term = q.q.toLowerCase();
      const num = /^bc-?(\d+)$/i.exec(q.q)?.[1];
      cases = cases.filter((c) => (num ? c.some((r) => String(r.number) === num) : this.targetName(c[0]!).toLowerCase().includes(term)));
    }
    cases.sort(active ? comparePriority : (a, b) => (b[0]!.resolvedAt?.getTime() ?? 0) - (a[0]!.resolvedAt?.getTime() ?? 0));

    const start = (q.page - 1) * q.limit;
    const pageCases = cases.slice(start, start + q.limit);
    const prior = await this.priorViolations(pageCases);
    const items = pageCases.map((c) => this.toItem(c, adminId, prior.get(c[0]!.id) ?? 0, now));

    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const monthAgo = new Date(now.getTime() - 30 * DAY);
    const [openRows, todayCount, resolvedCount, dismissedCount, handled7d, resolved30, dismissed30] = await Promise.all([
      active ? Promise.resolve(rows) : this.prisma.report.findMany({ where: { status: { in: [...ACTIVE] } }, select: reportSelect }),
      this.prisma.report.count({ where: { createdAt: { gte: new Date(now.getTime() - DAY) } } }),
      this.prisma.report.count({ where: { status: 'resolved' } }),
      this.prisma.report.count({ where: { status: 'dismissed' } }),
      this.prisma.report.findMany({ where: { resolvedAt: { gte: weekAgo } }, select: { createdAt: true, resolvedAt: true } }),
      this.prisma.report.count({ where: { status: 'resolved', resolvedAt: { gte: monthAgo } } }),
      this.prisma.report.count({ where: { status: 'dismissed', resolvedAt: { gte: monthAgo } } }),
    ]);
    const openCases = groupCases(openRows);
    const avgMs = handled7d.length ? handled7d.reduce((s, r) => s + (r.resolvedAt!.getTime() - r.createdAt.getTime()), 0) / handled7d.length : null;
    return {
      ...paginated(items, cases.length, q),
      stats: {
        open: openCases.length,
        openToday: todayCount,
        overdue: openCases.filter((c) => (caseDueAt(c)?.getTime() ?? Infinity) < now.getTime()).length,
        avgHandleHours: avgMs === null ? null : Math.round((avgMs / 3600_000) * 10) / 10,
        confirmedRate: resolved30 + dismissed30 ? Math.round((resolved30 / (resolved30 + dismissed30)) * 100) : null,
      },
      tabs: { open: openCases.length, resolved: resolvedCount, dismissed: dismissedCount },
    };
  }

  /** Mọi báo cáo cùng vụ với báo cáo `id` (cùng đối tượng, lý do, nhóm trạng thái) */
  private async caseOf(id: string): Promise<Row[]> {
    const first = await this.prisma.report.findUnique({ where: { id }, select: reportSelect });
    if (!first) throw ApiException.notFound('Không tìm thấy báo cáo');
    const active = first.status === 'open' || first.status === 'investigating';
    const targetField = { job: 'jobId', employer: 'employerId', recruiter: 'recruiterId', user: 'targetUserId' } as const;
    const field = targetField[first.targetType];
    const rows = await this.prisma.report.findMany({
      where: {
        targetType: first.targetType,
        [field]: first[field],
        reason: first.reason,
        status: active ? { in: [...ACTIVE] } : first.status,
      },
      orderBy: { createdAt: 'asc' },
      select: reportSelect,
    });
    return rows.length ? rows : [first];
  }

  async detail(id: string, adminId: string): Promise<AdminReportDetail> {
    const list = await this.caseOf(id);
    const first = list[0]!;
    const prior = (await this.priorViolations([list])).get(first.id) ?? 0;
    const item = this.toItem(list, adminId, prior, new Date());
    const status =
      first.targetType === 'job'
        ? (first.job?.status ?? null)
        : first.targetType === 'employer'
          ? first.employer?.suspendedAt ? 'suspended' : 'active'
          : first.targetType === 'recruiter'
            ? first.recruiter?.user?.lockedAt ? 'suspended' : 'active'
            : first.targetUser?.lockedAt ? 'locked' : 'active';
    return {
      ...item,
      reports: list.map((r) => ({
        code: reportCode(r.number),
        reason: REPORT_REASON_LABEL[r.reason as ReportReason] ?? r.reason,
        detail: r.detail,
        reporter: r.reporter ? shortName(r.reporter.name) : 'Khách',
        contact: maskContact(r.reporterContact),
        createdAt: r.createdAt.toISOString(),
      })),
      target: {
        type: first.targetType,
        id: targetIdOf(first),
        name: this.targetName(first),
        link: first.targetType === 'job' && first.job ? WEB_LINKS.job(first.job.slug) : null,
        status,
        previousViolations: prior,
      },
      decisionNote: first.decisionNote,
    };
  }

  async claim(adminId: string, id: string, req: Request): Promise<AdminReportDetail> {
    const list = await this.caseOf(id);
    const first = list[0]!;
    if (first.status !== 'open' && first.status !== 'investigating') throw new ApiException('CONFLICT', 'Báo cáo đã được xử lý', HttpStatus.CONFLICT);
    if (first.assignee && first.assignee.id !== adminId) throw new ApiException('CONFLICT', `${first.assignee.name} đang xử lý báo cáo này`, HttpStatus.CONFLICT);
    const ids = list.map((r) => r.id);
    await this.prisma.$transaction(async (tx) => {
      await tx.report.updateMany({ where: { id: { in: ids } }, data: { assigneeId: adminId, claimedAt: new Date(), status: 'investigating' } });
      await this.audit.log({ actorId: adminId, action: 'report.claim', targetType: 'report', targetId: first.id, after: { reports: ids.length } }, req, tx);
    });
    return this.detail(first.id, adminId);
  }

  /** Đối tượng xử phạt của vụ (NTD sở hữu tin, công ty, NTD cá nhân) */
  private async sanctionTarget(r: Row): Promise<SanctionTarget | null> {
    if (r.targetType === 'employer' && r.employerId) return { kind: 'company', employerId: r.employerId };
    if (r.targetType === 'recruiter' && r.recruiterId) return { kind: 'individual', recruiterId: r.recruiterId };
    if (r.targetType === 'job' && r.jobId) {
      const job = await this.prisma.job.findUnique({ where: { id: r.jobId }, select: { employerId: true, recruiterId: true, recruiter: { select: { employerId: true } } } });
      if (!job) return null;
      // Tin của thành viên công ty → xử phạt công ty; tin của NTD cá nhân → NTD đó
      return job.recruiter.employerId ? { kind: 'company', employerId: job.recruiter.employerId } : { kind: 'individual', recruiterId: job.recruiterId };
    }
    return null;
  }

  async decide(adminId: string, id: string, input: ReportDecisionInput, req: Request): Promise<AdminReportDetail> {
    const list = await this.caseOf(id);
    const first = list[0]!;
    if (first.status !== 'open' && first.status !== 'investigating') throw new ApiException('CONFLICT', 'Báo cáo đã được xử lý', HttpStatus.CONFLICT);
    if (first.assignee && first.assignee.id !== adminId) throw new ApiException('CONFLICT', `${first.assignee.name} đang xử lý báo cáo này`, HttpStatus.CONFLICT);
    if (input.decision === 'suspend' || input.decision === 'ban') await this.stepUp.assert(adminId, input.otp);
    const note = input.note ?? REPORT_DECISION_LABEL[input.decision];

    await this.apply(adminId, first, input.decision, note, req);

    const ids = list.map((r) => r.id);
    const now = new Date();
    const status = input.decision === 'dismiss' ? 'dismissed' : 'resolved';
    await this.prisma.$transaction(async (tx) => {
      await tx.report.updateMany({
        where: { id: { in: ids } },
        data: { status, decision: input.decision, decisionNote: input.note ?? null, resolvedById: adminId, resolvedAt: now, assigneeId: first.assignee?.id ?? adminId },
      });
      await this.audit.log({ actorId: adminId, action: 'report.decide', targetType: 'report', targetId: first.id, before: { status: first.status }, after: { status, decision: input.decision, note: input.note, reports: ids.length } }, req, tx);
    });

    // Người báo cáo nhận kết quả – không nêu tên người xử lý hay chi tiết hình phạt
    const reporterIds = [...new Set(list.map((r) => r.reporter?.id).filter((x): x is string => !!x))];
    for (const userId of reporterIds) {
      await this.notifications.notify(userId, 'report.result', {
        title: `Báo cáo ${reportCode(first.number)} đã được xử lý`,
        body: status === 'resolved' ? 'Cảm ơn bạn – chúng tôi đã xác nhận vi phạm và xử lý theo quy chế.' : 'Chúng tôi đã kiểm tra nhưng chưa đủ căn cứ xác định vi phạm.',
      });
    }
    return this.detail(first.id, adminId);
  }

  private async apply(adminId: string, r: Row, decision: ReportDecisionInput['decision'], note: string, req: Request) {
    if (decision === 'dismiss') {
      // Tin bị tự tạm ẩn vì báo cáo thu phí mà kiểm tra không có vi phạm → hiển thị lại
      if (r.targetType === 'job' && r.jobId && r.job?.status === 'paused' && r.job.suspendReason?.startsWith('Tự tạm ẩn')) {
        await this.prisma.job.update({ where: { id: r.jobId }, data: { status: 'open', suspendedAt: null, suspendReason: null } });
        await this.prisma.jobEvent.create({ data: { jobId: r.jobId, action: 'restore', note: 'Báo cáo không có căn cứ – hiển thị lại' } });
      }
      return;
    }
    if (r.targetType === 'user') {
      if (!r.targetUserId) throw ApiException.notFound('Tài khoản bị báo cáo không còn');
      if (decision === 'warn') {
        await this.notifications.notify(r.targetUserId, 'account.warning', { title: 'Cảnh cáo từ bộ phận kiểm duyệt viecpro', body: note });
        await this.audit.log({ actorId: adminId, action: 'user.warn', targetType: 'user', targetId: r.targetUserId, after: { reason: note } }, req);
      } else if (decision === 'remove_job') {
        throw new ApiException('VALIDATION_ERROR', 'Chỉ gỡ tin được với báo cáo tin đăng', HttpStatus.BAD_REQUEST, { decision: 'Quyết định không phù hợp' });
      } else {
        await this.sanctions.banUser(adminId, r.targetUserId, decision === 'ban' ? note : `Tạm khoá: ${note}`, req);
      }
      return;
    }
    if (decision === 'remove_job') {
      if (r.targetType !== 'job' || !r.jobId) throw new ApiException('VALIDATION_ERROR', 'Chỉ gỡ tin được với báo cáo tin đăng', HttpStatus.BAD_REQUEST, { decision: 'Quyết định không phù hợp' });
      await this.sanctions.removeJob(adminId, r.jobId, note, req);
      return;
    }
    const target = await this.sanctionTarget(r);
    if (!target) throw ApiException.notFound('Đối tượng bị báo cáo không còn');
    if (decision === 'warn') await this.sanctions.warn(adminId, target, note, req);
    // TODO(decision): "khoá vĩnh viễn" NTD hiện dùng cùng cơ chế tạm khoá (mở lại được bởi admin có quyền users.lock)
    else await this.sanctions.suspend(adminId, target, note, req).catch((e: unknown) => {
      // Đã bị tạm khoá từ trước → vẫn ghi nhận quyết định
      if (!(e instanceof ApiException && e.getStatus() === HttpStatus.CONFLICT)) throw e;
    });
  }
}
