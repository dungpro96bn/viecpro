import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';
import { ApplyEmailOtpService } from './apply-email-otp.service.js';
import { SeekerApplicationsController } from './seeker-applications.controller.js';
import { SeekerApplicationsService } from './seeker-applications.service.js';

@Module({
  controllers: [ApplicationsController, SeekerApplicationsController],
  providers: [ApplicationsService, ApplyEmailOtpService, SeekerApplicationsService],
})
export class ApplicationsModule {}
