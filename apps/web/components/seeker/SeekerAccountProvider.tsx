'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { SeekerDashboard, SeekerProfile } from '@viecpro/shared';
import { useAuth } from '@/components/auth/AuthProvider';
import { apiRequest } from '@/lib/api';

interface SeekerAccountValue {
  profile: SeekerProfile;
  dashboard: SeekerDashboard;
  unreadMessages: number;
  /** Cập nhật hồ sơ sau khi sửa (thẻ bên trái và % hoàn thiện đổi theo) */
  setProfile: (p: SeekerProfile) => void;
  /** Tải lại số trên menu (đã ứng tuyển, đã lưu…) */
  refresh: () => Promise<void>;
}

const Ctx = createContext<SeekerAccountValue | null>(null);

/**
 * Bảo vệ khu tài khoản ứng viên: chỉ tài khoản `seeker`.
 * Kiểm tra thật ở API (@Roles('seeker')); ở đây chỉ chuyển hướng cho tiện.
 */
export default function SeekerAccountProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<SeekerProfile | null>(null);
  const [dashboard, setDashboard] = useState<SeekerDashboard | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [p, d, messages] = await Promise.all([apiRequest<SeekerProfile>('/me/profile'), apiRequest<SeekerDashboard>('/me/dashboard'), apiRequest<{ unread: number }>('/me/conversations/unread-count')]);
      setProfile(p);
      setDashboard(d);
      setUnreadMessages(messages.unread);
      setError('');
    } catch {
      setError('Không tải được dữ liệu tài khoản. Vui lòng tải lại trang.');
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== 'seeker') {
      router.replace('/dang-nhap');
      return;
    }
    void refresh();
  }, [loading, user, router, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (error) return <div className="account-loading" role="alert">{error}</div>;
  if (!profile || !dashboard) return <>{fallback}</>;
  return <Ctx.Provider value={{ profile, dashboard, unreadMessages, setProfile, refresh }}>{children}</Ctx.Provider>;
}

export function useSeekerAccount() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useSeekerAccount phải dùng bên trong <SeekerAccountProvider>');
  return value;
}
