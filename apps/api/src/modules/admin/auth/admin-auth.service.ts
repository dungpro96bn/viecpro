import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ADMIN_PERMISSIONS,
  type AdminLoginInput,
  type AdminLoginResult,
  type AdminMe,
  type AdminMfaInput,
  type AdminMfaSetupInput,
  type AdminPermission,
} from '@viecpro/shared';
import type { Request } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { ENV, type Env } from '../../../config/env.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import { ApiException } from '../../../core/http/api-exception.js';
import { PrismaService } from '../../../core/prisma/prisma.service.js';
import { SecretBox } from '../../../core/security/secret-box.js';
import { generateTotpSecret, otpauthUrl, verifyTotp } from '../../../core/security/totp.js';
import { assertNotTemporarilyLocked, clearFailedLogins, invalidCredentials, registerFailedLogin } from '../../auth/login-guard.js';
import { verifyPassword } from '../../auth/password.js';
import { type IssuedTokens, SessionService } from '../../auth/session.service.js';

const CHALLENGE_TTL = 300;
const RECOVERY_CODES = 8;

interface Challenge {
  sub: string;
  purpose: 'admin_mfa';
  stage: 'verify' | 'setup';
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const normalizeRecovery = (s: string) => s.replace(/[^a-z0-9]/gi, '').toUpperCase();

const adminSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  deletedAt: true,
  lockedAt: true,
  failedLogins: true,
  loginLockedUntil: true,
  passwordHash: true,
  mfaSecretEnc: true,
  mfaEnabledAt: true,
  mfaRecoveryHashes: true,
  adminRole: { select: { key: true, name: true, permissions: true } },
} as const;

/**
 * Đăng nhập khu quản trị: mật khẩu → 2FA (TOTP) bắt buộc.
 * Lần đầu chưa bật 2FA: trả khoá bí mật để quét QR, nhập đúng mã mới cấp phiên.
 */
