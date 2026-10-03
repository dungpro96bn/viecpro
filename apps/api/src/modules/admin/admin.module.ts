import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminGuard } from './admin-access.js';
import { AdminAccountsController } from './admins/admin-accounts.controller.js';
import { AdminAccountsService } from './admins/admin-accounts.service.js';
import { AdminRolesController } from './admins/admin-roles.controller.js';
import { AdminRolesService } from './admins/admin-roles.service.js';
import { AuditLogsController } from './audit/audit-logs.controller.js';
import { AdminAuthController, AdminMeController } from './auth/admin-auth.controller.js';
import { AdminAuthService } from './auth/admin-auth.service.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { DashboardService } from './dashboard/dashboard.service.js';
import { AdminEmployersController } from './employers/admin-employers.controller.js';
import { AdminEmployersService } from './employers/admin-employers.service.js';
import { ModerationController } from './moderation/moderation.controller.js';
import { ModerationService } from './moderation/moderation.service.js';
import { AdminReportsController } from './reports/admin-reports.controller.js';
import { AdminReportsService } from './reports/admin-reports.service.js';
import { SanctionsService } from './sanctions/sanctions.service.js';
import { StepUpService } from './sanctions/step-up.service.js';
import { AdminUsersController } from './users/admin-users.controller.js';
import { AdminUsersService } from './users/admin-users.service.js';
import { AdminLeadsController } from './leads/admin-leads.controller.js';
import { AdminLeadsService } from './leads/admin-leads.service.js';
import { AdminToolsController, AdminExportDownloadController } from './admin-tools.controller.js';
import { AdminToolsService } from './admin-tools.service.js';
import { SiteController } from './site.controller.js';
import { VerificationsController } from './verifications/verifications.controller.js';
import { VerificationsService } from './verifications/verifications.service.js';

/** Toàn bộ API quản trị – tách khỏi module người dùng (RULE-BE.md mục 7) */
@Module({
  imports: [AuthModule],
  controllers: [
    AdminAuthController,
    AdminMeController,
    DashboardController,
    ModerationController,
    VerificationsController,
    AdminUsersController,
    AdminLeadsController,
    AdminToolsController,
    AdminExportDownloadController,
    SiteController,
    AdminEmployersController,
    AdminReportsController,
    AuditLogsController,
    AdminAccountsController,
    AdminRolesController,
  ],
  providers: [
    AdminGuard,
    AdminAuthService,
    DashboardService,
    ModerationService,
    VerificationsService,
    AdminUsersService,
    AdminLeadsService,
    AdminToolsService,
    AdminEmployersService,
    AdminReportsService,
    SanctionsService,
    StepUpService,
    AdminAccountsService,
    AdminRolesService,
  ],
})
export class AdminModule {}
