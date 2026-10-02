import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ageOf,
  maskEmail,
  maskVnPhone,
  REPORT_REASON_LABEL,
  type AdminSeekerDetail,
  type AdminSeekerItem,
  type AdminSeekerList,
  type AdminSeekerListQuery,
  type AdminSeekerStatus,
  type Gender,
  type LockAccountInput,
  type Program,
  type ReportReason,
  type RevealedContact,
} from '@viecpro/shared';
import type { Request } from 'express';
import { AuditService } from '../../../core/audit/audit.service.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { pageArgs, paginated } from '../../../core/http/pagination.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { COMPLETION_WEIGHTS, profileCompletion } from '../../me/profile-completion.js';
import { reportCode } from '../../reports/report-rules.js';

const DAY = 86400_000;
const ACTIVE_STAGES = ['interview', 'passed', 'departed'] as const;

const W = COMPLETION_WEIGHTS;
/** % hoàn thiện tính trong SQL – cùng trọng số với profile-completion.ts */
const COMPLETION_SQL = Prisma.sql`(
  (CASE WHEN u.name <> '' THEN ${W.name} ELSE 0 END) +
  (CASE WHEN u."phoneVerifiedAt" IS NOT NULL THEN ${W.phoneVerified} ELSE 0 END) +
  (CASE WHEN u.email IS NOT NULL THEN ${W.email} ELSE 0 END) +
  (CASE WHEN u."avatarUrl" IS NOT NULL THEN ${W.avatar} ELSE 0 END) +
  (CASE WHEN p."birthYear" IS NOT NULL THEN ${W.birthYear} ELSE 0 END) +
  (CASE WHEN p.gender IS NOT NULL THEN ${W.gender} ELSE 0 END) +
  (CASE WHEN COALESCE(p.hometown, '') <> '' THEN ${W.hometown} ELSE 0 END) +
  (CASE WHEN COALESCE(cardinality(p.programs), 0) > 0 THEN ${W.programs} ELSE 0 END) +
  (CASE WHEN COALESCE(cardinality(p.industries), 0) > 0 THEN ${W.industries} ELSE 0 END) +
  (CASE WHEN COALESCE(cardinality(p.prefs), 0) > 0 THEN ${W.prefs} ELSE 0 END) +
  (CASE WHEN COALESCE(p.about, '') <> '' THEN ${W.about} ELSE 0 END) +
  (CASE WHEN p.jlpt IS NOT NULL THEN ${W.jlpt} ELSE 0 END) +
  (CASE WHEN p."videoUrl" IS NOT NULL THEN ${W.video} ELSE 0 END)
)`;

const seekerSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  avatarUrl: true,
  phoneVerifiedAt: true,
  lockedAt: true,
  lockReason: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  seekerProfile: { select: { birthYear: true, gender: true, hometown: true, address: true, programs: true, industries: true, prefs: true, jlpt: true, about: true, videoUrl: true, lookingForJob: true } },
  _count: { select: { applications: true, reportedAs: true } },
} satisfies Prisma.UserSelect;
type SeekerRow = Prisma.UserGetPayload<{ select: typeof seekerSelect }>;

/** Mã hiển thị ổn định từ id (chưa có cột số thứ tự cho tài khoản) */
export const seekerCode = (id: string) => `UV-${id.slice(-6).toUpperCase()}`;

