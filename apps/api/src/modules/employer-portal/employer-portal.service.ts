import { Injectable } from '@nestjs/common';
import type { EmployerLeadList, EmployerLeadListQuery } from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { ApiException } from '../../core/http/api-exception.js';
import { pageArgs, paginated } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { type EmployerActor, EmployerContext } from './employer-context.service.js';

@Injectable()
export class EmployerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
  ) {}

  /**
   * Khách cần tư vấn thuộc NTD. Doanh nghiệp: khách gửi tới trang công ty, tới bất kỳ thành viên nào (kể cả đã rời đi)
   * hoặc tới tin của doanh nghiệp. Tin của NTD cá nhân đăng qua doanh nghiệp phái cử thuộc NTD đó (ownerScope), không thuộc doanh nghiệp.
   */
  leadScope(actor: EmployerActor): Prisma.LeadWhereInput {
    return actor.employerId
      ? { OR: [{ employerId: actor.employerId }, { recruiter: { employerId: actor.employerId } }, { job: this.ctx.ownerScope(actor) }] }
      : { OR: [{ recruiterId: actor.recruiterId }, { job: this.ctx.ownerScope(actor) }] };
  }

  async listLeads(userId: string, query: EmployerLeadListQuery): Promise<EmployerLeadList> {
    const actor = await this.ctx.resolve(userId);
    const scope = this.leadScope(actor);
    const where: Prisma.LeadWhereInput = query.tab ? { AND: [scope, { handledAt: query.tab === 'handled' ? { not: null } : null }] } : scope;
    const [rows, total, unhandled, handled] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { job: { select: { title: true, slug: true } }, recruiter: { select: { name: true } } },
        ...pageArgs(query),
      }),
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({ where: { AND: [scope, { handledAt: null }] } }),
      this.prisma.lead.count({ where: { AND: [scope, { handledAt: { not: null } }] } }),
    ]);
    const items = rows.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      handledAt: l.handledAt?.toISOString() ?? null,
      createdAt: l.createdAt.toISOString(),
      job: l.job,
      recruiter: l.recruiter,
    }));
    return { ...paginated(items, total, query), tabs: { unhandled, handled } };
  }

  /** Đánh dấu đã liên hệ – điều kiện phạm vi nằm trong câu cập nhật; bấm lại khi đã xử lý thì bỏ qua */
  async handleLead(userId: string, id: string): Promise<void> {
    const actor = await this.ctx.resolve(userId);
    const scope = this.leadScope(actor);
    const { count } = await this.prisma.lead.updateMany({ where: { AND: [scope, { id, handledAt: null }] }, data: { handledAt: new Date() } });
    if (count) return;
    const exists = await this.prisma.lead.count({ where: { AND: [scope, { id }] } });
    if (!exists) throw ApiException.notFound('Không tìm thấy khách cần tư vấn');
  }

  countUnhandled(actor: EmployerActor): Promise<number> {
    return this.prisma.lead.count({ where: { AND: [this.leadScope(actor), { handledAt: null }] } });
  }
}
