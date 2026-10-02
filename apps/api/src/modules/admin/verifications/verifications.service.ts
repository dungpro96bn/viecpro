import { HttpStatus, Injectable } from '@nestjs/common';
import type { VerificationDecisionInput, VerificationItem, VerificationList, VerificationListItem, VerificationListQuery, VerificationRejectInput, VerificationStatus } from '@viecpro/shared';
import type { Request } from 'express';
import { AuditService } from '../../../core/audit/audit.service.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { paginated } from '../../../core/http/pagination.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { autoCheck, parseDocuments, SUSPICIOUS_SCORE } from './verification-check.js';

const DAY = 86400_000;
const rowInclude = { employer: { select: { name: true, shortName: true } }, recruiter: { select: { name: true } } } satisfies Prisma.VerificationRequestInclude;
type Row = Prisma.VerificationRequestGetPayload<{ include: typeof rowInclude }>;

@Injectable()
export class VerificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private subtitle(r: Row) {
    const company = r.kind === 'company';
    // Giấy tờ chỉ hiện dạng đã che (RULE-BE.md mục 8); NTD cá nhân xác minh bằng SĐT, không dùng CCCD (spec R4)
    return [r.idMasked && `${company ? 'MST' : 'SĐT'} ${r.idMasked}`, r.location].filter(Boolean).join(' · ');
  }

  private name(r: Row) {
    return r.kind === 'company' ? (r.employer?.shortName ?? r.employer?.name ?? '—') : (r.recruiter?.name ?? '—');
  }

  /** Bản rút gọn cho bảng điều khiển */
  async queue(limit: number): Promise<{ total: number; items: VerificationItem[] }> {
    const where = { status: { in: ['pending' as const, 'needs_info' as const] } };
    const [total, rows] = await Promise.all([
      this.prisma.verificationRequest.count({ where }),
      this.prisma.verificationRequest.findMany({ where, orderBy: { createdAt: 'asc' }, take: limit, include: rowInclude }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      kind: r.kind === 'company' ? ('company' as const) : ('individual' as const),
      name: r.kind === 'company' ? this.name(r) : `${this.name(r)} (cá nhân)`,
      subtitle: this.subtitle(r),
      documents: parseDocuments(r.documents).map((d) => ({ label: d.label, ok: d.ok })),
      status: r.status as 'pending' | 'needs_info',
    }));
    return { total, items };
  }

  private toListItem(r: Row): VerificationListItem {
    const docs = parseDocuments(r.documents);
    const check = autoCheck(docs, { hasId: !!r.idMasked });
    const company = r.kind === 'company';
    return {
      id: r.id,
      kind: company ? 'company' : 'individual',
      name: this.name(r),
      kindLabel: company ? 'Công ty XKLĐ' : 'NTD cá nhân',
      subtitle: this.subtitle(r),
      documents: docs,
      validDocs: check.valid,
      totalDocs: docs.length,
      autoScore: check.score,
      autoSummary: check.summary,
      status: r.status,
      note: r.note,
      submittedAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
    };
  }

  /** Trang xác minh (design 08): tab trạng thái, lọc loại / thiếu giấy tờ, tìm theo tên, thống kê */
  async list(q: VerificationListQuery): Promise<VerificationList> {
    const where: Prisma.VerificationRequestWhereInput = {
      status: q.tab,
      ...(q.kind && { kind: q.kind }),
      ...(q.q && {
        OR: [
          { employer: { is: { name: { contains: q.q, mode: 'insensitive' } } } },
          { employer: { is: { shortName: { contains: q.q, mode: 'insensitive' } } } },
          { employer: { is: { taxCode: { contains: q.q } } } },
          { recruiter: { is: { name: { contains: q.q, mode: 'insensitive' } } } },
          { recruiter: { is: { phone: { contains: q.q.replace(/\D/g, '').replace(/^0/, '') || q.q } } } },
        ],
      }),
    };
    const now = Date.now();
    const [rows, byStatus, pendingRows, approvedMonth] = await Promise.all([
      this.prisma.verificationRequest.findMany({ where, orderBy: { createdAt: q.tab === 'pending' || q.tab === 'needs_info' ? 'asc' : 'desc' }, include: rowInclude }),
      this.prisma.verificationRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.verificationRequest.findMany({ where: { status: 'pending' }, select: { documents: true, idMasked: true } }),
      this.prisma.verificationRequest.findMany({ where: { status: 'approved', reviewedAt: { gte: new Date(now - 30 * DAY) } }, select: { createdAt: true, reviewedAt: true } }),
    ]);
    let items = rows.map((r) => this.toListItem(r));
    if (q.missingDocs) items = items.filter((i) => i.validDocs < i.totalDocs || !i.totalDocs);
    const start = (q.page - 1) * q.limit;

    const tabs = { pending: 0, needs_info: 0, approved: 0, rejected: 0 } as Record<VerificationStatus, number>;
    for (const g of byStatus) tabs[g.status] = g._count._all;
    const checks = pendingRows.map((r) => {
      const docs = parseDocuments(r.documents);
      return { missing: docs.some((d) => !d.ok) || !docs.length, score: autoCheck(docs, { hasId: !!r.idMasked }).score };
    });
    const reviewMs = approvedMonth.map((r) => r.reviewedAt!.getTime() - r.createdAt.getTime());
    return {
      ...paginated(items.slice(start, start + q.limit), items.length, q),
      stats: {
        pending: tabs.pending,
        missingDocs: checks.filter((c) => c.missing).length,
        suspicious: checks.filter((c) => c.score < SUSPICIOUS_SCORE).length,
        approvedThisMonth: approvedMonth.length,
        avgReviewMinutes: reviewMs.length ? Math.round(reviewMs.reduce((a, b) => a + b, 0) / reviewMs.length / 60_000) : null,
      },
      tabs,
    };
  }

  async detail(id: string): Promise<VerificationListItem> {
    const r = await this.prisma.verificationRequest.findUnique({ where: { id }, include: rowInclude });
    if (!r) throw ApiException.notFound('Không tìm thấy hồ sơ xác minh');
    return this.toListItem(r);
  }

  private async open(id: string) {
    const r = await this.prisma.verificationRequest.findUnique({
      where: { id },
      include: { employer: { select: { id: true, recruiters: { select: { userId: true } } } }, recruiter: { select: { userId: true } } },
    });
    if (!r) throw ApiException.notFound('Không tìm thấy hồ sơ xác minh');
    if (r.status === 'approved' || r.status === 'rejected') throw new ApiException('CONFLICT', 'Hồ sơ này đã được xử lý', HttpStatus.CONFLICT);
    return r;
  }

  private recipients(r: Awaited<ReturnType<VerificationsService['open']>>) {
    const ids = [r.recruiter?.userId, ...(r.employer?.recruiters.map((x) => x.userId) ?? [])];
    return [...new Set(ids.filter((id): id is string => !!id))];
  }

  async approve(adminId: string, id: string, input: VerificationDecisionInput, req: Request) {
    const r = await this.open(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.verificationRequest.update({ where: { id }, data: { status: 'approved', note: input.note, reviewedById: adminId, reviewedAt: new Date() } });
      if (r.employerId) await tx.employer.update({ where: { id: r.employerId }, data: { verified: true } });
      await this.audit.log({ actorId: adminId, action: 'verification.approve', targetType: 'verification', targetId: id, before: { status: r.status }, after: { status: 'approved' } }, req, tx);
    });
    for (const userId of this.recipients(r)) {
      await this.notifications.notify(userId, 'verification.approved', { title: 'Tài khoản nhà tuyển dụng đã được xác minh', body: 'Tin đăng mới sẽ hiển thị ngay, không cần chờ duyệt.' });
    }
  }

  async requestInfo(adminId: string, id: string, input: VerificationDecisionInput, req: Request) {
    const r = await this.open(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.verificationRequest.update({ where: { id }, data: { status: 'needs_info', note: input.note, reviewedById: adminId, reviewedAt: new Date() } });
      await this.audit.log({ actorId: adminId, action: 'verification.request_info', targetType: 'verification', targetId: id, before: { status: r.status }, after: { status: 'needs_info', note: input.note } }, req, tx);
    });
    for (const userId of this.recipients(r)) {
      await this.notifications.notify(userId, 'verification.needs_info', { title: 'Hồ sơ xác minh cần bổ sung giấy tờ', body: input.note ?? null });
    }
  }

  /** Từ chối hồ sơ: bắt buộc lý do, gửi cho NTD. Doanh nghiệp vẫn chưa xác minh → tin tiếp tục chờ duyệt */
  async reject(adminId: string, id: string, input: VerificationRejectInput, req: Request) {
    const r = await this.open(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.verificationRequest.update({ where: { id }, data: { status: 'rejected', note: input.note, reviewedById: adminId, reviewedAt: new Date() } });
      await this.audit.log({ actorId: adminId, action: 'verification.reject', targetType: 'verification', targetId: id, before: { status: r.status }, after: { status: 'rejected', note: input.note } }, req, tx);
    });
    for (const userId of this.recipients(r)) {
      await this.notifications.notify(userId, 'verification.rejected', { title: 'Hồ sơ xác minh chưa được chấp nhận', body: input.note });
    }
  }
}
