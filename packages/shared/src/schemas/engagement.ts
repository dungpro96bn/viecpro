import { z } from 'zod';
import { SAVED_JOB_SORTS, SEEKER_APPLICATION_TABS, APPLICANT_STAGES, APPLICATION_STATUSES, EDUCATION_LEVELS, EMPLOYER_RANGES, JLPT_LEVELS, MANUAL_APPLICATION_SOURCES, MARITAL_STATUSES, PASSPORT_STATUSES, INTERVIEW_KINDS, INVITE_CHANNELS, MEETING_PLATFORMS, GENDERS, INDUSTRIES, PLATFORMS, PROGRAMS } from '../enums.js';
import { normalizeVnPhone } from '../utils.js';
import { birthYearSchema, csvArray, emailSchema, nameSchema, paginationSchema, phoneSchema } from './common.js';

/** Popup "Ứng tuyển nhanh" – khách hoặc người đã đăng nhập */
export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'Mã gồm 6 chữ số');

/** Gửi mã xác nhận tới email trước khi ứng tuyển */
export const applyEmailOtpSchema = z
  .object({
    email: emailSchema,
    jobId: z.string().trim().min(1).max(80).optional(),
    jobSlug: z.string().trim().min(1).max(180).optional(),
    /** Tên để chào trong email (không lưu) */
    fullName: z.string().trim().max(80).optional(),
  })
  .refine((value) => Boolean(value.jobId || value.jobSlug), { message: 'Thiếu mã đơn hàng', path: ['jobId'] });
export type ApplyEmailOtpInput = z.infer<typeof applyEmailOtpSchema>;

/**
 * Ứng tuyển nhanh. Email bắt buộc và phải xác nhận bằng mã OTP gửi tới email đó
 * (`emailCode`), trừ khi tài khoản ứng viên đang đăng nhập đã xác thực đúng email này.
 */
export const applySchema = z.object({
  jobId: z.string().trim().min(1).max(80).optional(),
  jobSlug: z.string().trim().min(1).max(180).optional(),
  fullName: nameSchema,
  phone: phoneSchema,
  email: emailSchema,
  emailCode: otpCodeSchema.optional(),
  birthYear: birthYearSchema,
  gender: z.enum(GENDERS),
  address: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
}).refine((value) => Boolean(value.jobId || value.jobSlug), {
  message: 'Thiếu mã đơn hàng',
  path: ['jobId'],
});
export type ApplyInput = z.infer<typeof applySchema>;

/** Nhà tuyển dụng cập nhật trạng thái hồ sơ */
export const applicationStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES).exclude(['submitted', 'withdrawn']),
  interviewAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
});
export type ApplicationStatusInput = z.infer<typeof applicationStatusSchema>;

/** Lọc nhanh ở trang ứng viên của NTD */
export const APPLICANT_QUICK_FILTERS = ['unseen', 'passport', 'match90', 'overdue'] as const;
export type ApplicantQuickFilter = (typeof APPLICANT_QUICK_FILTERS)[number];

export const applicationListSchema = paginationSchema.extend({
  jobId: z.string().trim().max(40).optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  stage: z.enum(APPLICANT_STAGES).optional(),
  q: z.string().trim().max(80).optional(),
  minMatch: z.coerce.number().int().min(0).max(100).optional(),
  quick: z.enum(APPLICANT_QUICK_FILTERS).optional(),
});
export type ApplicationListQuery = z.infer<typeof applicationListSchema>;

/** Form "Đăng ký tư vấn" ở trang hồ sơ / chi tiết đơn */
export const consultSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  recruiterSlug: z.string().trim().min(1).max(100).optional(),
  employerSlug: z.string().trim().min(1).max(100).optional(),
  jobId: z.string().trim().min(1).max(80).optional(),
});
export type ConsultInput = z.infer<typeof consultSchema>;

/** Form "Nhận đơn hàng mới" ở footer – email hoặc số điện thoại */
export const subscribeSchema = z.object({
  contact: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập email hoặc số điện thoại')
    .refine((v) => z.email().safeParse(v).success || normalizeVnPhone(v) !== null, 'Email hoặc số điện thoại chưa đúng'),
  prefs: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  programs: z.array(z.enum(PROGRAMS)).max(PROGRAMS.length).default([]),
});
export type SubscribeInput = z.infer<typeof subscribeSchema>;

