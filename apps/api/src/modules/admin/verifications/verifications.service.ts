import { HttpStatus, Injectable } from '@nestjs/common';
import type { VerificationDecisionInput, VerificationItem } from '@viecpro/shared';
import type { Request } from 'express';
import { AuditService } from '../../../core/audit/audit.service.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';

type DocumentRow = { key: string; label: string; ok: boolean };

@Injectable()
export class VerificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async queue(limit: number): Promise<{ total: number; items: VerificationItem[] }> {
    const where = { status: { in: ['pending' as const, 'needs_info' as const] } };
    const [total, rows] = await Promise.all([
      this.prisma.verificationRequest.count({ where }),
      this.prisma.verificationRequest.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: limit,
        include: { employer: { select: { name: true, shortName: true } }, recruiter: { select: { name: true } } },
      }),
    ]);
    const items = rows.map((r) => {
      const docs = (Array.isArray(r.documents) ? r.documents : []) as DocumentRow[];
      const company = r.kind === 'company';
      return {
        id: r.id,
        kind: company ? ('company' as const) : ('individual' as const),
        name: company ? (r.employer?.shortName ?? r.employer?.name ?? '—') : `${r.recruiter?.name ?? '—'} (cá nhân)`,
        // Giấy tờ chỉ hiện dạng đã che (RULE-BE.md mục 8)
        subtitle: [r.idMasked && `${company ? 'MST' : 'CCCD'} ${r.idMasked}`, r.location].filter(Boolean).join(' · '),
        documents: docs.map((d) => ({ label: d.label, ok: !!d.ok })),
        status: r.status as 'pending' | 'needs_info',
      };
    });
    return { total, items };
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
}
