import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminGuard } from './admin-access.js';
import { AdminAuthController, AdminMeController } from './auth/admin-auth.controller.js';
import { AdminAuthService } from './auth/admin-auth.service.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { DashboardService } from './dashboard/dashboard.service.js';
import { ModerationController } from './moderation/moderation.controller.js';
import { ModerationService } from './moderation/moderation.service.js';
import { VerificationsController } from './verifications/verifications.controller.js';
import { VerificationsService } from './verifications/verifications.service.js';

/** Toàn bộ API quản trị – tách khỏi module người dùng (RULE-BE.md mục 7) */
@Module({
  imports: [AuthModule],
  controllers: [AdminAuthController, AdminMeController, DashboardController, ModerationController, VerificationsController],
  providers: [AdminGuard, AdminAuthService, DashboardService, ModerationService, VerificationsService],
})
export class AdminModule {}