/** Kỹ năng tự đánh giá (1–5). Cờ "đã xác nhận" chỉ cán bộ tư vấn đặt, client không gửi */
export const seekerSkillSchema = z.object({
  name: z.string().trim().min(2, 'Nhập tên kỹ năng').max(60),
  level: z.coerce.number().int().min(1).max(5),
  note: z.string().trim().max(60).nullable().default(null),
});
export type SeekerSkillInput = z.infer<typeof seekerSkillSchema>;

/** Tháng "YYYY-MM" hoặc năm "YYYY" */
const yearMonthSchema = z.string().trim().regex(/^(19|20)\d{2}(-(0[1-9]|1[0-2]))?$/, 'Định dạng MM/YYYY');

/** Kinh nghiệm làm việc / học vấn */
export const seekerExperienceSchema = z.object({
  kind: z.enum(['work', 'education']),
  title: z.string().trim().min(2, 'Nhập vị trí / bằng cấp').max(80),
  org: z.string().trim().max(120).default(''),
  from: yearMonthSchema,
  /** null = đến nay */
  to: yearMonthSchema.nullable().default(null),
  desc: z.string().trim().max(500).default(''),
  tags: z.array(z.string().trim().min(1).max(30)).max(6).default([]),
});
export type SeekerExperienceInput = z.infer<typeof seekerExperienceSchema>;

/** Gắn tệp đã tải lên vào một mục giấy tờ xuất cảnh */
export const seekerDocumentUploadSchema = z.object({
  path: z.string().trim().max(240).regex(/^uploads\/[a-z0-9]+\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i, 'Tệp chưa đúng'),
});
export type SeekerDocumentUploadInput = z.infer<typeof seekerDocumentUploadSchema>;

/** Hồ sơ người tìm việc (trang tài khoản) */
export const seekerProfileSchema = z
  .object({
    name: nameSchema,
    email: emailSchema.nullable(),
    birthYear: birthYearSchema,
    gender: z.enum(GENDERS),
    hometown: z.string().trim().max(80).nullable(),
    address: z.string().trim().max(200).nullable(),
    programs: z.array(z.enum(PROGRAMS)).max(PROGRAMS.length),
    industries: z.array(z.enum(INDUSTRIES)).max(INDUSTRIES.length),
    prefs: z.array(z.string().trim().min(1).max(80)).max(20),
    jlpt: z.enum(['N5', 'N4', 'N3', 'N2', 'N1']).nullable(),
    about: z.string().trim().max(1000).nullable(),
    avatarUrl: z.string().trim().max(240).nullable(),
    videoUrl: z.string().trim().max(240).nullable(),
    lookingForJob: z.boolean(),
    discoverable: z.boolean(),
    heightCm: z.coerce.number().int().min(120).max(220).nullable(),
    weightKg: z.coerce.number().int().min(30).max(150).nullable(),
    eyesight: z.string().trim().max(60).nullable(),
    maritalStatus: z.enum(MARITAL_STATUSES).nullable(),
    tattoo: z.boolean().nullable(),
    desiredSalary: z.coerce.number().int().min(0).max(2_000_000).nullable(),
    departWithin: z.enum(['3', '6', '12']).nullable(),
    maxFeeUsd: z.coerce.number().int().min(0).max(20_000).nullable(),
    jlptLearning: z.enum(JLPT_LEVELS).nullable(),
    skills: z.array(seekerSkillSchema).max(12),
    experiences: z.array(seekerExperienceSchema).max(15),
  })
  .partial();
export type SeekerProfileInput = z.infer<typeof seekerProfileSchema>;

/** Mobile đăng ký token nhận thông báo đẩy (FCM / APNs) */
export const pushTokenSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(PLATFORMS).exclude(['web']),
  deviceName: z.string().trim().max(120).optional(),
  appVersion: z.string().trim().max(20).optional(),
});
export type PushTokenInput = z.infer<typeof pushTokenSchema>;

/** Dashboard NTD: khoảng 7 / 14 / 30 / 90 ngày */
export const employerRangeSchema = z.object({
  range: z.enum(EMPLOYER_RANGES).default('14'),
});
export type EmployerRangeQuery = z.infer<typeof employerRangeSchema>;

export const employerReportQuerySchema = z.object({ range: z.enum(['7', '30', '90']).default('30') });
export type EmployerReportQuery = z.infer<typeof employerReportQuerySchema>;
export const employerReviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(10, 'Đánh giá cần ít nhất 10 ký tự').max(1500),
});
export type EmployerReviewCreateInput = z.infer<typeof employerReviewCreateSchema>;
export const employerReviewResponseSchema = z.object({ response: z.string().trim().min(3).max(1500) });
export type EmployerReviewResponseInput = z.infer<typeof employerReviewResponseSchema>;

