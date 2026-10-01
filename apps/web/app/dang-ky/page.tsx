import type { Metadata } from 'next';
import AuthShell from '@/components/auth/AuthShell';
import { IconCheck, IconShieldCheck } from '@/components/ui/Icons';
import RegisterForm from './RegisterForm';
import './register.css';

export const metadata: Metadata = {
  title: 'Đăng ký tài khoản',
};

const BENEFITS = [
  'Gợi ý đơn theo năm sinh, giới tính và chương trình',
  'Ứng tuyển 1 chạm, hồ sơ tự điền sẵn',
  'Nhận thông báo đơn mới, đơn miễn phí qua Zalo',
  'So sánh lương, chi phí minh bạch trước khi quyết định',
];

export default function RegisterPage() {
  return (
    <AuthShell
      sideImage="/images/auth/register-side.jpg"
      sideNarrow
      switchText="Đã có tài khoản?"
      switchHref="/dang-nhap"
      switchLabel="Đăng nhập"
      securityNote="Thông tin được bảo mật"
      alignTop
      side={
        <>
          <div className="auth-intro register-intro">
            <span className="auth-intro__eyebrow">Miễn phí trọn đời cho người lao động</span>
            <h2 className="auth-intro__title register-intro__title">Tìm đúng đơn Nhật Bản, đúng tuổi, đúng ngành</h2>
            <ul className="register-benefits">
              {BENEFITS.map((text) => (
                <li key={text} className="register-benefits__item">
                  <span className="register-benefits__check">
                    <IconCheck size={13} className="icon--w32" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="auth-glass register-promise">
            <span className="register-promise__icon">
              <IconShieldCheck size={22} className="icon--w2" />
            </span>
            <span className="register-promise__text">
              <span className="register-promise__title">Không thu bất kỳ khoản phí nào</span>
              <span className="register-promise__desc">viecpro không thu phí người lao động khi đăng ký hay ứng tuyển.</span>
            </span>
          </div>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
