import { z } from 'zod';
import { BADGES, DEPARTURE_WITHIN, EDUCATION_LEVELS, EMPLOYER_JOB_TABS, GENDERS, INDUSTRIES, JLPT_LEVELS, JOB_BENEFITS, JOB_CHANNELS, JOB_GENDERS, JOB_SORTS, JOB_TAGS, JOB_VISIBILITIES, PROGRAMS, REGIONS, SCREENING_KINDS } from '../enums.js';
import { PREFECTURES } from '../prefectures.js';
import { csvArray, paginationSchema } from './common.js';

/** Query tìm kiếm việc làm – khớp bộ lọc trang /tim-kiem */
export const jobSearchSchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  pref: csvArray(z.string()),
  region: csvArray(z.enum(REGIONS)),
  program: csvArray(z.enum(PROGRAMS)),
  tag: csvArray(z.enum(JOB_TAGS)),
  industry: csvArray(z.enum(INDUSTRIES)),
  /** Giới tính người tìm việc: lọc đơn tuyển giới tính đó hoặc cả hai */
  gender: z.enum(GENDERS).optional(),
  /** Năm sinh người tìm việc: lọc đơn có độ tuổi phù hợp */
  birthYear: z.coerce.number().int().optional(),
  salaryMin: z.coerce.number().int().min(0).optional(),
  salaryMax: z.coerce.number().int().min(0).optional(),
  departureWithin: z.enum(DEPARTURE_WITHIN).optional(),
  employer: z.string().optional(),
  recruiter: z.string().optional(),
  sort: z.enum(JOB_SORTS).default('relevance'),
});
export type JobSearchQuery = z.infer<typeof jobSearchSchema>;

const requirementRow = z.tuple([z.string(), z.string()]);

/**
 * Ảnh đơn hàng: ảnh mẫu có sẵn (/images/jobs/job-01.jpg) hoặc ảnh NTD đã tải lên (uploads/<userId>/<uuid>.jpg).
 * Không nhận URL ngoài. Ảnh tải lên phải thuộc chính người dùng – kiểm tra thêm ở service.
 */
export const JOB_IMAGE_PATTERN = /^(\/images\/jobs\/[a-z0-9-]+\.(jpg|png|webp)|uploads\/[a-z0-9]+\/[0-9a-f-]{36}\.(jpg|png|webp))$/i;

/** Thông tin đăng tin của NTD (form đăng tin – design 15). Lưu trong detail.posting để sửa lại được. */
export const jobPostingSchema = z.object({
  /** Mô tả công việc – mỗi dòng một ý */
  description: z.string().trim().max(3000).default(''),
  otherRequirements: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  educationMin: z.enum(EDUCATION_LEVELS).optional(),
  /** Làm thêm dự kiến (giờ / tháng) */
  overtimeHours: z.coerce.number().int().min(0).max(80).optional(),
  benefits: z.array(z.enum(JOB_BENEFITS)).max(JOB_BENEFITS.length).default([]),
  channels: z.array(z.enum(JOB_CHANNELS)).max(JOB_CHANNELS.length).default(['viecpro']),
  screening: z
    .array(
      z.object({
        question: z.string().trim().min(5, 'Câu hỏi tối thiểu 5 ký tự').max(160),
        kind: z.enum(SCREENING_KINDS),
        /** Câu trả lời bị loại tự động, vd. "Có" */
        rejectIf: z.string().trim().max(40).optional(),
      }),
    )
    .max(5)
    .default([]),
  /** Ảnh môi trường làm việc (ảnh đầu tiên là ảnh bìa) */
  gallery: z.array(z.string().trim().max(200).regex(JOB_IMAGE_PATTERN, 'Ảnh không hợp lệ')).max(10).default([]),
});
export type JobPosting = z.infer<typeof jobPostingSchema>;

/** Nội dung chi tiết đơn hàng (lưu JSON) – khớp các mục trang /viec-lam/[slug]. Dùng khi ĐỌC (không chặn dữ liệu cũ). */
export const jobDetailContentSchema = z.object({
  overview: z.string().default(''),
  highlights: z.array(z.string()).default([]),
  tasks: z.array(z.string()).default([]),
  environment: z.array(z.string()).default([]),
  requirements: z.array(requirementRow).default([]),
  incomes: z.array(z.object({ label: z.string(), value: z.string(), note: z.string().optional(), highlight: z.boolean().default(false) })).default([]),
  hours: z.array(requirementRow).default([]),
  benefits: z.array(z.string()).default([]),
  included: z.array(z.string()).default([]),
  documents: z.array(z.string()).default([]),
  steps: z.array(z.object({ title: z.string(), when: z.string(), desc: z.string() })).default([]),
  recruitment: z.string().optional(),
  contract: z.string().optional(),
  expectedIncome: z.string().optional(),
  /** Dữ liệu form đăng tin (chỉ NTD dùng khi sửa tin); dữ liệu hỏng thì bỏ qua */
  posting: jobPostingSchema.optional().catch(undefined),
});
export type JobDetailContent = z.infer<typeof jobDetailContentSchema>;