/** Ghi chú nội bộ trên hồ sơ */
export const applicantNoteSchema = z.object({
  body: z.string().trim().min(1, 'Vui lòng nhập ghi chú').max(1000),
});
export type ApplicantNoteInput = z.infer<typeof applicantNoteSchema>;

/** Lịch phỏng vấn theo khoảng ngày (tuần / danh sách) – tối đa 6 tuần */
export const interviewRangeSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((v) => v.to > v.from && v.to.getTime() - v.from.getTime() <= 42 * 86400_000, { message: 'Khoảng ngày không hợp lệ', path: ['to'] });
export type InterviewRangeQuery = z.infer<typeof interviewRangeSchema>;

/** Dời lịch hẹn */
export const interviewRescheduleSchema = z
  .object({
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.endAt > v.startAt && v.endAt.getTime() - v.startAt.getTime() <= 8 * 3600_000, { message: 'Giờ kết thúc phải sau giờ bắt đầu (tối đa 8 giờ)', path: ['endAt'] });
export type InterviewRescheduleInput = z.infer<typeof interviewRescheduleSchema>;

/** Ghi kết quả buổi hẹn: ai tham gia / vắng mặt + nhận xét */
export const interviewResultSchema = z.object({
  attendees: z
    .array(z.object({ applicationId: z.string().trim().min(1).max(40), status: z.enum(['attended', 'no_show']) }))
    .min(1)
    .max(30),
  result: z.string().trim().max(1000).optional(),
});
export type InterviewResultInput = z.infer<typeof interviewResultSchema>;

/** Tạo lịch hẹn (design 17) */
export const interviewCreateSchema = z
  .object({
    kind: z.enum(INTERVIEW_KINDS),
    applicationIds: z.array(z.string().trim().min(1).max(40)).min(1, 'Chọn ít nhất 1 ứng viên').max(30),
    startAt: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(15).max(480),
    platform: z.enum(MEETING_PLATFORMS).optional(),
    /** Chỉ nhận https (link hiển thị cho ứng viên và gửi qua email) */
    meetingUrl: z.url({ protocol: /^https$/, error: 'Link phòng họp phải bắt đầu bằng https://' }).trim().max(300).optional(),
    location: z.string().trim().max(200).optional(),
    interviewerIds: z.array(z.string().trim().min(1).max(40)).min(1, 'Chọn ít nhất 1 người phỏng vấn').max(10),
    partnerName: z.string().trim().max(120).optional(),
    channels: z.array(z.enum(INVITE_CHANNELS)).max(INVITE_CHANNELS.length).default([]),
    remind24h: z.boolean().default(true),
    remind2h: z.boolean().default(true),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.kind !== 'online' || !!v.platform, { message: 'Chọn nền tảng họp online', path: ['platform'] })
  .refine((v) => v.kind === 'online' || !!v.location, { message: 'Nhập địa điểm', path: ['location'] });
export type InterviewCreateInput = z.infer<typeof interviewCreateSchema>;

/** Giấy tờ đính kèm hồ sơ (tệp đã tải lên kho qua presigned URL) */
export const applicantDocumentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['pdf', 'image']),
  sizeKb: z.coerce.number().int().min(1).max(51200),
  path: z.string().trim().max(240).regex(/^uploads\/[a-z0-9]+\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i).optional(),
});

/** NTD tự thêm ứng viên (design 16) */
export const manualApplicantSchema = z.object({
  jobId: z.string().trim().min(1, 'Chọn tin tuyển dụng').max(40),
  fullName: nameSchema,
  phone: phoneSchema,
  birthYear: birthYearSchema,
  gender: z.enum(GENDERS),
  hometown: z.string().trim().max(60).optional(),
  heightCm: z.coerce.number().int().min(120).max(220).optional(),
  weightKg: z.coerce.number().int().min(30).max(150).optional(),
  maritalStatus: z.enum(MARITAL_STATUSES).optional(),
  email: emailSchema.optional().or(z.literal('').transform(() => undefined)),
  education: z.enum(EDUCATION_LEVELS).optional(),
  jlpt: z.enum(JLPT_LEVELS).optional(),
  passport: z.enum(PASSPORT_STATUSES).optional(),
  departWithin: z.enum(['3', '6', '12']).optional(),
  experience: z.string().trim().max(300).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  documents: z.array(applicantDocumentSchema).max(5).default([]),
  stage: z.enum(['new', 'contacted']).default('new'),
  assigneeId: z.string().trim().max(40).optional(),
  source: z.enum(MANUAL_APPLICATION_SOURCES),
  note: z.string().trim().max(1000).optional(),
  /** Ứng viên đồng ý cho doanh nghiệp lưu và xử lý dữ liệu cá nhân */
  consent: z.literal(true, { error: 'Cần xác nhận ứng viên đã đồng ý xử lý dữ liệu' }),
});
export type ManualApplicantInput = z.infer<typeof manualApplicantSchema>;

