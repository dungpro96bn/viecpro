'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cx } from '@/lib/format';
import PasswordInput from '@/components/auth/PasswordInput';
import SocialLogin from '@/components/auth/SocialLogin';
import { IconArrowRight, IconBuilding, IconUser, IconUserRound } from '@/components/ui/Icons';
import { apiRequest, apiMessage } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';
import type { AuthResponse } from '@viecpro/shared';

type Role = 'seeker' | 'employer';

const ROLES: { key: Role; label: string; icon: typeof IconUser }[] = [
  { key: 'seeker', label: 'Người tìm việc', icon: IconUser },
  { key: 'employer', label: 'Nhà tuyển dụng', icon: IconBuilding },
];

type Errors = Partial<Record<'identifier' | 'password', string>>;

function validate(identifier: string, password: string): Errors {
  const errors: Errors = {};
  if (!identifier.trim()) errors.identifier = 'Vui lòng nhập email hoặc số điện thoại';
  if (!password) errors.password = 'Vui lòng nhập mật khẩu';
  return errors;
}

export default function LoginForm() {
  const router = useRouter();
  const { acceptSession } = useAuth();
  const [role, setRole] = useState<Role>('seeker');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = validate(identifier, password);
    setErrors(next);
    setApiError('');
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      const session = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password, role, platform: 'web' }),
      });
      acceptSession(session);
      router.push(session.user.role === 'seeker' ? '/tai-khoan-ung-vien' : session.user.role === 'employer' ? '/quan-ly-tuyen-dung' : '/');
    } catch (error) {
      setApiError(apiMessage(error, 'Không thể kết nối máy chủ. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="auth-form" noValidate onSubmit={onSubmit}>
      <div className="auth-form__head">
        <h1 className="auth-form__title">Chào mừng trở lại</h1>
        <p className="auth-form__lead">Đăng nhập để ứng tuyển nhanh, lưu việc và theo dõi hồ sơ của bạn.</p>
      </div>

      <div className="auth-segmented" role="radiogroup" aria-label="Bạn là">
        {ROLES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={role === key}
            className={cx('auth-segmented__option', role === key && 'auth-segmented__option--active')}
            onClick={() => setRole(key)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>

      <div className="auth-form__fields">
        <label className="auth-field">
          <span className="auth-field__label">Email hoặc số điện thoại</span>
          <span className={cx('auth-input', errors.identifier && 'auth-input--invalid')}>
            <IconUserRound size={19} className="auth-input__icon" />
            <input
              className="auth-input__control"
              type="text"
              name="identifier"
              autoComplete="username"
              placeholder="Email hoặc 0912 345 678"
              value={identifier}
              aria-invalid={!!errors.identifier || undefined}
              aria-describedby={errors.identifier ? 'login-identifier-error' : undefined}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setErrors((prev) => ({ ...prev, identifier: undefined }));
              }}
            />
          </span>
          {errors.identifier && (
            <span id="login-identifier-error" className="auth-field__error">
              {errors.identifier}
            </span>
          )}
        </label>

        <div className="auth-field">
          <span className="auth-field__label">
            <label htmlFor="login-password">Mật khẩu</label>
            <Link href="/quen-mat-khau" className="auth-field__link">
              Quên mật khẩu?
            </Link>
          </span>
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            value={password}
            invalid={!!errors.password}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((prev) => ({ ...prev, password: undefined }));
            }}
          />
          {errors.password && (
            <span id="login-password-error" className="auth-field__error">
              {errors.password}
            </span>
          )}
        </div>

      </div>

      {apiError && <p className="auth-field__error" role="alert">{apiError}</p>}

      <button type="submit" className="btn btn--primary btn--block auth-submit" disabled={submitting}>
        {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        <IconArrowRight size={18} className="icon--w22" />
      </button>

      <SocialLogin label="Tiếp tục với Google" />

      <p className="auth-legal">
        Bằng việc đăng nhập, bạn đồng ý với <Link href="#">Điều khoản sử dụng</Link> và <Link href="#">Chính sách bảo mật</Link> của viecpro.
      </p>
    </form>
  );
}
