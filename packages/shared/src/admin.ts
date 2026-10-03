/**
 * Phân quyền quản trị (RBAC) – xem RULE-BE.md mục 6 lớp 3.
 * Dùng chung cho API (kiểm tra thật) và giao diện admin (ẩn / hiện nút).
 */

export const ADMIN_PERMISSIONS = [
  'dashboard.read',
  'users.read',
  'users.pii',
  'users.lock',
  'employers.read',
  'employers.verify',
  'employers.manage',
  'jobs.read',
  'jobs.moderate',
  'jobs.manage',
  'applications.read',
  'leads.read',
  'leads.manage',
  'content.manage',
  'notifications.send',
  'admins.manage',
  'audit.read',
  'settings.manage',
  'billing.read',
  'data.export',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_PERMISSION_LABEL: Record<AdminPermission, string> = {
  'dashboard.read': 'Xem bảng điều khiển',
  'users.read': 'Xem tài khoản',
  'users.pii': 'Xem đầy đủ thông tin liên hệ',
  'users.lock': 'Khoá / mở khoá tài khoản',
  'employers.read': 'Xem nhà tuyển dụng',
  'employers.verify': 'Xác minh nhà tuyển dụng',
  'employers.manage': 'Sửa hồ sơ nhà tuyển dụng',
  'jobs.read': 'Xem mọi đơn hàng',
  'jobs.moderate': 'Kiểm duyệt đơn hàng',
  'jobs.manage': 'Tạo / sửa đơn thay NTD',
  'applications.read': 'Xem hồ sơ ứng tuyển',
  'leads.read': 'Xem khách cần tư vấn',
  'leads.manage': 'Xử lý khách cần tư vấn',
  'content.manage': 'Quản lý nội dung',
  'notifications.send': 'Gửi thông báo hàng loạt',
  'admins.manage': 'Quản lý quản trị viên',
  'audit.read': 'Xem nhật ký hệ thống',
  'settings.manage': 'Cài đặt hệ thống',
  'billing.read': 'Xem giao dịch',
  'data.export': 'Xuất dữ liệu',
};

/** Vai trò quản trị mặc định (tạo bằng seed, isSystem = true) */
export const DEFAULT_ADMIN_ROLES: ReadonlyArray<{ key: string; name: string; description: string; permissions: readonly AdminPermission[] }> = [
  { key: 'super_admin', name: 'Super Admin', description: 'Toàn quyền hệ thống', permissions: ADMIN_PERMISSIONS },
  {
    key: 'moderator',
    name: 'Kiểm duyệt viên',
    description: 'Duyệt tin, xác minh doanh nghiệp, xử lý vi phạm',
    permissions: ['dashboard.read', 'jobs.read', 'jobs.moderate', 'employers.read', 'employers.verify', 'users.read', 'users.lock', 'audit.read'],
  },
  {
    key: 'support',
    name: 'Chăm sóc khách hàng',
    description: 'Hỗ trợ người dùng, xử lý khách cần tư vấn',
    permissions: ['dashboard.read', 'users.read', 'users.pii', 'applications.read', 'leads.read', 'leads.manage', 'employers.read', 'jobs.read', 'billing.read'],
  },
  { key: 'content', name: 'Biên tập nội dung', description: 'Banner, cẩm nang, danh mục', permissions: ['dashboard.read', 'content.manage', 'jobs.read'] },
];

export const SUPER_ADMIN_ROLE = 'super_admin';
