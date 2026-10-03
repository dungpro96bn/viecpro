import { HttpStatus, Injectable } from '@nestjs/common';
import {
  WEB_LINKS,
  type ApplicationItem,
  type Industry,
  type InterviewChangeRequestInput,
  type SeekerApplicationList,
  type SeekerApplicationListQuery,
  type SeekerApplicationSummary,
  type SeekerApplicationTab,
  type SavedJobsApplyInput,
  type SavedJobsApplyResult,
  type Gender,
} from '@viecpro/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { pageArgs } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ApplicationsService } from './applications.service.js';
import { buildSteps, inviteRate, TAB_STATUSES } from './seeker-progress.js';

/** Link phòng họp chỉ trả cho ứng viên trong 15 phút trước giờ hẹn */
const LINK_LEAD_MS = 15 * 60_000;
const WITHDRAWABLE = ['submitted', 'viewed', 'interview'];

const include = {
  job: { select: { id: true, slug: true, code: true, title: true, imageUrl: true, salary: true, pref: true, program: true, industry: true, deletedAt: true, employer: { select: { name: true } } } },
  events: { orderBy: { createdAt: 'asc' } },
  assignee: { select: { id: true, slug: true, name: true, title: true, photoUrl: true, phone: true, online: true } },
  attendees: {
    where: { interview: { status: 'scheduled' } },
    orderBy: { interview: { startAt: 'desc' } },
    take: 1,
    select: {
      status: true,
      interview: {
        select: {
          id: true,
          kind: true,
          startAt: true,
          endAt: true,
          platform: true,
          meetingUrl: true,
          location: true,
          partnerName: true,
          interviewers: { select: { name: true } },
          employer: { select: { name: true } },
          owner: { select: { userId: true } },
        },
      },
    },
  },
  employerReview: { select: { id: true, rating: true } },
  conversation: { select: { id: true, seekerReadAt: true, messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { senderSide: true, createdAt: true } } } },
} satisfies Prisma.ApplicationInclude;

type Row = Prisma.ApplicationGetPayload<{ include: typeof include }>;

