import type { Metadata } from 'next';
import AuthShell from '@/components/auth/AuthShell';
import ResetPasswordForm from './ResetPasswordForm';
import './reset-password.css';

export const metadata: Metadata = {
  title: 'Khôi phục mật khẩu',
  description: 'Xác thực số điện thoại và đặt lại mật khẩu tài khoản viecpro.',
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      sideImage="/images/auth/login-side.jpg"
      switchText="Đã nhớ mật khẩu?"
      switchHref="/dang-nhap"
      switchLabel="Đăng nhập"
      securityNote="Thông tin được bảo mật"
      side={<div className="auth-intro"><span className="auth-intro__eyebrow">Bảo vệ tài khoản</span><h2 className="auth-intro__title">Khôi phục quyền truy cập an toàn</h2><p className="auth-form__lead">Mã xác thực chỉ có hiệu lực trong thời gian ngắn và được dùng một lần.</p></div>}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
