'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { PASSWORD_RULES, type OtpSentResponse } from '@viecpro/shared';
import PasswordInput from '@/components/auth/PasswordInput';
import { apiRequest, apiMessage } from '@/lib/api';
import { IconArrowRight, IconArrowLeft } from '@/components/ui/Icons';

export default function ResetPasswordForm() {
  const [step, setStep] = useState<0 | 1>(0);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const sendCode = async () => {
    setError('');
    setBusy(true);
    try {
      const sent = await apiRequest<OtpSentResponse>('/auth/otp', {
        method: 'POST', body: JSON.stringify({ phone, purpose: 'reset_password' }),
      });
      setSeconds(sent.resendAfter);
      setStep(1);
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (step === 0) {
      if (phone.replace(/\D/g, '').replace(/^84/, '').replace(/^0/, '').length !== 9) {
        setError('Vui lòng nhập số điện thoại Việt Nam hợp lệ.');
        return;
      }
      await sendCode();
      return;
    }
    if (!/^\d{6}$/.test(code)) return setError('Mã xác thực gồm 6 chữ số.');
    if (!PASSWORD_RULES.every((rule) => rule.test(password))) return setError('Mật khẩu chưa đáp ứng đủ điều kiện.');
    if (password !== confirmation) return setError('Mật khẩu xác nhận chưa trùng khớp.');
    setBusy(true);
    try {
      await apiRequest<void>('/auth/password/reset', {
        method: 'POST', body: JSON.stringify({ phone, code, password }),
      });
      setSuccess(true);
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (seconds > 0 || busy) return;
    await sendCode();
  };

  return (
    <form className="auth-form auth-form--wide reset-form" noValidate onSubmit={submit}>
      <div className="auth-form__head">
        <h1 className="auth-form__title">{success ? 'Đã đổi mật khẩu' : 'Khôi phục mật khẩu'}</h1>
        <p className="auth-form__lead">
          {success ? 'Mật khẩu mới đã được lưu. Hãy đăng nhập lại để tiếp tục.' : step === 0 ? 'Nhập số điện thoại đã đăng ký để nhận mã xác thực.' : 'Nhập mã OTP và tạo mật khẩu mới cho tài khoản.'}
        </p>
      </div>

      {success ? (
        <Link href="/dang-nhap" className="btn btn--primary btn--block auth-submit">Đến trang đăng nhập<IconArrowRight size={18} /></Link>
      ) : (
        <div className="auth-form__fields">
          <label className="auth-field">
            <span className="auth-field__label">Số điện thoại</span>
            <span className="auth-input">
              <input className="auth-input__control" type="tel" inputMode="tel" autoComplete="tel" placeholder="0912 345 678" value={phone} disabled={step === 1} onChange={(event) => setPhone(event.target.value)} />
            </span>
          </label>
          {step === 1 && <>
            <label className="auth-field">
              <span className="auth-field__label">Mã xác thực</span>
              <span className="auth-input"><input className="auth-input__control" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Nhập 6 chữ số" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></span>
              <span className="reset-form__resend">
                {seconds > 0 ? `Gửi lại mã sau ${seconds} giây` : <button type="button" onClick={() => void resend()} disabled={busy}>Gửi lại mã</button>}
              </span>
            </label>
            <label className="auth-field">
              <span className="auth-field__label">Mật khẩu mới</span>
              <PasswordInput name="new-password" autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label className="auth-field">
              <span className="auth-field__label">Nhập lại mật khẩu</span>
              <PasswordInput name="confirm-password" autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </label>
          </>}
          {error && <p className="auth-field__error" role="alert">{error}</p>}
          <button type="submit" className="btn btn--primary btn--block auth-submit" disabled={busy}>
            {busy ? 'Đang xử lý…' : step === 0 ? 'Gửi mã xác thực' : 'Đặt lại mật khẩu'}
            <IconArrowRight size={18} className="icon--w22" />
          </button>
          {step === 1 && <button type="button" className="reset-form__back" onClick={() => { setStep(0); setError(''); }}><IconArrowLeft size={16} />Đổi số điện thoại</button>}
        </div>
      )}
    </form>
  );
}
