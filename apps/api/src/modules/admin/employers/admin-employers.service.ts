import { Injectable } from '@nestjs/common';
import {
  REPORT_REASON_LABEL,
  type AdminEmployerDetail,
  type AdminEmployerItem,
  type AdminEmployerList,
  type AdminEmployerListQuery,
  type AuditLogItem,
  type ReportReason,
} from '@viecpro/shared';
import type { Request } from 'express';
import { AssetUrlService } from '../../../core/assets/asset-url.service.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { paginated } from '../../../core/http/pagination.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { reportCode } from '../../reports/report-rules.js';
import { type SanctionTarget, SanctionsService } from '../sanctions/sanctions.service.js';
import { StepUpService } from '../sanctions/step-up.service.js';
import { deltaPercent, employerStatus, filterEmployers, isPaidPlan } from './employer-metrics.js';

const DAY = 86400_000;
const OPEN_REPORT = { in: ['open' as const, 'investigating' as const] };

/** "0109123482" → "0109•••482" */
const maskTax = (v: string | null) => (v && v.length > 7 ? `${v.slice(0, 4)}•••${v.slice(-3)}` : v);
/** "+84984524521" → "098•••4521" */
const maskPhone = (v: string | null) => {
  if (!v) return null;
  const d = v.replace(/^\+84/, '0');
  return `${d.slice(0, 3)}•••${d.slice(-4)}`;
};
/** Phần cuối địa chỉ làm tỉnh / thành: "Số 21 Lê Đức Thọ, Từ Liêm, Hà Nội" → "Hà Nội" */
const cityOf = (address: string | null | undefined) => address?.split(',').pop()?.trim() || null;

interface AppStats {
  cur: number;
  prev: number;
  recent: number;
  responded: number;
}
const emptyStats = (): AppStats => ({ cur: 0, prev: 0, recent: 0, responded: 0 });

