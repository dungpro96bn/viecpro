import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module.js';
import { ENV, type Env } from './config/env.js';
import { AssetsModule } from './core/assets/assets.module.js';
import { MailModule } from './core/mail/mail.module.js';
import { AuditModule } from './core/audit/audit.service.js';
import { AuthGuard } from './core/auth/auth.guard.js';
import { AllExceptionsFilter } from './core/http/all-exceptions.filter.js';
import { MaintenanceGuard } from './core/http/maintenance.guard.js';
import { PrismaModule } from './core/prisma/prisma.module.js';
import { RedisThrottlerStorage } from './core/http/redis-throttler.storage.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { ApplicationsModule } from './modules/applications/applications.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { EmployerPortalModule } from './modules/employer-portal/employer-portal.module.js';
import { JobAlertsModule } from './modules/job-alerts/job-alerts.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { LeadsModule } from './modules/leads/leads.module.js';
import { MeModule } from './modules/me/me.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SavedJobsModule } from './modules/saved-jobs/saved-jobs.module.js';
import { SystemController } from './modules/system/system.controller.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';

@Module({
  imports: [
    // Hạ tầng dùng chung
    ConfigModule,
    PrismaModule,
    AssetsModule,
    MailModule,
    AuditModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ENV],
      useFactory: (env: Env) => ({ secret: env.JWT_SECRET, signOptions: { expiresIn: env.JWT_ACCESS_TTL } }),
    }),
    // Mặc định 120 request / phút / IP; route nhạy cảm đặt @Throttle riêng
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        ...(env.REDIS_URL && { storage: new RedisThrottlerStorage(env.REDIS_URL) }),
      }),
    }),
    NotificationsModule,

    // Tính năng
    AuthModule,
    MeModule,
    JobsModule,
    SavedJobsModule,
    JobAlertsModule,
    ApplicationsModule,
    ProfilesModule,
    EmployerPortalModule,
    LeadsModule,
    ReportsModule,
    UploadsModule,

    // Quản trị
    AdminModule,
  ],
  controllers: [SystemController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: MaintenanceGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
