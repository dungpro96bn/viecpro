import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { systemSettingsSchema } from '@viecpro/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApiException } from './api-exception.js';

/** Route vẫn chạy khi bảo trì: khu quản trị (để tắt bảo trì) và trạng thái công khai (để web hiện thông báo). */
const MAINTENANCE_BYPASS = [/^\/admin(\/|$)/, /^\/auth\/admin(\/|$)/, /^\/site\//, /^\/health$/, /^\/app\/config$/];

/** Bỏ tiền tố toàn cục `/api/v1` để so khớp theo đường dẫn của controller */
export function routePath(url: string): string {
  return url.split('?')[0]!.replace(/^\/api\/v\d+(?=\/|$)/, '') || '/';
}

@Injectable()
export class MaintenanceGuard implements CanActivate {
  private cachedUntil = 0;
  private maintenance: { enabled: boolean; message: string } = { enabled: false, message: '' };

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ originalUrl?: string; url?: string }>();
    const path = routePath(req.originalUrl ?? req.url ?? '');
    if (MAINTENANCE_BYPASS.some((pattern) => pattern.test(path))) return true;

    if (Date.now() >= this.cachedUntil) {
      const row = await this.prisma.systemSetting.findUnique({ where: { key: 'system' }, select: { value: true } });
      const parsed = row ? systemSettingsSchema.safeParse(row.value) : null;
      this.maintenance = parsed?.success
        ? { enabled: parsed.data.maintenanceMode, message: parsed.data.maintenanceMessage }
        : { enabled: false, message: '' };
      this.cachedUntil = Date.now() + 5_000;
    }

    if (this.maintenance.enabled) throw new ApiException('MAINTENANCE', this.maintenance.message || 'Hệ thống đang bảo trì', HttpStatus.SERVICE_UNAVAILABLE);
    return true;
  }
}
