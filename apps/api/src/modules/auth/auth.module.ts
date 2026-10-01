import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ConsoleOtpSender, OtpSender, TwilioOtpSender } from './otp-sender.js';
import { OtpService } from './otp.service.js';
import { SessionService } from './session.service.js';
import { GoogleTokenVerifier } from './google-token-verifier.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    SessionService,
    GoogleTokenVerifier,
    {
      provide: OtpSender,
      inject: [ENV],
      useFactory: (env: Env) => env.OTP_PROVIDER === 'sms' ? new TwilioOtpSender(env) : new ConsoleOtpSender(),
    },
  ],
  exports: [SessionService],
})
export class AuthModule {}
