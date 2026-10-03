import { z } from 'zod';
import {
  ADMIN_EMPLOYER_KINDS,
  ADMIN_EMPLOYER_TABS,
  ADMIN_SEEKER_TABS,
  DASHBOARD_RANGES,
  MODERATION_TABS,
  INDUSTRIES,
  PROGRAMS,
  REPORT_DECISIONS,
  REPORT_REASONS,
  REPORT_SEVERITIES,
  REPORT_TABS,
  REPORT_TARGETS,
  VERIFICATION_TABS,
} from '../enums.js';
import { ADMIN_PERMISSIONS } from '../admin.js';
import { PREFECTURES } from '../prefectures.js';
import { emailSchema, nameSchema, paginationSchema, passwordSchema } from './common.js';

/** Danh sách admin cho phép tối đa 100 dòng / trang (RULE-BE.md mục 2) */
const adminPagination = paginationSchema.extend({ limit: z.coerce.number().int().min(1).max(100).default(20) });
const flag = z.preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean()).default(false);
const search = z.string().trim().max(120).optional();

const totpCode = z.string().trim().regex(/^\d{6}$/, 'Mã gồm 6 chữ số');

/** Bước 1 đăng nhập admin: email + mật khẩu */
export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(200),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

/** Bước 2: mã 2FA từ ứng dụng xác thực, hoặc 1 mã khôi phục */
export const adminMfaSchema = z
  .object({
    challengeToken: z.string().min(20).max(2000),
    code: totpCode.optional(),
    recoveryCode: z.string().trim().max(32).optional(),
  })
  .refine((v) => v.code || v.recoveryCode, { message: 'Vui lòng nhập mã xác thực', path: ['code'] });
export type AdminMfaInput = z.infer<typeof adminMfaSchema>;

/** Lần đăng nhập đầu: quét QR rồi nhập mã để bật 2FA */
export const adminMfaSetupSchema = z.object({
  challengeToken: z.string().min(20).max(2000),
  code: totpCode,
});
export type AdminMfaSetupInput = z.infer<typeof adminMfaSetupSchema>;

/** Admin tự đổi mật khẩu (bắt buộc khi đang dùng mật khẩu tạm) */
export const adminChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại').max(200),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, { message: 'Mật khẩu mới phải khác mật khẩu hiện tại', path: ['newPassword'] });
export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;

