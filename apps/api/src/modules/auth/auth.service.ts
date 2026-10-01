import { HttpStatus, Injectable } from '@nestjs/common';
import {
  normalizeVnPhone,
  type AuthResponse,
  type LoginInput,
  type OtpSentResponse,
  type RegisterInput,
  type ResetPasswordInput,
  type SendOtpInput,
  type VerifyRegisterInput,
} from '@viecpro/shared';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { uniqueSlug } from '../../core/utils/unique-slug.js';
import { authUserInclude, toAuthUser } from './auth-user.js';
import { OtpService } from './otp.service.js';
import { assertNotTemporarilyLocked, clearFailedLogins, invalidCredentials, registerFailedLogin } from './login-guard.js';
import { hashPassword, verifyPassword } from './password.js';
import { type DeviceInfo, type IssuedTokens, SessionService } from './session.service.js';
import { GoogleTokenVerifier } from './google-token-verifier.js';

const ROLE_NAME = { seeker: 'người tìm việc', employer: 'nhà tuyển dụng', admin: 'quản trị' } as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly assets: AssetUrlService,
    private readonly google: GoogleTokenVerifier,
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
              { key: 'cccd', label: 'CCCD đại diện', ok: false },
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

  async resetPassword(input: ResetPasswordInput) {
    const user = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    // Admin đặt lại mật khẩu qua super admin, không qua OTP công khai
    if (!user || user.deletedAt || user.role === 'admin') throw new ApiException('OTP_INVALID', 'Mã xác thực không đúng');
    await this.otp.verify(input.phone, 'reset_password', input.code);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password), phoneVerifiedAt: user.phoneVerifiedAt ?? new Date() } });
    // Đổi mật khẩu → đăng xuất mọi thiết bị
    await this.sessions.revokeAll(user.id);
  }
}
