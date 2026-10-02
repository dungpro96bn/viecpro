import { z } from 'zod';
import { contactPhoneSchema, emailSchema, nameSchema, passwordSchema, phoneSchema } from './common.js';

/**
 * Hồ sơ công khai của NTD (trang /nha-tuyen-dung/[slug], /tu-van-vien/[slug]).
 * Khối `legal` (pháp lý) và `checks` (mục đã xác minh) do admin quản lý – không có ở đây.
 */
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).optional().transform((v) => v || null);
/** Ảnh đã tải lên qua /me/assets – null để gỡ ảnh, bỏ trống = giữ nguyên */
const imagePath = z.string().trim().max(240).regex(/^uploads\/[a-z0-9]+\/[0-9a-f-]{36}\.(jpg|png|webp)$/i, 'Ảnh không hợp lệ').nullable().optional();

/** ["15+", "Năm kinh nghiệm"] */
const statRow = z.tuple([text(20).min(1, 'Nhập con số'), text(40).min(1, 'Nhập nhãn')]);
const valueItem = z.object({ title: text(60).min(1, 'Nhập tiêu đề'), desc: text(240) });
const tags = (maxItems: number, maxLen = 40) => z.array(text(maxLen).min(1)).max(maxItems);

export const recruiterProfileSectionsSchema = z.object({
  stats: z.array(statRow).max(4).default([]),
  values: z.array(valueItem).max(6).default([]),
  fields: tags(12).default([]),
  prefectures: tags(20).default([]),
  timeline: z.array(z.object({ when: text(30).min(1, 'Nhập thời gian'), title: text(80).min(1, 'Nhập tiêu đề'), desc: text(300) })).max(12).default([]),
  certificates: z.array(z.object({ title: text(80).min(1, 'Nhập tên chứng chỉ'), desc: text(200) })).max(10).default([]),
});
export type RecruiterProfileSections = z.infer<typeof recruiterProfileSectionsSchema>;

/** Cán bộ tự sửa hồ sơ tư vấn viên của mình */
export const recruiterProfileSchema = z.object({
  name: nameSchema,
  title: text(80).min(2, 'Nhập chức danh'),
  headline: optionalText(160),
  intro: optionalText(3000),
  city: optionalText(60),
  /** Số liên hệ công khai (hiện đầy đủ khi người xem đã đăng nhập) */
  phone: phoneSchema.nullable().optional(),
  photoPath: imagePath,
  sections: recruiterProfileSectionsSchema,
});
export type RecruiterProfileInput = z.infer<typeof recruiterProfileSchema>;

export const companyProfileSectionsSchema = z.object({
  stats: z.array(statRow).max(4).default([]),
  values: z.array(valueItem).max(6).default([]),
  offices: tags(10, 80).default([]),
  fields: tags(12).default([]),
});
export type CompanyProfileSections = z.infer<typeof companyProfileSectionsSchema>;

/** Quản trị viên doanh nghiệp sửa hồ sơ công ty. Tên pháp lý / MST đổi qua xác minh lại */
export const companyProfileSchema = z.object({
  shortName: optionalText(60),
  intro: optionalText(4000),
  phone: contactPhoneSchema.nullable().optional(),
  email: emailSchema.nullable().optional(),
  /** Nhận cả "camcom.vn" – tự thêm https:// */
  website: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .refine((v) => !v || /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v), 'Website chưa đúng, vd. camcom.vn')
    .optional()
    .transform((v) => v || null),
  address: optionalText(200),
  logoPath: imagePath,
  coverPath: imagePath,
  sections: companyProfileSectionsSchema,
});
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

/* ---------- Thành viên doanh nghiệp ---------- */
/** Số thành viên tối đa của một doanh nghiệp (kể cả lời mời đang chờ) */
export const COMPANY_MEMBER_LIMIT = 50;

/** Quản trị viên doanh nghiệp mời cán bộ mới (số chưa có tài khoản viecpro) */
export const inviteMemberSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: z.union([z.literal(''), emailSchema]).optional().transform((v) => v || null),
  title: text(80).min(2, 'Nhập chức danh'),
  companyAdmin: z.boolean().default(false),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const memberRoleSchema = z.object({ companyAdmin: z.boolean() });
export type MemberRoleInput = z.infer<typeof memberRoleSchema>;

/** Gỡ thành viên: tin đang mở và hồ sơ đang phụ trách chuyển cho người khác (mặc định người thao tác) */
export const removeMemberSchema = z.object({ transferToId: z.string().trim().max(40).optional() });
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

/** Người được mời xác thực OTP gửi tới số được mời và đặt mật khẩu */
export const acceptInviteSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Mã gồm 6 chữ số'),
  password: passwordSchema,
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
