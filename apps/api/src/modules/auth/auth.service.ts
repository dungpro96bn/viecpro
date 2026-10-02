import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  maskEmail,
  maskPhoneTail,
  normalizeVnPhone,
  type ForgotPasswordInput,
  type PasswordResetSent,
  type AuthResponse,
  type LoginInput,
  type OtpSentResponse,
  type RegisterInput,
  type ResetPasswordInput,
  type SendOtpInput,
  type VerifyRegisterInput,
} from '@viecpro/shared';
import { ENV, type Env } from '../../config/env.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { EmailSender } from '../../core/mail/email-sender.js';
import { accountCodeEmail } from '../../core/mail/templates/account.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { uniqueSlug } from '../../core/utils/unique-slug.js';
import { authUserInclude, toAuthUser } from './auth-user.js';
import { OtpService } from './otp.service.js';
import { assertNotTemporarilyLocked, assertStillMember, clearFailedLogins, invalidCredentials, registerFailedLogin } from './login-guard.js';
import { hashPassword, verifyPassword } from './password.js';
import { type DeviceInfo, type IssuedTokens, SessionService } from './session.service.js';
import { GoogleTokenVerifier } from './google-token-verifier.js';
import { EMAIL_CODE_RESEND_SEC, EMAIL_CODE_TTL_SEC, EmailCodeService } from './email-code.service.js';

const ROLE_NAME = { seeker: 'người tìm việc', employer: 'nhà tuyển dụng', admin: 'quản trị' } as const;