export const dashboardQuerySchema = z.object({
  range: z.enum(DASHBOARD_RANGES).default('30d'),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const rejectJobSchema = z.object({
  reason: z.string().trim().min(5, 'Vui lòng ghi lý do từ chối').max(500),
});
export type RejectJobInput = z.infer<typeof rejectJobSchema>;

/** Hàng chờ kiểm duyệt: phân trang, tìm theo tiêu đề hoặc nhà tuyển dụng */
export const MODERATION_FILTERS = ['high_risk', 'reported', 'new_employer', 'sla'] as const;
export type ModerationFilter = (typeof MODERATION_FILTERS)[number];

export const moderationQueueSchema = paginationSchema.extend({
  /** Tìm theo tiêu đề, mã tin (VP-10231) hoặc nhà tuyển dụng */
  q: z.string().trim().max(120).optional(),
  tab: z.enum(MODERATION_TABS).default('pending'),
  /** Lọc nhanh (design 07): rủi ro cao · bị báo cáo · DN mới · sắp quá SLA */
  filter: z.enum(MODERATION_FILTERS).optional(),
});
export type ModerationQueueQuery = z.infer<typeof moderationQueueSchema>;

export const verificationDecisionSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

/** Từ chối hồ sơ xác minh: bắt buộc lý do */
export const verificationRejectSchema = z.object({
  note: z.string().trim().min(5, 'Vui lòng ghi lý do từ chối').max(500),
});
export type VerificationRejectInput = z.infer<typeof verificationRejectSchema>;

/** Danh sách xác minh (design 08) */
export const verificationListSchema = adminPagination.extend({
  tab: z.enum(VERIFICATION_TABS).default('pending'),
  kind: z.enum(['company', 'individual']).optional(),
  missingDocs: flag,
  q: search,
});
export type VerificationListQuery = z.infer<typeof verificationListSchema>;

/** Danh sách ứng viên (design 09) */
export const adminSeekerListSchema = adminPagination.extend({
  tab: z.enum(ADMIN_SEEKER_TABS).default('all'),
  q: search,
  industry: z.enum(INDUSTRIES).optional(),
  program: z.enum(PROGRAMS).optional(),
  jlptN3: flag,
  complete80: flag,
  new7d: flag,
  reported: flag,
  sort: z.enum(['recent', 'newest']).default('recent'),
});
export type AdminSeekerListQuery = z.infer<typeof adminSeekerListSchema>;

/** Khoá tài khoản: bắt buộc lý do (hiện cho người dùng khi đăng nhập) */
export const lockAccountSchema = z.object({
  reason: z.string().trim().min(5, 'Vui lòng ghi lý do khoá').max(300),
});
export type LockAccountInput = z.infer<typeof lockAccountSchema>;

/** Danh sách nhà tuyển dụng – gộp công ty XKLĐ và NTD cá nhân (design 10) */
export const adminEmployerListSchema = adminPagination.extend({
  kind: z.enum(ADMIN_EMPLOYER_KINDS).default('all'),
  tab: z.enum(ADMIN_EMPLOYER_TABS).default('all'),
  q: search,
  verified: flag,
  paid: flag,
  slowResponse: flag,
  reported: flag,
  sort: z.enum(['applicants', 'newest', 'jobs', 'reports']).default('applicants'),
});
export type AdminEmployerListQuery = z.infer<typeof adminEmployerListSchema>;

/** Cảnh cáo / tạm khoá nhà tuyển dụng */
export const employerSanctionSchema = z.object({
  reason: z.string().trim().min(5, 'Vui lòng ghi lý do').max(500),
  /** Mã 2FA xác nhận lại – bắt buộc khi tạm khoá (khoá mọi thành viên, ẩn mọi tin) */
  otp: totpCode.optional(),
});
export type EmployerSanctionInput = z.infer<typeof employerSanctionSchema>;

/** Danh sách báo cáo vi phạm (design 11) */
export const adminReportListSchema = adminPagination.extend({
  tab: z.enum(REPORT_TABS).default('open'),
  target: z.enum(REPORT_TARGETS).optional(),
  severity: z.enum(REPORT_SEVERITIES).optional(),
  reason: z.enum(REPORT_REASONS).optional(),
  /** Chỉ việc của tôi */
  mine: flag,
  q: search,
});
export type AdminReportListQuery = z.infer<typeof adminReportListSchema>;

/** Khách đăng ký tư vấn trong admin */
export const adminLeadListSchema = adminPagination.extend({
  tab: z.enum(['unhandled', 'handled']).default('unhandled'),
  q: search,
});
export type AdminLeadListQuery = z.infer<typeof adminLeadListSchema>;

/** Tìm tin cho màn hình sửa nội dung thay nhà tuyển dụng */
export const adminManageJobsQuerySchema = adminPagination.extend({ q: search });
export type AdminManageJobsQuery = z.infer<typeof adminManageJobsQuerySchema>;

/** Trường nội dung được phép sửa thay NTD; giữ nguyên trạng thái và thông tin sở hữu tin */
export const adminJobUpdateSchema = z.object({
  title: z.string().trim().min(10).max(160),
  industry: z.enum(INDUSTRIES),
  pref: z.enum(PREFECTURES as [string, ...string[]]),
  salary: z.coerce.number().int().min(50_000).max(1_000_000),
  quantity: z.coerce.number().int().min(1).max(500),
  description: z.string().trim().max(3000),
});
export type AdminJobUpdateInput = z.infer<typeof adminJobUpdateSchema>;

export const ADMIN_EXPORT_DATASETS = ['jobs', 'employers', 'applications', 'users'] as const;
export const adminExportSchema = z.object({ dataset: z.enum(ADMIN_EXPORT_DATASETS) });
export type AdminExportInput = z.infer<typeof adminExportSchema>;

const phoneOrEmpty = z.string().trim().max(24);
const emailOrEmpty = z.union([emailSchema, z.literal('')]);
export const systemSettingsSchema = z.object({
  supportPhone: phoneOrEmpty,
  supportEmail: emailOrEmpty,
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().trim().min(1).max(240),
});
export type SystemSettings = z.infer<typeof systemSettingsSchema>;

const safeContentUrl = z.string().trim().max(500).refine((v) => (/^\/(?!\/)/.test(v) || /^https:\/\//i.test(v)), 'Chỉ dùng đường dẫn nội bộ hoặc HTTPS');
const homeAdSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{1,32}$/),
  enabled: z.boolean(),
  image: safeContentUrl,
  tag: z.string().trim().max(50),
  title: z.string().trim().min(1).max(120),
  cta: z.string().trim().max(60),
  href: safeContentUrl,
});
const homeBannerSchema = z.object({
  enabled: z.boolean(),
  image: safeContentUrl,
  tag: z.string().trim().max(60),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(240),
  cta: z.string().trim().max(60),
  href: safeContentUrl,
});
export const homepageContentSchema = z.object({
  employerBanner: homeBannerSchema,
  courseBanner: homeBannerSchema,
  miniAdsTitle: z.string().trim().min(1).max(80),
  miniAds: z.array(homeAdSchema).max(8),
});
export type HomepageContent = z.infer<typeof homepageContentSchema>;

export const reportDecisionSchema = z
  .object({
    decision: z.enum(REPORT_DECISIONS),
    note: z.string().trim().max(500).optional(),
    /** Mã 2FA xác nhận lại – bắt buộc với quyết định tạm khoá / khoá vĩnh viễn */
    otp: totpCode.optional(),
  })
  .refine((v) => v.decision === 'dismiss' || (v.note?.length ?? 0) >= 5, { message: 'Ghi lý do xử lý (gửi cho bên bị báo cáo)', path: ['note'] });
export type ReportDecisionInput = z.infer<typeof reportDecisionSchema>;

/** Nhật ký hệ thống (A-12) – chỉ đọc */
export const auditLogListSchema = adminPagination.extend({
  actorId: z.string().trim().max(40).optional(),
  action: z.string().trim().max(60).optional(),
  targetType: z.string().trim().max(40).optional(),
  targetId: z.string().trim().max(40).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AuditLogListQuery = z.infer<typeof auditLogListSchema>;
export type VerificationDecisionInput = z.infer<typeof verificationDecisionSchema>;

/* ---------- Phân quyền: quản trị viên & vai trò (A-11) ---------- */
export const ADMIN_ACCOUNT_STATUSES = ['all', 'active', 'locked', 'mfa_pending'] as const;
export type AdminAccountStatus = (typeof ADMIN_ACCOUNT_STATUSES)[number];

export const adminAccountListSchema = adminPagination.extend({
  status: z.enum(ADMIN_ACCOUNT_STATUSES).default('all'),
  roleId: z.string().trim().max(40).optional(),
  q: search,
});
export type AdminAccountListQuery = z.infer<typeof adminAccountListSchema>;

/** Mã 2FA xác nhận lại cho thao tác nhạy cảm (RULE-BE.md mục 7) */
const stepUp = { otp: totpCode.optional() };
const roleId = z.string().trim().min(1, 'Chọn vai trò').max(40);

export const createAdminSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  roleId,
  ...stepUp,
});
export type CreateAdminInput = z.infer<typeof createAdminSchema>;

export const changeAdminRoleSchema = z.object({ roleId, ...stepUp });
export type ChangeAdminRoleInput = z.infer<typeof changeAdminRoleSchema>;

export const lockAdminSchema = z.object({
  reason: z.string().trim().min(5, 'Ghi lý do khoá (tối thiểu 5 ký tự)').max(300),
  ...stepUp,
});
export type LockAdminInput = z.infer<typeof lockAdminSchema>;

/** Đặt lại 2FA / mật khẩu: chỉ cần mã xác nhận */
export const adminStepUpSchema = z.object(stepUp);
export type AdminStepUpInput = z.infer<typeof adminStepUpSchema>;

const roleFields = {
  name: z.string().trim().min(2, 'Nhập tên vai trò').max(60),
  description: z.string().trim().max(200).optional(),
  permissions: z.array(z.enum(ADMIN_PERMISSIONS)).min(1, 'Chọn ít nhất 1 quyền').max(ADMIN_PERMISSIONS.length),
};

export const createAdminRoleSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{2,39}$/, 'Mã gồm 3–40 ký tự a-z, 0-9, _ và bắt đầu bằng chữ'),
  ...roleFields,
  ...stepUp,
});
export type CreateAdminRoleInput = z.infer<typeof createAdminRoleSchema>;

export const updateAdminRoleSchema = z.object({ ...roleFields, ...stepUp });
export type UpdateAdminRoleInput = z.infer<typeof updateAdminRoleSchema>;
