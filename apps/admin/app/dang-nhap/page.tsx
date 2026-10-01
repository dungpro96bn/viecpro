import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IconLock, IconLogoMark, IconShieldCheck } from '@/components/ui/Icons';
import LoginFlow from './LoginFlow';
import './login.css';

export const metadata: Metadata = {
  title: 'Đăng nhập',
};

export default function AdminLoginPage() {
  return (
    <div className="login">
      <aside className="login__side">
        <span className="login__glow" />
        <div className="login__brand">
          <span className="login__mark">
            <IconLogoMark size={20} className="icon--w26" />
          </span>
          <b className="login__name">
            Viec<span className="login__accent">Pro</span>
          </b>
          <span className="login__badge">ADMIN</span>
        </div>
        <div className="login__intro">
          <h1 className="login__headline">Trung tâm vận hành nền tảng</h1>
          <p className="login__lead">Kiểm duyệt tin, xác minh doanh nghiệp và theo dõi sức khoẻ hệ thống viecpro.</p>
          <ul className="login__points">
            <li className="login__point">
              <IconShieldCheck size={18} />
              Bắt buộc xác thực 2 lớp cho mọi tài khoản quản trị
            </li>
            <li className="login__point">
              <IconLock size={18} />
              Mọi thao tác được ghi nhật ký, phiên tự hết hạn sau 30 phút không hoạt động
            </li>
          </ul>
        </div>
        <span className="login__foot">Chỉ dành cho nhân sự viecpro được cấp quyền.</span>
      </aside>

      <main className="login__main">
        <Suspense>
          <LoginFlow />
        </Suspense>
      </main>
    </div>
  );
}
