import { Inject, Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ENV, type Env } from '../../config/env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Bản chữ thuần cho trình đọc email không hiển thị HTML */
  text: string;
  /** Gắn nhãn để thống kê ở nhà cung cấp, vd. "apply-otp" */
  tag?: string;
}

/**
 * Kênh gửi email (RULE-BE.md mục 11). Đổi nhà cung cấp bằng class mới extends EmailSender
 * rồi đổi provider trong mail.module.ts theo biến EMAIL_PROVIDER.
 */
export abstract class EmailSender {
  abstract send(message: EmailMessage): Promise<void>;
}

/**
 * Dev: không gửi thật – ghi email ra apps/api/tmp/mail/<thời điểm>-<tag>.html để mở xem trước.
 * Log chỉ có người nhận, tiêu đề và đường dẫn tệp (không in mã OTP ra log).
 */
@Injectable()
export class ConsoleEmailSender extends EmailSender {
  private readonly logger = new Logger('Email');
  private readonly dir = join(process.cwd(), 'tmp', 'mail');

  async send(message: EmailMessage) {
    await mkdir(this.dir, { recursive: true });
    const file = join(this.dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${message.tag ?? 'mail'}.html`);
    await writeFile(file, message.html, 'utf8');
    // Không ghi mã OTP / email đầy đủ ra log (RULE-BE.md mục 4) – mở tệp HTML để xem nội dung
    const to = message.to.replace(/^(.{2}).*(@.*)$/, '$1•••$2');
    this.logger.log(`→ ${to} · "${message.subject.replace(/\b\d{6}\b/g, '••••••')}" · ${file}`);
  }
}

/** Production: Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email) */
@Injectable()
export class ResendEmailSender extends EmailSender {
  constructor(@Inject(ENV) private readonly env: Env) {
    super();
  }

  async send(message: EmailMessage) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.tag && { tags: [{ name: 'type', value: message.tag }] }),
      }),
      signal: AbortSignal.timeout(8000),
    });
    // Không đưa nội dung phản hồi (có thể chứa địa chỉ email) vào lỗi
    if (!response.ok) throw new Error(`Resend request failed with status ${response.status}`);
  }
}
