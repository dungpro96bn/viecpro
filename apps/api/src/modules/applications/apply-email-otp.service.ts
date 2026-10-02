import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { maskEmail, type ApplyEmailOtpInput, type EmailOtpSentResponse } from '@viecpro/shared';
import { ENV, type Env } from '../../config/env.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { EmailSender } from '../../core/mail/email-sender.js';
import { applyOtpEmail } from '../../core/mail/templates/apply.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { EMAIL_CODE_RESEND_SEC, EMAIL_CODE_TTL_SEC, EmailCodeService } from '../auth/email-code.service.js';

export { EMAIL_CODE_TTL_SEC, maskEmail };

/** Mã xác nhận email khi ứng tuyển – quy tắc mã nằm ở EmailCodeService (RULE-BE.md mục 5.2) */
@Injectable()
export class ApplyEmailOtpService {
  private readonly logger = new Logger(ApplyEmailOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: EmailSender,
    private readonly assets: AssetUrlService,
    private readonly codes: EmailCodeService,
    @Inject(ENV) private readonly env: Env,
  ) {}

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
    const base = { email: maskEmail(email), resendAfter: EMAIL_CODE_RESEND_SEC, expiresIn: EMAIL_CODE_TTL_SEC };
    if (await this.isVerifiedFor(userId, email)) return { ...base, verified: true, resendAfter: 0, expiresIn: 0 };

    let code: string;
    try {
      code = await this.codes.issue(email, 'apply', async (c) => {
        const message = applyOtpEmail({
          to: email,
          fullName: input.fullName,
          code: c,
          expiresMinutes: EMAIL_CODE_TTL_SEC / 60,
          job: { title: job.title, pref: job.pref, salary: job.salary, imageUrl: this.assets.url(job.imageUrl), employerName: job.employer?.name },
          webBaseUrl: this.env.WEB_BASE_URL,
        });
        await this.mail.send({ to: email, ...message });
      });
    } catch (e) {
      if (e instanceof ApiException) throw e;
      // Ghi log không kèm mã / email đầy đủ
      this.logger.error(`Gửi email OTP ứng tuyển thất bại tới ${maskEmail(email)}: ${(e as Error).message}`);
      throw new ApiException('INTERNAL_ERROR', 'Chưa gửi được email xác nhận. Vui lòng thử lại sau.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { ...base, verified: false, ...(this.env.NODE_ENV !== 'production' && { devCode: code }) };
  }

  /** Lỗi trả theo trường `emailCode` của form ứng tuyển */
  verify(email: string, code: string | undefined): Promise<void> {
    return this.codes.verify(email, 'apply', code, 'emailCode');
  }
}
