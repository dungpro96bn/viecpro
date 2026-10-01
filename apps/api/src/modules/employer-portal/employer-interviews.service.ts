import { HttpStatus, Injectable } from '@nestjs/common';
import {
  INTERVIEW_KINDS,
  WEB_LINKS,
  jobShortTitle,
  type EmployerInterviewItem,
  type EmployerInterviewWeek,
  type InterviewKind,
  type InterviewRangeQuery,
  type InterviewRescheduleInput,
  type InterviewResultInput,
} from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { type EmployerActor, EmployerContext } from './employer-context.service.js';
import { startOfDay } from './employer-stats.js';

export const interviewInclude = {
  attendees: {
    select: {
      status: true,
      application: { select: { id: true, fullName: true, phone: true, userId: true, job: { select: { title: true, position: true, industry: true, pref: true } } } },
    },
  },
  interviewers: { select: { id: true, name: true, title: true, photoUrl: true } },
} satisfies Prisma.InterviewInclude;

type InterviewRow = Prisma.InterviewGetPayload<{ include: typeof interviewInclude }>;

const pad = (n: number) => String(n).padStart(2, '0');
const viTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

/** Lịch phỏng vấn (design 14): tuần, thống kê, dời lịch, ghi kết quả, huỷ */
@Injectable()
export class EmployerInterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
    private readonly assets: AssetUrlService,
    private readonly notifications: NotificationsService,
  ) {}

  toItem(i: InterviewRow): EmployerInterviewItem {
    return {
      id: i.id,
      kind: i.kind,
      status: i.status,
      startAt: i.startAt.toISOString(),
      endAt: i.endAt.toISOString(),
      platform: i.platform,
      meetingUrl: i.meetingUrl,
      location: i.location,
      partnerName: i.partnerName,
      note: i.note,
      result: i.result,
      channels: i.channels,
      attendees: i.attendees.map((a) => ({
        applicationId: a.application.id,
        fullName: a.application.fullName,
        phone: a.application.phone,
        jobShortTitle: jobShortTitle(a.application.job),
        status: a.status,
      })),
      interviewers: i.interviewers.map((r) => ({ id: r.id, name: r.name, title: r.title, photoUrl: this.assets.url(r.photoUrl) })),
    };
  }

  async week(userId: string, range: InterviewRangeQuery): Promise<EmployerInterviewWeek> {
    const actor = await this.ctx.resolve(userId);
    const scope = this.ctx.interviewScope(actor);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [rows, attendance] = await Promise.all([
      this.prisma.interview.findMany({
        where: { ...scope, status: { not: 'cancelled' }, startAt: { gte: range.from, lt: range.to } },
        orderBy: { startAt: 'asc' },
        include: interviewInclude,
      }),
      this.prisma.interviewAttendee.findMany({
        where: { interview: { ...scope, startAt: { gte: prevMonthStart, lt: now } }, status: { in: ['attended', 'no_show'] } },
        select: { status: true, interview: { select: { startAt: true } } },
      }),
    ]);

    const items = rows.map((r) => this.toItem(r));
    const todayEnd = new Date(startOfDay(now).getTime() + 86400_000);
    const upcoming = items.filter((i) => new Date(i.endAt) > now && i.status === 'scheduled');
    const allConfirmed = (i: EmployerInterviewItem) => i.attendees.length > 0 && i.attendees.every((a) => a.status === 'confirmed' || a.status === 'attended');
    const noShow = (from: Date, to: Date) => {
      const list = attendance.filter((a) => a.interview.startAt >= from && a.interview.startAt < to);
      return list.length ? Math.round((list.filter((a) => a.status === 'no_show').length / list.length) * 100) : null;
    };

    const counts = new Map<string, number>();
    const people = new Map<string, EmployerInterviewItem['interviewers'][number]>();
    for (const i of items) {
      for (const r of i.interviewers) {
        counts.set(r.id, (counts.get(r.id) ?? 0) + 1);
        people.set(r.id, r);
      }
    }

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      items,
      stats: {
        total: items.length,
        remainingToday: upcoming.filter((i) => new Date(i.startAt) < todayEnd).length,
        confirmed: items.filter(allConfirmed).length,
        pending: upcoming.filter((i) => i.attendees.some((a) => a.status === 'pending')).length,
        noShowRate: noShow(monthStart, now),
        noShowRatePrev: noShow(prevMonthStart, monthStart),
      },
      kindCounts: Object.fromEntries(INTERVIEW_KINDS.map((k) => [k, items.filter((i) => i.kind === k).length])) as Record<InterviewKind, number>,
      interviewers: [...people.values()].map((p) => ({ ...p, count: counts.get(p.id) ?? 0 })).sort((a, b) => b.count - a.count),
    };
  }

  /** Lịch hẹn thuộc phạm vi NTD – điều kiện sở hữu trong câu truy vấn, không có quyền → 404 */
  private async own(actor: EmployerActor, id: string) {
    const row = await this.prisma.interview.findFirst({ where: { id, ...this.ctx.interviewScope(actor) }, include: interviewInclude });
    if (!row) throw ApiException.notFound('Không tìm thấy lịch hẹn');
    return row;
  }

  async detail(userId: string, id: string): Promise<EmployerInterviewItem> {
    return this.toItem(await this.own(await this.ctx.resolve(userId), id));
  }

  /** Dời lịch: ứng viên phải xác nhận lại, báo cho ứng viên có tài khoản */
  async reschedule(userId: string, id: string, input: InterviewRescheduleInput): Promise<EmployerInterviewItem> {
    const actor = await this.ctx.resolve(userId);
    const row = await this.own(actor, id);
    if (row.status !== 'scheduled') throw new ApiException('CONFLICT', 'Lịch hẹn đã kết thúc hoặc đã huỷ', HttpStatus.CONFLICT);
    if (input.startAt.getTime() < Date.now()) throw new ApiException('VALIDATION_ERROR', 'Không dời lịch về thời điểm đã qua', HttpStatus.BAD_REQUEST, { startAt: 'Chọn thời gian trong tương lai' });
    const appIds = row.attendees.map((a) => a.application.id);
    await this.prisma.$transaction([
      this.prisma.interview.update({ where: { id }, data: { startAt: input.startAt, endAt: input.endAt, ...(input.note && { note: input.note }) } }),
      this.prisma.interviewAttendee.updateMany({ where: { interviewId: id }, data: { status: 'pending', respondedAt: null } }),
      this.prisma.application.updateMany({ where: { id: { in: appIds } }, data: { interviewAt: input.startAt } }),
      this.prisma.applicationEvent.createMany({ data: appIds.map((applicationId) => ({ applicationId, status: 'interview' as const, note: `Dời lịch phỏng vấn sang ${viTime(input.startAt)}` })) }),
    ]);
    for (const a of row.attendees) {
      if (!a.application.userId) continue;
      await this.notifications.notify(a.application.userId, 'interview.rescheduled', {
        title: `Lịch phỏng vấn đổi sang ${viTime(input.startAt)}`,
        body: a.application.job.title,
        link: WEB_LINKS.seekerApplications,
      });
    }
    return this.toItem(await this.own(actor, id));
  }

  /** Ghi kết quả: ai tham gia / vắng mặt, kết thúc buổi hẹn */
  async recordResult(userId: string, id: string, input: InterviewResultInput): Promise<EmployerInterviewItem> {
    const actor = await this.ctx.resolve(userId);
    const row = await this.own(actor, id);
    if (row.status === 'cancelled') throw new ApiException('CONFLICT', 'Lịch hẹn đã huỷ', HttpStatus.CONFLICT);
    if (row.startAt.getTime() > Date.now()) throw new ApiException('CONFLICT', 'Buổi hẹn chưa diễn ra', HttpStatus.CONFLICT);
    const known = new Set(row.attendees.map((a) => a.application.id));
    if (input.attendees.some((a) => !known.has(a.applicationId))) throw ApiException.notFound('Ứng viên không thuộc lịch hẹn này');
    await this.prisma.$transaction([
      ...input.attendees.map((a) =>
        this.prisma.interviewAttendee.update({
          where: { interviewId_applicationId: { interviewId: id, applicationId: a.applicationId } },
          data: { status: a.status, respondedAt: new Date() },
        }),
      ),
      this.prisma.interview.update({ where: { id }, data: { status: 'done', result: input.result ?? null } }),
    ]);
    return this.toItem(await this.own(actor, id));
  }

  async cancel(userId: string, id: string): Promise<void> {
    const actor = await this.ctx.resolve(userId);
    const row = await this.own(actor, id);
    if (row.status !== 'scheduled') throw new ApiException('CONFLICT', 'Lịch hẹn đã kết thúc hoặc đã huỷ', HttpStatus.CONFLICT);
    await this.prisma.$transaction([
      this.prisma.interview.update({ where: { id }, data: { status: 'cancelled' } }),
      this.prisma.application.updateMany({ where: { id: { in: row.attendees.map((a) => a.application.id) }, interviewAt: row.startAt }, data: { interviewAt: null } }),
    ]);
    for (const a of row.attendees) {
      if (!a.application.userId) continue;
      await this.notifications.notify(a.application.userId, 'interview.cancelled', { title: `Lịch phỏng vấn ${viTime(row.startAt)} đã huỷ`, body: a.application.job.title, link: WEB_LINKS.seekerApplications });
    }
  }
}
