import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  maskEmail,
  type ChangeEmailConfirmInput,
  type ChangeEmailRequestInput,
  type ChangePhoneConfirmInput,
  type ChangePhoneRequestInput,
  type EmailOtpSentResponse,
  type Locale,
  type OtpSentResponse,
  type PersonalDataExport,
  type PhoneVisibility,
  type SeekerSettings,
  type SettingsUpdateInput,
  type Theme,
} from '@viecpro/shared';
import { ENV, type Env } from '../../config/env.js';
import { ApiException } from '../../core/http/api-exception.js';
import { EmailSender } from '../../core/mail/email-sender.js';
import { accountCodeEmail } from '../../core/mail/templates/account.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { EMAIL_CODE_RESEND_SEC, EMAIL_CODE_TTL_SEC, EmailCodeService } from '../auth/email-code.service.js';
import { OtpService } from '../auth/otp.service.js';
import { verifyPassword } from '../auth/password.js';
import { resolvePrefs } from '../notifications/notification-prefs.js';

/** Cài đặt tài khoản (design 05 – C-06): thông báo, quyền riêng tư, ngôn ngữ, đổi email / SĐT, dữ liệu cá nhân */
@Injectable()
export class AccountSettingsService {
  private readonly logger = new Logger(AccountSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly emailCodes: EmailCodeService,
    private readonly mail: EmailSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async get(userId: string): Promise<SeekerSettings> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        emailVerifiedAt: true,
        phone: true,
        phoneVerifiedAt: true,
        passwordHash: true,
        passwordChangedAt: true,
        googleId: true,
        settings: true,
        seekerProfile: { select: { discoverable: true } },
      },
    });
    const s = user.settings;
    return {
      account: {
        email: user.email,
        emailVerified: !!user.email && !!user.emailVerifiedAt,
        phone: user.phone,
        phoneVerified: !!user.phone && !!user.phoneVerifiedAt,
        hasPassword: !!user.passwordHash,
        passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
        googleLinked: !!user.googleId,
      },
      notifications: resolvePrefs(s?.notifyPrefs),
      quietHours: { enabled: s?.quietEnabled ?? true, from: s?.quietFrom ?? '22:00', to: s?.quietTo ?? '07:00' },
      privacy: { discoverable: user.seekerProfile?.discoverable ?? false, phoneVisibility: (s?.phoneVisibility as PhoneVisibility | undefined) ?? 'applied' },
      locale: (s?.locale as Locale | undefined) ?? 'vi',
      theme: (s?.theme as Theme | undefined) ?? 'system',
    };
  }

  async update(userId: string, input: SettingsUpdateInput): Promise<SeekerSettings> {
    const current = await this.prisma.userSetting.findUnique({ where: { userId } });
    const prefs = resolvePrefs(current?.notifyPrefs);
    for (const [group, toggles] of Object.entries(input.notifications ?? {})) {
      Object.assign(prefs[group as keyof typeof prefs], toggles);
    }
    const data = {
      notifyPrefs: prefs as unknown as Prisma.InputJsonValue,
      ...(input.quietHours?.enabled !== undefined && { quietEnabled: input.quietHours.enabled }),
      ...(input.quietHours?.from && { quietFrom: input.quietHours.from }),
      ...(input.quietHours?.to && { quietTo: input.quietHours.to }),
      ...(input.phoneVisibility && { phoneVisibility: input.phoneVisibility }),
      ...(input.locale && { locale: input.locale }),
      ...(input.theme && { theme: input.theme }),
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.userSetting.upsert({ where: { userId }, create: { userId, ...data }, update: data });
      // "Cho phép NTD tìm thấy hồ sơ" nằm ở hồ sơ ứng viên – chỉ áp dụng khi có hồ sơ
      if (input.discoverable !== undefined) await tx.seekerProfile.updateMany({ where: { userId }, data: { discoverable: input.discoverable } });
    });
    return this.get(userId);
  }

  /** Đổi email bước 1: gửi mã tới email mới (email phải chưa thuộc tài khoản khác) */
  async requestEmailChange(userId: string, input: ChangeEmailRequestInput): Promise<EmailOtpSentResponse> {
    const taken = await this.prisma.user.findFirst({ where: { email: input.email, id: { not: userId } }, select: { id: true } });
    if (taken) throw new ApiException('EMAIL_TAKEN', 'Email đã được dùng cho tài khoản khác', HttpStatus.CONFLICT, { email: 'Email đã được sử dụng' });
    let code: string;
    try {
      code = await this.emailCodes.issue(input.email, 'change_email', async (c) => {
        await this.mail.send({ to: input.email, ...accountCodeEmail({ to: input.email, purpose: 'change_email', code: c, expiresMinutes: EMAIL_CODE_TTL_SEC / 60, webBaseUrl: this.env.WEB_BASE_URL }) });
      });
    } catch (e) {
      if (e instanceof ApiException) throw e;
      this.logger.error(`Gửi mã đổi email thất bại tới ${maskEmail(input.email)}: ${(e as Error).message}`);
      throw new ApiException('INTERNAL_ERROR', 'Chưa gửi được email xác nhận. Vui lòng thử lại sau.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return {
      verified: false,
      email: maskEmail(input.email),
      resendAfter: EMAIL_CODE_RESEND_SEC,
      expiresIn: EMAIL_CODE_TTL_SEC,
      ...(this.env.NODE_ENV !== 'production' && { devCode: code }),
    };
  }

  async confirmEmailChange(userId: string, input: ChangeEmailConfirmInput): Promise<SeekerSettings> {
    await this.emailCodes.verify(input.email, 'change_email', input.code);
    const taken = await this.prisma.user.findFirst({ where: { email: input.email, id: { not: userId } }, select: { id: true } });
    if (taken) throw new ApiException('EMAIL_TAKEN', 'Email đã được dùng cho tài khoản khác', HttpStatus.CONFLICT, { email: 'Email đã được sử dụng' });
    await this.prisma.user.update({ where: { id: userId }, data: { email: input.email, emailVerifiedAt: new Date() } });
    return this.get(userId);
  }

  /**
   * Đổi SĐT bước 1: gửi OTP tới số mới. Tài khoản có mật khẩu phải nhập lại mật khẩu.
   * TODO(decision): spec yêu cầu OTP cả số cũ "nếu còn dùng" – hiện thay bằng mật khẩu hiện tại để người mất số cũ vẫn đổi được.
   */
  async requestPhoneChange(userId: string, input: ChangePhoneRequestInput): Promise<OtpSentResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, passwordHash: true } });
    if (user.passwordHash && !(input.currentPassword && (await verifyPassword(input.currentPassword, user.passwordHash)))) {
      throw new ApiException('INVALID_CREDENTIALS', 'Mật khẩu hiện tại không đúng', HttpStatus.BAD_REQUEST, { currentPassword: 'Mật khẩu hiện tại không đúng' });
    }
    if (user.phone === input.phone) throw new ApiException('VALIDATION_ERROR', 'Đây là số điện thoại hiện tại của bạn', HttpStatus.BAD_REQUEST, { phone: 'Số điện thoại không đổi' });
    const taken = await this.prisma.user.findFirst({ where: { phone: input.phone, id: { not: userId } }, select: { id: true } });
    if (taken) throw new ApiException('PHONE_TAKEN', 'Số điện thoại đã thuộc tài khoản khác', HttpStatus.CONFLICT, { phone: 'Số điện thoại đã được sử dụng' });
    return this.otp.send(input.phone, 'change_phone');
  }

  async confirmPhoneChange(userId: string, input: ChangePhoneConfirmInput): Promise<SeekerSettings> {
    await this.otp.verify(input.phone, 'change_phone', input.code);
    const taken = await this.prisma.user.findFirst({ where: { phone: input.phone, id: { not: userId } }, select: { id: true } });
    if (taken) throw new ApiException('PHONE_TAKEN', 'Số điện thoại đã thuộc tài khoản khác', HttpStatus.CONFLICT, { phone: 'Số điện thoại đã được sử dụng' });
    const old = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { phone: input.phone, phoneVerifiedAt: new Date() } }),
      // Hồ sơ NTD dùng chung số liên hệ cũ thì đổi theo
      this.prisma.recruiter.updateMany({ where: { userId, ...(old.phone && { phone: old.phone }) }, data: { phone: input.phone } }),
    ]);
    return this.get(userId);
  }

  /** "Đăng xuất tất cả thiết bị khác" – giữ phiên hiện tại */
  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<{ revoked: number }> {
    const r = await this.prisma.session.updateMany({ where: { userId, id: { not: currentSessionId }, revokedAt: null }, data: { revokedAt: new Date() } });
    return { revoked: r.count };
  }

  /**
   * Tải dữ liệu của tôi (Nghị định 13/2023): chỉ dữ liệu của chính người dùng, không có hash / token / ghi chú nội bộ của NTD.
   */
  async exportData(userId: string): Promise<PersonalDataExport> {
    const [user, applications, saved, alerts, notifications, sessions] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true, role: true, name: true, phone: true, email: true, avatarUrl: true, phoneVerifiedAt: true, emailVerifiedAt: true, createdAt: true, lastLoginAt: true,
          seekerProfile: { omit: { userId: true, consultantId: true } },
          settings: { omit: { userId: true } },
        },
      }),
      this.prisma.application.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          number: true, fullName: true, phone: true, email: true, birthYear: true, gender: true, address: true, note: true, status: true, createdAt: true, updatedAt: true,
          job: { select: { code: true, title: true } },
          events: { select: { status: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.savedJob.findMany({ where: { userId }, select: { createdAt: true, job: { select: { code: true, title: true } } } }),
      this.prisma.jobAlert.findMany({ where: { userId }, select: { name: true, criteria: true, channels: true, frequency: true, enabled: true, createdAt: true } }),
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 500, select: { type: true, title: true, body: true, createdAt: true, readAt: true } }),
      this.prisma.session.findMany({ where: { userId, isAdmin: false }, orderBy: { createdAt: 'desc' }, take: 50, select: { platform: true, deviceName: true, createdAt: true, lastUsedAt: true, revokedAt: true } }),
    ]);
    const { seekerProfile, settings, ...account } = user;
    return {
      exportedAt: new Date().toISOString(),
      account,
      profile: seekerProfile,
      settings,
      applications: applications.map(({ number, ...a }) => ({ code: `HS-${String(number).padStart(6, '0')}`, ...a })),
      savedJobs: saved,
      alerts,
      notifications,
      sessions,
    };
  }
}
