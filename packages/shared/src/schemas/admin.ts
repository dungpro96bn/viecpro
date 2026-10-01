import { z } from 'zod';
import { DASHBOARD_RANGES } from '../enums.js';
import { emailSchema, paginationSchema } from './common.js';

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

export const dashboardQuerySchema = z.object({
  range: z.enum(DASHBOARD_RANGES).default('30d'),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const rejectJobSchema = z.object({
  reason: z.string().trim().min(5, 'Vui lòng ghi lý do từ chối').max(500),
});
export type RejectJobInput = z.infer<typeof rejectJobSchema>;

/** Hàng chờ kiểm duyệt: phân trang, tìm theo tiêu đề hoặc nhà tuyển dụng */
export const moderationQueueSchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
});
export type ModerationQueueQuery = z.infer<typeof moderationQueueSchema>;

export const verificationDecisionSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type VerificationDecisionInput = z.infer<typeof verificationDecisionSchema>;
