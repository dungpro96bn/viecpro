import type { Metadata } from 'next';
import AuthShell from '@/components/auth/AuthShell';
import { IconCheck } from '@/components/ui/Icons';
import AcceptInvite from './AcceptInvite';
import '../../dang-ky/register.css';
import './invite.css';

export const metadata: Metadata = {
  title: 'Nhận lời mời thành viên',
  robots: { index: false },
};

const BENEFITS = ['Quản lý tin tuyển dụng chung của doanh nghiệp', 'Nhận và xử lý hồ sơ ứng viên được giao', 'Đặt lịch phỏng vấn cùng đồng nghiệp'];

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthShell
      sideImage="/images/auth/register-side.jpg"
      switchText="Đã có tài khoản?"
      switchHref="/dang-nhap"
      switchLabel="Đăng nhập"
      securityNote="Tài khoản chỉ được tạo sau khi xác thực số điện thoại được mời"
      side={
        <div className="auth-intro">
          <h2 className="auth-intro__title">viecpro Business</h2>
          <ul className="invite-benefits">
            {BENEFITS.map((b) => (
              <li key={b}>
                <IconCheck size={16} />
                {b}
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <AcceptInvite token={token} />
    </AuthShell>
  );
}
