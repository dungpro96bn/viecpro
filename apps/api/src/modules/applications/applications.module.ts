import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';
import { ApplyEmailOtpService } from './apply-email-otp.service.js';
import { SeekerApplicationsController } from './seeker-applications.controller.js';
import { SeekerApplicationsService } from './seeker-applications.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ApplicationsController, SeekerApplicationsController],
  providers: [ApplicationsService, ApplyEmailOtpService, SeekerApplicationsService],
})
export class ApplicationsModule {}
