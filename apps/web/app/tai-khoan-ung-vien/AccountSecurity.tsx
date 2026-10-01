'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { SessionItem } from '@viecpro/shared';
import { PASSWORD_RULES } from '@viecpro/shared';
import { apiMessage, apiRequest } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';

export default function AccountSecurity() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const { signOut } = useAuth();

  const load = async () => {
    try { setSessions(await apiRequest<SessionItem[]>('/me/sessions')); } catch { setError('Không tải được danh sách thiết bị.'); }
  };
  useEffect(() => { void load(); }, []);

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const currentPassword = String(values.get('currentPassword') ?? '');
    const newPassword = String(values.get('newPassword') ?? '');
    if (!PASSWORD_RULES.every((rule) => rule.test(newPassword))) return setError('Mật khẩu mới chưa đạt đủ điều kiện.');
    setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest<void>('/me/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      form.reset(); setNotice('Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.'); await load();
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(false); }
  };

  const revoke = async (session: SessionItem) => {
    if (session.current) return;
    try {
      await apiRequest<void>(`/me/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' });
      setSessions((items) => items.filter((item) => item.id !== session.id));
    } catch (cause) { setError(apiMessage(cause)); }
  };

  const removeAccount = async () => {
    if (busy || !window.confirm('Xóa tài khoản sẽ ẩn danh hồ sơ và đăng xuất mọi thiết bị. Bạn có chắc chắn muốn tiếp tục?')) return;
    setBusy(true); setError('');
    try {
      await apiRequest<void>('/me', { method: 'DELETE' });
      await signOut().catch(() => undefined);
      window.location.assign('/');
    } catch (cause) { setError(apiMessage(cause)); setBusy(false); }
  };

  return <section className="account-panel account-security" id="security">
    <div className="account-panel__heading"><span className="account-panel__title">Bảo mật và thiết bị</span></div>
    {error && <p className="account-profile-edit__message account-profile-edit__message--error" role="alert">{error}</p>}
    {notice && <p className="account-profile-edit__message" role="status">{notice}</p>}
    <form className="account-profile-edit__form" noValidate onSubmit={(event) => void changePassword(event)}>
      <label className="account-profile-edit__field">Mật khẩu hiện tại<input className="field-input" name="currentPassword" type="password" autoComplete="current-password" required /></label>
      <label className="account-profile-edit__field">Mật khẩu mới<input className="field-input" name="newPassword" type="password" autoComplete="new-password" required /></label>
      <button className="btn btn--outline btn--md" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Đổi mật khẩu'}</button>
    </form>
    <h3 className="account-security__heading">Thiết bị đang đăng nhập</h3>
    <ul className="account-security__sessions">{sessions.map((session) => <li key={session.id}><span><b>{session.deviceName ?? session.platform}</b><small>{session.current ? 'Thiết bị hiện tại' : `Hoạt động ${new Date(session.lastUsedAt).toLocaleString('vi-VN')}`}</small></span>{!session.current && <button type="button" className="btn btn--outline btn--sm" onClick={() => void revoke(session)}>Đăng xuất</button>}</li>)}</ul>
    <div className="account-security__delete"><span><b>Xóa tài khoản</b><small>Tài khoản sẽ được ẩn danh và các phiên đăng nhập bị thu hồi.</small></span><button type="button" className="btn btn--outline btn--sm" disabled={busy} onClick={() => void removeAccount()}>Xóa tài khoản</button></div>
  </section>;
}
