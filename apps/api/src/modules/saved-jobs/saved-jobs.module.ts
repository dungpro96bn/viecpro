import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module.js';
import { SavedJobsController } from './saved-jobs.controller.js';
import { SavedJobsService } from './saved-jobs.service.js';

@Module({
  imports: [JobsModule],
  controllers: [SavedJobsController],
  providers: [SavedJobsService],
})
export class SavedJobsModule {}
