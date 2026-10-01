import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { OtpPurpose, OtpSentResponse } from '@viecpro/shared';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { ENV, type Env } from '../../config/env.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { OtpSender } from './otp-sender.js';

const CODE_TTL_SEC = 5 * 60;
const RESEND_AFTER_SEC = 60;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: OtpSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private hash(phone: string, purpose: OtpPurpose, code: string) {
    return createHmac('sha256', this.env.OTP_SECRET).update(`${phone}:${purpose}:${code}`).digest('hex');
  }

  /** Tạo và gửi mã 6 số; chặn gửi lại trong 60 giây và tối đa 5 lần / giờ */
  async send(phone: string, purpose: OtpPurpose): Promise<OtpSentResponse> {
    const now = Date.now();
    const recent = await this.prisma.otpCode.findMany({
      where: { phone, purpose, createdAt: { gte: new Date(now - 3600_000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const last = recent[0];
    if (last && now - last.createdAt.getTime() < RESEND_AFTER_SEC * 1000) {
      const wait = Math.ceil((RESEND_AFTER_SEC * 1000 - (now - last.createdAt.getTime())) / 1000);
      throw new ApiException('OTP_RESEND_TOO_SOON', `Vui lòng chờ ${wait} giây để gửi lại mã`, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent.length >= MAX_PER_HOUR) {
      throw new ApiException('RATE_LIMITED', 'Bạn đã yêu cầu quá nhiều mã, vui lòng thử lại sau 1 giờ', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const otp = await this.prisma.otpCode.create({
      data: { phone, purpose, codeHash: this.hash(phone, purpose, code), expiresAt: new Date(now + CODE_TTL_SEC * 1000) },
    });
    try {
      await this.sender.send(phone, code, purpose);
    } catch {
      await this.prisma.otpCode.delete({ where: { id: otp.id } });
      throw new ApiException('INTERNAL_ERROR', 'Chưa gửi được mã xác thực. Vui lòng thử lại sau.', HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      phone,
      resendAfter: RESEND_AFTER_SEC,
      expiresIn: CODE_TTL_SEC,
      ...(this.env.NODE_ENV !== 'production' && { devCode: code }),
    };
  }

  /** Kiểm tra mã mới nhất; đúng thì đánh dấu đã dùng */
  async verify(phone: string, purpose: OtpPurpose, code: string): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new ApiException('OTP_INVALID', 'Mã xác thực không đúng');
    if (otp.expiresAt.getTime() < Date.now()) throw new ApiException('OTP_EXPIRED', 'Mã xác thực đã hết hạn, vui lòng gửi lại mã');
    if (otp.attempts >= MAX_ATTEMPTS) {
      throw new ApiException('OTP_TOO_MANY_ATTEMPTS', 'Bạn đã nhập sai quá nhiều lần, vui lòng gửi lại mã', HttpStatus.TOO_MANY_REQUESTS);
    }

    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(this.hash(phone, purpose, code), 'hex');
    if (!timingSafeEqual(expected, actual)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new ApiException('OTP_INVALID', 'Mã xác thực không đúng');
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  }
}
