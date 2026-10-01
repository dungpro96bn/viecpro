import { Injectable } from '@nestjs/common';
import type { LeadItem, Paginated, PaginationQuery } from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { pageArgs, paginated } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { EmployerContext } from './employer-context.service.js';

/** Khách đăng ký tư vấn qua hồ sơ / tin của NTD */
@Injectable()
export class EmployerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
  ) {}

  async listLeads(userId: string, query: PaginationQuery): Promise<Paginated<LeadItem>> {
    const actor = await this.ctx.resolve(userId);
    const where: Prisma.LeadWhereInput = actor.employerId ? { OR: [{ employerId: actor.employerId }, { recruiterId: actor.recruiterId }] } : { recruiterId: actor.recruiterId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, include: { job: { select: { title: true, slug: true } } }, ...pageArgs(query) }),
      this.prisma.lead.count({ where }),
    ]);
    const items = rows.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      handledAt: l.handledAt?.toISOString() ?? null,
      createdAt: l.createdAt.toISOString(),
      job: l.job,
    }));
    return paginated(items, total, query);
  }
}
