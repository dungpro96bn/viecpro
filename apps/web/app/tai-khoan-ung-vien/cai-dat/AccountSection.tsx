'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { formatVnPhone, PASSWORD_RULES, type EmailOtpSentResponse, type OtpSentResponse, type SeekerSettings, type SessionItem } from '@viecpro/shared';
import OtpInput from '@/components/apply/OtpInput';
import { IconCheck, IconLock, IconShieldCheck } from '@/components/ui/Icons';
import { ApiClientError, apiMessage, apiRequest } from '@/lib/api';
import { cx } from '@/lib/format';
import { daysAgo } from '@/lib/seeker';
import SettingsCard, { SettingRow } from './SettingsCard';

type Editing = 'email' | 'phone' | 'password' | null;

const PLATFORM_LABEL = { web: 'Trình duyệt web', ios: 'iPhone', android: 'Điện thoại Android' } as const;

/** Thẻ "Tài khoản & đăng nhập": email, số điện thoại, mật khẩu · Xem thêm: Google, thiết bị đăng nhập */
export default function AccountSection({ settings, onChange }: { settings: SeekerSettings; onChange: (s: SeekerSettings) => void }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState('');
  const a = settings.account;

  const done = (message: string, next?: SeekerSettings) => {
    if (next) onChange(next);
    setEditing(null);
    setNotice(message);
  };
  const open = (field: Editing) => {
    setNotice('');
    setEditing((cur) => (cur === field ? null : field));
  };
  const verified = (ok: boolean) => (
    <span className={cx('st-badge', ok ? 'st-badge--ok' : 'st-badge--warn')}>
      {ok && <IconCheck size={12} className="icon--w3" />}
      {ok ? 'Đã xác thực' : 'Chưa xác thực'}
    </span>
  );

  return (
    <SettingsCard id="tai-khoan" icon={IconLock} tone="blue" title="Tài khoản & đăng nhập" desc="Thông tin đăng nhập và bảo mật" moreLabel="Xem thêm: Google, thiết bị đăng nhập" more={<DevicesMore googleLinked={a.googleLinked} />}>
      {notice && (
        <p className="st-notice" role="status">
          {notice}
        </p>
      )}
      <SettingRow
        label="Email"
        desc={a.email ?? 'Chưa có email'}
        control={
          <>
            {a.email && verified(a.emailVerified)}
            <button type="button" className="st-btn" aria-expanded={editing === 'email'} onClick={() => open('email')}>
              {a.email ? 'Đổi' : 'Thêm'}
            </button>
          </>
        }
      >
        {editing === 'email' && <EmailChange onDone={(s) => done('Đã cập nhật email đăng nhập.', s)} onCancel={() => setEditing(null)} />}
      </SettingRow>
      <SettingRow
        label="Số điện thoại"
        desc={a.phone ? formatVnPhone(a.phone) : 'Chưa có số điện thoại'}
        control={
          <>
            {a.phone && verified(a.phoneVerified)}
            <button type="button" className="st-btn" aria-expanded={editing === 'phone'} onClick={() => open('phone')}>
              Đổi
            </button>
          </>
        }
      >
        {editing === 'phone' && <PhoneChange needPassword={a.hasPassword} onDone={(s) => done('Đã cập nhật số điện thoại.', s)} onCancel={() => setEditing(null)} />}
      </SettingRow>
      <SettingRow
        label="Mật khẩu"
        desc={!a.hasPassword ? 'Đăng nhập bằng Google – chưa đặt mật khẩu' : a.passwordChangedAt ? `Đổi lần cuối ${daysAgo(a.passwordChangedAt)}` : 'Chưa đổi kể từ khi tạo tài khoản'}
        control={
          a.hasPassword && (
            <button type="button" className="st-btn" aria-expanded={editing === 'password'} onClick={() => open('password')}>
              Đổi mật khẩu
            </button>
          )
        }
      >
        {editing === 'password' && (
          <PasswordChange
            onDone={() => {
              // Lần đổi gần nhất = bây giờ
              onChange({ ...settings, account: { ...a, passwordChangedAt: new Date().toISOString() } });
              done('Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.');
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </SettingRow>
    </SettingsCard>
  );
}

/** Đổi email: nhập email mới → mã 6 số gửi tới email đó */
function EmailChange({ onDone, onCancel }: { onDone: (s: SeekerSettings) => void; onCancel: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<EmailOtpSentResponse | null>(null);
  return (
    <CodeFlow
      sent={sent ? `Đã gửi mã tới ${sent.email}` : null}
      devCode={sent?.devCode}
      onCancel={onCancel}
      fields={(errors) => (
        <label className="st-form__field">
          Email mới
          <input className={cx('field-input', errors.email && 'st-form__input--invalid')} type="email" autoComplete="email" value={email} aria-invalid={!!errors.email} onChange={(e) => setEmail(e.target.value)} />
          {errors.email && <span className="st-form__error">{errors.email}</span>}
        </label>
      )}
      request={async () => setSent(await apiRequest<EmailOtpSentResponse>('/me/email/otp', { method: 'POST', body: JSON.stringify({ email }) }))}
      confirm={async (code) => onDone(await apiRequest<SeekerSettings>('/me/email', { method: 'POST', body: JSON.stringify({ email, code }) }))}
      validate={(): Record<string, string> => (/^\S+@\S+\.\S+$/.test(email.trim()) ? {} : { email: 'Email chưa đúng định dạng' })}
    />
  );
}

/** Đổi số điện thoại: số mới (+ mật khẩu hiện tại) → OTP SMS gửi tới số mới */
function PhoneChange({ needPassword, onDone, onCancel }: { needPassword: boolean; onDone: (s: SeekerSettings) => void; onCancel: () => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState<OtpSentResponse | null>(null);
  return (
    <CodeFlow
      sent={sent ? `Đã gửi mã SMS tới ${formatVnPhone(sent.phone)}` : null}
      devCode={sent?.devCode}
      onCancel={onCancel}
      fields={(errors) => (
        <>
          <label className="st-form__field">
            Số điện thoại mới
            <input className={cx('field-input', errors.phone && 'st-form__input--invalid')} type="tel" inputMode="tel" autoComplete="tel" value={phone} aria-invalid={!!errors.phone} onChange={(e) => setPhone(e.target.value)} />
            {errors.phone && <span className="st-form__error">{errors.phone}</span>}
          </label>
          {needPassword && (
            <label className="st-form__field">
              Mật khẩu hiện tại
              <input className={cx('field-input', errors.currentPassword && 'st-form__input--invalid')} type="password" autoComplete="current-password" value={password} aria-invalid={!!errors.currentPassword} onChange={(e) => setPassword(e.target.value)} />
              {errors.currentPassword && <span className="st-form__error">{errors.currentPassword}</span>}
            </label>
          )}
        </>
      )}
      request={async () => setSent(await apiRequest<OtpSentResponse>('/me/phone/otp', { method: 'POST', body: JSON.stringify({ phone, ...(needPassword && { currentPassword: password }) }) }))}
      confirm={async (code) => onDone(await apiRequest<SeekerSettings>('/me/phone', { method: 'POST', body: JSON.stringify({ phone, code }) }))}
      validate={() => ({
        ...(phone.replace(/\D/g, '').length < 9 && { phone: 'Số điện thoại chưa đúng' }),
        ...(needPassword && !password && { currentPassword: 'Nhập mật khẩu hiện tại' }),
      })}
    />
  );
}

interface CodeFlowProps {
  fields: (errors: Record<string, string>) => ReactNode;
  validate: () => Record<string, string>;
  request: () => Promise<void>;
  confirm: (code: string) => Promise<void>;
  /** Có giá trị = đã gửi mã, chuyển sang bước nhập mã */
  sent: string | null;
  devCode?: string;
  onCancel: () => void;
}

/** Luồng 2 bước dùng chung: nhập thông tin mới → nhập mã 6 số (có gửi lại sau 60 giây) */
function CodeFlow({ fields, validate, request, confirm, sent, devCode, onCancel }: CodeFlowProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) setErrors(e.fields);
      setError(apiMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const send = (event?: FormEvent) => {
    event?.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;
    void act(async () => {
      await request();
      setWait(60);
      setCode('');
    });
  };
  const submitCode = (value: string) => {
    if (value.length !== 6) return setError('Nhập đủ 6 số');
    void act(() => confirm(value));
  };

  if (!sent) {
    return (
      <form className="st-form" noValidate onSubmit={send}>
        <div className="st-form__grid">{fields(errors)}</div>
        {error && !Object.keys(errors).length && (
          <p className="st-form__error" role="alert">
            {error}
          </p>
        )}
        <div className="st-form__actions">
          <button type="button" className="btn btn--outline btn--sm" onClick={onCancel}>
            Huỷ
          </button>
          <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
            {busy ? 'Đang gửi…' : 'Gửi mã xác nhận'}
          </button>
        </div>
      </form>
    );
  }
  return (
    <form
      className="st-form st-otp"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submitCode(code);
      }}
    >
      <p className="st-form__hint">
        {sent}. Mã có hiệu lực 5 phút.
        {devCode && <b> Mã thử (dev): {devCode}</b>}
      </p>
      <OtpInput value={code} onChange={setCode} onComplete={submitCode} invalid={!!error} describedBy={error ? 'st-otp-error' : undefined} />
      {error && (
        <p id="st-otp-error" className="st-form__error" role="alert">
          {error}
        </p>
      )}
      <div className="st-form__actions">
        <button type="button" className="st-link" disabled={wait > 0 || busy} onClick={() => send()}>
          {wait > 0 ? `Gửi lại sau ${wait}s` : 'Gửi lại mã'}
        </button>
        <span className="st-form__spacer" />
        <button type="button" className="btn btn--outline btn--sm" onClick={onCancel}>
          Huỷ
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
          {busy ? 'Đang xác nhận…' : 'Xác nhận'}
        </button>
      </div>
    </form>
  );
}

/** Đổi mật khẩu – quy tắc độ mạnh lấy từ PASSWORD_RULES (dùng chung với API) */
function PasswordChange({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const v: Record<string, string> = {};
    if (!current) v.currentPassword = 'Nhập mật khẩu hiện tại';
    if (!PASSWORD_RULES.every((r) => r.test(next))) v.newPassword = 'Mật khẩu mới chưa đủ điều kiện';
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await apiRequest<void>('/me/password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      onDone();
    } catch (e) {
      setErrors(e instanceof ApiClientError && e.fields ? e.fields : { newPassword: apiMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="st-form" noValidate onSubmit={(e) => void submit(e)}>
      <div className="st-form__grid">
        <label className="st-form__field">
          Mật khẩu hiện tại
          <input className={cx('field-input', errors.currentPassword && 'st-form__input--invalid')} type="password" autoComplete="current-password" value={current} aria-invalid={!!errors.currentPassword} onChange={(e) => { setCurrent(e.target.value); setErrors((x) => ({ ...x, currentPassword: '' })); }} />
          {errors.currentPassword && <span className="st-form__error">{errors.currentPassword}</span>}
        </label>
        <label className="st-form__field">
          Mật khẩu mới
          <input className={cx('field-input', errors.newPassword && 'st-form__input--invalid')} type="password" autoComplete="new-password" value={next} aria-invalid={!!errors.newPassword} onChange={(e) => { setNext(e.target.value); setErrors((x) => ({ ...x, newPassword: '' })); }} />
          {errors.newPassword && <span className="st-form__error">{errors.newPassword}</span>}
        </label>
      </div>
      <ul className="st-rules" aria-label="Điều kiện mật khẩu">
        {PASSWORD_RULES.map((r) => (
          <li key={r.key} className={cx(r.test(next) && 'st-rules__ok')}>
            <IconCheck size={12} className="icon--w3" />
            {r.label}
          </li>
        ))}
      </ul>
      <div className="st-form__actions">
        <span className="st-form__spacer" />
        <button type="button" className="btn btn--outline btn--sm" onClick={onCancel}>
          Huỷ
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </button>
      </div>
    </form>
  );
}

/** Xem thêm: Google + thiết bị đang đăng nhập (đăng xuất từng thiết bị / tất cả thiết bị khác) */
function DevicesMore({ googleLinked }: { googleLinked: boolean }) {
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [error, setError] = useState('');

  const load = () =>
    apiRequest<SessionItem[]>('/me/sessions')
      .then(setSessions)
      .catch(() => setError('Không tải được danh sách thiết bị.'));
  useEffect(() => {
    void load();
  }, []);

  const revoke = async (id: string) => {
    try {
      await apiRequest<void>(`/me/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSessions((s) => s?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      setError(apiMessage(e));
    }
  };
  const revokeOthers = async () => {
    if (!window.confirm('Đăng xuất khỏi mọi thiết bị khác?')) return;
    try {
      await apiRequest<{ revoked: number }>('/me/sessions', { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(apiMessage(e));
    }
  };
  const others = sessions?.filter((s) => !s.current).length ?? 0;

  return (
    <>
      <SettingRow
        label="Google"
        desc={googleLinked ? 'Đã liên kết – đăng nhập nhanh bằng tài khoản Google' : 'Chưa liên kết. Đăng nhập bằng Google với cùng email để liên kết.'}
        control={googleLinked ? <span className="st-badge st-badge--ok"><IconShieldCheck size={12} />Đã liên kết</span> : undefined}
      />
      <SettingRow
        label="Thiết bị đang đăng nhập"
        desc={sessions ? `${sessions.length} thiết bị` : 'Đang tải…'}
        control={
          others > 0 && (
            <button type="button" className="st-btn" onClick={() => void revokeOthers()}>
              Đăng xuất tất cả thiết bị khác
            </button>
          )
        }
      >
        {error && <p className="st-form__error" role="alert">{error}</p>}
        {sessions && (
          <ul className="st-devices">
            {sessions.map((s) => (
              <li key={s.id}>
                <span>
                  <b>{s.deviceName ?? PLATFORM_LABEL[s.platform]}</b>
                  <small>{s.current ? 'Thiết bị này' : `Hoạt động ${new Date(s.lastUsedAt).toLocaleString('vi-VN')}`}</small>
                </span>
                {!s.current && (
                  <button type="button" className="st-link" onClick={() => void revoke(s.id)}>
                    Đăng xuất
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SettingRow>
    </>
  );
}
