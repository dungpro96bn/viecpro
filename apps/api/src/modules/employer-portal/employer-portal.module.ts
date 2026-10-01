import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module.js';
import { EmployerAccountController } from './employer-account.controller.js';
import { EmployerApplicantsController } from './employer-applicants.controller.js';
import { EmployerApplicantsService } from './employer-applicants.service.js';
import { EmployerAccountService } from './employer-account.service.js';
import { EmployerContext } from './employer-context.service.js';
import { EmployerDashboardService } from './employer-dashboard.service.js';
import { EmployerIntakeService } from './employer-intake.service.js';
import { EmployerInterviewCreateService } from './employer-interview-create.service.js';
import { EmployerInterviewsController } from './employer-interviews.controller.js';
import { EmployerJobFormService } from './employer-job-form.service.js';
import { EmployerInterviewsService } from './employer-interviews.service.js';
import { EmployerJobsController } from './employer-jobs.controller.js';
import { EmployerJobsService } from './employer-jobs.service.js';
import { EmployerPartnersService } from './employer-partners.service.js';
import { EmployerPortalController } from './employer-portal.controller.js';
import { EmployerPortalService } from './employer-portal.service.js';

@Module({
  imports: [JobsModule],
  controllers: [EmployerAccountController, EmployerJobsController, EmployerApplicantsController, EmployerInterviewsController, EmployerPortalController],
  providers: [EmployerContext, EmployerAccountService, EmployerDashboardService, EmployerJobsService, EmployerJobFormService, EmployerApplicantsService, EmployerIntakeService, EmployerInterviewCreateService, EmployerInterviewsService, EmployerPartnersService, EmployerPortalService],
})
export class EmployerPortalModule {}
