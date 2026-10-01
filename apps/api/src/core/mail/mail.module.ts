import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { ConsoleEmailSender, EmailSender, ResendEmailSender } from './email-sender.js';

@Global()
@Module({
  providers: [
    {
      provide: EmailSender,
      inject: [ENV],
      useFactory: (env: Env) => (env.EMAIL_PROVIDER === 'resend' ? new ResendEmailSender(env) : new ConsoleEmailSender()),
    },
  ],
  exports: [EmailSender],
})
export class MailModule {}
