import { Inject, Injectable, Logger } from '@nestjs/common';
import { maskPhoneTail } from '@viecpro/shared';
import { ENV, type Env } from '../../config/env.js';

/**
 * Kênh gửi tin nhắn SMS thông báo (không phải mã OTP – mã OTP đi qua OtpSender).
 * Đổi nhà cung cấp (SMS brandname, Zalo ZNS…) bằng class mới extends SmsSender rồi đổi provider trong notifications.module.ts.
 */
export abstract class SmsSender {
  abstract send(phone: string, text: string): Promise<void>;
}

/** Dev: in tin nhắn ra log thay vì gửi thật */
@Injectable()
export class ConsoleSmsSender extends SmsSender {
  private readonly logger = new Logger('SMS');

  async send(phone: string, text: string) {
    this.logger.log(`${maskPhoneTail(phone)} ← ${text}`);
  }
}

/** Gửi SMS thật qua Twilio Programmable Messaging (dùng chung tài khoản với OTP) */
@Injectable()
export class TwilioSmsSender extends SmsSender {
  constructor(@Inject(ENV) private readonly env: Env) { super(); }

  async send(phone: string, text: string) {
    const account = this.env.SMS_TWILIO_ACCOUNT_SID;
    const token = this.env.SMS_TWILIO_AUTH_TOKEN;
    const from = this.env.SMS_TWILIO_FROM;
    if (!account || !token || !from) throw new Error('Twilio SMS provider is missing credentials');
    const authorization = Buffer.from(`${account}:${token}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: phone, From: from, Body: text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Twilio SMS request failed with status ${response.status}`);
  }
}
