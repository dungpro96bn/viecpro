'use client';

import { useAuth } from '@/lib/auth';
import ChangePasswordForm from './ChangePasswordForm';
import './account.css';

/** Đang dùng mật khẩu tạm: API chặn mọi màn hình cho tới khi đổi mật khẩu (PASSWORD_CHANGE_REQUIRED) */
export default function ForcedPasswordChange() {
  const { admin, logout } = useAuth();
  return (
    <main className="cpw-page">
      <section className="panel cpw-card" aria-labelledby="cpw-title">
        <h1 id="cpw-title" className="cpw-card__title">
          Đặt mật khẩu mới
        </h1>
        <p className="cpw-card__lead">
          Xin chào {admin?.name}. Bạn đang dùng mật khẩu tạm do quản trị viên khác cấp. Hãy đặt mật khẩu của riêng bạn trước khi tiếp tục.
        </p>
        <ChangePasswordForm submitLabel="Lưu mật khẩu và tiếp tục" />
        <button type="button" className="cpw-card__logout" onClick={() => void logout()}>
          Đăng xuất
        </button>
      </section>
    </main>
  );
}
