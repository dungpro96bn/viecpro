'use client';

import type { AdminBadges } from '@viecpro/shared';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Sidebar from './Sidebar';
import './layout.css';

interface ShellState {
  badges: AdminBadges | null;
  refreshBadges: () => Promise<void>;
}

const ShellContext = createContext<ShellState>({ badges: null, refreshBadges: async () => undefined });
export const useShell = () => useContext(ShellContext);

/** Khung khu quản trị: chặn khi chưa đăng nhập, sidebar + vùng nội dung */
export default function AdminShell({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [badges, setBadges] = useState<AdminBadges | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const refreshBadges = useCallback(async () => {
    try {
      setBadges(await api<AdminBadges>('/admin/badges'));
    } catch {
      // Badge không quan trọng – lỗi thì giữ số cũ
    }
  }, []);

  useEffect(() => {
    if (status === 'signed-out') router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  useEffect(() => {
    if (status !== 'signed-in') return;
    void refreshBadges();
    const t = setInterval(() => void refreshBadges(), 60_000);
    return () => clearInterval(t);
  }, [status, refreshBadges]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (status !== 'signed-in') {
    return (
      <div className="shell-loading" role="status">
        <span className="spinner" />
        <span>Đang kiểm tra phiên đăng nhập…</span>
      </div>
    );
  }

  return (
    <ShellContext.Provider value={{ badges, refreshBadges }}>
      <div className={menuOpen ? 'shell shell--menu-open' : 'shell'}>
        <Sidebar badges={badges} onClose={() => setMenuOpen(false)} />
        <button type="button" className="shell__backdrop" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />
        <div className="shell__main">
          <button type="button" className="shell__menu-toggle icon-btn" aria-label="Mở menu" onClick={() => setMenuOpen(true)}>
            <span className="shell__menu-icon" />
          </button>
          {children}
        </div>
      </div>
    </ShellContext.Provider>
  );
}
