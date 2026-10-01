import { HttpStatus, Injectable } from '@nestjs/common';
import {
  APPLICATION_STATUS_LABEL,
  STAGE_OF_STATUS,
  WEB_LINKS,
  ageOf,
  jobShortTitle,
  type ApplicantNoteItem,
  type ApplicantStage,
  type ApplicationListQuery,
  type ApplicationStatus,
  type ApplicationStatusInput,
  type EmployerApplicantDetail,
  type EmployerApplicantItem,
  type EmployerApplicantList,
} from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { pageArgs } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { scoreApplicant } from './applicant-match.js';
import { type EmployerActor, EmployerContext } from './employer-context.service.js';
import { isOverdue } from './employer-mappers.js';

const DAY = 86400_000;

/** Bước hiển thị → trạng thái hồ sơ */
const STATUSES_OF_STAGE: Record<ApplicantStage, ApplicationStatus[]> = {
  new: ['submitted'],
  contacted: ['viewed'],
  interview: ['interview'],
  passed: ['passed', 'departed'],
  rejected: ['rejected', 'withdrawn'],
};

const itemSelect = {
  id: true,
  fullName: true,
  gender: true,
  birthYear: true,
  hometown: true,
  address: true,
  phone: true,
  tags: true,
  matchScore: true,
  status: true,
  seenAt: true,
  createdAt: true,
  job: { select: { id: true, position: true, industry: true, pref: true } },
} satisfies Prisma.ApplicationSelect;

type ItemRow = Prisma.ApplicationGetPayload<{ select: typeof itemSelect }>;

