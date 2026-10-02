'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { PASSWORD_RULES, type MemberInvitePreview, type OtpSentResponse } from '@viecpro/shared';
import PasswordInput from '@/components/auth/PasswordInput';
import { IconArrowRight, IconBuilding, IconCheck } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import { cx } from '@/lib/format';
import OtpStep from '../../dang-ky/OtpStep';

type Step = 'loading' | 'invalid' | 'password' | 'otp' | 'done';

/** Nhận lời mời: xem lời mời → đặt mật khẩu → mã OTP gửi tới số được mời → tạo tài khoản trong doanh nghiệp */
export default function AcceptInvite({ token }: { token: string }) {
  const [step, setStep] = useState<Step>('loading');
  const [invite, setInvite] = useState<MemberInvitePreview | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [resendAfter, setResendAfter] = useState(60);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const base = `/invites/${encodeURIComponent(token)}`;

  useEffect(() => {
    apiRequest<MemberInvitePreview>(base)
      .then((data) => {
        setInvite(data);
        setStep('password');
      })
      .catch((e) => {
        setError(apiMessage(e, 'Lời mời không còn hiệu lực.'));
        setStep('invalid');
      });
  }, [base]);

  const rulesOk = PASSWORD_RULES.every((r) => r.test(password));
  const mismatch = confirm.length > 0 && confirm !== password;

  const sendOtp = async () => {
    const sent = await apiRequest<OtpSentResponse>(`${base}/otp`, { method: 'POST' });
    return sent.resendAfter;
  };

  const toOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!rulesOk || confirm !== password || busy) return;
    setBusy(true);
    setError('');
    try {
      setResendAfter(await sendOtp());
      setStep('otp');
    } catch (err) {
      setError(apiMessage(err, 'Không gửi được mã xác thực.'));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'loading') return <div className="auth-form invite-loading" aria-busy="true" />;

  if (step === 'invalid' || !invite) {
    return (
      <div className="auth-form">
        <div className="auth-form__head">
          <h1 className="auth-form__title">Lời mời không còn hiệu lực</h1>
          <p className="auth-form__lead">{error || 'Link có thể đã hết hạn, đã được dùng hoặc đã bị huỷ.'} Hãy nhờ người mời gửi lại lời mời mới.</p>
        </div>
        <Link href="/dang-nhap" className="btn btn--primary btn--block auth-submit">
          Về trang đăng nhập
        </Link>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="auth-form">
        <span className="invite-done">
          <IconCheck size={28} />
        </span>
        <div className="auth-form__head">
          <h1 className="auth-form__title">Chào mừng bạn đến {invite.companyName}</h1>
          <p className="auth-form__lead">Tài khoản đã được tạo. Đăng nhập bằng số điện thoại được mời và mật khẩu vừa đặt để vào khu quản lý tuyển dụng.</p>
        </div>
        <Link href="/dang-nhap" className="btn btn--primary btn--block auth-submit">
          Đăng nhập
          <IconArrowRight size={18} className="icon--w22" />
        </Link>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="auth-form">
        {error && (
          <p className="auth-field__error" role="alert">
            {error}
          </p>
        )}
        <OtpStep
          phone=""
          phoneLabel={invite.phoneMasked}
          backLabel="Quay lại"
          resendAfter={resendAfter}
          onBack={() => {
            setError('');
            setStep('password');
          }}
          onResend={sendOtp}
          onError={(err) => setError(apiMessage(err, 'Mã xác thực không đúng.'))}
          onVerified={async (code) => {
            setError('');
            await apiRequest<{ phone: string }>(`${base}/accept`, { method: 'POST', body: JSON.stringify({ code, password }) });
            setStep('done');
          }}
        />
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={(e) => void toOtp(e)}>
      <div className="invite-card">
        <span className="invite-card__logo">{invite.companyLogoUrl ? <img src={invite.companyLogoUrl} alt="" /> : <IconBuilding size={24} />}</span>
        <span>
          <b>{invite.companyName}</b>
          <small>{invite.inviterName} mời bạn tham gia</small>
        </span>
      </div>
      <div className="auth-form__head">
        <h1 className="auth-form__title">Chào {invite.name}</h1>
        <p className="auth-form__lead">
          Bạn được mời làm <b>{invite.title}</b>. Đặt mật khẩu, sau đó nhập mã gửi tới số <b>{invite.phoneMasked}</b> để tạo tài khoản.
        </p>
      </div>
      <div className="auth-form__fields">
        <label className="auth-field">
          <span className="auth-field__label">Mật khẩu</span>
          <PasswordInput name="password" autoComplete="new-password" placeholder="Tạo mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <ul className="invite-rules" aria-label="Yêu cầu mật khẩu">
          {PASSWORD_RULES.map((r) => (
            <li key={r.key} className={cx(r.test(password) && 'invite-rules__ok')}>
              <IconCheck size={13} />
              {r.label}
            </li>
          ))}
        </ul>
        <label className="auth-field">
          <span className="auth-field__label">Nhập lại mật khẩu</span>
          <PasswordInput name="confirm" autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={confirm} invalid={mismatch} onChange={(e) => setConfirm(e.target.value)} />
          {mismatch && <span className="auth-field__error">Mật khẩu nhập lại không khớp</span>}
        </label>
      </div>
      {error && (
        <p className="auth-field__error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block auth-submit" disabled={!rulesOk || confirm !== password || busy}>
        {busy ? 'Đang gửi mã…' : 'Gửi mã xác thực'}
        <IconArrowRight size={18} className="icon--w22" />
      </button>
      <p className="auth-field__hint">Lời mời hết hạn ngày {new Date(invite.expiresAt).toLocaleDateString('vi-VN')}.</p>
    </form>
  );
}
