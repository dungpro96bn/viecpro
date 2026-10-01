import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';
import { SeekerProfileService } from './seeker-profile.service.js';

@Module({
  imports: [AuthModule, JobsModule],
  controllers: [MeController],
  providers: [MeService, SeekerProfileService],
})
export class MeModule {}
