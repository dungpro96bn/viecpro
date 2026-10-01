'use client';

import { useState, type ChangeEvent } from 'react';
import { cx } from '@/lib/format';
import { IconEye, IconEyeOff, IconLock } from '../ui/Icons';

interface PasswordInputProps {
  id?: string;
  name: string;
  autoComplete: 'current-password' | 'new-password';
  placeholder: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  invalid?: boolean;
  /** Ô cao 50px (form đăng ký) thay vì 52px */
  compact?: boolean;
  'aria-describedby'?: string;
}

/** Ô mật khẩu có nút ẩn / hiện */
export default function PasswordInput({ compact, invalid, ...input }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const iconSize = compact ? 18 : 19;

  return (
    <span className={cx('auth-input', 'auth-input--action', compact && 'auth-input--compact', invalid && 'auth-input--invalid')}>
      <IconLock size={iconSize} className="auth-input__icon" />
      <input className="auth-input__control" type={visible ? 'text' : 'password'} aria-invalid={invalid || undefined} {...input} />
      <button
        type="button"
        className="auth-input__eye"
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <IconEyeOff size={iconSize} /> : <IconEye size={iconSize} />}
      </button>
    </span>
  );
}
