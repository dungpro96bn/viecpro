import { HttpStatus, Injectable } from '@nestjs/common';
import {
  jobShortTitle,
  normalizeVnPhone,
  type ApplicantDuplicateCheck,
  type ApplicantDuplicateQuery,
  type ApplicantImportResult,
  type ApplicantJobMatch,
  type ApplicantJobMatchQuery,
  type EmployerApplicantItem,
  type ImportApplicantsInput,
  type ManualApplicantInput,
} from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { scoreApplicant } from './applicant-match.js';
import { type EmployerActor, EmployerContext } from './employer-context.service.js';

const jobSelect = { id: true, code: true, title: true, position: true, industry: true, pref: true, imageUrl: true, birthYearFrom: true, birthYearTo: true, gender: true, jlptRequired: true } satisfies Prisma.JobSelect;

/** NTD tự thêm ứng viên (design 16): kiểm tra trùng, gợi ý tin phù hợp, nhập thủ công / từ Excel */
@Injectable()
export class EmployerIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
    private readonly assets: AssetUrlService,
  ) {}

  async duplicates(userId: string, q: ApplicantDuplicateQuery): Promise<ApplicantDuplicateCheck> {
    const actor = await this.ctx.resolve(userId);
    const scope = this.ctx.applicationScope(actor);
    const phone = q.phone ? normalizeVnPhone(q.phone) : null;
    const given = q.name?.trim().split(/\s+/).pop();
    const select = { id: true, fullName: true, hometown: true, createdAt: true, job: { select: { position: true, industry: true, pref: true } } } as const;
    const [phoneMatches, similar, checked] = await Promise.all([
      phone ? this.prisma.application.findMany({ where: { ...scope, phone }, select, orderBy: { createdAt: 'desc' }, take: 3 }) : [],
      given && given.length >= 2 && q.name!.trim().split(/\s+/).length >= 2
        ? this.prisma.application.findMany({
            where: { ...scope, fullName: { endsWith: given, mode: 'insensitive' }, ...(phone && { phone: { not: phone } }), NOT: { fullName: { equals: q.name!.trim(), mode: 'insensitive' } } },
            select,
            orderBy: { createdAt: 'desc' },
            take: 2,
          })
        : [],
      this.prisma.application.count({ where: scope }),
    ]);
    const toItem = (a: (typeof phoneMatches)[number]) => ({ id: a.id, fullName: a.fullName, hometown: a.hometown, jobShortTitle: jobShortTitle(a.job), createdAt: a.createdAt.toISOString() });
    return { phoneMatches: phoneMatches.map(toItem), similarNames: similar.map(toItem), checked };
  }

  /** Tin đang tuyển của NTD, xếp theo % phù hợp với thông tin vừa nhập */
  async jobMatch(userId: string, q: ApplicantJobMatchQuery): Promise<ApplicantJobMatch[]> {
    const actor = await this.ctx.resolve(userId);
    const jobs = await this.prisma.job.findMany({ where: { ...this.ctx.jobScope(actor), status: 'open' }, select: jobSelect, orderBy: { publishedAt: 'desc' }, take: 40 });
    const applicant = { birthYear: q.birthYear ?? 2000, gender: q.gender ?? 'nu', jlpt: q.jlpt ?? null, passport: q.passport ?? null, tags: q.tags ?? [] };
    return jobs
      .map((j) => {
        const { score, reasons } = scoreApplicant(applicant, j);
        // Lý do chưa đạt (nếu có) quan trọng hơn để NTD cân nhắc
        const reason = reasons.find((r) => !r.ok && !r.text.startsWith('Chưa có chứng chỉ')) ?? { ok: true, text: reasons.filter((r) => r.ok).slice(0, 2).map((r) => r.text.replace(/ \(.*\)$/, '')).join(', ') };
        return { job: { id: j.id, code: j.code, title: j.title, shortTitle: jobShortTitle(j), imageUrl: this.assets.url(j.imageUrl) }, score, reason };
      })
      .sort((a, b) => b.score - a.score);
  }

  /** Tin phải thuộc phạm vi NTD và đang tuyển */
  private async openJob(actor: EmployerActor, jobId: string) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, ...this.ctx.jobScope(actor) }, select: { ...jobSelect, status: true, recruiterId: true } });
    if (!job) throw ApiException.notFound('Không tìm thấy đơn hàng');
    if (job.status !== 'open') throw new ApiException('JOB_CLOSED', 'Tin không còn nhận hồ sơ', HttpStatus.CONFLICT, { jobId: 'Chọn tin đang hiển thị' });
    return job;
  }

  async create(userId: string, input: ManualApplicantInput): Promise<EmployerApplicantItem> {
    const actor = await this.ctx.resolve(userId);
    const job = await this.openJob(actor, input.jobId);
    const files = input.documents.filter((d) => d.path);
    if (files.some((d) => !d.path!.startsWith(`uploads/${userId}/`))) {
      throw new ApiException('VALIDATION_ERROR', 'Chỉ được đính kèm tệp đã tải lên', HttpStatus.BAD_REQUEST, { documents: 'Tải tệp lên trước khi đính kèm' });
    }
    // Kho ảnh hiện tại là công khai: chỉ nhận 1 ảnh chân dung, không nhận giấy tờ định danh hoặc CV.
    if (files.length > 1 || files.some((d) => d.kind !== 'image' || !d.name.startsWith('Ảnh chân dung'))) {
      throw new ApiException('VALIDATION_ERROR', 'Chỉ đính kèm ảnh chân dung; ViecPro không nhận giấy tờ định danh hoặc CV', HttpStatus.BAD_REQUEST, { documents: 'Chỉ đính kèm ảnh chân dung' });
    }
    const assigneeId = input.assigneeId && input.assigneeId !== actor.recruiterId ? (await this.prisma.recruiter.findFirst({ where: { id: input.assigneeId, ...this.ctx.teamScope(actor) }, select: { id: true } }))?.id : actor.recruiterId;
    if (!assigneeId) throw new ApiException('VALIDATION_ERROR', 'Cán bộ phụ trách không thuộc doanh nghiệp', HttpStatus.BAD_REQUEST, { assigneeId: 'Chọn cán bộ trong doanh nghiệp' });
    const duplicate = await this.prisma.application.findFirst({ where: { jobId: job.id, phone: input.phone, status: { not: 'withdrawn' } }, select: { id: true } });
    if (duplicate) throw new ApiException('ALREADY_APPLIED', 'Số điện thoại này đã ứng tuyển tin đã chọn', HttpStatus.CONFLICT, { phone: 'Đã có hồ sơ cùng số điện thoại ở tin này' });

    const { score } = scoreApplicant({ birthYear: input.birthYear, gender: input.gender, jlpt: input.jlpt ?? null, passport: input.passport ?? null, tags: input.tags }, job);
    const contacted = input.stage === 'contacted';
    const now = new Date();
    const app = await this.prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          jobId: job.id,
          fullName: input.fullName,
          phone: input.phone,
          email: input.email,
          birthYear: input.birthYear,
          gender: input.gender,
          hometown: input.hometown,
          heightCm: input.heightCm,
          weightKg: input.weightKg,
          maritalStatus: input.maritalStatus,
          education: input.education,
          jlpt: input.jlpt,
          passport: input.passport,
          departWithin: input.departWithin,
          experience: input.experience,
          tags: input.tags,
          documents: input.documents as Prisma.InputJsonValue,
          source: input.source,
          matchScore: score,
          assigneeId,
          status: contacted ? 'viewed' : 'submitted',
          // NTD tự nhập nên coi như đã xem
          seenAt: now,
          contactedAt: contacted ? now : null,
          events: { create: [{ status: 'submitted', note: 'NTD thêm thủ công' }, ...(contacted ? [{ status: 'viewed' as const, note: 'Đã liên hệ khi tiếp nhận' }] : [])] },
        },
        include: { job: { select: { id: true, position: true, industry: true, pref: true } } },
      });
      if (input.note) await tx.applicationNote.create({ data: { applicationId: created.id, authorId: actor.recruiterId, body: input.note } });
      return created;
    });
    return {
      id: app.id,
      fullName: app.fullName,
      gender: app.gender,
      age: now.getFullYear() - app.birthYear,
      hometown: app.hometown,
      phone: app.phone,
      job: { id: app.job.id, shortTitle: jobShortTitle(app.job) },
      tags: app.tags,
      matchScore: app.matchScore,
      status: app.status,
      stage: contacted ? 'contacted' : 'new',
      unseen: false,
      overdue: false,
      createdAt: app.createdAt.toISOString(),
    };
  }

  /** Nhập từ Excel / CSV: bỏ qua dòng lỗi, trả danh sách dòng bị bỏ qua kèm lý do */
  async import(userId: string, input: ImportApplicantsInput): Promise<ApplicantImportResult> {
    const actor = await this.ctx.resolve(userId);
    const codes = [...new Set(input.rows.map((r) => r.jobCode.toUpperCase()))];
    const jobs = await this.prisma.job.findMany({ where: { ...this.ctx.jobScope(actor), code: { in: codes }, status: 'open' }, select: jobSelect });
    const jobByCode = new Map(jobs.map((j) => [j.code, j]));
    const year = new Date().getFullYear();
    const skipped: ApplicantImportResult['skipped'] = [];
    const seen = new Set<string>();
    const data: Prisma.ApplicationCreateManyInput[] = [];

    const existing = await this.prisma.application.findMany({
      where: { jobId: { in: jobs.map((j) => j.id) }, status: { not: 'withdrawn' } },
      select: { jobId: true, phone: true },
    });
    for (const e of existing) seen.add(`${e.jobId}:${e.phone}`);

    input.rows.forEach((r, i) => {
      const row = i + 2; // dòng 1 là tiêu đề cột
      const job = jobByCode.get(r.jobCode.toUpperCase());
      const phone = normalizeVnPhone(r.phone);
      const gender = /^n(ữ|u)$/i.test(r.gender.trim()) ? 'nu' : /^nam$/i.test(r.gender.trim()) ? 'nam' : null;
      if (r.fullName.trim().length < 2) return skipped.push({ row, reason: 'Thiếu họ tên' });
      if (!phone) return skipped.push({ row, reason: 'Số điện thoại chưa đúng' });
      if (!gender) return skipped.push({ row, reason: 'Giới tính phải là "Nam" hoặc "Nữ"' });
      if (r.birthYear < year - 60 || r.birthYear > year - 16) return skipped.push({ row, reason: 'Năm sinh không hợp lệ' });
      if (!job) return skipped.push({ row, reason: `Không có tin đang tuyển mã ${r.jobCode}` });
      if (seen.has(`${job.id}:${phone}`)) return skipped.push({ row, reason: 'Trùng số điện thoại ở tin này' });
      seen.add(`${job.id}:${phone}`);
      const { score } = scoreApplicant({ birthYear: r.birthYear, gender, jlpt: null, passport: null, tags: [] }, job);
      data.push({
        jobId: job.id,
        fullName: r.fullName.trim(),
        phone,
        birthYear: r.birthYear,
        gender,
        hometown: r.hometown?.trim() || null,
        source: input.source,
        matchScore: score,
        assigneeId: actor.recruiterId,
        seenAt: new Date(),
      });
      return undefined;
    });

    if (data.length) {
      const start = new Date();
      await this.prisma.$transaction(async (tx) => {
        await tx.application.createMany({ data });
        const created = await tx.application.findMany({ where: { createdAt: { gte: start }, OR: data.map((d) => ({ jobId: d.jobId, phone: d.phone })) }, select: { id: true } });
        await tx.applicationEvent.createMany({ data: created.map((c) => ({ applicationId: c.id, status: 'submitted' as const, note: 'Nhập từ tệp Excel' })) });
      });
    }
    return { created: data.length, skipped };
  }
}
