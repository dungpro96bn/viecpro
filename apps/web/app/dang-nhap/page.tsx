import type { Metadata } from 'next';
import AuthShell from '@/components/auth/AuthShell';
import { IconBoltLine, IconHeart, IconTaskCheck } from '@/components/ui/Icons';
import LoginForm from './LoginForm';
import './login.css';

export const metadata: Metadata = {
  title: 'Đăng nhập',
};

const PERKS = [
  { icon: IconHeart, title: 'Lưu việc & nhận đơn mới đúng tỉnh', desc: 'Thông báo qua Zalo khi có đơn phù hợp tuổi, ngành' },
  { icon: IconBoltLine, title: 'Ứng tuyển 1 chạm', desc: 'Hồ sơ được điền sẵn, gửi cho cán bộ trong vài giây' },
  { icon: IconTaskCheck, title: 'Theo dõi trạng thái hồ sơ', desc: 'Biết ngay khi được gọi phỏng vấn, thi tay nghề' },
];

const STATS = [
  { value: '2.365', label: 'Đơn đang tuyển' },
  { value: '47', label: 'Tỉnh thành Nhật Bản' },
  { value: '1.200+', label: 'NTD đã xác thực' },
];

export default function LoginPage() {
  return (
    <AuthShell
      sideImage="/images/auth/login-side.jpg"
      switchText="Chưa có tài khoản?"
      switchHref="/dang-ky"
      switchLabel="Đăng ký miễn phí"
      securityNote="Kết nối được mã hóa"
      side={
        <>
          <div className="auth-intro">
            <span className="auth-intro__eyebrow">
              <span className="auth-intro__live" />
              2.365 đơn hàng Nhật Bản đang tuyển
            </span>
            <h2 className="auth-intro__title">
              Một tài khoản,
              <br />
              theo sát mọi đơn hàng Nhật Bản
            </h2>
            <ul className="login-perks">
              {PERKS.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="login-perks__item">
                  <span className="login-perks__icon">
                    <Icon size={19} className="icon--w2" />
                  </span>
                  <span className="login-perks__text">
                    <span className="login-perks__title">{title}</span>
                    <span className="login-perks__desc">{desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <dl className="auth-glass login-stats">
            {STATS.map((s) => (
              <div key={s.label} className="login-stats__item">
                <dt className="login-stats__label">{s.label}</dt>
                <dd className="login-stats__value">{s.value}</dd>
              </div>
            ))}
          </dl>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
