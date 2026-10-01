import type { AdminBadges, AdminPermission } from '@viecpro/shared';
import type { ComponentType, SVGProps } from 'react';
import {
  IconBars,
  IconBook,
  IconBriefcase,
  IconFlag,
  IconGrid,
  IconKey,
  IconList,
  IconModeration,
  IconReceipt,
  IconSettings,
  IconShieldCheck,
  IconWallet,
  IconWorkers,
} from '@/components/ui/Icons';

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  /** Ẩn mục nếu admin thiếu quyền */
  permission: AdminPermission;
  badge?: keyof AdminBadges;
  /** Badge màu đỏ (việc khẩn) */
  urgent?: boolean;
  /** Màn hình đã làm xong */
  ready?: boolean;
}

export const NAV: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Tổng quan',
    items: [
      { href: '/', label: 'Bảng điều khiển', icon: IconGrid, permission: 'dashboard.read', ready: true },
      { href: '/phan-tich', label: 'Phân tích', icon: IconBars, permission: 'dashboard.read' },
    ],
  },
  {
    title: 'Vận hành',
    items: [
      { href: '/kiem-duyet-tin', label: 'Kiểm duyệt tin', icon: IconModeration, permission: 'jobs.read', badge: 'pendingJobs' },
      { href: '/xac-minh-doanh-nghiep', label: 'Xác minh doanh nghiệp', icon: IconShieldCheck, permission: 'employers.read', badge: 'pendingVerifications' },
      { href: '/nguoi-lao-dong', label: 'Người lao động', icon: IconWorkers, permission: 'users.read' },
      { href: '/nha-tuyen-dung', label: 'Nhà tuyển dụng', icon: IconBriefcase, permission: 'employers.read' },
      { href: '/bao-cao-vi-pham', label: 'Báo cáo vi phạm', icon: IconFlag, permission: 'jobs.moderate', badge: 'openReports', urgent: true },
    ],
  },
  {
    title: 'Tài chính',
    items: [
      { href: '/goi-doanh-thu', label: 'Gói & doanh thu', icon: IconWallet, permission: 'settings.manage' },
      { href: '/giao-dich', label: 'Giao dịch', icon: IconReceipt, permission: 'settings.manage' },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { href: '/noi-dung', label: 'Nội dung & cẩm nang', icon: IconBook, permission: 'content.manage' },
      { href: '/phan-quyen', label: 'Phân quyền', icon: IconKey, permission: 'admins.manage' },
      { href: '/nhat-ky', label: 'Nhật ký hệ thống', icon: IconList, permission: 'audit.read' },
      { href: '/cai-dat', label: 'Cài đặt', icon: IconSettings, permission: 'settings.manage' },
    ],
  },
];

export function findNav(pathname: string): NavItem | undefined {
  return NAV.flatMap((g) => g.items).find((i) => i.href === pathname);
}
