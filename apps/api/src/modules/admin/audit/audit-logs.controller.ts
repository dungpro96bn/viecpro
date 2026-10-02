import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { auditLogListSchema, type AuditLogItem, type AuditLogListQuery, type Paginated } from '@viecpro/shared';
import { pageArgs, paginated } from '../../../core/http/pagination.js';
import { ZodQuery } from '../../../core/http/zod.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { AdminController, RequirePermission } from '../admin-access.js';

/** Nhật ký hệ thống (A-12) – chỉ đọc. AuditLog không có API sửa / xoá (RULE-BE.md mục 7) */
@ApiTags('Admin – nhật ký hệ thống')
@AdminController()
@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermission('audit.read')
  @Get()
  @ApiOperation({ summary: 'Tra cứu nhật ký thao tác theo người, hành động, đối tượng, thời gian' })
  async list(@ZodQuery(auditLogListSchema) q: AuditLogListQuery): Promise<Paginated<AuditLogItem>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.actorId && { actorId: q.actorId }),
      ...(q.action && { action: { startsWith: q.action } }),
      ...(q.targetType && { targetType: q.targetType }),
      ...(q.targetId && { targetId: q.targetId }),
      ...((q.from || q.to) && { createdAt: { gte: q.from, lte: q.to } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
        select: { id: true, action: true, targetType: true, targetId: true, before: true, after: true, ip: true, createdAt: true, actor: { select: { id: true, name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })), total, q);
  }
}