/* ---- Giới hạn khi GHI (RULE-BE.md mục 3: chuỗi / mảng luôn có max) ---- */
const line = (max = 200) => z.string().trim().max(max);
const lines = (maxItems = 12, maxLen = 200) => z.array(line(maxLen)).max(maxItems).default([]);
const pairRows = (maxItems = 12) => z.array(z.tuple([line(80), line(300)])).max(maxItems).default([]);

/** Nội dung chi tiết khi NTD tạo / sửa đơn */
export const jobDetailInputSchema = z.object({
  overview: line(2000).default(''),
  highlights: lines(8),
  tasks: lines(),
  environment: lines(),
  requirements: pairRows(),
  incomes: z.array(z.object({ label: line(80), value: line(80), note: line(200).optional(), highlight: z.boolean().default(false) })).max(8).default([]),
  hours: pairRows(8),
  benefits: lines(),
  included: lines(),
  documents: lines(),
  steps: z.array(z.object({ title: line(80), when: line(40), desc: line(300) })).max(10).default([]),
  recruitment: line(120).optional(),
  contract: line(120).optional(),
  expectedIncome: line(80).optional(),
});


const jobYear = z.coerce.number().int().min(1950).max(new Date().getFullYear());

/** Nhà tuyển dụng tạo / sửa đơn hàng */
export const jobUpsertSchema = z
  .object({
    title: z.string().trim().min(10, 'Tiêu đề tối thiểu 10 ký tự').max(160),
    imageUrl: z.string().trim().max(200).regex(JOB_IMAGE_PATTERN, 'Ảnh không hợp lệ, vui lòng tải ảnh lên').optional(),
    pref: z.enum(PREFECTURES as [string, ...string[]], { error: 'Tỉnh thành không hợp lệ' }),
    program: z.enum(PROGRAMS),
    industry: z.enum(INDUSTRIES),
    salary: z.coerce.number().int().min(50_000).max(1_000_000),
    quantity: z.coerce.number().int().min(1).max(500),
    gender: z.enum(JOB_GENDERS),
    birthYearFrom: jobYear,
    birthYearTo: jobYear,
    tags: z.array(z.enum(JOB_TAGS)).max(JOB_TAGS.length).default([]),
    badges: z.array(z.enum(BADGES)).max(BADGES.length).default([]),
    departureAt: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
    detail: jobDetailInputSchema.default(jobDetailInputSchema.parse({})),
    publish: z.boolean().default(true),
    /* ---- Trường thêm cho form đăng tin mới (tuỳ chọn – không phá vỡ API cũ) ---- */
    position: z.string().trim().min(2).max(80).optional(),
    examAt: z.coerce.date().optional(),
    feeUsd: z.coerce.number().int().min(0).max(20000).optional(),
    contractYears: z.coerce.number().int().min(1).max(5).optional(),
    jlptRequired: z.enum(JLPT_LEVELS).nullable().optional(),
    visibility: z.enum(JOB_VISIBILITIES).default('standard'),
    /** Cán bộ phụ trách (cùng doanh nghiệp) – mặc định là người đăng */
    recruiterId: z.string().trim().max(40).optional(),
    /** Có posting → server tự dựng nội dung chi tiết từ form */
    posting: jobPostingSchema.optional(),
  })
  .refine((v) => v.birthYearFrom <= v.birthYearTo, { message: 'Năm sinh "từ" phải nhỏ hơn hoặc bằng "đến"', path: ['birthYearFrom'] });
export type JobUpsertInput = z.infer<typeof jobUpsertSchema>;

/** Sắp xếp danh sách tin của NTD */
export const EMPLOYER_JOB_SORTS = ['updated', 'newest', 'applications', 'deadline'] as const;
export type EmployerJobSort = (typeof EMPLOYER_JOB_SORTS)[number];

/** Danh sách tin của NTD theo tab */
export const employerJobListSchema = paginationSchema.extend({
  tab: z.enum(EMPLOYER_JOB_TABS).default('visible'),
  q: z.string().trim().max(120).optional(),
  industry: z.enum(INDUSTRIES).optional(),
  sort: z.enum(EMPLOYER_JOB_SORTS).default('updated'),
});
export type EmployerJobListQuery = z.infer<typeof employerJobListSchema>;

/** Thông tin thị trường cho form đăng tin */
export const jobMarketSchema = z.object({
  industry: z.enum(INDUSTRIES),
  program: z.enum(PROGRAMS),
  pref: z.enum(PREFECTURES as [string, ...string[]]).optional(),
  gender: z.enum(JOB_GENDERS).optional(),
  birthYearFrom: z.coerce.number().int().min(1950).max(2020).optional(),
  birthYearTo: z.coerce.number().int().min(1950).max(2020).optional(),
  quantity: z.coerce.number().int().min(1).max(500).optional(),
});
export type JobMarketQuery = z.infer<typeof jobMarketSchema>;
