import { Injectable } from '@nestjs/common';
import type { EmployerPartnerItem } from '@viecpro/shared';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { EmployerContext } from './employer-context.service.js';
import { EmployerDashboardService } from './employer-dashboard.service.js';

/** Liên kết NTD cá nhân ↔ doanh nghiệp phái cử */
@Injectable()
export class EmployerPartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
    private readonly dashboard: EmployerDashboardService,
  ) {}

  async list(userId: string): Promise<EmployerPartnerItem[]> {
    return this.dashboard.partners(await this.ctx.resolve(userId));
  }

  async requestRenewal(userId: string, id: string) {
    const actor = await this.ctx.resolve(userId);
    // Điều kiện sở hữu nằm trong câu truy vấn (RULE-BE.md mục 6 lớp 2)
    const result = await this.prisma.recruiterPartner.updateMany({ where: { id, recruiterId: actor.recruiterId }, data: { renewRequestedAt: new Date() } });
    if (!result.count) throw ApiException.notFound('Không tìm thấy liên kết doanh nghiệp');
  }
}