@Injectable()
export class AdminAuthService {
  private readonly box: SecretBox;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.box = new SecretBox(env.ADMIN_MFA_KEY);
  }

  private challenge(sub: string, stage: Challenge['stage']) {
    const payload: Challenge = { sub, purpose: 'admin_mfa', stage };
    return this.jwt.signAsync(payload, { expiresIn: CHALLENGE_TTL });
  }

  private async readChallenge(token: string, stage: Challenge['stage']) {
    try {
      const c = await this.jwt.verifyAsync<Challenge>(token);
      if (c.purpose !== 'admin_mfa' || c.stage !== stage) throw new Error('sai loại');
      return c;
    } catch {
      throw new ApiException('TOKEN_EXPIRED', 'Phiên xác thực đã hết hạn, vui lòng đăng nhập lại', HttpStatus.UNAUTHORIZED);
    }
  }

  private async loadAdmin(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: adminSelect });
    if (!user || user.role !== 'admin' || user.deletedAt || user.lockedAt || !user.adminRole) throw invalidCredentials();
    return user;
  }

  toMe(user: { id: string; name: string; email: string | null; mfaEnabledAt: Date | null; adminRole: { key: string; name: string; permissions: string[] } | null }): AdminMe {
    return {
      id: user.id,
      name: user.name,
      email: user.email ?? '',
      role: { key: user.adminRole?.key ?? '', name: user.adminRole?.name ?? '' },
      permissions: (user.adminRole?.permissions ?? []).filter((p): p is AdminPermission => (ADMIN_PERMISSIONS as readonly string[]).includes(p)),
      mfaEnabled: !!user.mfaEnabledAt,
    };
  }

  async me(id: string): Promise<AdminMe> {
    return this.toMe(await this.loadAdmin(id));
  }

  /** Bước 1: email + mật khẩu; khi bật cờ thử nghiệm local thì cấp phiên ngay */
  async login(input: AdminLoginInput, req: Request): Promise<{ result: AdminLoginResult; tokens?: IssuedTokens }> {
    const found = await this.prisma.user.findUnique({ where: { email: input.email }, select: adminSelect });
    const user = found && found.role === 'admin' && !found.deletedAt && found.adminRole ? found : null;

    await assertNotTemporarilyLocked(user);
    const ok = user?.passwordHash && (await verifyPassword(input.password, user.passwordHash));
    if (!user || !ok) {
      if (user) await registerFailedLogin(this.prisma, user);
      throw invalidCredentials();
    }
    if (user.lockedAt) throw ApiException.forbidden('Tài khoản quản trị đã bị khoá');

    if (this.env.ADMIN_MFA_BYPASS) {
      await clearFailedLogins(this.prisma, user);
      const tokens = await this.sessions.create(user.id, 'admin', { platform: 'web', userAgent: req.headers['user-agent'], ip: req.ip }, { admin: true });
      await this.audit.log({ actorId: user.id, action: 'admin.login_mfa_bypassed', targetType: 'session', targetId: tokens.sessionId }, req);
      return { result: { step: 'done', accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, admin: this.toMe(user) }, tokens };
    }

    if (user.mfaEnabledAt) return { result: { step: 'mfa', challengeToken: await this.challenge(user.id, 'verify') } };

    // Chưa bật 2FA: tạo khoá mới (ghi đè khoá dở dang trước đó)
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaSecretEnc: this.box.encrypt(secret) } });
    return { result: {
      step: 'mfa_setup',
      challengeToken: await this.challenge(user.id, 'setup'),
      secret,
      otpauthUrl: otpauthUrl(secret, user.email ?? user.id),
    } };
  }

  /** Bước 2: mã 2FA hoặc mã khôi phục → cấp phiên admin */
  async verifyMfa(input: AdminMfaInput, req: Request): Promise<{ result: AdminLoginResult; tokens: IssuedTokens }> {
    const { sub } = await this.readChallenge(input.challengeToken, 'verify');
    const user = await this.loadAdmin(sub);
    await assertNotTemporarilyLocked(user);
    if (!user.mfaSecretEnc || !user.mfaEnabledAt) throw invalidCredentials();

    let usedRecovery: string | null = null;
    let ok = false;
    if (input.code) {
      ok = verifyTotp(this.box.decrypt(user.mfaSecretEnc), input.code);
    } else if (input.recoveryCode) {
      const hash = sha256(normalizeRecovery(input.recoveryCode));
      ok = user.mfaRecoveryHashes.includes(hash);
      if (ok) usedRecovery = hash;
    }
    if (!ok) {
      await registerFailedLogin(this.prisma, user);
      throw new ApiException('OTP_INVALID', 'Mã xác thực không đúng');
    }

    await clearFailedLogins(this.prisma, user);
    if (usedRecovery) {
      await this.prisma.user.update({ where: { id: user.id }, data: { mfaRecoveryHashes: user.mfaRecoveryHashes.filter((h) => h !== usedRecovery) } });
    }
    const tokens = await this.sessions.create(user.id, 'admin', { platform: 'web', userAgent: req.headers['user-agent'], ip: req.ip }, { admin: true });
    await this.audit.log({ actorId: user.id, action: usedRecovery ? 'admin.login_recovery_code' : 'admin.login', targetType: 'session', targetId: tokens.sessionId }, req);
    return { result: { step: 'done', accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, admin: this.toMe(user) }, tokens };
  }

  /** Lần đầu: xác nhận mã từ ứng dụng xác thực → bật 2FA, cấp mã khôi phục và phiên */
  async setupMfa(input: AdminMfaSetupInput, req: Request): Promise<{ result: AdminLoginResult; tokens: IssuedTokens }> {
    const { sub } = await this.readChallenge(input.challengeToken, 'setup');
    const user = await this.loadAdmin(sub);
    if (user.mfaEnabledAt || !user.mfaSecretEnc) throw invalidCredentials();
    if (!verifyTotp(this.box.decrypt(user.mfaSecretEnc), input.code)) {
      await registerFailedLogin(this.prisma, user);
      throw new ApiException('OTP_INVALID', 'Mã xác thực không đúng, kiểm tra lại giờ trên điện thoại');
    }

    const recoveryCodes = Array.from({ length: RECOVERY_CODES }, () => {
      const raw = randomBytes(5).toString('hex').toUpperCase();
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabledAt: new Date(), mfaRecoveryHashes: recoveryCodes.map((c) => sha256(normalizeRecovery(c))), failedLogins: 0, loginLockedUntil: null },
      select: adminSelect,
    });
    const tokens = await this.sessions.create(user.id, 'admin', { platform: 'web', userAgent: req.headers['user-agent'], ip: req.ip }, { admin: true });
    await this.audit.log({ actorId: user.id, action: 'admin.mfa_enabled', targetType: 'user', targetId: user.id }, req);
    return {
      result: { step: 'done', accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, admin: this.toMe(updated), recoveryCodes },
      tokens,
    };
  }

  async refresh(refreshToken: string) {
    const tokens = await this.sessions.rotate(refreshToken, { admin: true });
    return { tokens, admin: await this.me(tokens.userId) };
  }

  async logout(adminId: string, sessionId: string, req: Request) {
    await this.sessions.revoke(sessionId, adminId);
    await this.audit.log({ actorId: adminId, action: 'admin.logout', targetType: 'session', targetId: sessionId }, req);
  }
}
