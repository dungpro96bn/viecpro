import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OtpPurpose } from '@viecpro/shared';
import { ENV, type Env } from '../../config/env.js';

/**
 * Kênh gửi mã OTP. Đổi nhà cung cấp (Zalo ZNS, eSMS, SpeedSMS…) bằng cách viết class mới
 * implements OtpSender rồi đổi provider trong auth.module.ts theo biến OTP_PROVIDER.
 */
export abstract class OtpSender {
  abstract send(phone: string, code: string, purpose: OtpPurpose): Promise<void>;
}

/** Dev: in mã ra log thay vì gửi SMS thật */
@Injectable()
export class ConsoleOtpSender extends OtpSender {
  private readonly logger = new Logger('OTP');

  async send(phone: string, code: string, purpose: OtpPurpose) {
    this.logger.log(`[${purpose}] ${phone} → ${code}`);
  }
}

const PURPOSE_LABEL: Record<OtpPurpose, string> = {
  register: 'đăng ký',
  login: 'đăng nhập',
  reset_password: 'đặt lại mật khẩu',
  change_phone: 'đổi số điện thoại',
  join_company: 'nhận lời mời doanh nghiệp',
};

/** Production SMS sender backed by Twilio Programmable Messaging. */
@Injectable()
export class TwilioOtpSender extends OtpSender {
  constructor(@Inject(ENV) private readonly env: Env) { super(); }

  async send(phone: string, code: string, purpose: OtpPurpose) {
    const account = this.env.SMS_TWILIO_ACCOUNT_SID;
    const token = this.env.SMS_TWILIO_AUTH_TOKEN;
    const from = this.env.SMS_TWILIO_FROM;
    if (!account || !token || !from) throw new Error('Twilio OTP provider is missing credentials');
    const purposeLabel = PURPOSE_LABEL[purpose];
    const authorization = Buffer.from(`${account}:${token}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: phone, From: from, Body: `Mã ${purposeLabel} viecpro: ${code}. Mã có hiệu lực trong 5 phút.` }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Twilio SMS request failed with status ${response.status}`);
  }
}
