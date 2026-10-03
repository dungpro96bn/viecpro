import { Injectable } from '@nestjs/common';
import { PARTNER_CONTACT_VISIBLE_FROM, ageOf, maskEmail, maskVnPhone, type PaginationQuery, type PartnerApplicantItem, type PartnerApplicantList, type PartnerJobItem, type PartnerJobListQuery, type ReportCreated } from '@viecpro/shared';
import type { Request } from 'express';
import type { Prisma } from '../../generated/prisma/client.js';
import { ApiException } from '../../core/http/api-exception.js';
import { pageArgs, paginated } from '../../core/http/pagination.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { EmployerContext, type EmployerActor } from './employer-context.service.js';

const VIEW_COOLDOWN_MS = 60 * 60_000;

const partnerJobSelect = {
  id: true,
  code: true,
  slug: true,
  title: true,
  status: true,
  createdAt: true,
  recruiter: { select: { id: true, slug: true, name: true } },
  _count: { select: { applications: true } },
} satisfies Prisma.JobSelect;

const applicantSelect = {
  id: true,
  fullName: true,
  gender: true,
  birthYear: true,
  hometown: true,
  phone: true,
  email: true,
  address: true,
  status: true,
  createdAt: true,
  job: { select: { id: true, title: true, slug: true } },
} satisfies Prisma.ApplicationSelect;

@Injectable()
export class EmployerPartnerViewService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: EmployerContext, private readonly reports: ReportsService) {}

  private async adminActor(userId: string): Promise<EmployerActor> {
    const actor = await this.ctx.resolve(userId);
    if (!actor.employerId) throw ApiException.forbidden('Chỉ quản trị viên doanh nghiệp được xem tin đối tác');
    const recruiter = await this.prisma.recruiter.findUnique({ where: { id: actor.recruiterId }, select: { companyAdmin: true } });
    if (!recruiter?.companyAdmin) throw ApiException.forbidden('Chỉ quản trị viên doanh nghiệp được xem tin đối tác');
    return actor;
  }

  async listJobs(userId: string, query: PartnerJobListQuery) {
    const actor = await this.adminActor(userId);
    const where: Prisma.JobWhereInput = { ...this.ctx.partnerJobScope(actor), ...(query.recruiterId && { recruiterId: query.recruiterId }) };
    const [rows, total] = await Promise.all([
      this.prisma.job.findMany({ where, select: partnerJobSelect, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.job.count({ where }),
    ]);
    const items: PartnerJobItem[] = rows.map((row) => ({
      id: row.id,
      code: row.code,
      slug: row.slug,
      title: row.title,
      status: row.status,
      applications: row._count.applications,
      createdAt: row.createdAt.toISOString(),
      recruiter: row.recruiter,
    }));
    return paginated(items, total, query);
  }

  private applicantItem(row: Prisma.ApplicationGetPayload<{ select: typeof applicantSelect }>): PartnerApplicantItem {
    const contactMasked = !PARTNER_CONTACT_VISIBLE_FROM.includes(row.status);
    return {
      id: row.id,
      fullName: row.fullName,
      gender: row.gender,
      age: ageOf(row.birthYear),
      hometown: row.hometown,
      phone: contactMasked ? maskVnPhone(row.phone) : row.phone,
      email: contactMasked && row.email ? maskEmail(row.email) : row.email,
      address: contactMasked && row.address ? '••••••' : row.address,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      job: row.job,
      contactMasked,
    };
  }

  async listApplications(userId: string, jobId: string, query: PaginationQuery): Promise<PartnerApplicantList> {
    const actor = await this.adminActor(userId);
    const scope = this.ctx.partnerJobScope(actor);
    const job = await this.prisma.job.findFirst({ where: { id: jobId, ...scope }, select: { id: true } });
    if (!job) throw ApiException.notFound('Không tìm thấy tin đối tác');
    const where = { jobId: job.id };
    const [rows, total] = await Promise.all([
      this.prisma.application.findMany({ where, select: applicantSelect, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.application.count({ where }),
    ]);
    return paginated(rows.map((row) => this.applicantItem(row)), total, query);
  }

  async detail(userId: string, applicationId: string): Promise<PartnerApplicantItem> {
    const actor = await this.adminActor(userId);
    const scope = this.ctx.partnerJobScope(actor);
    const row = await this.prisma.application.findFirst({ where: { id: applicationId, job: scope }, select: applicantSelect });
    if (!row) throw ApiException.notFound('Không tìm thấy hồ sơ');

    const since = new Date(Date.now() - VIEW_COOLDOWN_MS);
    const recent = await this.prisma.partnerView.findFirst({
      where: { employerId: actor.employerId!, viewerRecruiterId: actor.recruiterId, applicationId, createdAt: { gte: since } },
      select: { id: true },
    });
    if (!recent) await this.prisma.partnerView.create({ data: { employerId: actor.employerId!, viewerRecruiterId: actor.recruiterId, applicationId } });
    return this.applicantItem(row);
  }

  async requestHide(userId: string, jobId: string, req: Request): Promise<ReportCreated> {
    const actor = await this.adminActor(userId);
    const job = await this.prisma.job.findFirst({ where: { id: jobId, ...this.ctx.partnerJobScope(actor) }, select: { id: true } });
    if (!job) throw ApiException.notFound('Không tìm thấy tin đối tác');
    return this.reports.create({ targetType: 'job', target: job.id, reason: 'partner_request', detail: 'Doanh nghiệp phái cử đề nghị xem xét tạm ẩn tin này.' }, userId, req.ip);
  }
}