/** Nhà tuyển dụng (design 10 – A-05): gộp công ty XKLĐ và NTD cá nhân */
@Injectable()
export class AdminEmployersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetUrlService,
    private readonly sanctions: SanctionsService,
    private readonly stepUp: StepUpService,
  ) {}

  /** Số hồ sơ 30 ngày / 30 ngày trước / tỉ lệ phản hồi 90 ngày theo doanh nghiệp và theo cán bộ */
  private async applicationStats(now: Date) {
    const d30 = new Date(now.getTime() - 30 * DAY);
    const d60 = new Date(now.getTime() - 60 * DAY);
    const d90 = new Date(now.getTime() - 90 * DAY);
    const rows = await this.prisma.$queryRaw<Array<{ employerId: string | null; recruiterId: string; cur: bigint; prev: bigint; recent: bigint; responded: bigint }>>`
      SELECT j."employerId", j."recruiterId",
        COUNT(*) FILTER (WHERE a."createdAt" >= ${d30}) AS cur,
        COUNT(*) FILTER (WHERE a."createdAt" >= ${d60} AND a."createdAt" < ${d30}) AS prev,
        COUNT(*) AS recent,
        COUNT(*) FILTER (WHERE a.status <> 'submitted' OR a."seenAt" IS NOT NULL) AS responded
      FROM "Application" a JOIN "Job" j ON j.id = a."jobId"
      WHERE a."createdAt" >= ${d90}
      GROUP BY j."employerId", j."recruiterId"`;
    const byEmployer = new Map<string, AppStats>();
    const byRecruiter = new Map<string, AppStats>();
    const add = (map: Map<string, AppStats>, key: string, r: (typeof rows)[number]) => {
      const s = map.get(key) ?? emptyStats();
      s.cur += Number(r.cur);
      s.prev += Number(r.prev);
      s.recent += Number(r.recent);
      s.responded += Number(r.responded);
      map.set(key, s);
    };
    for (const r of rows) {
      if (r.employerId) add(byEmployer, r.employerId, r);
      add(byRecruiter, r.recruiterId, r);
    }
    return { byEmployer, byRecruiter };
  }

  private async loadAll(now = new Date()): Promise<AdminEmployerItem[]> {
    const [companies, individuals, jobCounts, reportsByEmployer, reportsByRecruiter, approvedIndividuals, stats] = await Promise.all([
      this.prisma.employer.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, shortName: true, logoUrl: true, taxCode: true, address: true, verified: true, suspendedAt: true, createdAt: true, plan: { select: { name: true, expiresAt: true } } },
      }),
      this.prisma.recruiter.findMany({
        where: { employerId: null, user: { is: { role: 'employer', deletedAt: null } } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, photoUrl: true, phone: true, city: true, createdAt: true,
          user: { select: { lockedAt: true, lockReason: true } },
          plan: { select: { name: true, expiresAt: true } },
          partners: { select: { employer: { select: { name: true, shortName: true } } }, take: 1, orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.job.groupBy({ by: ['employerId', 'recruiterId', 'status'], _count: { _all: true } }),
      this.prisma.report.groupBy({ by: ['employerId'], where: { status: OPEN_REPORT, employerId: { not: null } }, _count: { _all: true } }),
      this.prisma.report.groupBy({ by: ['recruiterId'], where: { status: OPEN_REPORT, recruiterId: { not: null } }, _count: { _all: true } }),
      this.prisma.verificationRequest.findMany({ where: { kind: 'individual', status: 'approved', recruiterId: { not: null } }, select: { recruiterId: true } }),
      this.applicationStats(now),
    ]);

    const jobs = { employer: new Map<string, { open: number; total: number }>(), recruiter: new Map<string, { open: number; total: number }>() };
    for (const j of jobCounts) {
      const n = j._count._all;
      const bump = (map: Map<string, { open: number; total: number }>, key: string) => {
        const v = map.get(key) ?? { open: 0, total: 0 };
        v.total += n;
        if (j.status === 'open') v.open += n;
        map.set(key, v);
      };
      if (j.employerId) bump(jobs.employer, j.employerId);
      bump(jobs.recruiter, j.recruiterId);
    }
    const repE = new Map(reportsByEmployer.map((r) => [r.employerId, r._count._all]));
    const repR = new Map(reportsByRecruiter.map((r) => [r.recruiterId, r._count._all]));
    const approved = new Set(approvedIndividuals.map((v) => v.recruiterId));

    const plan = (p: { name: string; expiresAt: Date } | null) =>
      p && p.expiresAt.getTime() >= now.getTime() ? { name: p.name, expiresAt: p.expiresAt.toISOString(), daysLeft: Math.ceil((p.expiresAt.getTime() - now.getTime()) / DAY) } : null;
    const metrics = (s: AppStats | undefined) => ({
      applicants30d: s?.cur ?? 0,
      applicantsDelta: s ? deltaPercent(s.cur, s.prev) : null,
      responseRate: s?.recent ? Math.round((s.responded / s.recent) * 100) : null,
    });

    const companyItems: AdminEmployerItem[] = companies.map((e) => ({
      key: `company:${e.id}`,
      kind: 'company',
      id: e.id,
      name: e.shortName ?? e.name,
      logoUrl: e.logoUrl ? this.assets.url(e.logoUrl) : null,
      subtitle: [e.taxCode && `MST ${maskTax(e.taxCode)}`, cityOf(e.address)].filter(Boolean).join(' · '),
      verified: e.verified,
      reportCount: repE.get(e.id) ?? 0,
      openJobs: jobs.employer.get(e.id)?.open ?? 0,
      totalJobs: jobs.employer.get(e.id)?.total ?? 0,
      ...metrics(stats.byEmployer.get(e.id)),
      plan: plan(e.plan),
      status: employerStatus({ suspended: !!e.suspendedAt, verified: e.verified, planExpiresAt: e.plan?.expiresAt ?? null }, now),
    }));
    const individualItems: AdminEmployerItem[] = individuals.map((r) => {
      const partner = r.partners[0]?.employer;
      const verified = approved.has(r.id);
      return {
        key: `individual:${r.id}`,
        kind: 'individual',
        id: r.id,
        name: r.name,
        logoUrl: r.photoUrl ? this.assets.url(r.photoUrl) : null,
        subtitle: [r.phone && `SĐT ${maskPhone(r.phone)}`, r.city, `Liên kết: ${partner ? (partner.shortName ?? partner.name) : 'Chưa khai báo'}`].filter(Boolean).join(' · '),
        verified,
        reportCount: repR.get(r.id) ?? 0,
        openJobs: jobs.recruiter.get(r.id)?.open ?? 0,
        totalJobs: jobs.recruiter.get(r.id)?.total ?? 0,
        ...metrics(stats.byRecruiter.get(r.id)),
        plan: plan(r.plan),
        status: employerStatus({ suspended: !!r.user?.lockedAt, verified, planExpiresAt: r.plan?.expiresAt ?? null }, now),
      };
    });
    // Mới nhất trước – thứ tự mặc định khi sắp xếp "newest"
    return [...companyItems, ...individualItems];
  }

  // TODO(decision): gộp 2 bảng nên lọc / phân trang trong bộ nhớ – đủ cho vài chục nghìn NTD; lớn hơn cần bảng tổng hợp
  async list(q: AdminEmployerListQuery): Promise<AdminEmployerList> {
    const now = new Date();
    const all = await this.loadAll(now);
    const filtered = filterEmployers(all, q);
    const start = (q.page - 1) * q.limit;
    const createdRecently = await Promise.all([
      this.prisma.employer.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY) } } }),
      this.prisma.recruiter.count({ where: { employerId: null, createdAt: { gte: new Date(now.getTime() - 30 * DAY) }, user: { is: { role: 'employer', deletedAt: null } } } }),
    ]);
    const ofKind = q.kind === 'all' ? all : all.filter((i) => i.kind === q.kind);
    const count = (status: AdminEmployerItem['status']) => ofKind.filter((i) => i.status === status).length;
    return {
      ...paginated(filtered.slice(start, start + q.limit), filtered.length, q),
      stats: {
        total: all.length,
        newThisMonth: createdRecently[0] + createdRecently[1],
        withOpenJobs: all.filter((i) => i.openJobs > 0).length,
        paid: all.filter((i) => isPaidPlan(i.plan?.name)).length,
        expiring: all.filter((i) => i.status === 'expiring').length,
      },
      kinds: { all: all.length, company: all.filter((i) => i.kind === 'company').length, individual: all.filter((i) => i.kind === 'individual').length },
      tabs: { all: ofKind.length, active: count('active'), pending: count('pending'), expiring: count('expiring'), suspended: count('suspended') },
    };
  }

  /** :kind/:id → đối tượng xử phạt; không tồn tại → 404 */
  async target(kind: string, id: string): Promise<SanctionTarget> {
    if (kind === 'company') {
      if (await this.prisma.employer.findUnique({ where: { id }, select: { id: true } })) return { kind: 'company', employerId: id };
    } else if (kind === 'individual') {
      const r = await this.prisma.recruiter.findFirst({ where: { id, employerId: null, user: { is: { role: 'employer' } } }, select: { id: true } });
      if (r) return { kind: 'individual', recruiterId: id };
    }
    throw ApiException.notFound('Không tìm thấy nhà tuyển dụng');
  }

  async detail(kind: string, id: string): Promise<AdminEmployerDetail> {
    const target = await this.target(kind, id);
    const item = (await this.loadAll()).find((i) => i.key === `${target.kind}:${id}`);
    if (!item) throw ApiException.notFound('Không tìm thấy nhà tuyển dụng');
    const company = target.kind === 'company';
    const jobWhere = company ? { employerId: id } : { recruiterId: id };
    const reportWhere = company ? { employerId: id } : { recruiterId: id };

    const [info, members, partners, jobs, violations, history] = await Promise.all([
      company
        ? this.prisma.employer.findUniqueOrThrow({ where: { id }, select: { phone: true, email: true, website: true, address: true, createdAt: true, suspendedAt: true, suspendReason: true } })
        : this.prisma.recruiter.findUniqueOrThrow({ where: { id }, select: { phone: true, city: true, createdAt: true, user: { select: { email: true, lockedAt: true, lockReason: true } } } }),
      this.prisma.recruiter.findMany({
        where: company ? { employerId: id } : { id },
        select: { id: true, name: true, title: true, leftAt: true, user: { select: { lockedAt: true } } },
        orderBy: [{ leftAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
      }),
      this.prisma.recruiterPartner.findMany({
        where: company ? { employerId: id } : { recruiterId: id },
        select: { id: true, expiresAt: true, recruiter: { select: { name: true } }, employer: { select: { name: true } } },
      }),
      this.prisma.job.findMany({
        where: jobWhere,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, code: true, title: true, status: true, suspendedAt: true, createdAt: true, _count: { select: { applications: true } } },
      }),
      this.prisma.report.findMany({ where: reportWhere, orderBy: { createdAt: 'desc' }, take: 20, select: { number: true, reason: true, status: true, decision: true, createdAt: true } }),
      this.prisma.auditLog.findMany({
        where: { targetType: company ? 'employer' : 'recruiter', targetId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, action: true, targetType: true, targetId: true, before: true, after: true, ip: true, createdAt: true, actor: { select: { id: true, name: true } } },
      }),
    ]);

    const contact =
      'website' in info
        ? { phone: info.phone, email: info.email, website: info.website, address: info.address }
        : // Liên hệ của NTD cá nhân là dữ liệu cá nhân → che (RULE-BE.md mục 7)
          { phone: maskPhone(info.phone), email: null, website: null, address: info.city };
    const suspendedAt = 'suspendedAt' in info ? info.suspendedAt : (info.user?.lockedAt ?? null);
    const suspendReason = 'suspendReason' in info ? info.suspendReason : (info.user?.lockReason ?? null);

    return {
      ...item,
      createdAt: info.createdAt.toISOString(),
      suspendedAt: suspendedAt?.toISOString() ?? null,
      suspendReason,
      contact,
      members: members.map((m) => ({ id: m.id, name: m.name, title: m.title, locked: !!m.user?.lockedAt, leftAt: m.leftAt?.toISOString() ?? null })),
      partners: partners.map((p) => ({ id: p.id, name: company ? p.recruiter.name : p.employer.name, expiresAt: p.expiresAt?.toISOString() ?? null })),
      jobs: jobs.map((j) => ({ id: j.id, code: j.code, title: j.title, status: j.status, applicants: j._count.applications, suspended: !!j.suspendedAt, createdAt: j.createdAt.toISOString() })),
      violations: violations.map((v) => ({ code: reportCode(v.number), reason: REPORT_REASON_LABEL[v.reason as ReportReason] ?? v.reason, status: v.status, decision: v.decision, createdAt: v.createdAt.toISOString() })),
      history: history.map(
        (h): AuditLogItem => ({ id: h.id, actor: h.actor, action: h.action, targetType: h.targetType, targetId: h.targetId, before: h.before, after: h.after, ip: h.ip, createdAt: h.createdAt.toISOString() }),
      ),
    };
  }

  async warn(adminId: string, kind: string, id: string, reason: string, req: Request): Promise<AdminEmployerDetail> {
    await this.sanctions.warn(adminId, await this.target(kind, id), reason, req);
    return this.detail(kind, id);
  }

  async suspend(adminId: string, kind: string, id: string, reason: string, otp: string | undefined, req: Request): Promise<AdminEmployerDetail> {
    const target = await this.target(kind, id);
    // Khoá mọi thành viên + ẩn mọi tin = khoá hàng loạt → xác nhận lại bằng 2FA
    await this.stepUp.assert(adminId, otp);
    await this.sanctions.suspend(adminId, target, reason, req);
    return this.detail(kind, id);
  }

  async unsuspend(adminId: string, kind: string, id: string, req: Request): Promise<AdminEmployerDetail> {
    await this.sanctions.unsuspend(adminId, await this.target(kind, id), req);
    return this.detail(kind, id);
  }
}
