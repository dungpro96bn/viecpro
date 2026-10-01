import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { ApplyEmailOtpInput, EmailOtpSentResponse } from '@viecpro/shared';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { ENV, type Env } from '../../config/env.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { EmailSender } from '../../core/mail/email-sender.js';
import { applyOtpEmail } from '../../core/mail/templates/apply.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

export const EMAIL_CODE_TTL_SEC = 5 * 60;
const RESEND_AFTER_SEC = 60;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;

/** "lan.nguyen99@gmail.com" → "la•••99@gmail.com" (không lộ đủ email trong response / UI) */
export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  const shown = user.length <= 3 ? user.slice(0, 1) : `${user.slice(0, 2)}•••${user.slice(-2)}`;
  return `${shown}${user.length <= 3 ? '•••' : ''}@${domain}`;
}

/**
 * Mã OTP 6 số gửi tới email ứng tuyển (RULE-BE.md mục 5.2): sinh bằng crypto.randomInt, chỉ lưu HMAC,
 * sống 5 phút, sai tối đa 5 lần, gửi lại sau 60 giây, tối đa 5 mã / giờ / email, dùng xong đánh dấu consumedAt.
 */
@Injectable()
export class ApplyEmailOtpService {
  private readonly logger = new Logger(ApplyEmailOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: EmailSender,
    private readonly assets: AssetUrlService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private hash(email: string, code: string) {
    return createHmac('sha256', this.env.OTP_SECRET).update(`email:${email}:apply:${code}`).digest('hex');
  }

  /** Tài khoản ứng viên đang đăng nhập đã xác thực đúng email này → không cần mã */
  async isVerifiedFor(userId: string | undefined, email: string): Promise<boolean> {
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
    return !!user?.emailVerifiedAt && user.email === email;
  }

  async send(input: ApplyEmailOtpInput, userId?: string): Promise<EmailOtpSentResponse> {
    const job = await this.prisma.job.findFirst({
      where: { OR: [...(input.jobId ? [{ id: input.jobId }] : []), ...(input.jobSlug ? [{ slug: input.jobSlug }] : [])] },
      select: { title: true, pref: true, salary: true, imageUrl: true, status: true, employer: { select: { name: true } } },
    });
    if (!job) throw ApiException.notFound('Không tìm thấy đơn hàng');
    if (job.status !== 'open') throw new ApiException('JOB_CLOSED', 'Đơn hàng đã ngừng tuyển', HttpStatus.CONFLICT);

    const email = input.email;
    const base = { email: maskEmail(email), resendAfter: RESEND_AFTER_SEC, expiresIn: EMAIL_CODE_TTL_SEC };
    if (await this.isVerifiedFor(userId, email)) return { ...base, verified: true, resendAfter: 0, expiresIn: 0 };

    const now = Date.now();
    const recent = await this.prisma.emailOtpCode.findMany({
      where: { email, purpose: 'apply', createdAt: { gte: new Date(now - 3600_000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const last = recent[0];
    if (last && now - last.createdAt.getTime() < RESEND_AFTER_SEC * 1000) {
      const wait = Math.ceil((RESEND_AFTER_SEC * 1000 - (now - last.createdAt.getTime())) / 1000);
      throw new ApiException('OTP_RESEND_TOO_SOON', `Vui lòng chờ ${wait} giây để gửi lại mã`, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent.length >= MAX_PER_HOUR) {
      throw new ApiException('RATE_LIMITED', 'Email này đã yêu cầu quá nhiều mã, vui lòng thử lại sau 1 giờ', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const otp = await this.prisma.emailOtpCode.create({
      data: { email, purpose: 'apply', codeHash: this.hash(email, code), expiresAt: new Date(now + EMAIL_CODE_TTL_SEC * 1000) },
    });
    const message = applyOtpEmail({
      to: email,
      fullName: input.fullName,
      code,
      expiresMinutes: EMAIL_CODE_TTL_SEC / 60,
      job: { title: job.title, pref: job.pref, salary: job.salary, imageUrl: this.assets.url(job.imageUrl), employerName: job.employer?.name },
      webBaseUrl: this.env.WEB_BASE_URL,
    });
    try {
      await this.mail.send({ to: email, ...message });
    } catch (e) {
      // Gửi lỗi: xoá mã để không tính vào giới hạn; ghi log không kèm mã / email đầy đủ
      await this.prisma.emailOtpCode.delete({ where: { id: otp.id } });
      this.logger.error(`Gửi email OTP ứng tuyển thất bại tới ${maskEmail(email)}: ${(e as Error).message}`);
      throw new ApiException('INTERNAL_ERROR', 'Chưa gửi được email xác nhận. Vui lòng thử lại sau.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { ...base, verified: false, ...(this.env.NODE_ENV !== 'production' && { devCode: code }) };
  }

  /** Kiểm tra mã mới nhất của email; đúng thì đánh dấu đã dùng. Lỗi trả theo trường `emailCode` */
  async verify(email: string, code: string | undefined): Promise<void> {
    const fail = (errorCode: 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_TOO_MANY_ATTEMPTS', message: string, status = HttpStatus.BAD_REQUEST) => new ApiException(errorCode, message, status, { emailCode: message });
    if (!code) throw fail('OTP_INVALID', 'Nhập mã xác nhận đã gửi tới email của bạn');
    const otp = await this.prisma.emailOtpCode.findFirst({ where: { email, purpose: 'apply', consumedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!otp) throw fail('OTP_INVALID', 'Mã xác nhận không đúng, hãy gửi lại mã');
    if (otp.expiresAt.getTime() < Date.now()) throw fail('OTP_EXPIRED', 'Mã xác nhận đã hết hạn, vui lòng gửi lại mã');
    if (otp.attempts >= MAX_ATTEMPTS) throw fail('OTP_TOO_MANY_ATTEMPTS', 'Bạn đã nhập sai quá nhiều lần, vui lòng gửi lại mã', HttpStatus.TOO_MANY_REQUESTS);

    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(this.hash(email, code), 'hex');
    if (!timingSafeEqual(expected, actual)) {
      await this.prisma.emailOtpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      const left = MAX_ATTEMPTS - otp.attempts - 1;
      throw fail('OTP_INVALID', left > 0 ? `Mã xác nhận không đúng (còn ${left} lần thử)` : 'Mã xác nhận không đúng, vui lòng gửi lại mã');
    }
    // Đánh dấu đã dùng có điều kiện để 2 request song song không cùng dùng 1 mã
    const used = await this.prisma.emailOtpCode.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (!used.count) throw fail('OTP_INVALID', 'Mã xác nhận đã được dùng, vui lòng gửi lại mã');
  }
}