/** Lỗi giới hạn gửi lại – không trả cho client ở luồng quên mật khẩu vì sẽ lộ tài khoản có tồn tại */
const SILENT_SEND_ERRORS = new Set(['OTP_RESEND_TOO_SOON', 'RATE_LIMITED']);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly assets: AssetUrlService,
    private readonly google: GoogleTokenVerifier,
    private readonly emailCodes: EmailCodeService,
    private readonly mail: EmailSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Dựng AuthResponse; chỉ trả refreshToken trong body cho app mobile */
  private async respond(userId: string, tokens: IssuedTokens, device: Pick<DeviceInfo, 'platform'>): Promise<AuthResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: authUserInclude });
    return {
      user: toAuthUser(user, this.assets),
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      ...(device.platform !== 'web' && { refreshToken: tokens.refreshToken }),
    };
  }

  /** Bước 1: tạo tài khoản (chưa xác thực) và gửi OTP. Đăng ký lại cùng số chưa xác thực sẽ ghi đè thông tin cũ. */
  async register(input: RegisterInput): Promise<OtpSentResponse> {
    const existing = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if ((existing?.phoneVerifiedAt && !existing.deletedAt) || existing?.role === 'admin') {
      throw new ApiException('PHONE_TAKEN', 'Số điện thoại đã được đăng ký, vui lòng đăng nhập', HttpStatus.CONFLICT);
    }

    const passwordHash = await hashPassword(input.password);
    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        // Tài khoản chưa xác thực chưa đăng nhập được nên chưa có đơn / hồ sơ ứng tuyển – xoá hẳn kèm hồ sơ NTD đã tạo
        const recruiter = await tx.recruiter.findUnique({ where: { userId: existing.id }, select: { id: true, employerId: true } });
        if (recruiter) {
          await tx.recruiter.delete({ where: { id: recruiter.id } });
          const employer = recruiter.employerId
            ? await tx.employer.findUnique({ where: { id: recruiter.employerId }, select: { id: true, verified: true, _count: { select: { recruiters: true, jobs: true } } } })
            : null;
          // Xoá công ty cũ (cùng hồ sơ xác minh – cascade) nếu chỉ do lần đăng ký dở này tạo ra
          if (employer && !employer.verified && employer._count.recruiters === 0 && employer._count.jobs === 0) {
            await tx.employer.delete({ where: { id: employer.id } });
          }
        }
        await tx.user.delete({ where: { id: existing.id } });
      }
      const user = await tx.user.create({ data: { role: input.role, name: input.name, phone: input.phone, passwordHash } });

      if (input.role === 'seeker') {
        await tx.seekerProfile.create({
          data: { userId: user.id, birthYear: input.birthYear, gender: input.gender, programs: input.programs },
        });
      } else {
        const employer = await tx.employer.create({
          data: { name: input.company, slug: await uniqueSlug(input.company, async (s) => !!(await tx.employer.findUnique({ where: { slug: s } }))) },
        });
        // Hồ sơ xác minh tự tạo – tin đăng chờ duyệt cho tới khi được xác minh
        await tx.verificationRequest.create({
          data: {
            kind: 'company',
            employerId: employer.id,
            documents: [
              { key: 'dkkd', label: 'ĐKKD', ok: false },
              { key: 'gpxkld', label: 'GP XKLĐ', ok: false },
              // Thư uỷ quyền khi người đăng ký không phải đại diện pháp luật – không thu thập CCCD (spec R4)
              { key: 'uy_quyen', label: 'Thư uỷ quyền', ok: false },
            ],
          },
        });
        await tx.recruiter.create({
          data: {
            userId: user.id,
            employerId: employer.id,
            name: input.name,
            title: 'Cán bộ tuyển dụng',
            phone: input.phone,
            slug: await uniqueSlug(input.name, async (s) => !!(await tx.recruiter.findUnique({ where: { slug: s } }))),
          },
        });
      }
    });

    return this.otp.send(input.phone, 'register');
  }

  /** Bước 2: xác thực OTP → kích hoạt tài khoản và đăng nhập luôn */
  async verifyRegister(input: VerifyRegisterInput, device: DeviceInfo): Promise<{ response: AuthResponse; tokens: IssuedTokens }> {
    const user = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (!user || user.deletedAt) throw ApiException.notFound('Không tìm thấy tài khoản đăng ký với số này');
    await this.otp.verify(input.phone, 'register', input.code);
    await this.prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: user.phoneVerifiedAt ?? new Date() } });
    const tokens = await this.sessions.create(user.id, user.role, device);
    return { response: await this.respond(user.id, tokens, device), tokens };
  }

  /** Gửi lại OTP (đăng ký / đăng nhập / quên mật khẩu). Không tiết lộ số chưa đăng ký. */
  async sendOtp({ phone, purpose }: SendOtpInput): Promise<OtpSentResponse> {
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true, deletedAt: true } });
    if (!user || user.deletedAt) return { phone, resendAfter: 60, expiresIn: 300 };
    return this.otp.send(phone, purpose);
  }

  async login(input: LoginInput, device: DeviceInfo): Promise<{ response: AuthResponse; tokens: IssuedTokens }> {
    const id = input.identifier.trim();
    const phone = id.includes('@') ? null : normalizeVnPhone(id);
    const user = await this.prisma.user.findFirst({
      where: phone ? { phone } : { email: id.toLowerCase() },
    });

    // Tài khoản admin chỉ đăng nhập qua /auth/admin/login (bắt buộc 2FA) – trả lỗi như sai mật khẩu
    const candidate = user && !user.deletedAt && user.role !== 'admin' ? user : null;
    await assertNotTemporarilyLocked(candidate);
    const ok = candidate?.passwordHash && (await verifyPassword(input.password, candidate.passwordHash));
    if (!candidate || !ok) {
      if (candidate) await registerFailedLogin(this.prisma, candidate);
      throw invalidCredentials();
    }
    if (candidate.lockedAt) {
      throw new ApiException('FORBIDDEN', 'Tài khoản đã bị khoá. Vui lòng liên hệ 1900 66 88 để được hỗ trợ', HttpStatus.FORBIDDEN);
    }
    await assertStillMember(this.prisma, candidate);
    if (input.role && input.role !== candidate.role) {
      throw new ApiException('WRONG_ROLE', `Đây là tài khoản ${ROLE_NAME[candidate.role]}, vui lòng chọn đúng vai trò`, HttpStatus.FORBIDDEN);
    }
    if (!candidate.phoneVerifiedAt) {
      throw new ApiException('PHONE_NOT_VERIFIED', 'Tài khoản chưa xác thực số điện thoại', HttpStatus.FORBIDDEN);
    }

    await clearFailedLogins(this.prisma, candidate);
    const tokens = await this.sessions.create(candidate.id, candidate.role, device);
    return { response: await this.respond(candidate.id, tokens, device), tokens };
  }

  async refresh(refreshToken: string, device: Pick<DeviceInfo, 'platform'>): Promise<{ response: AuthResponse; tokens: IssuedTokens }> {
    const tokens = await this.sessions.rotate(refreshToken);
    return { response: await this.respond(tokens.userId, tokens, device), tokens };
  }

  async googleLogin(idToken: string, device: DeviceInfo): Promise<{ response: AuthResponse; tokens: IssuedTokens }> {
    const identity = await this.google.verify(idToken);
    let user = await this.prisma.user.findFirst({ where: { OR: [{ googleId: identity.subject }, { email: identity.email }] } });
    if (user?.role === 'admin' || user?.deletedAt) throw new ApiException('INVALID_CREDENTIALS', 'Không thể đăng nhập bằng tài khoản này', HttpStatus.UNAUTHORIZED);
    if (user?.lockedAt) throw new ApiException('FORBIDDEN', 'Tài khoản đã bị khoá. Vui lòng liên hệ 1900 66 88 để được hỗ trợ', HttpStatus.FORBIDDEN);
    if (user) await assertStillMember(this.prisma, user);
    if (user) {
      if (user.googleId && user.googleId !== identity.subject) throw new ApiException('CONFLICT', 'Email đã liên kết với tài khoản Google khác', HttpStatus.CONFLICT);
      user = await this.prisma.user.update({ where: { id: user.id }, data: { googleId: identity.subject, email: identity.email, avatarUrl: user.avatarUrl ?? identity.picture } });
    } else {
      user = await this.prisma.user.create({
        data: { role: 'seeker', name: identity.name, email: identity.email, googleId: identity.subject, avatarUrl: identity.picture, seekerProfile: { create: {} } },
      });
    }
    const tokens = await this.sessions.create(user.id, user.role, device);
    return { response: await this.respond(user.id, tokens, device), tokens };
  }

  /** Tài khoản theo email hoặc số điện thoại (đã chuẩn hoá) – không trả admin / đã xoá / đã khoá */
  private async resetTarget(identifier: string) {
    const id = identifier.trim();
    const phone = id.includes('@') ? null : normalizeVnPhone(id);
    const user = await this.prisma.user.findFirst({
      where: phone ? { phone } : { email: id.toLowerCase() },
      select: { id: true, phone: true, email: true, emailVerifiedAt: true, phoneVerifiedAt: true, role: true, deletedAt: true, lockedAt: true },
    });
    // Admin đặt lại mật khẩu qua super admin, không qua mã công khai
    return user && !user.deletedAt && !user.lockedAt && user.role !== 'admin' ? user : null;
  }

  /**
   * Quên mật khẩu bước 1 (design 03): gửi mã tới SMS hoặc email của tài khoản.
   * Luôn trả cùng một dạng response, không cho biết tài khoản có tồn tại hay không (RULE-BE.md mục 5.3).
   * Kênh email chỉ dùng được khi email của tài khoản đã xác thực (tránh gửi mã tới email gõ nhầm).
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<PasswordResetSent> {
    const id = input.identifier.trim();
    const isEmail = id.includes('@');
    // Chỉ che lại chính giá trị người dùng nhập – không tra từ tài khoản
    const sentTo = isEmail && input.channel === 'email' ? maskEmail(id.toLowerCase()) : !isEmail && input.channel === 'sms' ? maskPhoneTail(normalizeVnPhone(id)!) : null;
    const response: PasswordResetSent = { channel: input.channel, sentTo, resendAfter: EMAIL_CODE_RESEND_SEC, expiresIn: EMAIL_CODE_TTL_SEC };

    const user = await this.resetTarget(id);
    if (!user) return response;
    try {
      if (input.channel === 'sms' && user.phone) {
        const sent = await this.otp.send(user.phone, 'reset_password');
        return { ...response, ...(sent.devCode && { devCode: sent.devCode }) };
      }
      if (input.channel === 'email' && user.email && user.emailVerifiedAt) {
        const email = user.email;
        const code = await this.emailCodes.issue(email, 'reset_password', async (c) => {
          await this.mail.send({ to: email, ...accountCodeEmail({ to: email, purpose: 'reset_password', code: c, expiresMinutes: EMAIL_CODE_TTL_SEC / 60, webBaseUrl: this.env.WEB_BASE_URL }) });
        });
        return { ...response, ...(this.env.NODE_ENV !== 'production' && { devCode: code }) };
      }
    } catch (e) {
      if (e instanceof ApiException && SILENT_SEND_ERRORS.has((e.getResponse() as { code: string }).code)) return response;
      if (!(e instanceof ApiException)) this.logger.error(`Gửi mã đặt lại mật khẩu thất bại: ${(e as Error).message}`);
      throw new ApiException('INTERNAL_ERROR', 'Chưa gửi được mã xác thực. Vui lòng thử lại sau.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return response;
  }

  /** Quên mật khẩu bước 2–3: kiểm tra mã theo kênh đã chọn, đặt mật khẩu mới, đăng xuất mọi thiết bị */
  async resetPassword(input: ResetPasswordInput) {
    const user = await this.resetTarget(input.identifier ?? input.phone!);
    const invalid = () => new ApiException('OTP_INVALID', 'Mã xác thực không đúng', HttpStatus.BAD_REQUEST, { code: 'Mã xác thực không đúng' });
    if (!user) throw invalid();
    if (input.channel === 'email') {
      if (!user.email || !user.emailVerifiedAt) throw invalid();
      await this.emailCodes.verify(user.email, 'reset_password', input.code);
    } else {
      if (!user.phone) throw invalid();
      await this.otp.verify(user.phone, 'reset_password', input.code);
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(input.password),
        passwordChangedAt: new Date(),
        failedLogins: 0,
        loginLockedUntil: null,
        ...(input.channel === 'sms' && !user.phoneVerifiedAt && { phoneVerifiedAt: new Date() }),
      },
    });
    // Đặt lại mật khẩu bằng mã → thu hồi tất cả phiên (RULE-BE.md mục 5.2)
    await this.sessions.revokeAll(user.id);
  }
}
