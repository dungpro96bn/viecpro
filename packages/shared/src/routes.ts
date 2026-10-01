/**
 * Đường dẫn trang web dùng trong thông báo (in-app + push). App mobile đổi thành deep link.
 * Không chứa token hay dữ liệu cá nhân (RULE-BE.md mục 12).
 */
export const WEB_LINKS = {
  job: (slug: string) => `/viec-lam/${slug}`,
  search: '/tim-kiem',
  /** Trang tài khoản ứng viên */
  seekerProfile: '/tai-khoan-ung-vien/ho-so',
  seekerApplications: '/tai-khoan-ung-vien/viec-da-ung-tuyen',
  seekerSaved: '/tai-khoan-ung-vien/viec-da-luu',
  seekerAccount: '/tai-khoan-ung-vien',
  /** Khu quản lý của nhà tuyển dụng (tách khỏi /nha-tuyen-dung/[slug] là hồ sơ công khai) */
  employerJobs: '/quan-ly-tuyen-dung/don-hang',
  employerApplicants: '/quan-ly-tuyen-dung/ung-vien',
  employerLeads: '/quan-ly-tuyen-dung/khach-tu-van',
  employerAccount: '/quan-ly-tuyen-dung',
} as const;
