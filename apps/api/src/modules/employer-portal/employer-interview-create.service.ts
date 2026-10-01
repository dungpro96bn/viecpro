import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  MEETING_PLATFORM_LABEL,
  STAGE_OF_STATUS,
  WEB_LINKS,
  jobShortTitle,
  type EmployerInterviewItem,
  type InterviewAvailability,
  type InterviewAvailabilityQuery,
  type InterviewCandidate,
  type InterviewCandidatesQuery,
  type InterviewCreateInput,
} from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { ENV, type Env } from '../../config/env.js';
import { ApiException } from '../../core/http/api-exception.js';
import { EmailSender } from '../../core/mail/email-sender.js';
import { interviewInviteEmail } from '../../core/mail/templates/interview.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { EmployerContext } from './employer-context.service.js';
import { EmployerInterviewsService, interviewInclude } from './employer-interviews.service.js';
import { startOfDay } from './employer-stats.js';

const DAY = 86400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const viTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

/** Trạng thái hồ sơ còn mời phỏng vấn được */
const INVITABLE = ['submitted', 'viewed', 'interview'] as const;

/** Tạo lịch hẹn (design 17): ứng viên chờ hẹn, lịch bận người phỏng vấn, tạo & gửi lời mời */
@Injectable()
export class EmployerInterviewCreateService {
  private readonly logger = new Logger(EmployerInterviewCreateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
    private readonly interviews: EmployerInterviewsService,
    private readonly notifications: NotificationsService,
    private readonly mail: EmailSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Ứng viên chờ hẹn (mới / đã liên hệ, chưa có lịch), cùng các hồ sơ được chọn sẵn qua `ids` */
  async candidates(userId: string, q: InterviewCandidatesQuery): Promise<InterviewCandidate[]> {
    const actor = await this.ctx.resolve(userId);
    const scope = this.ctx.applicationScope(actor);
    const select = { id: true, fullName: true, gender: true, birthYear: true, hometown: true, phone: true, matchScore: true, status: true, job: { select: { position: true, industry: true, pref: true } } } as const;
    const search: Prisma.ApplicationWhereInput | undefined = q.q ? { OR: [{ fullName: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q.replace(/\D/g, '') || q.q } }] } : undefined;
    const [picked, waiting] = await Promise.all([
      q.ids?.length ? this.prisma.application.findMany({ where: { ...scope, id: { in: q.ids }, status: { in: [...INVITABLE] } }, select }) : [],
      this.prisma.application.findMany({
        where: { ...scope, ...search, status: { in: ['submitted', 'viewed'] }, interviewAt: null },
        select,
        orderBy: [{ matchScore: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: 20,
      }),
    ]);
    const year = new Date().getFullYear();
    const seen = new Set<string>();
    return [...picked, ...waiting]
      .filter((a) => !seen.has(a.id) && seen.add(a.id))
      .map((a) => ({
        applicationId: a.id,
        fullName: a.fullName,
        gender: a.gender,
        age: year - a.birthYear,
        hometown: a.hometown,
        phone: a.phone,
        jobShortTitle: jobShortTitle(a.job),
        matchScore: a.matchScore,
        stage: STAGE_OF_STATUS[a.status],
      }));
  }

  /** Khung bận của người phỏng vấn (chỉ cán bộ trong phạm vi NTD) trong N ngày */
  async availability(userId: string, q: InterviewAvailabilityQuery): Promise<InterviewAvailability> {
    const actor = await this.ctx.resolve(userId);
    const from = startOfDay(q.from);
    const to = new Date(from.getTime() + q.days * DAY);
    const team = await this.prisma.recruiter.findMany({ where: { ...this.ctx.teamScope(actor), ...(q.interviewerIds?.length && { id: { in: q.interviewerIds } }) }, select: { id: true } });
    const ids = team.map((t) => t.id);
    const rows = ids.length
      ? await this.prisma.interview.findMany({
          where: { status: 'scheduled', startAt: { lt: to }, endAt: { gt: from }, interviewers: { some: { id: { in: ids } } } },
          select: { startAt: true, endAt: true, kind: true, interviewers: { where: { id: { in: ids } }, select: { id: true } } },
          orderBy: { startAt: 'asc' },
        })
      : [];
    return {
      days: Array.from({ length: q.days }, (_, i) => {
        const dayStart = new Date(from.getTime() + i * DAY);
        const dayEnd = new Date(dayStart.getTime() + DAY);
        return {
          date: dayStart.toISOString(),
          busy: rows
            .filter((r) => r.startAt < dayEnd && r.endAt > dayStart)
            .flatMap((r) => r.interviewers.map((p) => ({ recruiterId: p.id, start: r.startAt.toISOString(), end: r.endAt.toISOString(), kind: r.kind }))),
        };
      }),
    };
  }

  async create(userId: string, input: InterviewCreateInput): Promise<EmployerInterviewItem> {
    const actor = await this.ctx.resolve(userId);
    const startAt = input.startAt;
    const endAt = new Date(startAt.getTime() + input.durationMinutes * 60_000);
    if (startAt.getTime() < Date.now()) throw new ApiException('VALIDATION_ERROR', 'Không hẹn vào thời điểm đã qua', HttpStatus.BAD_REQUEST, { startAt: 'Chọn thời gian trong tương lai' });

    const appIds = [...new Set(input.applicationIds)];
    const apps = await this.prisma.application.findMany({
      where: { ...this.ctx.applicationScope(actor), id: { in: appIds } },
      select: { id: true, status: true, userId: true, fullName: true, email: true, job: { select: { title: true, employer: { select: { name: true } } } } },
    });
    // Hồ sơ ngoài phạm vi NTD coi như không tồn tại
    if (apps.length !== appIds.length) throw ApiException.notFound('Không tìm thấy ứng viên');
    if (apps.some((a) => !(INVITABLE as readonly string[]).includes(a.status))) {
      throw new ApiException('CONFLICT', 'Có ứng viên đã đậu, bị loại hoặc đã rút hồ sơ', HttpStatus.CONFLICT, { applicationIds: 'Bỏ ứng viên không còn mời được' });
    }

    const interviewerIds = [...new Set(input.interviewerIds)];
    const people = await this.prisma.recruiter.findMany({ where: { ...this.ctx.teamScope(actor), id: { in: interviewerIds } }, select: { id: true, name: true } });
    if (people.length !== interviewerIds.length) throw new ApiException('VALIDATION_ERROR', 'Người phỏng vấn không thuộc doanh nghiệp', HttpStatus.BAD_REQUEST, { interviewerIds: 'Chọn cán bộ trong doanh nghiệp' });

    const clash = await this.prisma.interview.findFirst({
      where: { status: 'scheduled', startAt: { lt: endAt }, endAt: { gt: startAt }, interviewers: { some: { id: { in: interviewerIds } } } },
      select: { interviewers: { where: { id: { in: interviewerIds } }, select: { name: true } } },
    });
    if (clash) {
      throw new ApiException('SLOT_TAKEN', `${clash.interviewers.map((p) => p.name).join(', ')} đã có lịch trong khung giờ này`, HttpStatus.CONFLICT, { startAt: 'Chọn khung giờ khác' });
    }

    const id = await this.prisma.$transaction(async (tx) => {
      const created = await tx.interview.create({
        data: {
          kind: input.kind,
          startAt,
          endAt,
          platform: input.kind === 'online' ? input.platform : null,
          meetingUrl: input.kind === 'online' ? input.meetingUrl : null,
          location: input.kind === 'online' ? null : input.location,
          note: input.note,
          partnerName: input.partnerName,
          channels: input.channels,
          remind24h: input.remind24h,
          remind2h: input.remind2h,
          employerId: actor.employerId,
          ownerId: actor.recruiterId,
          interviewers: { connect: interviewerIds.map((i) => ({ id: i })) },
          attendees: { create: appIds.map((applicationId) => ({ applicationId })) },
        },
        select: { id: true },
      });
      await tx.application.updateMany({ where: { id: { in: appIds } }, data: { status: 'interview', interviewAt: startAt, contactedAt: new Date() } });
      await tx.applicationEvent.createMany({ data: appIds.map((applicationId) => ({ applicationId, status: 'interview' as const, note: `Hẹn phỏng vấn lúc ${viTime(startAt)}` })) });
      return created.id;
    });

    // Báo trong app cho ứng viên có tài khoản; gửi email nếu NTD chọn kênh email.
    // Chưa có API: gửi lời mời qua Zalo OA / SMS (kênh "zalo", "sms")
    const employerName = apps[0]?.job.employer?.name ?? (await this.prisma.recruiter.findUnique({ where: { id: actor.recruiterId }, select: { name: true } }))?.name ?? 'Nhà tuyển dụng';
    for (const a of apps) {
      if (a.userId) await this.notifications.notify(a.userId, 'interview.scheduled', { title: `Lời mời phỏng vấn lúc ${viTime(startAt)}`, body: a.job.title, link: WEB_LINKS.seekerApplications });
      if (!input.channels.includes('email') || !a.email) continue;
      try {
        const message = interviewInviteEmail({
          to: a.email,
          fullName: a.fullName,
          kind: input.kind,
          startAt,
          endAt,
          platformLabel: input.platform ? MEETING_PLATFORM_LABEL[input.platform] : null,
          location: input.kind === 'online' ? null : (input.location ?? null),
          meetingUrl: null, // link chỉ hiện trong tài khoản / Zalo trước giờ hẹn 15 phút
          jobTitle: a.job.title,
          employerName,
          interviewers: people.map((p) => p.name),
          partnerName: input.partnerName ?? null,
          note: input.note ?? null,
          webBaseUrl: this.env.WEB_BASE_URL,
          trackPath: WEB_LINKS.seekerApplications,
        });
        await this.mail.send({ to: a.email, ...message });
      } catch (e) {
        // Lỗi gửi email không huỷ lịch hẹn đã tạo (RULE-BE.md mục 11)
        this.logger.error(`Gửi email mời phỏng vấn (lịch ${id}) thất bại: ${(e as Error).message}`);
      }
    }
    const row = await this.prisma.interview.findUniqueOrThrow({ where: { id }, include: interviewInclude });
    return this.interviews.toItem(row);
  }
}
