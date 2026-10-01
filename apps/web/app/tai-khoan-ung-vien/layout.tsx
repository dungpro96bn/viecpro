import type { Metadata } from 'next';
import SeekerShell from '@/components/seeker/SeekerShell';

export const metadata: Metadata = {
  title: { default: 'Tài khoản ứng viên', template: '%s | viecpro' },
  robots: { index: false },
};

/** Khu tài khoản ứng viên – dữ liệu riêng tư, tải phía client sau khi đăng nhập */
export default function SeekerAccountLayout({ children }: { children: React.ReactNode }) {
  return <SeekerShell>{children}</SeekerShell>;
}
