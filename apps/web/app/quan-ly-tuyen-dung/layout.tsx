import type { Metadata } from 'next';
import EmployerShell from '@/components/employer/EmployerShell';

export const metadata: Metadata = {
  title: { default: 'Quản lý tuyển dụng', template: '%s · viecpro Business' },
  robots: { index: false },
};

/** Khu quản lý nhà tuyển dụng (doanh nghiệp / cá nhân) – dữ liệu riêng tư, tải phía client sau khi đăng nhập */
export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return <EmployerShell>{children}</EmployerShell>;
}
