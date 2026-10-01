'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { EmployerAccount } from '@viecpro/shared';
import { useAuth } from '@/components/auth/AuthProvider';
import { apiRequest } from '@/lib/api';

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
  const { user, loading } = useAuth();
  const [account, setAccount] = useState<EmployerAccount | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setAccount(await apiRequest<EmployerAccount>('/employer/me'));
      setError('');
    } catch {
      setError('Không tải được thông tin tài khoản. Vui lòng tải lại trang.');
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

  if (error) return <div className="emp-state emp-state--error" role="alert">{error}</div>;
  if (!account) return <>{fallback}</>;
  return <Ctx.Provider value={{ account, refresh }}>{children}</Ctx.Provider>;
}

export function useEmployerAccount() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useEmployerAccount phải dùng bên trong <EmployerAccountProvider>');
  return value;
}
