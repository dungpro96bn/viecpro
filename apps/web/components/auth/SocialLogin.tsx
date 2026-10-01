'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthResponse } from '@viecpro/shared';
import { apiMessage, apiRequest } from '@/lib/api';
import { useAuth } from './AuthProvider';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: { theme: string; size: string; text: string; shape: string; width: number }) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function SocialLogin({ label }: { label: string }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const { acceptSession } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) return;
    let active = true;
    const mount = () => {
      if (!active || !buttonRef.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          void apiRequest<AuthResponse>('/auth/google', { method: 'POST', body: JSON.stringify({ idToken: response.credential, platform: 'web' }) })
            .then((session) => { acceptSession(session); router.replace(session.user.role === 'employer' ? '/' : '/tai-khoan-ung-vien'); })
            .catch((cause: unknown) => setError(apiMessage(cause, 'Không thể đăng nhập bằng Google.')));
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 360 });
    };
    if (window.google) mount();
    else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = mount;
      script.onerror = () => setError('Không tải được dịch vụ đăng nhập Google.');
      document.head.append(script);
    }
    return () => { active = false; };
  }, [acceptSession, router]);

  return (
    <>
      <div className="auth-divider">hoặc</div>
      {GOOGLE_CLIENT_ID ? <div ref={buttonRef} className="auth-social-google" aria-label={label} /> : <p className="auth-social__config">Đăng nhập Google chưa được cấu hình.</p>}
      {error && <p className="auth-social__error" role="alert">{error}</p>}
    </>
  );
}
