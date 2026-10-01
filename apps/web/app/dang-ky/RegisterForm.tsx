'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cx } from '@/lib/format';
import { IconArrowRight, IconCheck } from '@/components/ui/Icons';
import { apiRequest, apiMessage } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';
import type { AuthResponse, OtpSentResponse, Program } from '@viecpro/shared';
import InfoStep, { type RegisterInfo } from './InfoStep';
import OtpStep from './OtpStep';

const STEPS = ['Thông tin', 'Xác thực', 'Hoàn tất'];

/** Form đăng ký 3 bước: nhập thông tin → xác thực OTP → hoàn tất */
export default function RegisterForm() {
  const { acceptSession } = useAuth();
  const [step, setStep] = useState(0);
  const [info, setInfo] = useState<RegisterInfo | null>(null);
  const [otp, setOtp] = useState<OtpSentResponse | null>(null);
  const [formError, setFormError] = useState('');

  const startRegistration = async (data: RegisterInfo) => {
    const input = data.role === 'seeker'
      ? { role: data.role, name: data.name, phone: data.phone, password: data.password, birthYear: Number(data.birthYear), gender: data.gender, programs: data.programs as Program[] }
      : { role: data.role, name: data.name, phone: data.phone, password: data.password, company: data.company };
    const sent = await apiRequest<OtpSentResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) });
    setInfo(data);
    setOtp(sent);
    setFormError('');
    setStep(1);
  };

  const verifyRegistration = async (code: string) => {
    if (!info) return;
    const session = await apiRequest<AuthResponse>('/auth/register/verify', {
      method: 'POST',
      body: JSON.stringify({ phone: info.phone, code, platform: 'web' }),
    });
    acceptSession(session);
    setStep(2);
  };

  return (
    <div className="auth-form auth-form--wide">
      <ol className="reg-steps" aria-label="Các bước đăng ký">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={cx('reg-steps__item', i === step && 'reg-steps__item--active', i < step && 'reg-steps__item--done')}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="reg-steps__num">{i < step ? <IconCheck size={14} className="icon--w3" /> : i + 1}</span>
            <span className="reg-steps__label">{label}</span>
            {i < STEPS.length - 1 && <span className="reg-steps__line" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <InfoStep
          initial={info}
          onNext={startRegistration}
        />
      )}

      {formError && <p className="auth-field__error" role="alert">{formError}</p>}
      {step === 1 && info && otp && (
        <OtpStep
          phone={info.phone}
          resendAfter={otp.resendAfter}
          onBack={() => setStep(0)}
          onVerified={verifyRegistration}
          onResend={async () => {
            try {
              const sent = await apiRequest<OtpSentResponse>('/auth/otp', {
                method: 'POST', body: JSON.stringify({ phone: info.phone, purpose: 'register' }),
              });
              setOtp(sent);
              return sent.resendAfter;
            } catch (error) {
              setFormError(apiMessage(error));
              return 60;
            }
          }}
          onError={(error) => setFormError(apiMessage(error))}
        />
      )}

      {step === 2 && info && (
        <div className="reg-done">
          <span className="reg-done__icon">
            <IconCheck size={36} className="icon--w3" />
          </span>
          <h1 className="auth-form__title">Đăng ký thành công!</h1>
          <p className="auth-form__lead reg-done__lead">
            Chào <b>{info.name}</b>, tài khoản {info.role === 'seeker' ? 'người tìm việc' : 'nhà tuyển dụng'} của bạn đã sẵn sàng.
            {info.role === 'seeker'
              ? ' viecpro sẽ gửi đơn hàng phù hợp qua Zalo cho bạn.'
              : ' Bạn có thể bắt đầu đăng đơn hàng và nhận hồ sơ ứng viên.'}
          </p>
          <div className="reg-done__actions">
            <Link href="/tim-kiem" className="btn btn--primary btn--block auth-submit">
              {info.role === 'seeker' ? 'Khám phá việc làm' : 'Xem đơn hàng trên viecpro'}
              <IconArrowRight size={18} className="icon--w22" />
            </Link>
            <Link href="/" className="btn btn--block auth-social">
              Về trang chủ
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
