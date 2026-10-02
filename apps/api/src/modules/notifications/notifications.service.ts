import { Injectable, Logger } from '@nestjs/common';
import type { NotificationItem, Paginated, PaginationQuery } from '@viecpro/shared';
import { pageArgs, paginated } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { groupOf, isQuietTime, resolvePrefs } from './notification-prefs.js';
import { type PushMessage, PushSender } from './push-sender.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushSender,
  ) {}

  /**
   * Lưu thông báo trong app + đẩy tới mọi thiết bị mobile của người dùng.
   * Push tôn trọng Cài đặt: tắt kênh App của nhóm thì không đẩy; trong giờ yên lặng không đẩy (spec 3.11).
   * Thông báo trong app luôn được lưu.
   */
  async notify(userId: string, type: string, message: PushMessage) {
    await this.prisma.notification.create({ data: { userId, type, title: message.title, body: message.body, link: message.link } });
    if (!(await this.pushAllowed(userId, type))) return;
    const tokens = await this.prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
    // Lỗi push không được làm hỏng nghiệp vụ chính
    await this.push.send(tokens.map((t) => t.token), message).catch((e: unknown) => this.logger.warn(`Gửi push lỗi: ${String(e)}`));
  }

  /** Kênh push của nhóm còn bật và không nằm trong giờ yên lặng */
  async pushAllowed(userId: string, type: string, now = new Date()): Promise<boolean> {
    const settings = await this.prisma.userSetting.findUnique({ where: { userId }, select: { notifyPrefs: true, quietEnabled: true, quietFrom: true, quietTo: true } });
    if (!settings) return !isQuietTime(now, '22:00', '07:00');
    if (!resolvePrefs(settings.notifyPrefs)[groupOf(type)].app) return false;
    return !(settings.quietEnabled && isQuietTime(now, settings.quietFrom, settings.quietTo));
  }

  async list(userId: string, query: PaginationQuery): Promise<Paginated<NotificationItem> & { unread: number }> {
    const where = { userId };
    const [rows, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    const items = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
    return { ...paginated(items, total, query), unread };
  }

  async markRead(userId: string, id?: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null, ...(id && { id }) }, data: { readAt: new Date() } });
  }
}
