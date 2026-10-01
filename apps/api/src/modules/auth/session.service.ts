import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Platform, Role } from '@viecpro/shared';
import { createHash, randomBytes } from 'node:crypto';
import { ENV, type Env } from '../../config/env.js';
import type { AuthPayload } from '../../core/auth/auth.decorators.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

export interface DeviceInfo {
  platform: Platform;
  deviceName?: string;
  userAgent?: string;
  ip?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
}

/** Phiên admin: access 10 phút, hạn tuyệt đối 12 giờ (RULE-BE.md mục 7) */
const ADMIN_ACCESS_TTL = 600;
const ADMIN_SESSION_HOURS = 12;
/** Khoảng cho phép 2 lần refresh song song bằng cùng token mà không bị coi là lộ token */
const REUSE_GRACE_MS = 30_000;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const expired = () => new ApiException('TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', HttpStatus.UNAUTHORIZED);

/**
 * Phiên đăng nhập theo thiết bị.
 * - Access token (JWT, ngắn hạn) gửi qua header Authorization.
 * - Refresh token (chuỗi ngẫu nhiên, lưu hash) xoay vòng mỗi lần refresh;
 *   token cũ bị dùng lại → coi như bị lộ, thu hồi cả phiên.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private newRefreshToken() {
    const token = randomBytes(48).toString('base64url');
    return { token, hash: sha256(token) };
  }

  private refreshExpiry(admin: boolean, absolute?: Date | null) {
    const sliding = new Date(Date.now() + this.env.REFRESH_TTL_DAYS * 86400_000);
    if (!admin || !absolute) return sliding;
    return absolute < sliding ? absolute : sliding;
  }

  private async signAccess(userId: string, role: Role, sessionId: string, admin: boolean) {
    const payload: AuthPayload = { sub: userId, role, sid: sessionId, ...(admin && { adm: true }) };
    return this.jwt.signAsync(payload, admin ? { expiresIn: ADMIN_ACCESS_TTL } : undefined);
  }

  private accessTtl(admin: boolean) {
    return admin ? ADMIN_ACCESS_TTL : this.env.JWT_ACCESS_TTL;
  }

  async create(userId: string, role: Role, device: DeviceInfo, opts: { admin?: boolean } = {}): Promise<IssuedTokens> {
    const admin = !!opts.admin;
    const absoluteExpiresAt = admin ? new Date(Date.now() + ADMIN_SESSION_HOURS * 3600_000) : null;
    const { token, hash } = this.newRefreshToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hash,
        isAdmin: admin,
        absoluteExpiresAt,
        platform: device.platform,
        deviceName: device.deviceName,
        userAgent: device.userAgent?.slice(0, 300),
        ip: device.ip,
        expiresAt: this.refreshExpiry(admin, absoluteExpiresAt),
      },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    return { accessToken: await this.signAccess(userId, role, session.id, admin), refreshToken: token, expiresIn: this.accessTtl(admin), sessionId: session.id };
  }

  /** Đổi refresh token lấy cặp token mới. `admin` phải khớp loại phiên (web / app không dùng được phiên admin và ngược lại). */
  async rotate(refreshToken: string, opts: { admin?: boolean } = {}): Promise<IssuedTokens & { userId: string }> {
    const admin = !!opts.admin;
    const hash = sha256(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: { select: { role: true, deletedAt: true, lockedAt: true } } },
    });

    if (!session) {
      // Token đã xoay bị dùng lại → thu hồi phiên.
      // Ngoại lệ: trong 30 giây sau lần xoay (2 request refresh chạy song song) chỉ từ chối, không thu hồi.
      const reused = await this.prisma.session.findUnique({ where: { previousTokenHash: hash }, select: { id: true, userId: true, lastUsedAt: true } });
      if (reused && Date.now() - reused.lastUsedAt.getTime() > REUSE_GRACE_MS) {
        await this.revoke(reused.id);
        this.logger.warn(`Refresh token bị dùng lại – đã thu hồi phiên ${reused.id} của user ${reused.userId}`);
      }
      throw expired();
    }

    const now = Date.now();
    const invalid =
      session.isAdmin !== admin ||
      session.revokedAt ||
      session.expiresAt.getTime() < now ||
      (session.absoluteExpiresAt && session.absoluteExpiresAt.getTime() < now) ||
      session.user.deletedAt ||
      session.user.lockedAt;
    if (invalid) throw expired();

    const next = this.newRefreshToken();
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: next.hash,
        previousTokenHash: hash,
        lastUsedAt: new Date(),
        expiresAt: this.refreshExpiry(admin, session.absoluteExpiresAt),
      },
    });
    return {
      userId: session.userId,
      accessToken: await this.signAccess(session.userId, session.user.role, session.id, admin),
      refreshToken: next.token,
      expiresIn: this.accessTtl(admin),
      sessionId: session.id,
    };
  }

  /** Phiên còn hiệu lực + tài khoản còn hoạt động – dùng cho guard admin (kiểm tra DB mỗi request) */
  async isActive(sessionId: string, userId: string) {
    const s = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { absoluteExpiresAt: true, isAdmin: true, user: { select: { lockedAt: true, deletedAt: true } } },
    });
    if (!s || s.user.lockedAt || s.user.deletedAt) return null;
    if (s.absoluteExpiresAt && s.absoluteExpiresAt.getTime() < Date.now()) return null;
    return s;
  }

  async revoke(sessionId: string, userId?: string) {
    return this.prisma.session.updateMany({ where: { id: sessionId, ...(userId && { userId }), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAll(userId: string) {
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async list(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, isAdmin: false, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }
}
