import { Injectable, Logger } from '@nestjs/common';
import type { NotificationItem, Paginated, PaginationQuery } from '@viecpro/shared';
import { pageArgs, paginated } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { type PushMessage, PushSender } from './push-sender.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushSender,
  ) {}

  /** Lưu thông báo trong app + đẩy tới mọi thiết bị mobile của người dùng */
  async notify(userId: string, type: string, message: PushMessage) {
    await this.prisma.notification.create({ data: { userId, type, title: message.title, body: message.body, link: message.link } });
    const tokens = await this.prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
    // Lỗi push không được làm hỏng nghiệp vụ chính
    await this.push.send(tokens.map((t) => t.token), message).catch((e: unknown) => this.logger.warn(`Gửi push lỗi: ${String(e)}`));
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
