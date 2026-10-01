import { z } from 'zod';
import { PASSWORD_RULES, normalizeVnPhone } from '../utils.js';

/** Số điện thoại VN, tự chuẩn hoá về "+84xxxxxxxxx" */
export const phoneSchema = z
  .string({ error: 'Vui lòng nhập số điện thoại' })
  .trim()
  .min(1, 'Vui lòng nhập số điện thoại')
  .transform((v, ctx) => {
    const phone = normalizeVnPhone(v);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Số điện thoại chưa đúng' });
      return z.NEVER;
    }
    return phone;
  });

/** Cắt khoảng trắng + chữ thường trước khi kiểm tra định dạng; tối đa 120 ký tự */
export const emailSchema = z.string().trim().toLowerCase().max(120, 'Email tối đa 120 ký tự').pipe(z.email('Email chưa đúng định dạng'));

export const passwordSchema = z
  .string({ error: 'Vui lòng nhập mật khẩu' })
  .max(72, 'Mật khẩu tối đa 72 ký tự')
  .refine((v) => PASSWORD_RULES.every((r) => r.test(v)), 'Mật khẩu cần 8+ ký tự, có chữ số, chữ hoa và chữ thường');

const thisYear = new Date().getFullYear();
export const birthYearSchema = z.coerce
  .number({ error: 'Vui lòng chọn năm sinh' })
  .int()
  .min(thisYear - 60, 'Năm sinh không hợp lệ')
  .max(thisYear - 16, 'Bạn cần đủ 16 tuổi');

export const nameSchema = z.string({ error: 'Vui lòng nhập họ và tên' }).trim().min(2, 'Vui lòng nhập họ và tên').max(80);

/** Mảng lấy từ query: nhận "a,b" hoặc ?x=a&x=b */
export function csvArray<T extends z.ZodType>(item: T) {
  return z.preprocess((v) => {
    if (v === undefined || v === '') return undefined;
    const arr = Array.isArray(v) ? v : String(v).split(',');
    return arr.map((s) => String(s).trim()).filter(Boolean);
  }, z.array(item).optional());
}

/** Phân trang dạng trang (web) – mobile dùng page tăng dần cho cuộn vô hạn */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof paginationSchema>;
