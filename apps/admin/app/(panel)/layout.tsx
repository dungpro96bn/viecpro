import AdminShell from '@/components/layout/AdminShell';

/** Các trang cần đăng nhập quản trị */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
