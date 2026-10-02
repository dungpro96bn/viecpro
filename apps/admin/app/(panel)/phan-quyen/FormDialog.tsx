'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { cx } from '@/lib/format';

interface Props {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  /** Ô mã 2FA xác nhận lại (RULE-BE.md mục 7) */
  otp?: boolean;
  busy?: boolean;
  error?: string | null;
  disabled?: boolean;
  wide?: boolean;
  onSubmit: (otp: string) => void;
  onClose: () => void;
  children?: ReactNode;
}

/** Hộp thoại có form tuỳ ý + ô mã 2FA – dùng cho tạo admin, đổi vai trò, sửa vai trò */
export default function FormDialog({ open, title, description, confirmLabel, tone = 'primary', otp, busy, error, disabled, wide, onSubmit, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setCode('');
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(code);
  };

  return (
    <dialog ref={ref} className={cx('dialog', wide && 'dialog--wide')} onClose={onClose} onCancel={onClose}>
      <form className="dialog__body" onSubmit={submit}>
        <h2 className="dialog__title">{title}</h2>
        {description && <p className="dialog__desc">{description}</p>}
        {open && children}
        {otp && (
          <label className="field">
            <span className="field__label">Mã 2FA xác nhận</span>
            <input
              className="field__input dialog__otp"
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 số từ ứng dụng xác thực"
              maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        )}
        {error && (
          <p className="alert alert--danger" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button type="submit" className={cx('btn', tone === 'danger' ? 'btn--danger-solid' : 'btn--primary')} disabled={busy || disabled}>
            {busy ? <span className="spinner" /> : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
