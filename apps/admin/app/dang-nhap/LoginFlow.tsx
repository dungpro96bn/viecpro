'use client';

import type { AdminLoginResult } from '@viecpro/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { IconArrowRight, IconCopy } from '@/components/ui/Icons';
import { ApiRequestError, publicPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Done = Extract<AdminLoginResult, { step: 'done' }>;
type Step =
  | { name: 'credentials' }
  | { name: 'mfa'; challengeToken: string }
  | { name: 'mfa_setup'; challengeToken: string; secret: string; qr: string }
  | { name: 'recovery'; result: Done };

/** Chỉ chuyển hướng trong nội bộ trang admin (chặn open redirect) */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/dang-nhap') ? next : '/';
}

const errorMessage = (e: unknown) => (e instanceof ApiRequestError ? e.message : 'Không kết nối được máy chủ, vui lòng thử lại');

export default function LoginFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, notice, complete } = useAuth();
  const [step, setStep] = useState<Step>({ name: 'credentials' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const next = safeNext(params.get('next'));

  // Đã đăng nhập (phiên còn) → vào thẳng trang quản trị
  useEffect(() => {
    if (status === 'signed-in' && step.name !== 'recovery') router.replace(next);
  }, [status, step.name, router, next]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const finish = (result: AdminLoginResult) => {
    if (result.step !== 'done') return;
    if (result.recoveryCodes?.length) {
      setStep({ name: 'recovery', result });
      return;
    }
    complete(result);
    router.replace(next);
  };

  const submitCredentials = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const result = await publicPost<AdminLoginResult>('/auth/admin/login', { email, password });
      setPassword('');
      setCode('');
      if (result.step === 'mfa') setStep({ name: 'mfa', challengeToken: result.challengeToken });
      else if (result.step === 'mfa_setup') {
        const qr = await QRCode.toDataURL(result.otpauthUrl, { margin: 1, width: 184 });
        setStep({ name: 'mfa_setup', challengeToken: result.challengeToken, secret: result.secret, qr });
      } else finish(result);
    });
  };

  const submitMfa = (e: FormEvent) => {
    e.preventDefault();
    if (step.name !== 'mfa' && step.name !== 'mfa_setup') return;
    const challengeToken = step.challengeToken;
    void run(async () => {
      const result =
        step.name === 'mfa_setup'
          ? await publicPost<AdminLoginResult>('/auth/admin/mfa/setup', { challengeToken, code })
          : await publicPost<AdminLoginResult>('/auth/admin/mfa', useRecovery ? { challengeToken, recoveryCode: code } : { challengeToken, code });
      finish(result);
    });
  };

  const backToStart = () => {
    setStep({ name: 'credentials' });
    setCode('');
    setError(null);
    setUseRecovery(false);
  };

  if (step.name === 'recovery') {
    const codes = step.result.recoveryCodes ?? [];
    return (
      <div className="login-card">
        <div className="login-card__head">
          <h2 className="login-card__title">Lưu mã khôi phục</h2>
          <p className="login-card__lead">Dùng một trong các mã dưới đây để đăng nhập khi mất điện thoại. Mỗi mã chỉ dùng được một lần và sẽ <b>không hiện lại</b>.</p>
        </div>
        <ol className="recovery-codes">
          {codes.map((c) => (
            <li key={c} className="recovery-codes__item">
              {c}
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="btn btn--outline btn--lg btn--block"
          onClick={() =>
            void navigator.clipboard.writeText(codes.join('\n')).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
          }
        >
          <IconCopy size={16} />
          {copied ? 'Đã sao chép' : 'Sao chép tất cả'}
        </button>
        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          onClick={() => {
            complete(step.result);
            router.replace(next);
          }}
        >
          Tôi đã lưu mã, vào trang quản trị
        </button>
      </div>
    );
  }

  if (step.name === 'mfa' || step.name === 'mfa_setup') {
    const setup = step.name === 'mfa_setup';
    return (
      <form className="login-card" onSubmit={submitMfa}>
        <div className="login-card__head">
          <h2 className="login-card__title">{setup ? 'Bật xác thực 2 lớp' : 'Xác thực 2 lớp'}</h2>
          <p className="login-card__lead">
            {setup
              ? 'Quét mã QR bằng Google Authenticator, Authy hoặc 1Password, rồi nhập mã 6 số hiển thị trong ứng dụng.'
              : useRecovery
                ? 'Nhập một mã khôi phục bạn đã lưu khi bật 2FA.'
                : 'Mở ứng dụng xác thực trên điện thoại và nhập mã 6 số.'}
          </p>
        </div>

        {setup && (
          <div className="mfa-setup">
            <img className="mfa-setup__qr" src={step.qr} alt="Mã QR để thêm tài khoản vào ứng dụng xác thực" width={184} height={184} />
            <div className="mfa-setup__manual">
              <span className="field__hint">Không quét được? Nhập khoá thủ công:</span>
              <code className="mfa-setup__secret">{step.secret.match(/.{1,4}/g)?.join(' ')}</code>
            </div>
          </div>
        )}

        {error && (
          <p className="alert alert--danger" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span className="field__label">{useRecovery ? 'Mã khôi phục' : 'Mã xác thực'}</span>
          <input
            className="field__input login-card__code"
            value={code}
            onChange={(e) => setCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode={useRecovery ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            placeholder={useRecovery ? 'XXXXX-XXXXX' : '000000'}
            autoFocus
            required
          />
        </label>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy || (!useRecovery && code.length !== 6)}>
          {busy ? <span className="spinner" /> : setup ? 'Bật 2FA và đăng nhập' : 'Xác nhận'}
        </button>

        <div className="login-card__links">
          {!setup && (
            <button
              type="button"
              className="login-card__link"
              onClick={() => {
                setUseRecovery((v) => !v);
                setCode('');
                setError(null);
              }}
            >
              {useRecovery ? 'Dùng mã từ ứng dụng xác thực' : 'Mất điện thoại? Dùng mã khôi phục'}
            </button>
          )}
          <button type="button" className="login-card__link login-card__link--muted" onClick={backToStart}>
            Đăng nhập tài khoản khác
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="login-card" onSubmit={submitCredentials}>
      <div className="login-card__head">
        <h2 className="login-card__title">Đăng nhập quản trị</h2>
        <p className="login-card__lead">Dùng email công việc được cấp. Tài khoản người dùng thường không đăng nhập được tại đây.</p>
      </div>

      {notice && !error && <p className="alert alert--info">{notice}</p>}
      {error && (
        <p className="alert alert--danger" role="alert">
          {error}
        </p>
      )}

      <label className="field">
        <span className="field__label">Email</span>
        <input className="field__input" type="email" autoComplete="username" placeholder="ten@viecpro.vn" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </label>
      <label className="field">
        <span className="field__label">Mật khẩu</span>
        <input className="field__input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>

      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
        {busy ? <span className="spinner" /> : 'Tiếp tục'}
        {!busy && <IconArrowRight size={16} className="icon--w22" />}
      </button>
      <p className="login-card__note">Quên mật khẩu? Liên hệ Super Admin để được cấp lại.</p>
    </form>
  );
}
