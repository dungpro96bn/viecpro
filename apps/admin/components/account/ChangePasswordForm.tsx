'use client';

import { useState, type FormEvent } from 'react';
import { PASSWORD_RULES, type AdminMe } from '@viecpro/shared';
import { errorText } from '@/components/list/list-utils';
import { IconCheck } from '@/components/ui/Icons';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cx } from '@/lib/format';
import './account.css';

/** Form tự đổi mật khẩu – dùng cho màn bắt buộc (mật khẩu tạm) và hộp thoại từ menu tài khoản */
export default function ChangePasswordForm({ onDone, onCancel, submitLabel = 'Đổi mật khẩu' }: { onDone?: () => void; onCancel?: () => void; submitLabel?: string }) {
  const { updateAdmin } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rulesOk = PASSWORD_RULES.every((r) => r.test(next));
  const mismatch = confirm.length > 0 && confirm !== next;
  const same = next.length > 0 && next === current;
  const ready = current.length > 0 && rulesOk && confirm === next && !same;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      updateAdmin(await post<AdminMe>('/admin/password', { currentPassword: current, newPassword: next }));
      onDone?.();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="cpw" onSubmit={(e) => void submit(e)}>
      <label className="field">
        <span className="field__label">Mật khẩu hiện tại</span>
        <input className="field__input" type="password" autoComplete="current-password" value={current} maxLength={200} onChange={(e) => setCurrent(e.target.value)} autoFocus />
      </label>
      <label className="field">
        <span className="field__label">Mật khẩu mới</span>
        <input className="field__input" type="password" autoComplete="new-password" value={next} maxLength={72} onChange={(e) => setNext(e.target.value)} />
      </label>
      <ul className="cpw__rules" aria-label="Yêu cầu mật khẩu">
        {PASSWORD_RULES.map((r) => (
          <li key={r.key} className={cx('cpw__rule', r.test(next) && 'cpw__rule--ok')}>
            <IconCheck size={13} />
            {r.label}
          </li>
        ))}
        <li className={cx('cpw__rule', next.length > 0 && !same && 'cpw__rule--ok')}>
          <IconCheck size={13} />
          Khác mật khẩu hiện tại
        </li>
      </ul>
      <label className="field">
        <span className="field__label">Nhập lại mật khẩu mới</span>
        <input className="field__input" type="password" autoComplete="new-password" value={confirm} maxLength={72} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
        {mismatch && <span className="field__hint cpw__error">Mật khẩu nhập lại không khớp</span>}
      </label>
      {error && (
        <p className="alert alert--danger" role="alert">
          {error}
        </p>
      )}
      <p className="field__hint">Sau khi đổi, các thiết bị khác đang đăng nhập tài khoản này sẽ bị đăng xuất.</p>
      <div className="cpw__actions">
        {onCancel && (
          <button type="button" className="btn btn--outline" onClick={onCancel} disabled={busy}>
            Huỷ
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={!ready || busy}>
          {busy ? <span className="spinner" /> : submitLabel}
        </button>
      </div>
    </form>
  );
}