/** Việc đã ứng tuyển (design 19): danh sách theo tab, số liệu, xác nhận / xin đổi giờ phỏng vấn */
@Injectable()
export class SeekerApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetUrlService,
    private readonly notifications: NotificationsService,
    private readonly applications: ApplicationsService,
  ) {}

  private toItem(a: Row, now = new Date()): ApplicationItem {
    const { employer, deletedAt, ...job } = a.job;
    const att = a.attendees[0];
    const iv = att && att.interview.endAt > now ? att.interview : null;
    const noted = [...a.events].reverse().find((e) => e.note);
    return {
      id: a.id,
      conversationId: a.conversation?.id ?? null,
      unreadMessages: a.conversation?.messages[0]?.senderSide === 'employer' && (!a.conversation.seekerReadAt || a.conversation.messages[0].createdAt > a.conversation.seekerReadAt) ? 1 : 0,
      status: a.status,
      interviewAt: a.interviewAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      job: { ...job, industry: job.industry as Industry, imageUrl: this.assets.url(job.imageUrl), employerName: employer?.name ?? null, removed: !!deletedAt },
      timeline: a.events.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt.toISOString() })),
      code: `VP-${a.number}`,
      steps: buildSteps(a.status, a.events, a.interviewAt),
      interview: iv && {
        id: iv.id,
        kind: iv.kind,
        startAt: iv.startAt.toISOString(),
        endAt: iv.endAt.toISOString(),
        platform: iv.platform,
        meetingUrl: iv.startAt.getTime() - now.getTime() <= LINK_LEAD_MS ? iv.meetingUrl : null,
        linkOpensAt: new Date(iv.startAt.getTime() - LINK_LEAD_MS).toISOString(),
        location: iv.location,
        partnerName: iv.partnerName,
        interviewers: iv.interviewers.map((p) => p.name),
        employerName: iv.employer?.name ?? employer?.name ?? null,
        myStatus: att.status,
      },
      consultant: a.assignee && { ...a.assignee, photoUrl: this.assets.url(a.assignee.photoUrl) },
      latestNote: noted?.note ? { text: noted.note, at: noted.createdAt.toISOString() } : null,
      withdrawable: WITHDRAWABLE.includes(a.status),
      review: a.employerReview,
    };
  }

  async list(userId: string, query: SeekerApplicationListQuery): Promise<SeekerApplicationList> {
    const base: Prisma.ApplicationWhereInput = { userId, ...(query.q && { job: { title: { contains: query.q, mode: 'insensitive' } } }) };
    const where: Prisma.ApplicationWhereInput = query.tab === 'all' ? base : { ...base, status: { in: TAB_STATUSES[query.tab] } };
    const [rows, total, grouped] = await Promise.all([
      this.prisma.application.findMany({ where, include, orderBy: query.sort === 'applied' ? { createdAt: 'desc' } : { updatedAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.application.count({ where }),
      this.prisma.application.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
    ]);
    const count = (statuses: string[]) => grouped.filter((g) => statuses.includes(g.status)).reduce((n, g) => n + g._count._all, 0);
    const counts = Object.fromEntries([['all', count(grouped.map((g) => g.status))], ...Object.entries(TAB_STATUSES).map(([k, v]) => [k, count(v)])]) as Record<SeekerApplicationTab, number>;
    const now = new Date();
    return { items: rows.map((r) => this.toItem(r, now)), page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total, counts };
  }

  async summary(userId: string): Promise<SeekerApplicationSummary> {
    const now = new Date();
    const apps = await this.prisma.application.findMany({ where: { userId }, include, orderBy: { updatedAt: 'desc' } });
    const processing = apps.filter((a) => TAB_STATUSES.processing.includes(a.status));
    const upcoming = apps
      .map((a) => ({ a, iv: a.attendees[0]?.interview }))
      .filter((x) => x.iv && x.iv.endAt > now)
      .sort((x, y) => x.iv!.startAt.getTime() - y.iv!.startAt.getTime());
    const passed = apps.filter((a) => TAB_STATUSES.passed.includes(a.status));
    const rate = inviteRate(apps);

    const pendingJobs = processing.map((a) => a.jobId);
    const [response, ranking] = await Promise.all([
      // Thời gian cán bộ phản hồi (liên hệ lần đầu) ở các đơn bạn đang chờ, 60 ngày gần đây
      pendingJobs.length
        ? this.prisma.$queryRaw<Array<{ hours: number | null }>>`
            SELECT AVG(EXTRACT(EPOCH FROM ("contactedAt" - "createdAt")) / 3600)::float AS hours
            FROM "Application"
            WHERE "jobId" IN (${Prisma.join(pendingJobs)}) AND "contactedAt" IS NOT NULL AND "createdAt" > now() - interval '60 days'`
        : Promise.resolve([{ hours: null }]),
      rate === null
        ? Promise.resolve([{ below: 0, total: 0 }])
        : this.prisma.$queryRaw<Array<{ below: number; total: number }>>`
            WITH r AS (
              SELECT a."userId", AVG(CASE WHEN a.status IN ('interview', 'passed', 'departed') OR EXISTS (
                SELECT 1 FROM "ApplicationEvent" e WHERE e."applicationId" = a.id AND e.status = 'interview') THEN 100.0 ELSE 0 END) AS rate
              FROM "Application" a
              WHERE a."userId" IS NOT NULL AND a."userId" <> ${userId} AND a.status <> 'withdrawn'
              GROUP BY a."userId" HAVING count(*) >= 3)
            SELECT (count(*) FILTER (WHERE rate < ${rate}))::int AS below, count(*)::int AS total FROM r`,
    ]);
    const hours = response[0]?.hours;
    const rank = ranking[0];
    const latest = passed[0];
    return {
      processing: processing.length,
      avgResponseHours: hours == null ? null : Math.max(1, Math.round(hours)),
      upcomingInterviews: upcoming.length,
      nextInterview: upcoming[0] ? this.toItem(upcoming[0].a, now) : null,
      passed: passed.length,
      latestPassed: latest ? { pref: latest.job.pref, note: [...latest.events].reverse().find((e) => e.note)?.note ?? null } : null,
      inviteRate: rate,
      betterThan: rank && rank.total >= 10 ? Math.round((rank.below / rank.total) * 100) : null,
    };
  }

  /** Lịch hẹn sắp tới của chính hồ sơ này – điều kiện sở hữu nằm trong truy vấn, không có → 404 */
  private async myAttendee(userId: string, applicationId: string) {
    const att = await this.prisma.interviewAttendee.findFirst({
      where: { applicationId, application: { userId }, interview: { status: 'scheduled', endAt: { gt: new Date() } } },
      orderBy: { interview: { startAt: 'asc' } },
      select: { id: true, status: true, interview: { select: { startAt: true, owner: { select: { userId: true } } } }, application: { select: { fullName: true, job: { select: { title: true } } } } },
    });
    if (!att) throw ApiException.notFound('Không có lịch phỏng vấn sắp tới');
    return att;
  }

  async confirmInterview(userId: string, applicationId: string): Promise<ApplicationItem> {
    const att = await this.myAttendee(userId, applicationId);
    await this.prisma.interviewAttendee.update({ where: { id: att.id }, data: { status: 'confirmed', respondedAt: new Date() } });
    return this.one(userId, applicationId);
  }

  /** Xin đổi giờ: ghi vào lịch sử hồ sơ + báo cán bộ tạo lịch; lịch vẫn giữ tới khi cán bộ dời */
  async requestChange(userId: string, applicationId: string, input: InterviewChangeRequestInput): Promise<ApplicationItem> {
    const att = await this.myAttendee(userId, applicationId);
    if (att.interview.startAt.getTime() - Date.now() < 2 * 3600_000) {
      throw new ApiException('CONFLICT', 'Còn dưới 2 giờ tới giờ hẹn – vui lòng gọi trực tiếp cán bộ', HttpStatus.CONFLICT);
    }
    await this.prisma.$transaction([
      this.prisma.interviewAttendee.update({ where: { id: att.id }, data: { status: 'pending', respondedAt: new Date() } }),
      this.prisma.applicationEvent.create({ data: { applicationId, status: 'interview', note: `Ứng viên xin đổi giờ: ${input.reason}` } }),
    ]);
    const ownerUserId = att.interview.owner.userId;
    if (ownerUserId) {
      await this.notifications.notify(ownerUserId, 'interview.change_request', {
        title: `${att.application.fullName} xin đổi giờ phỏng vấn`,
        body: input.reason,
        link: `${WEB_LINKS.employerApplicants}?id=${applicationId}`,
      });
    }
    return this.one(userId, applicationId);
  }

  /** Ứng tuyển nhanh nhiều việc (từ "Việc đã lưu") bằng thông tin trong hồ sơ; việc lỗi được bỏ qua kèm lý do */
  async applyMany(userId: string, input: SavedJobsApplyInput): Promise<SavedJobsApplyResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, phone: true, email: true, emailVerifiedAt: true, seekerProfile: { select: { birthYear: true, gender: true, address: true } } } });
    const p = user.seekerProfile;
    // Ứng tuyển hàng loạt không có bước nhập mã → chỉ cho email tài khoản đã xác thực bằng OTP
    if (!user.email || !user.emailVerifiedAt) {
      throw new ApiException('EMAIL_NOT_VERIFIED', 'Email trong hồ sơ chưa được xác thực. Hãy ứng tuyển 1 việc (nhập mã gửi tới email) để xác thực trước.', HttpStatus.BAD_REQUEST);
    }
    if (!user.phone || !p?.birthYear || !p.gender) {
      throw new ApiException('VALIDATION_ERROR', 'Cập nhật năm sinh, giới tính và số điện thoại trong hồ sơ trước khi ứng tuyển nhanh', HttpStatus.BAD_REQUEST);
    }
    const jobs = await this.prisma.job.findMany({ where: { id: { in: [...new Set(input.jobIds)] } }, select: { id: true, birthYearFrom: true, birthYearTo: true, gender: true } });
    const result: SavedJobsApplyResult = { applied: [], skipped: [] };
    for (const jobId of new Set(input.jobIds)) {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) {
        result.skipped.push({ jobId, reason: 'Không tìm thấy đơn hàng' });
        continue;
      }
      if (p.birthYear < job.birthYearFrom || p.birthYear > job.birthYearTo || (job.gender !== 'both' && job.gender !== p.gender)) {
        result.skipped.push({ jobId, reason: 'Không khớp độ tuổi / giới tính của đơn' });
        continue;
      }
      try {
        await this.applications.apply({ jobId, fullName: user.name, phone: user.phone, email: user.email, birthYear: p.birthYear, gender: p.gender as Gender, address: p.address ?? undefined }, userId);
        result.applied.push(jobId);
      } catch (e) {
        if (!(e instanceof ApiException)) throw e;
        result.skipped.push({ jobId, reason: e.message });
      }
    }
    return result;
  }

  /** Rút hồ sơ (kiểm tra ở ApplicationsService), trả lại hồ sơ đủ tiến trình */
  async withdraw(userId: string, id: string): Promise<ApplicationItem> {
    await this.applications.withdraw(userId, id);
    return this.one(userId, id);
  }

  private async one(userId: string, id: string): Promise<ApplicationItem> {
    const row = await this.prisma.application.findFirst({ where: { id, userId }, include });
    if (!row) throw ApiException.notFound('Không tìm thấy hồ sơ ứng tuyển');
    return this.toItem(row);
  }
}
