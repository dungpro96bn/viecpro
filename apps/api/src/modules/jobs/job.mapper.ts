import { Injectable } from '@nestjs/common';
import {
  jobDetailContentSchema,
  JOB_GENDER_LABEL,
  type BadgeKind,
  type EmployerSummary,
  type Industry,
  type JobDetail,
  type JobListItem,
  type JobStatus,
  type JobTag,
  type RecruiterSummary,
} from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';

export const recruiterSummarySelect = {
  id: true,
  slug: true,
  name: true,
  title: true,
  photoUrl: true,
  rating: true,
  city: true,
} satisfies Prisma.RecruiterSelect;

export const employerSummarySelect = { id: true, slug: true, name: true, logoUrl: true, verified: true } satisfies Prisma.EmployerSelect;

/** Trạng thái đơn được xem công khai: nháp / chờ duyệt / bị từ chối không lộ ra ngoài (RULE-BE.md mục 7) */
export const PUBLIC_JOB_STATUSES: JobStatus[] = ['open', 'closed'];

/** include dùng cho mọi truy vấn trả về JobListItem / JobDetail */
export const jobInclude = {
  recruiter: { select: recruiterSummarySelect },
  employer: { select: employerSummarySelect },
} satisfies Prisma.JobInclude;

export type JobRow = Prisma.JobGetPayload<{ include: typeof jobInclude }>;

/** Đổi bản ghi Prisma → dữ liệu trả về API (URL ảnh tuyệt đối, ngày ISO) */
@Injectable()
export class JobMapper {
  constructor(private readonly assets: AssetUrlService) {}

  recruiter(r: Prisma.RecruiterGetPayload<{ select: typeof recruiterSummarySelect }>): RecruiterSummary {
    return { ...r, photoUrl: this.assets.url(r.photoUrl) };
  }

  employer(e: Prisma.EmployerGetPayload<{ select: typeof employerSummarySelect }> | null): EmployerSummary | null {
    return e && { ...e, logoUrl: this.assets.url(e.logoUrl) };
  }

  listItem(job: JobRow): JobListItem {
    return {
      id: job.id,
      code: job.code,
      slug: job.slug,
      title: job.title,
      imageUrl: this.assets.url(job.imageUrl),
      pref: job.pref,
      region: job.region,
      program: job.program,
      industry: job.industry as Industry,
      salary: job.salary,
      quantity: job.quantity,
      quantityText: `${String(job.quantity).padStart(2, '0')} ${JOB_GENDER_LABEL[job.gender].toLowerCase()}`,
      gender: job.gender,
      birthYearFrom: job.birthYearFrom,
      birthYearTo: job.birthYearTo,
      tags: job.tags as JobTag[],
      badges: job.badges as BadgeKind[],
      views: job.views,
      publishedAt: job.publishedAt?.toISOString() ?? null,
      deadline: job.deadline?.toISOString() ?? null,
      recruiter: this.recruiter(job.recruiter),
      employer: this.employer(job.employer),
    };
  }

  detail(job: JobRow): JobDetail {
    return {
      ...this.listItem(job),
      status: job.status,
      departureAt: job.departureAt?.toISOString() ?? null,
      detail: jobDetailContentSchema.parse(job.detail ?? {}),
    };
  }
}
