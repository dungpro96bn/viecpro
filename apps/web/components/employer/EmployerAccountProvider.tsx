'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { EmployerAccount } from '@viecpro/shared';
import { useAuth } from '@/components/auth/AuthProvider';
import { ApiClientError, apiRequest } from '@/lib/api';

interface EmployerAccountValue {
  account: EmployerAccount;
  /** Tải lại số trên menu / gói dịch vụ sau khi thao tác */
  refresh: () => Promise<void>;
}

const Ctx = createContext<EmployerAccountValue | null>(null);

/**
 * Bảo vệ khu quản lý: chỉ tài khoản nhà tuyển dụng.
 * Kiểm tra thật ở API (@Roles('employer')); ở đây chỉ chuyển hướng cho tiện.
 */
export default function EmployerAccountProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [account, setAccount] = useState<EmployerAccount | null>(null);
  const [error, setError] = useState('');
  /** Đã bị gỡ khỏi doanh nghiệp: hiện lý do + nút đăng xuất thay cho lỗi chung */
  const [removed, setRemoved] = useState('');

  const refresh = useCallback(async () => {
    try {
      setAccount(await apiRequest<EmployerAccount>('/employer/me'));
      setError('');
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'MEMBER_REMOVED') setRemoved(e.message);
      else setError('Không tải được thông tin tài khoản. Vui lòng tải lại trang.');
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== 'employer') {
      router.replace('/dang-nhap');
      return;
    }
    void refresh();
  }, [loading, user, router, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (removed) {
    return (
      <div className="emp-state emp-state--error" role="alert">
        <p>{removed}</p>
        <button
          type="button"
          className="emp-btn"
          onClick={() => {
            void signOut().then(() => router.replace('/dang-nhap'));
          }}
        >
          Đăng xuất
        </button>
      </div>
    );
  }
  if (error) return <div className="emp-state emp-state--error" role="alert">{error}</div>;
  if (!account) return <>{fallback}</>;
  return <Ctx.Provider value={{ account, refresh }}>{children}</Ctx.Provider>;
}

export function useEmployerAccount() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useEmployerAccount phải dùng bên trong <EmployerAccountProvider>');
  return value;
}