/** Nhập hàng loạt từ tệp Excel / CSV (tối đa 500 dòng / lần) */
export const importApplicantsSchema = z.object({
  source: z.enum(MANUAL_APPLICATION_SOURCES).default('other'),
  consent: z.literal(true, { error: 'Cần xác nhận ứng viên đã đồng ý xử lý dữ liệu' }),
  rows: z
    .array(
      z.object({
        fullName: z.string().trim().max(80),
        phone: z.string().trim().max(20),
        birthYear: z.coerce.number().int().min(1900).max(2100),
        gender: z.string().trim().max(10),
        hometown: z.string().trim().max(60).optional(),
        jobCode: z.string().trim().max(20),
      }),
    )
    .min(1, 'Tệp không có dòng dữ liệu')
    .max(500, 'Tối đa 500 hồ sơ mỗi lần'),
});
export type ImportApplicantsInput = z.infer<typeof importApplicantsSchema>;

/** Gợi ý tin phù hợp khi đang nhập ứng viên */
export const applicantJobMatchSchema = z.object({
  birthYear: z.coerce.number().int().min(1940).max(2015).optional(),
  gender: z.enum(GENDERS).optional(),
  jlpt: z.enum(JLPT_LEVELS).optional(),
  passport: z.enum(PASSPORT_STATUSES).optional(),
  tags: csvArray(z.string().trim().max(30)),
});
export type ApplicantJobMatchQuery = z.infer<typeof applicantJobMatchSchema>;

/** Kiểm tra trùng hồ sơ theo số điện thoại / họ tên */
export const applicantDuplicateSchema = z.object({
  phone: z.string().trim().max(20).optional(),
  name: z.string().trim().max(80).optional(),
});
export type ApplicantDuplicateQuery = z.infer<typeof applicantDuplicateSchema>;

/** Ứng viên chờ hẹn lịch */
export const interviewCandidatesSchema = z.object({
  q: z.string().trim().max(80).optional(),
  ids: csvArray(z.string().trim().min(1).max(40)),
});
export type InterviewCandidatesQuery = z.infer<typeof interviewCandidatesSchema>;

/** Lịch bận của người phỏng vấn trong N ngày */
export const interviewAvailabilitySchema = z.object({
  from: z.coerce.date(),
  days: z.coerce.number().int().min(1).max(14).default(7),
  interviewerIds: csvArray(z.string().trim().min(1).max(40)),
});
export type InterviewAvailabilityQuery = z.infer<typeof interviewAvailabilitySchema>;

/** Việc đã ứng tuyển (design 19) – vẫn nhận page/limit như trước */
export const seekerApplicationListSchema = paginationSchema.extend({
  tab: z.enum(SEEKER_APPLICATION_TABS).default('all'),
  q: z.string().trim().max(80).optional(),
  sort: z.enum(['updated', 'applied']).default('updated'),
});
export type SeekerApplicationListQuery = z.infer<typeof seekerApplicationListSchema>;

/** Ứng viên xin đổi giờ phỏng vấn */
export const interviewChangeRequestSchema = z.object({
  reason: z.string().trim().min(5, 'Cho cán bộ biết lý do và giờ bạn rảnh').max(300),
});
export type InterviewChangeRequestInput = z.infer<typeof interviewChangeRequestSchema>;

/** Việc đã lưu (design 20) */
export const savedJobListSchema = paginationSchema.extend({
  sort: z.enum(SAVED_JOB_SORTS).default('expiring'),
  industry: z.enum(INDUSTRIES).optional(),
});
export type SavedJobListQuery = z.infer<typeof savedJobListSchema>;

/** Ứng tuyển nhanh nhiều việc đã lưu bằng thông tin hồ sơ */
export const savedJobsApplySchema = z.object({
  jobIds: z.array(z.string().trim().min(1).max(40)).min(1, 'Chọn ít nhất 1 việc').max(5, 'Tối đa 5 việc mỗi lần'),
});
export type SavedJobsApplyInput = z.infer<typeof savedJobsApplySchema>;
