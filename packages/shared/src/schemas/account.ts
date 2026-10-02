import { z } from 'zod';
import {
  ALERT_CHANNELS,
  ALERT_FREQUENCIES,
  GENDERS,
  INDUSTRIES,
  LOCALES,
  NOTIFICATION_GROUPS,
  PHONE_VISIBILITIES,
  PROGRAMS,
  REGIONS,
  REPORT_REASONS,
  RESET_CHANNELS,
  THEMES,
} from '../enums.js';
import { normalizeVnPhone } from '../utils.js';
import { emailSchema, passwordSchema, phoneSchema } from './common.js';

const code6 = z.string().trim().regex(/^\d{6}$/, 'Mã gồm 6 chữ số');

/** Email hoặc số điện thoại đã đăng ký */
const identifierSchema = z
  .string({ error: 'Vui lòng nhập email hoặc số điện thoại' })
  .trim()
  .min(1, 'Vui lòng nhập email hoặc số điện thoại')
  .max(120)
  .refine((v) => (v.includes('@') ? z.email().safeParse(v.toLowerCase()).success : normalizeVnPhone(v) !== null), 'Email hoặc số điện thoại chưa đúng');

/* ------------------------------------------------------------------ */
/* Quên mật khẩu (design 03)                                          */
/* ------------------------------------------------------------------ */
/** Bước 1: gửi mã tới SMS hoặc email của tài khoản */
export const forgotPasswordSchema = z.object({
  identifier: identifierSchema,
  channel: z.enum(RESET_CHANNELS).default('sms'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Bước 2–3: nhập mã + mật khẩu mới. Nhận `identifier` (email / SĐT) + `channel`;
 * vẫn nhận `phone` như bản cũ để app mobile chưa cập nhật không bị lỗi (RULE-BE.md mục 2).
 */
export const resetPasswordSchema = z
  .object({
    identifier: identifierSchema.optional(),
    phone: phoneSchema.optional(),
    channel: z.enum(RESET_CHANNELS).default('sms'),
    code: code6,
    password: passwordSchema,
  })
  .refine((v) => v.identifier || v.phone, { message: 'Vui lòng nhập email hoặc số điện thoại', path: ['identifier'] });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/* ------------------------------------------------------------------ */
/* Thông báo việc làm (design 04 – spec 3.12)                         */
/* ------------------------------------------------------------------ */
export const jobAlertCriteriaSchema = z.object({
  industries: z.array(z.enum(INDUSTRIES)).max(INDUSTRIES.length).default([]),
  /** Tỉnh Nhật (nhiều tỉnh); rỗng = toàn Nhật Bản */
  prefs: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  regions: z.array(z.enum(REGIONS)).max(REGIONS.length).default([]),
  programs: z.array(z.enum(PROGRAMS)).max(PROGRAMS.length).default([]),
  salaryMin: z.coerce.number().int().min(0).max(2_000_000).nullable().default(null),
  /** Chỉ đơn miễn phí xuất cảnh */
  freeOnly: z.boolean().default(false),
  gender: z.enum(GENDERS).nullable().default(null),
});
export type JobAlertCriteria = z.infer<typeof jobAlertCriteriaSchema>;

export const jobAlertSchema = z.object({
  /** Bỏ trống: hệ thống tự đặt tên theo tiêu chí ("Điện tử · Kanto · Miễn phí") */
  name: z.string().trim().max(60).optional(),
  criteria: jobAlertCriteriaSchema,
  channels: z.array(z.enum(ALERT_CHANNELS)).min(1, 'Chọn ít nhất 1 kênh nhận').max(ALERT_CHANNELS.length),
  frequency: z.enum(ALERT_FREQUENCIES).default('daily'),
  enabled: z.boolean().default(true),
});
export type JobAlertInput = z.infer<typeof jobAlertSchema>;

export const jobAlertUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    criteria: jobAlertCriteriaSchema,
    channels: z.array(z.enum(ALERT_CHANNELS)).min(1, 'Chọn ít nhất 1 kênh nhận').max(ALERT_CHANNELS.length),
    frequency: z.enum(ALERT_FREQUENCIES),
    enabled: z.boolean(),
  })
  .partial();
export type JobAlertUpdateInput = z.infer<typeof jobAlertUpdateSchema>;

/* ------------------------------------------------------------------ */
/* Cài đặt (design 05)                                                 */
/* ------------------------------------------------------------------ */
const hhmm = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ dạng HH:mm');
const channelToggles = z.object({ app: z.boolean(), email: z.boolean(), sms: z.boolean() }).partial();

export const settingsUpdateSchema = z
  .object({
    notifications: z.partialRecord(z.enum(NOTIFICATION_GROUPS), channelToggles),
    quietHours: z.object({ enabled: z.boolean(), from: hhmm, to: hhmm }).partial(),
    discoverable: z.boolean(),
    phoneVisibility: z.enum(PHONE_VISIBILITIES),
    locale: z.enum(LOCALES),
    theme: z.enum(THEMES),
  })
  .partial();
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

/** Đổi email bước 1: gửi mã tới email mới */
export const changeEmailRequestSchema = z.object({ email: emailSchema });
export type ChangeEmailRequestInput = z.infer<typeof changeEmailRequestSchema>;

/** Đổi email bước 2 */
export const changeEmailConfirmSchema = z.object({ email: emailSchema, code: code6 });
export type ChangeEmailConfirmInput = z.infer<typeof changeEmailConfirmSchema>;

/**
 * Đổi số điện thoại bước 1: gửi OTP tới số mới. Tài khoản có mật khẩu phải nhập lại mật khẩu
 * (thay cho OTP số cũ khi người dùng không còn dùng số cũ).
 */
export const changePhoneRequestSchema = z.object({
  phone: phoneSchema,
  currentPassword: z.string().max(200).optional(),
});
export type ChangePhoneRequestInput = z.infer<typeof changePhoneRequestSchema>;

export const changePhoneConfirmSchema = z.object({ phone: phoneSchema, code: code6 });
export type ChangePhoneConfirmInput = z.infer<typeof changePhoneConfirmSchema>;

/* ------------------------------------------------------------------ */
/* Báo cáo vi phạm phía người dùng (M18)                              */
/* ------------------------------------------------------------------ */
export const reportCreateSchema = z
  .object({
    /** Người dùng chỉ báo cáo được tin, công ty, NTD cá nhân (ứng viên do NTD / hệ thống báo cáo) */
    targetType: z.enum(['job', 'employer', 'recruiter']),
    /** id hoặc slug của đối tượng */
    target: z.string().trim().min(1).max(180),
    reason: z.enum(REPORT_REASONS),
    detail: z.string().trim().max(1000, 'Mô tả tối đa 1000 ký tự').optional(),
    /** Khách (chưa đăng nhập) để lại email / SĐT để nhận kết quả */
    contact: z
      .string()
      .trim()
      .max(120)
      .refine((v) => z.email().safeParse(v).success || normalizeVnPhone(v) !== null, 'Email hoặc số điện thoại chưa đúng')
      .optional(),
  })
  .refine((v) => v.reason !== 'other' || (v.detail?.length ?? 0) >= 10, { message: 'Mô tả ngắn gọn vấn đề (ít nhất 10 ký tự)', path: ['detail'] });
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
