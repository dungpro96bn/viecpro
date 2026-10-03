import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { ConversationItem, ConversationMessageItem, ConversationMessages, ConversationListQuery } from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RealtimePublisher } from '../../core/realtime/realtime-publisher.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { EmployerContext } from '../employer-portal/employer-context.service.js';

const PAGE = 50;
type Side = 'employer' | 'seeker';
type Cursor = { at: string; id: string };
const encode = (m: { createdAt: Date; id: string }) => Buffer.from(JSON.stringify({ at: m.createdAt.toISOString(), id: m.id } satisfies Cursor)).toString('base64url');
const decode = (value: string): Cursor => {
  try { const c = JSON.parse(Buffer.from(value, 'base64url').toString()) as Cursor; if (!c.id || !Number.isFinite(Date.parse(c.at))) throw new Error(); return c; }
  catch { throw new ApiException('VALIDATION_ERROR', 'Con trỏ tin nhắn không hợp lệ'); }
};
const flagged = (body: string) => /\b\d{10,16}\b|chuyển\s*khoản|đặt\s*cọc/i.test(body);
const messageItem = (m: { id: string; senderSide: string; senderUserId: string | null; body: string; flagged: boolean; createdAt: Date }): ConversationMessageItem => ({ id: m.id, senderSide: m.senderSide as Side, senderUserId: m.senderUserId, body: m.body, flagged: m.flagged, createdAt: m.createdAt.toISOString() });

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);
  constructor(private readonly prisma: PrismaService, private readonly context: EmployerContext, private readonly notifications: NotificationsService, private readonly realtime: RealtimePublisher) {}

  private async employerScope(userId: string) {
    const actor = await this.context.resolve(userId);
    return this.context.applicationScope(actor);
  }
  private seekerScope(userId: string): Prisma.ApplicationWhereInput { return { userId }; }

  async open(userId: string, applicationId: string) {
    const applicationScope = await this.employerScope(userId);
    const application = await this.prisma.application.findFirst({ where: { id: applicationId, ...applicationScope }, select: { id: true, userId: true } });
    if (!application) throw ApiException.notFound('Không tìm thấy hồ sơ');
    if (!application.userId) throw new ApiException('CONFLICT', 'Hồ sơ nhập thủ công không hỗ trợ tin nhắn', HttpStatus.CONFLICT);
    return this.prisma.conversation.upsert({ where: { applicationId }, create: { applicationId }, update: {} });
  }

  private async conversation(side: Side, userId: string, conversationId: string) {
    const application = side === 'employer' ? await this.employerScope(userId) : this.seekerScope(userId);
    const row = await this.prisma.conversation.findFirst({ where: { id: conversationId, application: { is: application } }, include: { application: { include: { job: { include: { recruiter: { select: { userId: true, name: true } }, employer: { select: { name: true } } } } } }, messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { senderSide: true, createdAt: true } } } });
    if (!row) throw ApiException.notFound('Không tìm thấy cuộc trò chuyện');
    if (!row.application.userId) throw new ApiException('CONFLICT', 'Hồ sơ không hỗ trợ tin nhắn', HttpStatus.CONFLICT);
    return row;
  }

  async list(side: Side, userId: string, query: ConversationListQuery) {
    const application = side === 'employer' ? await this.employerScope(userId) : this.seekerScope(userId);
    const where: Prisma.ConversationWhereInput = { application: { is: { ...application, ...(side === 'employer' && { userId: { not: null } }), ...(side === 'employer' && query.q && { fullName: { contains: query.q, mode: 'insensitive' } }) } } };
    const rows = await this.prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit,
      include: { application: { include: { job: { include: { recruiter: { select: { name: true } }, employer: { select: { name: true } } } } } }, messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 } },
    });
    const items: ConversationItem[] = await Promise.all(rows.map(async (row) => {
      const last = row.messages[0];
      const readAt = side === 'employer' ? row.employerReadAt : row.seekerReadAt;
      const incomingSide = side === 'employer' ? 'seeker' : 'employer';
      const unread = await this.prisma.message.count({ where: { conversationId: row.id, senderSide: incomingSide, ...(readAt && { createdAt: { gt: readAt } }) } });
      return { id: row.id, applicationId: row.applicationId, participantName: side === 'employer' ? row.application.fullName : row.application.job.employer?.name ?? row.application.job.recruiter.name, jobTitle: row.application.job.title, lastMessage: last ? messageItem(last) : null, unread, lastMessageAt: row.lastMessageAt.toISOString() };
    }));
    return { items, page: query.page, limit: query.limit, hasMore: query.page * query.limit < await this.prisma.conversation.count({ where }) };
  }

  async messages(side: Side, userId: string, conversationId: string, before?: string, after?: string): Promise<ConversationMessages> {
    await this.conversation(side, userId, conversationId);
    const cursor = before ? decode(before) : after ? decode(after) : null;
    const where: Prisma.MessageWhereInput = { conversationId, ...(after && cursor ? { OR: [{ createdAt: { gt: new Date(cursor.at) } }, { createdAt: new Date(cursor.at), id: { gt: cursor.id } }] } : before && cursor ? { OR: [{ createdAt: { lt: new Date(cursor.at) } }, { createdAt: new Date(cursor.at), id: { lt: cursor.id } }] } : {}) };
    const rows = await this.prisma.message.findMany({ where, orderBy: [{ createdAt: before ? 'desc' : 'asc' }, { id: before ? 'desc' : 'asc' }], take: PAGE });
    const ordered = before ? rows.reverse() : rows;
    const items = ordered.map(messageItem);
    return { items, before: items.length ? encode(ordered[0]!) : null, after: items.length ? encode(ordered[items.length - 1]!) : null };
  }

  async send(side: Side, userId: string, conversationId: string, body: string) {
    const conversation = await this.conversation(side, userId, conversationId);
    const now = new Date();
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({ data: { conversationId, senderUserId: userId, senderSide: side, body, flagged: flagged(body), createdAt: now } });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
      return created;
    });
    const app = conversation.application;
    const recipientReadAt = side === 'employer' ? conversation.seekerReadAt : conversation.employerReadAt;
    const lastMessage = conversation.messages[0];
    const recipientSide = side === 'employer' ? 'seeker' : 'employer';
    const shouldNotify = !lastMessage || lastMessage.senderSide === recipientSide || !!recipientReadAt && lastMessage.createdAt <= recipientReadAt || Date.now() - lastMessage.createdAt.getTime() >= 10 * 60_000;
    await this.realtime.publish(`conversation:${conversationId}`, { type: 'message.new', message: messageItem(message) }).catch((e: unknown) => this.logger.warn(`Không phát được sự kiện realtime: ${String(e)}`));
    if (shouldNotify) {
      const assignee = side === 'seeker' && app.assigneeId ? await this.prisma.recruiter.findUnique({ where: { id: app.assigneeId }, select: { userId: true } }) : null;
      const recipientId = side === 'employer' ? app.userId : assignee?.userId ?? app.job.recruiter.userId;
      if (recipientId) await this.notifications.notify(recipientId, 'message.new', { title: 'Bạn có tin nhắn mới', body: body.slice(0, 160), link: side === 'employer' ? '/tai-khoan-ung-vien/tin-nhan' : '/quan-ly-tuyen-dung/tin-nhan' }).catch((e: unknown) => this.logger.warn(`Không gửi được thông báo tin nhắn: ${String(e)}`));
    }
    return messageItem(message);
  }

  async read(side: Side, userId: string, conversationId: string) {
    await this.conversation(side, userId, conversationId);
    await this.prisma.conversation.update({ where: { id: conversationId }, data: side === 'employer' ? { employerReadAt: new Date() } : { seekerReadAt: new Date() } });
  }

  async unreadCount(side: Side, userId: string) {
    const application = side === 'employer' ? await this.employerScope(userId) : this.seekerScope(userId);
    const rows = await this.prisma.conversation.findMany({ where: { application: { is: application } }, select: { id: true, employerReadAt: true, seekerReadAt: true } });
    const incoming = side === 'employer' ? 'seeker' : 'employer';
    const unread = await Promise.all(rows.map((r) => {
      const readAt = side === 'employer' ? r.employerReadAt : r.seekerReadAt;
      return this.prisma.message.count({ where: { conversationId: r.id, senderSide: incoming, ...(readAt && { createdAt: { gt: readAt } }) } });
    }));
    return { unread: unread.reduce((sum, count) => sum + count, 0) };
  }
}