/** Quản lý hồ sơ ứng viên (design 13): lọc theo bước, chi tiết, ghi chú, đổi bước tuyển dụng */
@Injectable()
export class EmployerApplicantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
    private readonly assets: AssetUrlService,
    private readonly notifications: NotificationsService,
  ) {}

  private toItem(a: ItemRow): EmployerApplicantItem {
    return {
      id: a.id,
      fullName: a.fullName,
      gender: a.gender,
      age: ageOf(a.birthYear),
      hometown: a.hometown ?? a.address,
      phone: a.phone,
      job: { id: a.job.id, shortTitle: jobShortTitle(a.job) },
      tags: a.tags,
      matchScore: a.matchScore,
      status: a.status,
      stage: STAGE_OF_STATUS[a.status],
      unseen: a.status === 'submitted' && !a.seenAt,
      overdue: isOverdue(a),
      createdAt: a.createdAt.toISOString(),
    };
  }

  /** Điều kiện lọc chung (đơn, tìm kiếm, mức phù hợp) */
  private filters(query: ApplicationListQuery): Prisma.ApplicationWhereInput {
    const and: Prisma.ApplicationWhereInput[] = [];
    if (query.jobId) and.push({ jobId: query.jobId });
    if (query.minMatch) and.push({ matchScore: { gte: query.minMatch } });
    if (query.q) {
      const digits = query.q.replace(/\D/g, '').replace(/^0/, '');
      and.push({
        OR: [
          { fullName: { contains: query.q, mode: 'insensitive' } },
          { hometown: { contains: query.q, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      });
    }
    return and.length ? { AND: and } : {};
  }

  private quick(kind: NonNullable<ApplicationListQuery['quick']>): Prisma.ApplicationWhereInput {
    switch (kind) {
      case 'unseen':
        return { status: 'submitted', seenAt: null };
      case 'passport':
        return { OR: [{ passport: 'has' }, { tags: { has: 'Có hộ chiếu' } }] };
      case 'match90':
        return { matchScore: { gte: 90 } };
      case 'overdue':
        return { status: 'submitted', createdAt: { lt: new Date(Date.now() - DAY) } };
    }
  }

  async list(userId: string, query: ApplicationListQuery): Promise<EmployerApplicantList> {
    const actor = await this.ctx.resolve(userId);
    const scope = this.ctx.applicationScope(actor);
    const base: Prisma.ApplicationWhereInput = { AND: [scope, this.filters(query)] };
    const stage: Prisma.ApplicationWhereInput = query.stage ? { status: { in: STATUSES_OF_STAGE[query.stage] } } : query.status ? { status: query.status } : {};
    const where: Prisma.ApplicationWhereInput = { AND: [base, stage, query.quick ? this.quick(query.quick) : {}] };
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

    const [rows, total, byStatus, unseen, passport, match90, overdue, contacted, interviewsThisWeek, jobs] = await Promise.all([
      this.prisma.application.findMany({ where, select: itemSelect, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.application.count({ where }),
      this.prisma.application.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
      this.prisma.application.count({ where: { AND: [base, stage, this.quick('unseen')] } }),
      this.prisma.application.count({ where: { AND: [base, stage, this.quick('passport')] } }),
      this.prisma.application.count({ where: { AND: [base, stage, this.quick('match90')] } }),
      this.prisma.application.count({ where: { AND: [base, stage, this.quick('overdue')] } }),
      this.prisma.application.findMany({ where: { AND: [base, { contactedAt: { not: null }, createdAt: { gte: new Date(now.getTime() - 30 * DAY) } }] }, select: { createdAt: true, contactedAt: true } }),
      this.prisma.interview.count({ where: { ...this.ctx.interviewScope(actor), status: { not: 'cancelled' }, startAt: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * DAY) } } }),
      this.prisma.application.groupBy({ by: ['jobId'], where: scope, _count: { _all: true }, orderBy: { _count: { jobId: 'desc' } }, take: 30 }),
    ]);

    const count = (statuses: ApplicationStatus[]) => byStatus.filter((s) => statuses.includes(s.status)).reduce((n, s) => n + s._count._all, 0);
    const stageCounts = {
      all: byStatus.reduce((n, s) => n + s._count._all, 0),
      new: count(STATUSES_OF_STAGE.new),
      contacted: count(STATUSES_OF_STAGE.contacted),
      interview: count(STATUSES_OF_STAGE.interview),
      passed: count(STATUSES_OF_STAGE.passed),
      rejected: count(STATUSES_OF_STAGE.rejected),
    };
    const hours = contacted.map((a) => (a.contactedAt!.getTime() - a.createdAt.getTime()) / 3600_000);
    const jobRows = await this.prisma.job.findMany({ where: { id: { in: jobs.map((j) => j.jobId) } }, select: { id: true, position: true, industry: true, pref: true } });
    const jobById = new Map(jobRows.map((j) => [j.id, j]));

    return {
      items: rows.map((r) => this.toItem(r)),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
      stageCounts,
      stageNotes: {
        unseen,
        avgContactHours: hours.length ? Math.round((hours.reduce((s, h) => s + h, 0) / hours.length) * 10) / 10 : null,
        interviewsThisWeek,
        passRate: stageCounts.interview + stageCounts.passed ? Math.round((stageCounts.passed / (stageCounts.interview + stageCounts.passed)) * 100) : 0,
      },
      quickCounts: { unseen, passport, match90, overdue },
      jobs: jobs.filter((j) => jobById.has(j.jobId)).map((j) => ({ id: j.jobId, shortTitle: jobShortTitle(jobById.get(j.jobId)!), count: j._count._all })),
    };
  }

  /** Hồ sơ thuộc phạm vi NTD – điều kiện sở hữu nằm trong câu truy vấn, không có quyền thì 404 */
  private async own(actor: EmployerActor, id: string) {
    const app = await this.prisma.application.findFirst({
      where: { id, ...this.ctx.applicationScope(actor) },
      include: { job: { select: { id: true, title: true, slug: true, position: true, industry: true, pref: true, birthYearFrom: true, birthYearTo: true, gender: true, jlptRequired: true } } },
    });
    if (!app) throw ApiException.notFound('Không tìm thấy hồ sơ');
    return app;
  }

  async detail(userId: string, id: string): Promise<EmployerApplicantDetail> {
    const actor = await this.ctx.resolve(userId);
    const app = await this.own(actor, id);
    const [events, notes, assignee] = await Promise.all([
      this.prisma.applicationEvent.findMany({ where: { applicationId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.applicationNote.findMany({ where: { applicationId: id }, orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true, photoUrl: true } } } }),
      app.assigneeId ? this.prisma.recruiter.findUnique({ where: { id: app.assigneeId }, select: { id: true, name: true } }) : null,
    ]);
    const { reasons } = scoreApplicant(app, app.job);
    const docs = Array.isArray(app.documents) ? (app.documents as EmployerApplicantDetail['documents']) : [];
    return {
      ...this.toItem({ ...app, job: app.job }),
      email: app.email,
      address: app.address,
      maritalStatus: app.maritalStatus,
      heightCm: app.heightCm,
      weightKg: app.weightKg,
      education: app.education,
      experience: app.experience,
      jlpt: app.jlpt,
      passport: app.passport,
      departWithin: app.departWithin,
      note: app.note,
      source: app.source,
      interviewAt: app.interviewAt?.toISOString() ?? null,
      documents: docs,
      matchReasons: reasons,
      events: events.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt.toISOString() })),
      notes: notes.map((n) => this.toNote(n)),
      assignee,
    };
  }

  private toNote(n: { id: string; body: string; createdAt: Date; author: { name: string; photoUrl: string | null } | null }): ApplicantNoteItem {
    return { id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), author: n.author && { name: n.author.name, photoUrl: this.assets.url(n.author.photoUrl) } };
  }

  /** NTD mở xem hồ sơ lần đầu (bỏ đánh dấu "chưa xem") */
  async markSeen(userId: string, id: string) {
    const actor = await this.ctx.resolve(userId);
    await this.prisma.application.updateMany({ where: { id, ...this.ctx.applicationScope(actor), seenAt: null }, data: { seenAt: new Date() } });
  }

  async addNote(userId: string, id: string, body: string): Promise<ApplicantNoteItem> {
    const actor = await this.ctx.resolve(userId);
    await this.own(actor, id);
    const note = await this.prisma.applicationNote.create({
      data: { applicationId: id, authorId: actor.recruiterId, body },
      include: { author: { select: { name: true, photoUrl: true } } },
    });
    return this.toNote(note);
  }

  /** Đổi bước tuyển dụng → ghi timeline + báo cho ứng viên (in-app + push) */
  async updateStatus(userId: string, id: string, input: ApplicationStatusInput) {
    const actor = await this.ctx.resolve(userId);
    const app = await this.own(actor, id);
    if (app.status === 'withdrawn') throw new ApiException('CONFLICT', 'Ứng viên đã rút hồ sơ', HttpStatus.CONFLICT);
    if (input.status === 'interview' && !input.interviewAt && !app.interviewAt) {
      throw new ApiException('VALIDATION_ERROR', 'Vui lòng tạo lịch phỏng vấn', HttpStatus.BAD_REQUEST, { interviewAt: 'Vui lòng chọn lịch phỏng vấn' });
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: app.id },
        data: {
          status: input.status,
          interviewAt: input.interviewAt ?? app.interviewAt,
          seenAt: app.seenAt ?? now,
          contactedAt: app.contactedAt ?? now,
          events: { create: { status: input.status, note: input.note } },
        },
      });
      if (app.userId && input.status === 'viewed') await tx.profileView.create({ data: { seekerId: app.userId, recruiterId: actor.recruiterId } });
    });

    if (app.userId) {
      await this.notifications.notify(app.userId, `application.${input.status}`, {
        title: `${APPLICATION_STATUS_LABEL[input.status]}: ${app.job.title}`,
        body: input.note ?? null,
        link: WEB_LINKS.seekerApplications,
      });
    }
  }
}
