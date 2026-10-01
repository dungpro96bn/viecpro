import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AppConfig } from '@viecpro/shared';
import { ENV, type Env } from '../../config/env.js';
import { Public } from '../../core/auth/auth.decorators.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

@ApiTags('Hệ thống')
@Public()
@Controller()
export class SystemController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Kiểm tra API + database (dùng cho load balancer / monitoring)' })
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', time: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException('Database không phản hồi');
    }
  }

  @Get('app/config')
  @ApiOperation({ summary: 'Cấu hình cho app mobile: phiên bản tối thiểu (ép cập nhật), link store, hotline' })
  appConfig(): AppConfig {
    const e = this.env;
    return {
      minVersion: { ios: e.APP_MIN_VERSION_IOS, android: e.APP_MIN_VERSION_ANDROID },
      latestVersion: { ios: e.APP_LATEST_VERSION_IOS, android: e.APP_LATEST_VERSION_ANDROID },
      storeUrl: { ios: e.APP_STORE_URL_IOS, android: e.APP_STORE_URL_ANDROID },
      hotline: '1900 66 88',
      maintenance: false,
    };
  }
}
