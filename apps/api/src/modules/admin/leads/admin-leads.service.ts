import { Injectable } from '@nestjs/common';
import type { AdminLeadItem, AdminLeadList, AdminLeadListQuery } from '@viecpro/shared';
import type { Request } from 'express';
import type { Prisma } from '../../../generated/prisma/client.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { pageArgs, paginated } from '../../../core/http/pagination.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { AdminContext } from '../admin-access.js';

const leadSelect = {
  id: true,
  name: true,
  phone: true,
  handledAt: true,
  createdAt: true,
  job: { select: { title: true, slug: true } },
  employer: { select: { name: true, shortName: true } },
  recruiter: { select: { name: true } },
} satisfies Prisma.LeadSelect;

type LeadRow = Prisma.LeadGetPayload<{ select: typeof leadSelect }>;

function maskPhone(phone: string): string {
  const local = phone.replace(/^\+84/, '0');
  return local.length >= 7 ? `${local.slice(0, 4)} xxx ${local.slice(-3)}` : '••••••';
}

@Injectable()
export class AdminLeadsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private search(q?: string, searchPhone = false): Prisma.LeadWhereInput {
    if (!q) return {};
    const contains = { contains: q, mode: 'insensitive' as const };
    return {
      OR: [
        { name: contains },
        ...(searchPhone ? [{ phone: { contains: q } }] : []),
        { job: { is: { title: contains } } },
        { employer: { is: { name: contains } } },
        { employer: { is: { shortName: contains } } },
        { recruiter: { is: { name: contains } } },
      ],
    };
  }

  async list(admin: AdminContext, query: AdminLeadListQuery, req: Request): Promise<AdminLeadList> {
    const canSeePii = admin.permissions.includes('users.pii');
    const baseWhere = this.search(query.q, canSeePii);
    const where: Prisma.LeadWhereInput = {
      ...baseWhere,
      handledAt: query.tab === 'handled' ? { not: null } : null,
    };
    const [rows, total, unhandled, handled] = await this.prisma.$transaction([
      this.prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, select: leadSelect, ...pageArgs(query) }),
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({ where: { ...baseWhere, handledAt: null } }),
      this.prisma.lead.count({ where: { ...baseWhere, handledAt: { not: null } } }),
    ]);
    if (canSeePii && rows.length) {
      await this.audit.log({ actorId: admin.id, action: 'lead.pii_view', targetType: 'lead_list', after: { count: rows.length, page: query.page } }, req);
    }
    const items: AdminLeadItem[] = rows.map((lead: LeadRow) => ({
      id: lead.id,
      name: lead.name,
      phone: canSeePii ? lead.phone : maskPhone(lead.phone),
      handledAt: lead.handledAt?.toISOString() ?? null,
      createdAt: lead.createdAt.toISOString(),
      job: lead.job,
      employer: lead.employer ? { name: lead.employer.shortName ?? lead.employer.name } : null,
      recruiter: lead.recruiter,
    }));
    return { ...paginated(items, total, query), tabs: { unhandled, handled } };
  }

  async handle(adminId: string, id: string, req: Request): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id }, select: { id: true, handledAt: true } });
      if (!lead) throw ApiException.notFound('Không tìm thấy khách cần tư vấn');
      if (lead.handledAt) return;
      const handledAt = new Date();
      const changed = await tx.lead.updateMany({ where: { id, handledAt: null }, data: { handledAt } });
      if (!changed.count) return;
      await this.audit.log({ actorId: adminId, action: 'lead.handle', targetType: 'lead', targetId: id, before: { handledAt: null }, after: { handledAt } }, req, tx);
    });
  }
}
