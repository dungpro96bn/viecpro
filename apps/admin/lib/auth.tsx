'use client';

import type { AdminLoginResult, AdminMe, AdminPermission } from '@viecpro/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { onTokenRefresh, post, publicPost, setAccessToken } from './api';

/** Không thao tác 30 phút thì đăng xuất (RULE-BE.md mục 7) */
const IDLE_LIMIT_MS = 30 * 60_000;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
const IDLE_NOTICE = 'Bạn đã được đăng xuất vì không thao tác trong 30 phút.';
const EXPIRED_NOTICE = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';

type Status = 'loading' | 'signed-in' | 'signed-out';
type Done = Extract<AdminLoginResult, { step: 'done' }>;

interface AuthState {
  status: Status;
  admin: AdminMe | null;
  /** Lý do bị đăng xuất để hiện ở trang đăng nhập */
  notice: string | null;
  can: (permission: AdminPermission) => boolean;
  /** Hoàn tất đăng nhập (sau bước 2FA) */
  complete: (result: Done) => void;
  logout: (notice?: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const statusRef = useRef<Status>('loading');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatusBoth = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  const clear = useCallback((message: string | null) => {
    if (timer.current) clearTimeout(timer.current);
    setAccessToken(null);
    setAdmin(null);
    setNotice(message);
    setStatusBoth('signed-out');
  }, []);

  // refresh và apply gọi lẫn nhau (hẹn giờ làm mới) – dùng ref để không giữ closure cũ
  const refreshRef = useRef<() => Promise<string | null>>(async () => null);

  const apply = useCallback((result: Done) => {
    setAccessToken(result.accessToken);
    setAdmin(result.admin);
    setNotice(null);
    setStatusBoth('signed-in');
    // Làm mới trước khi access token hết hạn 1 phút
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void refreshRef.current(), Math.max(10, result.expiresIn - 60) * 1000);
  }, []);

  // Gộp các lần làm mới chạy cùng lúc (Strict Mode, nhiều request 401) – tránh gửi trùng refresh token
  const inFlight = useRef<Promise<string | null> | null>(null);
  refreshRef.current = () => (inFlight.current ??= doRefresh().finally(() => (inFlight.current = null)));

  const doRefresh = async (): Promise<string | null> => {
    try {
      const result = await publicPost<AdminLoginResult>('/auth/admin/refresh');
      if (result.step !== 'done') throw new Error('unexpected');
      apply(result);
      return result.accessToken;
    } catch {
      clear(statusRef.current === 'signed-in' ? EXPIRED_NOTICE : null);
      return null;
    }
  };

  // Mở trang: thử khôi phục phiên từ cookie httpOnly
  useEffect(() => {
    onTokenRefresh(() => refreshRef.current());
    void refreshRef.current();
    return () => {
      onTokenRefresh(null);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const logout = useCallback(
    async (message?: string) => {
      try {
        await post('/admin/logout');
      } catch {
        // Phiên có thể đã hết hạn – vẫn xoá trạng thái phía client
      }
      clear(message ?? null);
    },
    [clear],
  );

  // Tự đăng xuất khi không thao tác
  useEffect(() => {
    if (status !== 'signed-in') return;
    let idle = setTimeout(() => void logout(IDLE_NOTICE), IDLE_LIMIT_MS);
    const reset = () => {
      clearTimeout(idle);
      idle = setTimeout(() => void logout(IDLE_NOTICE), IDLE_LIMIT_MS);
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(idle);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [status, logout]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      admin,
      notice,
      can: (p) => !!admin?.permissions.includes(p),
      complete: apply,
      logout,
    }),
    [status, admin, notice, apply, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider');
  return ctx;
}
