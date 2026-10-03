import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
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
import { EmployerMembersController, MemberInvitesController } from './employer-members.controller.js';
import { EmployerMembersService } from './employer-members.service.js';
import { EmployerProfileController } from './employer-profile.controller.js';
import { EmployerProfileService } from './employer-profile.service.js';
import { EmployerTrashController } from './employer-trash.controller.js';
import { EmployerTrashService } from './employer-trash.service.js';
import { TrashPurgeWorker } from './trash-purge.worker.js';
import { EmployerJobTrashService } from './employer-job-trash.service.js';
import { EmployerReviewsController, SeekerReviewsController } from './employer-reviews.controller.js';
import { EmployerReviewsService } from './employer-reviews.service.js';
import { MemberInvitesService } from './member-invites.service.js';

@Module({
  imports: [JobsModule, AuthModule],
  controllers: [EmployerAccountController, EmployerJobsController, EmployerApplicantsController, EmployerInterviewsController, EmployerPortalController, EmployerProfileController, EmployerMembersController, MemberInvitesController, EmployerTrashController, EmployerReviewsController, SeekerReviewsController],
  providers: [EmployerContext, EmployerAccountService, EmployerDashboardService, EmployerJobsService, EmployerJobFormService, EmployerApplicantsService, EmployerIntakeService, EmployerInterviewCreateService, EmployerInterviewsService, EmployerPartnersService, EmployerPortalService, EmployerProfileService, EmployerMembersService, MemberInvitesService, EmployerTrashService, EmployerJobTrashService, TrashPurgeWorker, EmployerReviewsService],
})
export class EmployerPortalModule {}
