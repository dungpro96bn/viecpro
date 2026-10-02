import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module.js';
import { AlertDispatcherService } from './alert-dispatcher.service.js';
import { JobAlertsController } from './job-alerts.controller.js';
import { JobAlertsService } from './job-alerts.service.js';

@Module({
  imports: [JobsModule],
  controllers: [JobAlertsController],
  providers: [JobAlertsService, AlertDispatcherService],
})
export class JobAlertsModule {}