/** Danh sách ứng viên trang quản trị (design 09 – A-04). Liên hệ luôn che, xem đầy đủ cần users.pii + ghi nhật ký */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private tabWhere(tab: AdminSeekerListQuery['tab']): Prisma.UserWhereInput {
    switch (tab) {
      case 'locked':
        return { lockedAt: { not: null } };
      case 'passed':
        return { lockedAt: null, applications: { some: { status: { in: ['passed', 'departed'] } } } };
      case 'interviewing':
        return { lockedAt: null, applications: { some: { status: 'interview' }, none: { status: { in: ['passed', 'departed'] } } } };
      case 'seeking':
        return { lockedAt: null, seekerProfile: { is: { lookingForJob: true } }, applications: { none: { status: { in: [...ACTIVE_STAGES] } } } };
      default:
        return {};
    }
  }

  private async completeIds(min: number): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT u.id FROM "User" u LEFT JOIN "SeekerProfile" p ON p."userId" = u.id
      WHERE u.role = 'seeker' AND u."deletedAt" IS NULL AND ${COMPLETION_SQL} >= ${min}`;
    return rows.map((r) => r.id);
  }

  private async where(q: AdminSeekerListQuery): Promise<Prisma.UserWhereInput> {
    const and: Prisma.UserWhereInput[] = [{ role: 'seeker', deletedAt: null }, this.tabWhere(q.tab)];
    if (q.q) {
      const digits = q.q.replace(/\D/g, '').replace(/^(84|0)/, '');
      and.push({
        OR: [
          { name: { contains: q.q, mode: 'insensitive' } },
          { email: { contains: q.q.toLowerCase() } },
          ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
          ...(/^uv-/i.test(q.q) ? [{ id: { endsWith: q.q.slice(3).toLowerCase() } }] : []),
        ],
      });
    }
    if (q.industry) and.push({ seekerProfile: { is: { industries: { has: q.industry } } } });
    if (q.program) and.push({ seekerProfile: { is: { programs: { has: q.program } } } });
    if (q.jlptN3) and.push({ seekerProfile: { is: { jlpt: { in: ['N3', 'N2', 'N1'] } } } });
    if (q.new7d) and.push({ createdAt: { gte: new Date(Date.now() - 7 * DAY) } });
    if (q.reported) and.push({ reportedAs: { some: {} } });
    if (q.complete80) and.push({ id: { in: await this.completeIds(80) } });
    return { AND: and };
  }

  private toItem(u: SeekerRow, statuses: Set<string>, openReports: number): AdminSeekerItem {
    const p = u.seekerProfile;
    const { completion } = profileCompletion({
      name: !!u.name,
      phoneVerified: !!u.phoneVerifiedAt,
      email: !!u.email,
      avatar: !!u.avatarUrl,
      birthYear: !!p?.birthYear,
      gender: !!p?.gender,
      hometown: !!p?.hometown,
      programs: !!p?.programs.length,
      industries: !!p?.industries.length,
      prefs: !!p?.prefs.length,
      about: !!p?.about,
      jlpt: !!p?.jlpt,
      video: !!p?.videoUrl,
    });
    const status: AdminSeekerStatus = u.lockedAt
      ? 'locked'
      : statuses.has('departed')
        ? 'departed'
        : statuses.has('passed')
          ? 'passed'
          : statuses.has('interview')
            ? 'interviewing'
            : p?.lookingForJob
              ? 'seeking'
              : 'idle';
    return {
      id: u.id,
      code: seekerCode(u.id),
      name: u.name,
      gender: (p?.gender ?? null) as Gender | null,
      age: p?.birthYear ? ageOf(p.birthYear) : null,
      hometown: p?.hometown ?? null,
      industry: p?.industries[0] ?? null,
      program: (p?.programs[0] ?? null) as Program | null,
      jlpt: p?.jlpt ?? null,
      completion,
      applicationCount: u._count.applications,
      reportCount: openReports,
      isNew: Date.now() - u.createdAt.getTime() < 7 * DAY,
      lastActiveAt: (u.lastLoginAt ?? u.updatedAt).toISOString(),
      status,
      phoneMasked: u.phone ? maskVnPhone(u.phone) : null,
      emailMasked: u.email ? maskEmail(u.email) : null,
    };
  }

  private async decorate(rows: SeekerRow[]): Promise<AdminSeekerItem[]> {
    const ids = rows.map((r) => r.id);
    const [apps, reports] = await Promise.all([
      this.prisma.application.groupBy({ by: ['userId', 'status'], where: { userId: { in: ids } } }),
      this.prisma.report.groupBy({ by: ['targetUserId'], where: { targetUserId: { in: ids }, status: { in: ['open', 'investigating'] } }, _count: { _all: true } }),
    ]);
    const statuses = new Map<string, Set<string>>();
    for (const a of apps) if (a.userId) statuses.set(a.userId, (statuses.get(a.userId) ?? new Set()).add(a.status));
    const openReports = new Map(reports.map((r) => [r.targetUserId, r._count._all]));
    return rows.map((r) => this.toItem(r, statuses.get(r.id) ?? new Set(), openReports.get(r.id) ?? 0));
  }

  async list(q: AdminSeekerListQuery): Promise<AdminSeekerList> {
    const where = await this.where(q);
    const orderBy: Prisma.UserOrderByWithRelationInput[] = q.sort === 'newest' ? [{ createdAt: 'desc' }] : [{ lastLoginAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }];
    const base = { role: 'seeker' as const, deletedAt: null };
    const weekAgo = new Date(Date.now() - 7 * DAY);
    const [rows, total, all, newThisWeek, seeking, interviewing, passed, locked, reported, reportedOpen, complete] = await Promise.all([
      this.prisma.user.findMany({ where, select: seekerSelect, orderBy, ...pageArgs(q) }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: base }),
      this.prisma.user.count({ where: { ...base, createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { ...base, ...this.tabWhere('seeking') } }),
      this.prisma.user.count({ where: { ...base, ...this.tabWhere('interviewing') } }),
      this.prisma.user.count({ where: { ...base, ...this.tabWhere('passed') } }),
      this.prisma.user.count({ where: { ...base, ...this.tabWhere('locked') } }),
      this.prisma.user.count({ where: { ...base, reportedAs: { some: {} } } }),
      this.prisma.user.count({ where: { ...base, reportedAs: { some: { status: { in: ['open', 'investigating'] } } } } }),
      this.prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*) AS n FROM "User" u LEFT JOIN "SeekerProfile" p ON p."userId" = u.id
        WHERE u.role = 'seeker' AND u."deletedAt" IS NULL AND ${COMPLETION_SQL} >= 80`,
    ]);
    return {
      ...paginated(await this.decorate(rows), total, q),
      stats: {
        total: all,
        newThisWeek,
        seeking,
        completeRate: all ? Math.round((Number(complete[0]?.n ?? 0) / all) * 100) : 0,
        reported,
        reportedOpen,
      },
      tabs: { all, seeking, interviewing, passed, locked },
    };
  }

  private async seeker(id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, role: 'seeker', deletedAt: null }, select: seekerSelect });
    if (!u) throw ApiException.notFound('Không tìm thấy ứng viên');
    return u;
  }

  async detail(id: string): Promise<AdminSeekerDetail> {
    const u = await this.seeker(id);
    const [[item], applications, reports] = await Promise.all([
      this.decorate([u]),
      this.prisma.application.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, status: true, createdAt: true, job: { select: { title: true, employer: { select: { name: true } } } } },
      }),
      this.prisma.report.findMany({ where: { targetUserId: id }, orderBy: { createdAt: 'desc' }, take: 20, select: { number: true, reason: true, status: true, createdAt: true } }),
    ]);
    const p = u.seekerProfile;
    return {
      ...item!,
      createdAt: u.createdAt.toISOString(),
      lockedAt: u.lockedAt?.toISOString() ?? null,
      lockReason: u.lockReason,
      address: p?.address ?? null,
      prefs: p?.prefs ?? [],
      programs: (p?.programs ?? []) as Program[],
      industries: p?.industries ?? [],
      applications: applications.map((a) => ({ id: a.id, jobTitle: a.job.title, employerName: a.job.employer?.name ?? null, status: a.status, createdAt: a.createdAt.toISOString() })),
      reports: reports.map((r) => ({ code: reportCode(r.number), reason: REPORT_REASON_LABEL[r.reason as ReportReason] ?? r.reason, status: r.status, createdAt: r.createdAt.toISOString() })),
    };
  }

  /** Bấm "Hiện" số điện thoại / email – luôn ghi nhật ký (RULE-BE.md mục 7) */
  async reveal(adminId: string, id: string, req: Request): Promise<RevealedContact> {
    const u = await this.seeker(id);
    await this.audit.log({ actorId: adminId, action: 'user.pii_view', targetType: 'user', targetId: id }, req);
    return { phone: u.phone, email: u.email };
  }

  async lock(adminId: string, id: string, input: LockAccountInput, req: Request): Promise<AdminSeekerDetail> {
    const u = await this.seeker(id);
    if (u.lockedAt) throw new ApiException('CONFLICT', 'Tài khoản đã bị khoá', HttpStatus.CONFLICT);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { lockedAt: now, lockReason: input.reason } });
      // Khoá → đăng xuất mọi thiết bị, refresh thất bại ngay (RULE-BE.md mục 5.4)
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
      await this.audit.log({ actorId: adminId, action: 'user.lock', targetType: 'user', targetId: id, before: { lockedAt: null }, after: { lockedAt: now, reason: input.reason } }, req, tx);
    });
    return this.detail(id);
  }

  async unlock(adminId: string, id: string, req: Request): Promise<AdminSeekerDetail> {
    const u = await this.seeker(id);
    if (!u.lockedAt) throw new ApiException('CONFLICT', 'Tài khoản không bị khoá', HttpStatus.CONFLICT);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { lockedAt: null, lockReason: null, failedLogins: 0, loginLockedUntil: null } });
      await this.audit.log({ actorId: adminId, action: 'user.unlock', targetType: 'user', targetId: id, before: { lockedAt: u.lockedAt, reason: u.lockReason }, after: { lockedAt: null } }, req, tx);
    });
    return this.detail(id);
  }
}
