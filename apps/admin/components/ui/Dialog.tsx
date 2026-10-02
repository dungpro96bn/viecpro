'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cx } from '@/lib/format';
import './ui.css';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** Có ô nhập lý do / ghi chú */
  input?: { label: string; placeholder?: string; defaultValue?: string; required?: boolean; minLength?: number };
  /** Ô mã 2FA xác nhận lại – thao tác phá huỷ (khoá hàng loạt, khoá vĩnh viễn) theo RULE-BE.md mục 7 */
  otp?: boolean;
  confirmLabel: string;
  tone?: 'primary' | 'danger' | 'warning';
  busy?: boolean;
  error?: string | null;
  onConfirm: (value: string, otp: string) => void;
  onClose: () => void;
}

/** Hộp thoại xác nhận dùng <dialog> gốc của trình duyệt (bẫy focus, phím Esc sẵn có) */
export default function Dialog({ open, title, description, input, otp, confirmLabel, tone = 'primary', busy, error, onConfirm, onClose }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(input?.defaultValue ?? '');
  const [code, setCode] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setValue(input?.defaultValue ?? '');
      setCode('');
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, input?.defaultValue]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onConfirm(value.trim(), code);
  };

  const tooShort = !!input?.required && value.trim().length < (input.minLength ?? 1);

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose}>
      <form className="dialog__body" onSubmit={submit}>
        <h2 className="dialog__title">{title}</h2>
        {description && <p className="dialog__desc">{description}</p>}
        {input && (
          <label className="field">
            <span className="field__label">{input.label}</span>
            <textarea className="field__input field__input--area" value={value} placeholder={input.placeholder} maxLength={500} onChange={(e) => setValue(e.target.value)} autoFocus />
          </label>
        )}
        {otp && (
          <label className="field">
            <span className="field__label">Mã 2FA</span>
            <input
              className="field__input dialog__otp"
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 số từ ứng dụng xác thực"
              maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <span className="field__hint">Xác nhận lại vì thao tác này ảnh hưởng nhiều tài khoản / dữ liệu.</span>
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
          <button
            type="submit"
            className={cx('btn', tone === 'danger' ? 'btn--danger-solid' : tone === 'warning' ? 'btn--warning-solid' : 'btn--primary')}
            disabled={busy || tooShort}
          >
            {busy ? <span className="spinner" /> : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
