'use client';

import type { AdminBadges } from '@viecpro/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cx, initials } from '@/lib/format';
import { NAV } from '@/lib/nav';
import { IconLogoMark, IconLogout, IconSearch } from '../ui/Icons';

/** Kiểm tra /health mỗi phút để hiện đèn trạng thái ở chân sidebar */
function useSystemStatus() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () =>
      fetch(`${API_URL}/health`)
        .then((r) => setOk(r.ok))
        .catch(() => setOk(false));
    void check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);
  return ok;
}

export default function Sidebar({ badges, onClose }: { badges: AdminBadges | null; onClose: () => void }) {
  const pathname = usePathname();
  const { admin, can, logout } = useAuth();
  const systemOk = useSystemStatus();

  return (
    <aside className="sidebar" aria-label="Điều hướng quản trị">
      <span className="sidebar__glow" />
      <div className="sidebar__brand">
        <span className="sidebar__mark">
          <IconLogoMark size={19} className="icon--w26" />
        </span>
        <b className="sidebar__name">
          Viec<span className="sidebar__accent">Pro</span>
        </b>
        <span className="sidebar__badge">ADMIN</span>
        <button type="button" className="sidebar__close" aria-label="Đóng menu" onClick={onClose}>
          ×
        </button>
      </div>

      <button type="button" className="sidebar__search" aria-disabled="true" title="Tìm kiếm toàn hệ thống – sắp có">
        <IconSearch size={16} />
        <span className="sidebar__search-text">Tìm mọi thứ…</span>
        <kbd className="sidebar__kbd">⌘K</kbd>
      </button>

      <nav className="sidebar__nav">
        {NAV.map((group) => {
          const items = group.items.filter((i) => can(i.permission));
          if (!items.length) return null;
          return (
            <div key={group.title} className="sidebar__group">
              <span className="sidebar__group-title">{group.title}</span>
              {items.map(({ href, label, icon: Icon, badge, urgent }) => {
                const active = pathname === href;
                const count = badge && badges ? badges[badge] : 0;
                return (
                  <Link key={href} href={href} className={cx('sidebar__link', active && 'sidebar__link--active')} aria-current={active ? 'page' : undefined}>
                    <Icon size={18} />
                    <span className="sidebar__label">{label}</span>
                    {count > 0 && <span className={cx('sidebar__count', urgent && 'sidebar__count--urgent')}>{count}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <span className={cx('sidebar__status', systemOk === false && 'sidebar__status--down')}>
          <span className="sidebar__status-dot" />
          {systemOk === false ? 'Không kết nối được API' : 'Mọi hệ thống hoạt động bình thường'}
        </span>
        {admin && (
          <span className="sidebar__me">
            <span className="sidebar__avatar">{initials(admin.name)}</span>
            <span className="sidebar__me-text">
              <b className="sidebar__me-name">{admin.name}</b>
              <span className="sidebar__me-role">
                {admin.role.name} · {admin.mfaEnabled ? '2FA bật' : '2FA tắt'}
              </span>
            </span>
            <button type="button" className="sidebar__logout" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void logout()}>
              <IconLogout size={17} />
            </button>
          </span>
        )}
      </div>
    </aside>
  );
}
