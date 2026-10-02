import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../../config/env.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { SecretBox } from '../../../core/security/secret-box.js';
import { verifyTotp } from '../../../core/security/totp.js';

/**
 * Xác nhận lại bằng mã 2FA cho hành động phá huỷ (khoá hàng loạt, khoá vĩnh viễn…) – RULE-BE.md mục 7.
 * ADMIN_MFA_BYPASS (chỉ dev / test, production từ chối khởi động) bỏ qua bước này.
 */
@Injectable()
export class StepUpService {
  private readonly box: SecretBox;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.box = new SecretBox(env.ADMIN_MFA_KEY);
  }

  async assert(adminId: string, otp: string | undefined): Promise<void> {
    if (this.env.ADMIN_MFA_BYPASS) return;
    const fail = (message: string) => new ApiException('OTP_INVALID', message, HttpStatus.BAD_REQUEST, { otp: message });
    if (!otp) throw fail('Nhập mã 2FA để xác nhận thao tác này');
    const admin = await this.prisma.user.findUnique({ where: { id: adminId }, select: { mfaSecretEnc: true } });
    if (!admin?.mfaSecretEnc || !verifyTotp(this.box.decrypt(admin.mfaSecretEnc), otp)) throw fail('Mã 2FA không đúng');
  }
}
