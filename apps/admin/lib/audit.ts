/** Tên hành động trong nhật ký thao tác (AuditLog.action) */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'admin.login': 'Đăng nhập trang quản trị',
  'admin.login_recovery_code': 'Đăng nhập bằng mã khôi phục',
  'admin.login_mfa_bypassed': 'Đăng nhập bỏ qua 2FA (kiểm thử)',
  'admin.mfa_enabled': 'Bật xác thực 2 bước',
  'admin.logout': 'Đăng xuất',
  'admin.create': 'Tạo quản trị viên',
  'admin.role_change': 'Đổi vai trò quản trị',
  'admin.lock': 'Khoá quản trị viên',
  'admin.unlock': 'Mở khoá quản trị viên',
  'admin.mfa_reset': 'Đặt lại 2FA',
  'admin.password_reset': 'Cấp mật khẩu tạm',
  'admin.password_change': 'Tự đổi mật khẩu',
  'role.create': 'Tạo vai trò',
  'role.update': 'Sửa vai trò',
  'role.delete': 'Xoá vai trò',
  'user.pii_view': 'Xem thông tin liên hệ',
  'user.lock': 'Khoá tài khoản',
  'user.unlock': 'Mở khoá tài khoản',
  'user.warn': 'Cảnh cáo người dùng',
  'user.ban': 'Cấm tài khoản',
  'employer.warn': 'Cảnh cáo',
  'employer.suspend': 'Tạm khoá',
  'employer.unsuspend': 'Mở khoá',
  'job.approve': 'Duyệt tin',
  'job.reject': 'Từ chối tin',
  'job.request_changes': 'Yêu cầu sửa tin',
  'job.remove': 'Gỡ tin',
  'verification.approve': 'Xác minh',
  'verification.reject': 'Từ chối xác minh',
  'verification.request_info': 'Yêu cầu bổ sung giấy tờ',
  'report.claim': 'Nhận xử lý báo cáo',
  'report.decide': 'Kết luận báo cáo',
  'data.export': 'Xuất dữ liệu',
};

/** Nhóm hành động – lọc theo tiền tố action */
export const AUDIT_GROUPS = [
  { value: '', label: 'Tất cả' },
  { value: 'admin.', label: 'Quản trị viên & đăng nhập' },
  { value: 'role.', label: 'Vai trò quản trị' },
  { value: 'user.', label: 'Tài khoản người dùng' },
  { value: 'employer.', label: 'Nhà tuyển dụng' },
  { value: 'job.', label: 'Tin tuyển dụng' },
  { value: 'verification.', label: 'Xác minh doanh nghiệp' },
  { value: 'report.', label: 'Báo cáo vi phạm' },
  { value: 'data.', label: 'Xuất dữ liệu' },
] as const;

export const AUDIT_TARGET_LABEL: Record<string, string> = {
  user: 'Tài khoản',
  employer: 'Doanh nghiệp',
  recruiter: 'NTD cá nhân',
  job: 'Tin tuyển dụng',
  verification: 'Hồ sơ xác minh',
  report: 'Báo cáo',
  session: 'Phiên đăng nhập',
  dashboard: 'Bảng điều khiển',
  admin_role: 'Vai trò quản trị',
};

export const auditActionLabel = (action: string) => AUDIT_ACTION_LABEL[action] ?? action;
