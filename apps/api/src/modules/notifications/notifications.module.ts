import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { FcmPushSender, LogPushSender, PushSender } from './push-sender.js';
import { ConsoleSmsSender, SmsSender, TwilioSmsSender } from './sms-sender.js';
import { ENV, type Env } from '../../config/env.js';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, {
    provide: PushSender,
    inject: [ENV],
    useFactory: (env: Env) => env.PUSH_PROVIDER === 'fcm' ? new FcmPushSender(env) : new LogPushSender(),
  }, {
    // Cùng nhà cung cấp với OTP: OTP_PROVIDER=sms thì gửi thật qua Twilio, còn lại in ra log
    provide: SmsSender,
    inject: [ENV],
    useFactory: (env: Env) => env.OTP_PROVIDER === 'sms' ? new TwilioSmsSender(env) : new ConsoleSmsSender(),
  }],
  exports: [NotificationsService, SmsSender],
})
export class NotificationsModule {}
