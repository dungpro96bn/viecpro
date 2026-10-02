import { z } from 'zod';
import { GENDERS, OTP_PURPOSES, PLATFORMS, PROGRAMS, ROLES } from '../enums.js';
import { birthYearSchema, emailSchema, nameSchema, passwordSchema, phoneSchema } from './common.js';

/** Thông tin thiết bị – web gửi platform "web", mobile gửi ios/android + tên máy */
export const deviceSchema = z.object({
  platform: z.enum(PLATFORMS).default('web'),
  deviceName: z.string().trim().max(120).optional(),
});

const seekerRegister = z.object({
  role: z.literal('seeker'),
  name: nameSchema,
  phone: phoneSchema,
  password: passwordSchema,
  birthYear: birthYearSchema,
  gender: z.enum(GENDERS).default('nam'),
  programs: z.array(z.enum(PROGRAMS)).default([]),
});

const employerRegister = z.object({
  role: z.literal('employer'),
  name: nameSchema,
  phone: phoneSchema,
  password: passwordSchema,
  company: z.string({ error: 'Vui lòng nhập tên công ty' }).trim().min(2, 'Vui lòng nhập tên công ty').max(160),
});

/** Bước 1 đăng ký: tạo tài khoản chờ xác thực + gửi OTP */
export const registerSchema = z.discriminatedUnion('role', [seekerRegister, employerRegister]);
export type RegisterInput = z.infer<typeof registerSchema>;

/** Bước 2 đăng ký: xác thực OTP → đăng nhập luôn */
export const verifyRegisterSchema = deviceSchema.extend({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{6}$/, 'Mã gồm 6 chữ số'),
});
export type VerifyRegisterInput = z.infer<typeof verifyRegisterSchema>;

export const sendOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(OTP_PURPOSES),
});
export type SendOtpInput = z.infer<typeof sendOtpSchema>;

/** Đăng nhập bằng email hoặc số điện thoại */
export const loginSchema = deviceSchema.extend({
  identifier: z.string().trim().min(1, 'Vui lòng nhập email hoặc số điện thoại'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
  /** Vai trò chọn trên form – báo lỗi nếu tài khoản thuộc vai trò khác */
  role: z.enum(ROLES).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Mobile gửi refresh token trong body (platform ios/android); web dùng cookie httpOnly */
export const refreshSchema = deviceSchema.pick({ platform: true }).extend({
  refreshToken: z.string().min(20).optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const googleLoginSchema = deviceSchema.extend({
  /** Google chỉ tạo tài khoản người tìm việc; NTD đăng ký bằng số điện thoại (cần tên công ty) */
  idToken: z.string().trim().min(10).max(8192),
});
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;

/** resetPasswordSchema: xem schemas/account.ts (email hoặc SĐT, kênh SMS / email) */

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export { emailSchema };
