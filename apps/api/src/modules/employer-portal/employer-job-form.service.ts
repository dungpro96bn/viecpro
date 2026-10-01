import { HttpStatus, Injectable } from '@nestjs/common';
import {
  REGION_OF_PREF,
  slugify,
  type EmployerJobForm,
  type Industry,
  type JobDetail,
  type JobMarketInsight,
  type JobMarketQuery,
  type JobTag,
  type JobUpsertInput,
  type JobVisibility,
  type TeamMember,
} from '@viecpro/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { jobSearchText } from '../jobs/job-query.js';
import { jobInclude, JobMapper } from '../jobs/job.mapper.js';
import { type EmployerActor, EmployerContext } from './employer-context.service.js';
import { buildJobContent, deriveTags } from './job-content.js';

const FIRST_JOB_NUMBER = 10231;
/** Ảnh mẫu khi NTD không chọn ảnh */
const DEFAULT_JOB_IMAGE = '/images/jobs/job-01.jpg';
/** Lượt đẩy tin của gói cho gói hiển thị nổi bật / tuyển gấp (design 15) */
const VISIBILITY_COST: Record<JobVisibility, number> = { standard: 0, featured: 5, urgent: 10 };
const DAY = 86400_000;

/** Đăng tin / sửa tin (design 15) + dữ liệu phụ trợ cho form */
@Injectable()
export class EmployerJobFormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
    private readonly mapper: JobMapper,
    private readonly assets: AssetUrlService,
  ) {}

  /* ---------- Dữ liệu phụ trợ ---------- */

  async team(userId: string): Promise<TeamMember[]> {
    const actor = await this.ctx.resolve(userId);
    const rows = await this.prisma.recruiter.findMany({ where: this.ctx.teamScope(actor), orderBy: { name: 'asc' }, select: { id: true, name: true, title: true, photoUrl: true } });
    return rows.map((r) => ({ ...r, photoUrl: this.assets.url(r.photoUrl), isMe: r.id === actor.recruiterId }));
  }

  /** Khoảng lương tin cùng ngành (ưu tiên cùng tỉnh), người lao động phù hợp, hồ sơ dự kiến */
  async market(userId: string, q: JobMarketQuery): Promise<JobMarketInsight> {
    await this.ctx.resolve(userId);
    const base: Prisma.JobWhereInput = { status: { in: ['open', 'closed'] }, industry: q.industry, program: q.program };
    let peers = q.pref ? await this.prisma.job.findMany({ where: { ...base, pref: q.pref }, select: { salary: true } }) : [];
    if (peers.length < 3) peers = await this.prisma.job.findMany({ where: base, select: { salary: true } });
    const salaries = peers.map((p) => p.salary).sort((a, b) => a - b);
    const quantile = (x: number) => salaries[Math.min(salaries.length - 1, Math.floor(x * (salaries.length - 1)))]!;

    const since = new Date(Date.now() - 30 * DAY);
    const [seekers, openPeers, apps30, passed] = await Promise.all([
      this.prisma.seekerProfile.count({
        where: {
          lookingForJob: true,
          programs: { has: q.program },
          ...(q.gender && q.gender !== 'both' && { OR: [{ gender: q.gender }, { gender: null }] }),
          ...(q.birthYearFrom && q.birthYearTo && { birthYear: { gte: q.birthYearFrom, lte: q.birthYearTo } }),
        },
      }),
      this.prisma.job.count({ where: { ...base, status: 'open' } }),
      this.prisma.application.count({ where: { job: { ...base, status: 'open' }, createdAt: { gte: since } } }),
      this.prisma.application.count({ where: { job: base, status: { in: ['passed', 'departed'] } } }),
    ]);
    const totalApps = await this.prisma.application.count({ where: { job: base } });
    const perJob30 = openPeers ? Math.round(apps30 / openPeers) : 0;
    const passRate = totalApps ? passed / totalApps : 0;
    const perDayHired = (perJob30 / 30) * passRate;
    return {
      salary: salaries.length ? { min: salaries[0]!, median: quantile(0.5), max: salaries.at(-1)!, sample: salaries.length } : null,
      seekers,
      expectedApplications: perJob30,
      daysToFill: q.quantity && perDayHired > 0 ? Math.ceil(q.quantity / perDayHired) : null,
    };
  }

  async getForm(userId: string, jobId: string): Promise<EmployerJobForm> {
    const actor = await this.ctx.resolve(userId);
    const j = await this.prisma.job.findFirst({ where: { id: jobId, ...this.ctx.jobScope(actor) } });
    if (!j) throw ApiException.notFound('Không tìm thấy đơn hàng');
    const posting = (j.detail as { posting?: EmployerJobForm['posting'] } | null)?.posting ?? null;
    return {
      id: j.id,
      code: j.code,
      status: j.status,
      title: j.title,
      imageUrl: j.imageUrl,
      pref: j.pref,
      program: j.program,
      industry: j.industry as Industry,
      position: j.position,
      salary: j.salary,
      quantity: j.quantity,
      gender: j.gender,
      birthYearFrom: j.birthYearFrom,
      birthYearTo: j.birthYearTo,
      departureAt: j.departureAt?.toISOString() ?? null,
      deadline: j.deadline?.toISOString() ?? null,
      examAt: j.examAt?.toISOString() ?? null,
      feeUsd: j.feeUsd,
      contractYears: j.contractYears,
      jlptRequired: j.jlptRequired,
      visibility: j.visibility,
      recruiterId: j.recruiterId,
      posting,
    };
  }

  /* ---------- Ghi ---------- */

  /** Ảnh tải lên phải nằm trong thư mục của chính người dùng (ảnh mẫu /images/jobs/* dùng chung) */
  private assertOwnImages(userId: string, input: JobUpsertInput) {
    const images = [input.imageUrl, ...(input.posting?.gallery ?? [])].filter((x): x is string => !!x);
    if (images.some((img) => img.startsWith('uploads/') && !img.startsWith(`uploads/${userId}/`))) {
      throw new ApiException('VALIDATION_ERROR', 'Chỉ được dùng ảnh đã tải lên', HttpStatus.BAD_REQUEST, { imageUrl: 'Tải ảnh lên trước khi chọn' });
    }
  }

  /** Cán bộ phụ trách phải cùng doanh nghiệp (NTD cá nhân: chính mình) */
  private async assignee(actor: EmployerActor, recruiterId?: string) {
    if (!recruiterId || recruiterId === actor.recruiterId) return actor.recruiterId;
    const ok = await this.prisma.recruiter.findFirst({ where: { id: recruiterId, ...this.ctx.teamScope(actor) }, select: { id: true } });
    if (!ok) throw new ApiException('VALIDATION_ERROR', 'Cán bộ phụ trách không thuộc doanh nghiệp', HttpStatus.BAD_REQUEST, { recruiterId: 'Chọn cán bộ trong doanh nghiệp' });
    return recruiterId;
  }

  private async median(industry: string, program: JobUpsertInput['program']) {
    const rows = await this.prisma.job.findMany({ where: { status: 'open', industry, program }, select: { salary: true } });
    const s = rows.map((r) => r.salary).sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)]! : null;
  }

  /** Dữ liệu ghi DB chung cho tạo / sửa */
  private async data(input: JobUpsertInput) {
    const { publish: _publish, posting, recruiterId: _r, imageUrl, ...rest } = input;
    const detail = posting
      ? buildJobContent({ ...rest, posting, departureAt: rest.departureAt ?? null, examAt: rest.examAt ?? null })
      : input.detail;
    const tags: JobTag[] = input.tags.length ? input.tags : posting ? deriveTags({ ...rest, posting, departureAt: rest.departureAt ?? null }, await this.median(rest.industry, rest.program), rest.salary) : [];
    const badges = [...new Set([...input.badges, ...(input.visibility === 'featured' ? (['hot'] as const) : input.visibility === 'urgent' ? (['urgent'] as const) : [])])];
    return {
      ...rest,
      imageUrl: imageUrl ?? posting?.gallery[0],
      region: REGION_OF_PREF[rest.pref]!,
      tags,
      badges,
      jlptRequired: rest.jlptRequired ?? null,
      detail: detail as Prisma.InputJsonValue,
    };
  }

  /** Trừ lượt đẩy tin khi chọn gói hiển thị nổi bật / tuyển gấp (chỉ phần chênh lệch khi nâng gói) */
  private async chargeVisibility(tx: Prisma.TransactionClient, actor: EmployerActor, from: JobVisibility, to: JobVisibility) {
    const cost = Math.max(0, VISIBILITY_COST[to] - VISIBILITY_COST[from]);
    if (!cost) return;
    const plan = await tx.businessPlan.findFirst({ where: actor.employerId ? { employerId: actor.employerId } : { recruiterId: actor.recruiterId } });
    const used = plan ? await tx.businessPlan.updateMany({ where: { id: plan.id, boostsUsed: { lte: plan.boostQuota - cost } }, data: { boostsUsed: { increment: cost } } }) : { count: 0 };
    if (!used.count) throw new ApiException('CONFLICT', `Gói hiển thị này cần ${cost} lượt đẩy tin – gói của bạn không đủ lượt`, HttpStatus.CONFLICT, { visibility: 'Không đủ lượt đẩy tin' });
  }

  /** Mã đơn tiếp theo = mã lớn nhất hiện có + 1 */
  private async nextJobNumber(tx: Prisma.TransactionClient) {
    const [row] = await tx.$queryRaw<Array<{ max: number | null }>>`
      SELECT MAX(CAST(SUBSTRING(code FROM 4) AS INTEGER)) AS max FROM "Job" WHERE code ~ '^VP-[0-9]+$'`;
    return Math.max(FIRST_JOB_NUMBER - 1, row?.max ?? 0) + 1;
  }

  /** Đăng tin: đã xác minh → hiển thị ngay; chưa xác minh → chờ duyệt (RULE-BE.md mục 7); không đăng → nháp */
  async create(userId: string, input: JobUpsertInput): Promise<JobDetail> {
    const actor = await this.ctx.resolve(userId);
    this.assertOwnImages(userId, input);
    const recruiterId = await this.assignee(actor, input.recruiterId);
    const data = await this.data(input);
    const status = !input.publish ? 'draft' : actor.verified ? 'open' : 'pending';
    const now = new Date();

    // Thử lại khi 2 tin tạo cùng lúc trùng mã
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const id = await this.prisma.$transaction(async (tx) => {
          if (input.publish) await this.chargeVisibility(tx, actor, 'standard', input.visibility);
          const number = (await this.nextJobNumber(tx)) + attempt;
          const code = `VP-${number}`;
          const job = await tx.job.create({
            data: {
              ...data,
              imageUrl: data.imageUrl ?? DEFAULT_JOB_IMAGE,
              badges: input.publish ? [...new Set(['new' as const, ...data.badges])] : data.badges,
              status,
              code,
              slug: `${slugify(input.title)}-${number}`,
              searchText: jobSearchText({ ...input, code }),
              recruiterId,
              employerId: actor.employerId ?? (await this.partnerEmployer(tx, actor)),
              publishedAt: status === 'open' ? now : null,
              submittedAt: status === 'pending' ? now : null,
            },
            select: { id: true },
          });
          await tx.jobEvent.create({ data: { jobId: job.id, actorId: actor.recruiterId, action: status === 'draft' ? 'draft' : status === 'pending' ? 'submit' : 'create' } });
          return job.id;
        });
        return this.mapper.detail(await this.prisma.job.findUniqueOrThrow({ where: { id }, include: jobInclude }));
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      }
    }
    throw new ApiException('CONFLICT', 'Không tạo được mã đơn, vui lòng thử lại', HttpStatus.CONFLICT);
  }

  /** NTD cá nhân đăng tin qua doanh nghiệp phái cử còn hiệu lực (liên kết gần hết hạn nhất được ưu tiên sau) */
  private async partnerEmployer(tx: Prisma.TransactionClient, actor: EmployerActor) {
    const link = await tx.recruiterPartner.findFirst({
      where: { recruiterId: actor.recruiterId, employer: { verified: true }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { expiresAt: { sort: 'desc', nulls: 'first' } },
      select: { employerId: true },
    });
    return link?.employerId ?? null;
  }

  async update(userId: string, jobId: string, input: JobUpsertInput): Promise<JobDetail> {
    const actor = await this.ctx.resolve(userId);
    const current = await this.prisma.job.findFirst({ where: { id: jobId, ...this.ctx.jobScope(actor) } });
    if (!current) throw ApiException.notFound('Không tìm thấy đơn hàng');
    this.assertOwnImages(userId, input);
    const recruiterId = await this.assignee(actor, input.recruiterId ?? current.recruiterId);
    const { imageUrl, ...data } = await this.data(input);
    // Tin đã đóng giữ nguyên; còn lại tính lại (NTD chưa xác minh sửa tin → chờ duyệt lại)
    const status = current.status === 'closed' ? 'closed' : !input.publish ? 'draft' : actor.verified ? 'open' : 'pending';

    await this.prisma.$transaction(async (tx) => {
      if (input.publish) await this.chargeVisibility(tx, actor, current.visibility, input.visibility);
      await tx.job.update({
        where: { id: jobId },
        data: {
          ...data,
          ...(imageUrl && { imageUrl }),
          status,
          recruiterId,
          searchText: jobSearchText({ ...input, code: current.code }),
          publishedAt: current.publishedAt ?? (status === 'open' ? new Date() : null),
          submittedAt: status === 'pending' ? new Date() : current.submittedAt,
          rejectReason: null,
        },
      });
      await tx.jobEvent.create({ data: { jobId, actorId: actor.recruiterId, action: status === 'pending' && current.status !== 'pending' ? 'submit' : status === 'draft' ? 'draft' : 'update' } });
    });
    return this.mapper.detail(await this.prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: jobInclude }));
  }
}
