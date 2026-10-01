import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/lib/format';
import Logo from '../layout/Logo';
import { IconArrowLeft, IconShieldCheck } from '../ui/Icons';
import './auth.css';

interface AuthShellProps {
  /** Ảnh nền cột trái (phủ lớp màu thương hiệu) */
  sideImage: string;
  /** Cột trái hẹp hơn (trang đăng ký có form dài) */
  sideNarrow?: boolean;
  /** Nội dung giới thiệu ở đáy cột trái */
  side: ReactNode;
  /** Dòng chuyển trang ở góc phải trên: "Chưa có tài khoản? Đăng ký" */
  switchText: string;
  switchHref: string;
  switchLabel: string;
  /** Dòng cam kết bảo mật ở chân trang */
  securityNote: string;
  /** Căn form lên đầu thay vì giữa (form dài) */
  alignTop?: boolean;
  children: ReactNode;
}

/** Khung 2 cột dùng chung cho trang đăng nhập / đăng ký: cột thương hiệu bên trái, form bên phải */
export default function AuthShell({
  sideImage,
  sideNarrow,
  side,
  switchText,
  switchHref,
  switchLabel,
  securityNote,
  alignTop,
  children,
}: AuthShellProps) {
  return (
    <div className="page page--fluid auth">
      <aside className={cx('auth__side', sideNarrow && 'auth__side--narrow')}>
        <img className="auth__side-img" src={sideImage} alt="" />
        <span className="auth__side-overlay" />
        <span className="auth__ring auth__ring--lg" />
        <span className="auth__ring auth__ring--sm" />
        <div className="auth__side-inner">
          <Logo tone="brand" />
          {side}
        </div>
      </aside>

      <main className="auth__main">
        <div className="auth__topbar">
          <Link href="/" className="auth__home">
            <IconArrowLeft size={18} className="icon--w2" />
            Về trang chủ
          </Link>
          <span className="auth__topbar-logo">
            <Logo />
          </span>
          <span className="auth__switch">
            <span className="auth__switch-text">{switchText} </span>
            <Link href={switchHref}>{switchLabel}</Link>
          </span>
        </div>

        <div className={cx('auth__body', alignTop && 'auth__body--top')}>{children}</div>

        <div className="auth__footer">
          <span>© 2026 viecpro</span>
          <span className="auth__footer-meta">
            <span className="auth__footer-note">
              <IconShieldCheck size={15} />
              {securityNote}
            </span>
            <span>
              Hỗ trợ: <b className="auth__hotline">1900 66 88</b>
            </span>
          </span>
        </div>
      </main>
    </div>
  );
}
