import { Module } from '@nestjs/common';
import { JobMapper } from './job.mapper.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

@Module({
  controllers: [JobsController],
  providers: [JobsService, JobMapper],
  exports: [JobsService, JobMapper],
})
export class JobsModule {}
