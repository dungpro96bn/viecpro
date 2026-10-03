import type { ExecutionContext } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { MaintenanceGuard, routePath } from './maintenance.guard.js';

const ctx = (url: string) => ({ switchToHttp: () => ({ getRequest: () => ({ originalUrl: url }) }) }) as unknown as ExecutionContext;

describe('MaintenanceGuard', () => {
  const prisma = {
    systemSetting: { findUnique: vi.fn(async () => ({ value: { supportPhone: '19006688', supportEmail: 'hotro@viecpro.vn', maintenanceMode: true, maintenanceMessage: 'Đang bảo trì' } })) },
  } as unknown as PrismaService;

  it('bỏ tiền tố /api/v1 khi so khớp đường dẫn', () => {
    expect(routePath('/api/v1/site/system?x=1')).toBe('/site/system');
    expect(routePath('/api/v1')).toBe('/');
    expect(routePath('/api/v12/admin/users')).toBe('/admin/users');
  });

  it('vẫn cho trạng thái công khai, khu admin và đăng nhập admin chạy khi bảo trì', async () => {
    const guard = new MaintenanceGuard(prisma);
    for (const url of ['/api/v1/site/system', '/api/v1/site/homepage', '/api/v1/admin/tools/system', '/api/v1/auth/admin/refresh', '/api/v1/health', '/api/v1/app/config']) {
      await expect(guard.canActivate(ctx(url))).resolves.toBe(true);
    }
  });

  it('chặn route người dùng bằng 503 MAINTENANCE', async () => {
    const guard = new MaintenanceGuard(prisma);
    await expect(guard.canActivate(ctx('/api/v1/jobs'))).rejects.toMatchObject({ status: 503, response: { code: 'MAINTENANCE', message: 'Đang bảo trì' } });
    // Không lách được bằng đường dẫn chứa "/admin/" ở giữa
    await expect(guard.canActivate(ctx('/api/v1/employers/admin/x'))).rejects.toMatchObject({ status: 503 });
  });
});
