'use client';

import type { AdminBadges } from '@viecpro/shared';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import ChangePasswordDialog from '@/components/account/ChangePasswordDialog';
import { useAuth } from '@/lib/auth';
import { cx, formatNumber, initials } from '@/lib/format';
import { IconBell, IconFlag, IconKey, IconLogoMark, IconLogout, IconMenu, IconModeration, IconShieldCheck } from '../ui/Icons';

/** Đóng menu khi bấm ra ngoài / phím Esc */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const PENDING = [
  { key: 'pendingJobs', label: 'Tin chờ duyệt', href: '/kiem-duyet-tin', icon: IconModeration, permission: 'jobs.read' },
  { key: 'pendingVerifications', label: 'Hồ sơ chờ xác minh', href: '/xac-minh-doanh-nghiep', icon: IconShieldCheck, permission: 'employers.read' },
  { key: 'openReports', label: 'Báo cáo vi phạm cần xử lý', href: '/bao-cao-vi-pham', icon: IconFlag, permission: 'jobs.moderate' },
] as const;

/**
 * Thanh trên cho tablet / mobile (≤ 1180px, khi sidebar thành ngăn trượt):
 * ☰ + logo trái · chuông việc tồn + tài khoản phải – cùng kiểu với khu nhà tuyển dụng.
 */
export default function Topbar({ badges, onMenu }: { badges: AdminBadges | null; onMenu: () => void }) {
  const { admin, can, logout } = useAuth();
  const bell = usePopover();
  const me = usePopover();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const items = PENDING.filter((p) => can(p.permission));
  const total = badges ? items.reduce((s, p) => s + badges[p.key], 0) : 0;

  return (
    <header className="topbar">
      <button type="button" className="topbar__btn" aria-label="Mở menu" onClick={onMenu}>
        <IconMenu size={20} />
      </button>
      <Link href="/" className="topbar__brand" aria-label="Quản trị viecpro – Bảng điều khiển">
        <span className="sidebar__mark">
          <IconLogoMark size={17} className="icon--w26" />
        </span>
        <b className="topbar__name">
          Viec<span className="sidebar__accent">Pro</span>
        </b>
        <span className="sidebar__badge">ADMIN</span>
      </Link>

      <div className="topbar__actions">
        <div className="topbar__pop" ref={bell.ref}>
          <button type="button" className="topbar__btn" aria-label={total ? `${total} việc cần xử lý` : 'Không có việc tồn'} aria-expanded={bell.open} onClick={() => bell.setOpen((o) => !o)}>
            <IconBell size={20} />
            {total > 0 && <span className="topbar__dot">{total > 99 ? '99+' : total}</span>}
          </button>
          {bell.open && (
            <div className="topbar__menu" role="menu">
              <span className="topbar__menu-title">Việc cần xử lý</span>
              {items.map(({ key, label, href, icon: Icon }) => (
                <Link key={key} href={href} role="menuitem" className="topbar__item" onClick={() => bell.setOpen(false)}>
                  <Icon size={17} />
                  <span>{label}</span>
                  <b className={cx('topbar__count', !!badges?.[key] && 'topbar__count--on')}>{badges ? formatNumber(badges[key]) : '…'}</b>
                </Link>
              ))}
            </div>
          )}
        </div>

        {admin && (
          <div className="topbar__pop" ref={me.ref}>
            <button type="button" className="topbar__avatar" aria-label={`Tài khoản ${admin.name}`} aria-expanded={me.open} onClick={() => me.setOpen((o) => !o)}>
              {initials(admin.name)}
            </button>
            {me.open && (
              <div className="topbar__menu" role="menu">
                <span className="topbar__me">
                  <b>{admin.name}</b>
                  <span>
                    {admin.role.name} · {admin.mfaEnabled ? '2FA bật' : '2FA tắt'}
                  </span>
                </span>
                <button
                  type="button"
                  role="menuitem"
                  className="topbar__item"
                  onClick={() => {
                    me.setOpen(false);
                    setPasswordOpen(true);
                  }}
                >
                  <IconKey size={17} />
                  <span>Đổi mật khẩu</span>
                </button>
                <button type="button" role="menuitem" className="topbar__item topbar__item--danger" onClick={() => void logout()}>
                  <IconLogout size={17} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </header>
  );
}
