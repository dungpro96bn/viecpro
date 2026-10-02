'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { IconArrowLeft, IconArrowRight, IconChat } from '@/components/ui/Icons';

const LENGTH = 6;
const RESEND_AFTER = 60;

/** 912345678 → "+84 912 345 678" */
function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').replace(/^0/, '');
  return `+84 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`.trim();
}

interface OtpStepProps {
  phone: string;
  /** Hiển thị thay cho số đã định dạng (vd. số đã che "0911 xxx 333" ở trang nhận lời mời) */
  phoneLabel?: string;
  /** Nhãn nút quay lại (mặc định "Quay lại sửa thông tin") */
  backLabel?: string;
  resendAfter: number;
  onBack: () => void;
  onVerified: (code: string) => Promise<void>;
  onResend: () => Promise<number>;
  onError: (error: unknown) => void;
}

/** Bước 2: nhập mã OTP 6 số gửi qua Zalo / SMS */
export default function OtpStep({ phone, phoneLabel, backLabel = 'Quay lại sửa thông tin', resendAfter, onBack, onVerified, onResend, onError }: OtpStepProps) {
  const [code, setCode] = useState<string[]>(Array(LENGTH).fill(''));
  const [seconds, setSeconds] = useState(resendAfter || RESEND_AFTER);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const fill = (start: number, digits: string) => {
    const next = [...code];
    digits
      .slice(0, LENGTH - start)
      .split('')
      .forEach((d, i) => (next[start + i] = d));
    setCode(next);
    inputs.current[Math.min(start + digits.length, LENGTH - 1)]?.focus();
  };

  const onChange = (i: number, value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      const next = [...code];
      next[i] = '';
      setCode(next);
      return;
    }
    fill(i, digits);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fill(i, e.clipboardData.getData('text').replace(/\D/g, ''));
  };

  const complete = code.every(Boolean);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!complete || submitting) return;
    setSubmitting(true);
    try {
      await onVerified(code.join(''));
    } catch (error) {
      onError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (seconds > 0 || resending) return;
    setResending(true);
    try {
      setSeconds(await onResend());
      setCode(Array(LENGTH).fill(''));
      inputs.current[0]?.focus();
    } catch (error) {
      onError(error);
    } finally {
      setResending(false);
    }
  };

  return (
    <form className="reg-otp" onSubmit={onSubmit}>
      <span className="reg-otp__icon">
        <IconChat size={26} className="icon--w2" />
      </span>
      <div className="auth-form__head">
        <h1 className="auth-form__title reg-form__title">Xác thực số điện thoại</h1>
        <p className="auth-form__lead">
          Nhập mã gồm {LENGTH} chữ số viecpro vừa gửi qua Zalo / SMS tới <b className="reg-otp__phone">{phoneLabel ?? formatPhone(phone)}</b>.{' '}
          {!phoneLabel && (
            <button type="button" className="reg-otp__link" onClick={onBack}>
              Đổi số
            </button>
          )}
        </p>
      </div>

      <div className="reg-otp__inputs" role="group" aria-label="Mã xác thực">
        {code.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            className="reg-otp__input"
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={LENGTH}
            aria-label={`Chữ số ${i + 1}`}
            value={d}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={(e) => onPaste(i, e)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>

      <p className="reg-otp__resend">
        Chưa nhận được mã?{' '}
        {seconds > 0 ? (
          <span>
            Gửi lại sau <b className="reg-otp__timer">{seconds}s</b>
          </span>
        ) : (
          <button type="button" className="reg-otp__link" onClick={() => void resend()} disabled={resending}>
            {resending ? 'Đang gửi…' : 'Gửi lại mã'}
          </button>
        )}
      </p>

      <button type="submit" className="btn btn--primary btn--block auth-submit" disabled={!complete || submitting}>
        {submitting ? 'Đang xác thực…' : 'Xác nhận'}
        <IconArrowRight size={18} className="icon--w22" />
      </button>

      <button type="button" className="reg-otp__back" onClick={onBack}>
        <IconArrowLeft size={16} className="icon--w2" />
        {backLabel}
      </button>
    </form>
  );
}
