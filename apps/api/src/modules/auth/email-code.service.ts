import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { EmailOtpPurpose } from '@viecpro/shared';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { ENV, type Env } from '../../config/env.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

export const EMAIL_CODE_TTL_SEC = 5 * 60;
export const EMAIL_CODE_RESEND_SEC = 60;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;

/**
 * Mã 6 số gửi qua email (RULE-BE.md mục 5.2): crypto.randomInt, chỉ lưu HMAC, sống 5 phút,
 * sai tối đa 5 lần, gửi lại sau 60 giây, tối đa 5 mã / giờ / email / mục đích, dùng xong đánh dấu consumedAt.
 * Dùng chung cho ứng tuyển, đặt lại mật khẩu và đổi email. Việc gửi email do nơi gọi đảm nhận.
 */
@Injectable()
export class EmailCodeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private hash(email: string, purpose: EmailOtpPurpose, code: string) {
    return createHmac('sha256', this.env.OTP_SECRET).update(`email:${email}:${purpose}:${code}`).digest('hex');
  }

  /**
   * Tạo mã mới và gọi `deliver` để gửi. Gửi lỗi → xoá mã (không tính vào giới hạn) rồi ném lỗi lại.
   * Trả mã để môi trường dev hiển thị `devCode`.
   */
  async issue(email: string, purpose: EmailOtpPurpose, deliver: (code: string) => Promise<void>): Promise<string> {
    const now = Date.now();
    const recent = await this.prisma.emailOtpCode.findMany({
      where: { email, purpose, createdAt: { gte: new Date(now - 3600_000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const last = recent[0];
    if (last && now - last.createdAt.getTime() < EMAIL_CODE_RESEND_SEC * 1000) {
      const wait = Math.ceil((EMAIL_CODE_RESEND_SEC * 1000 - (now - last.createdAt.getTime())) / 1000);
      throw new ApiException('OTP_RESEND_TOO_SOON', `Vui lòng chờ ${wait} giây để gửi lại mã`, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent.length >= MAX_PER_HOUR) {
      throw new ApiException('RATE_LIMITED', 'Email này đã yêu cầu quá nhiều mã, vui lòng thử lại sau 1 giờ', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const otp = await this.prisma.emailOtpCode.create({
      data: { email, purpose, codeHash: this.hash(email, purpose, code), expiresAt: new Date(now + EMAIL_CODE_TTL_SEC * 1000) },
    });
    try {
      await deliver(code);
    } catch (e) {
      await this.prisma.emailOtpCode.delete({ where: { id: otp.id } });
      throw e;
    }
    return code;
  }

  /** Kiểm tra mã mới nhất; đúng thì đánh dấu đã dùng. `field` là tên trường trả lỗi cho form */
  async verify(email: string, purpose: EmailOtpPurpose, code: string | undefined, field = 'code'): Promise<void> {
    const fail = (errorCode: 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_TOO_MANY_ATTEMPTS', message: string, status = HttpStatus.BAD_REQUEST) =>
      new ApiException(errorCode, message, status, { [field]: message });
    if (!code) throw fail('OTP_INVALID', 'Nhập mã xác nhận đã gửi tới email của bạn');
    const otp = await this.prisma.emailOtpCode.findFirst({ where: { email, purpose, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!otp) throw fail('OTP_INVALID', 'Mã xác nhận không đúng, hãy gửi lại mã');
    if (otp.expiresAt.getTime() < Date.now()) throw fail('OTP_EXPIRED', 'Mã xác nhận đã hết hạn, vui lòng gửi lại mã');
    if (otp.attempts >= MAX_ATTEMPTS) throw fail('OTP_TOO_MANY_ATTEMPTS', 'Bạn đã nhập sai quá nhiều lần, vui lòng gửi lại mã', HttpStatus.TOO_MANY_REQUESTS);

    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(this.hash(email, purpose, code), 'hex');
    if (!timingSafeEqual(expected, actual)) {
      await this.prisma.emailOtpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      const left = MAX_ATTEMPTS - otp.attempts - 1;
      throw fail('OTP_INVALID', left > 0 ? `Mã xác nhận không đúng (còn ${left} lần thử)` : 'Mã xác nhận không đúng, vui lòng gửi lại mã');
    }
    // Đánh dấu có điều kiện để 2 request song song không cùng dùng 1 mã
    const used = await this.prisma.emailOtpCode.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (!used.count) throw fail('OTP_INVALID', 'Mã xác nhận đã được dùng, vui lòng gửi lại mã');
  }
}
