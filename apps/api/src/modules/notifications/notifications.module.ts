import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { FcmPushSender, LogPushSender, PushSender } from './push-sender.js';
import { ENV, type Env } from '../../config/env.js';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, {
    provide: PushSender,
    inject: [ENV],
    useFactory: (env: Env) => env.PUSH_PROVIDER === 'fcm' ? new FcmPushSender(env) : new LogPushSender(),
  }],
  exports: [NotificationsService],
})
export class NotificationsModule {}
