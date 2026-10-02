import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { AccountSettingsService } from './account-settings.service.js';
import { MeController } from './me.controller.js';
import { SettingsController } from './settings.controller.js';
import { MeService } from './me.service.js';
import { SeekerProfileService } from './seeker-profile.service.js';

@Module({
  imports: [AuthModule, JobsModule],
  controllers: [MeController, SettingsController],
  providers: [MeService, SeekerProfileService, AccountSettingsService],
})
export class MeModule {}
